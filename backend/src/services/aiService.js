const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const VALID_TAXONOMY = {
  'Road Damage / Pothole': 'Public Works Department',
  'Water Leakage / Pipeline': 'Water Supply & Sewerage Board',
  'Garbage / Waste': 'Sanitation & Waste Management',
  'Drainage / Sewage': 'Drainage & Sewage Department',
  'Streetlight / Electrical': 'Electrical & Street Lighting',
  'Traffic Infrastructure': 'Traffic Management Department',
  'Public Infrastructure Damage': 'Maintenance Department',
  'Other Civic Issue': 'Maintenance Department',
  'Building Maintenance': 'Maintenance Department'
};


const SYSTEM_PROMPT = `You are NAGARSETU 3.0's civic issue vision analyzer.

Analyze ONLY the actual image provided.

Do not infer the issue from the filename.
Do not reuse previous analysis.
Do not assume every image is a road issue.

Determine the physical civic issue visible in the image.

Allowed categories:

Road Damage / Pothole
Water Leakage / Pipeline
Garbage / Waste
Drainage / Sewage
Streetlight / Electrical
Traffic Infrastructure
Public Infrastructure Damage
Other Civic Issue

If the image visibly shows a leaking or damaged water pipeline, flowing water from municipal water infrastructure, or a water-line failure, classify it as:

Water Leakage / Pipeline

If the image visibly shows potholes, pavement cracks, road craters, damaged asphalt, or road-surface deterioration, classify it as:

Road Damage / Pothole

If garbage or waste is visible:

Garbage / Waste

If blocked/open drainage or sewage overflow is visible:

Drainage / Sewage

If a broken streetlight/electrical civic infrastructure is visible:

Streetlight / Electrical

If a traffic signal or traffic infrastructure issue is visible:

Traffic Infrastructure

If evidence is insufficient:

Other Civic Issue

Do not invent visual information.

Respond ONLY with a valid JSON object matching this exact structure:
{
  "category": "One of: Road Damage / Pothole, Water Leakage / Pipeline, Garbage / Waste, Drainage / Sewage, Streetlight / Electrical, Traffic Infrastructure, Public Infrastructure Damage, Other Civic Issue",
  "title": "Short descriptive title of the defect",
  "description": "Factual description based strictly on visible evidence.",
  "priority": "LOW or MEDIUM or HIGH or CRITICAL",
  "severity": "LOW or MEDIUM or HIGH or CRITICAL",
  "recommended_department": "Corresponding department name from taxonomy",
  "confidence": 0.94,
  "detected_features": ["list", "of", "features"],
  "is_civic_issue": true,
  "needs_manual_verification": false
}`;

function mapDepartment(category) {
  return VALID_TAXONOMY[category] || 'Public Works Department';
}

async function callDirectGeminiVision(fileInput, targetModel = null) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = targetModel || process.env.GEMINI_VISION_MODEL || 'gemini-3.6-flash';

  console.log(`[GEMINI] Request started`);
  console.log(`[GEMINI] API key configured: ${Boolean(apiKey && apiKey.trim() !== '')}`);
  console.log(`[GEMINI] Target Model: ${model}`);

  if (!apiKey || apiKey.trim() === '' || apiKey === 'your_gemini_api_key_here') {
    console.error('[GEMINI ERROR] GEMINI_API_KEY is missing or unconfigured in environment.');
    const errObj = new Error('Gemini analysis failed: GEMINI_API_KEY is not configured in server environment.');
    errObj.statusCode = 503;
    errObj.errorCode = 'AI_SERVICE_UNCONFIGURED';
    throw errObj;
  }

  let fileBuffer;
  let mimeType = 'image/jpeg';
  let originalName = 'uploaded-photo.jpg';

  if (Buffer.isBuffer(fileInput)) {
    fileBuffer = fileInput;
  } else if (fileInput && typeof fileInput === 'object' && Buffer.isBuffer(fileInput.buffer)) {
    fileBuffer = fileInput.buffer;
    if (fileInput.mimetype) mimeType = fileInput.mimetype;
    if (fileInput.originalname) originalName = fileInput.originalname;
  } else if (typeof fileInput === 'string') {
    if (!fs.existsSync(fileInput)) {
      const errObj = new Error(`Gemini analysis failed: Image file not found at ${fileInput}`);
      errObj.statusCode = 400;
      errObj.errorCode = 'INVALID_IMAGE';
      throw errObj;
    }
    fileBuffer = fs.readFileSync(fileInput);
    const ext = path.extname(fileInput).toLowerCase();
    if (ext === '.png') mimeType = 'image/png';
    if (ext === '.webp') mimeType = 'image/webp';
    originalName = path.basename(fileInput);
  } else {
    const errObj = new Error('Gemini analysis failed: Invalid image payload provided.');
    errObj.statusCode = 400;
    errObj.errorCode = 'INVALID_IMAGE';
    throw errObj;
  }

  if (!fileBuffer || fileBuffer.length === 0) {
    const errObj = new Error('Gemini analysis failed: Image payload is empty (0 bytes).');
    errObj.statusCode = 400;
    errObj.errorCode = 'INVALID_IMAGE';
    throw errObj;
  }

  const base64Image = fileBuffer.toString('base64');
  const imageHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const analysisId = crypto.randomUUID();

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const payload = JSON.stringify({
    contents: [
      {
        parts: [
          { text: SYSTEM_PROMPT },
          {
            inline_data: {
              mime_type: mimeType,
              data: base64Image
            }
          }
        ]
      }
    ],
    generationConfig: {
      response_mime_type: 'application/json',
      temperature: 0.1
    }
  });

  return new Promise((resolve, reject) => {
    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 30000
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            const rawText = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!rawText) throw new Error('Empty response payload from Gemini model.');

            let cleanText = rawText.trim();
            if (cleanText.startsWith('```')) {
              cleanText = cleanText.replace(/^```(json)?\s*/i, '').replace(/\s*```$/, '').trim();
            }

            const resultObj = JSON.parse(cleanText);
            const category = (resultObj.category && Object.prototype.hasOwnProperty.call(VALID_TAXONOMY, resultObj.category))
              ? resultObj.category
              : 'Other Civic Issue';
            const department = mapDepartment(category);
            const confidence = typeof resultObj.confidence === 'number' ? resultObj.confidence : 0.92;

            resolve({
              success: true,
              analysis_id: analysisId,
              image_hash: imageHash,
              model: model,
              is_civic_issue: resultObj.is_civic_issue ?? true,
              category: category,
              title: resultObj.title || `${category} Defect`,
              description: resultObj.description || 'Vision AI identified civic issue based on visual evidence.',
              severity: (resultObj.severity || 'HIGH').toUpperCase(),
              priority: (resultObj.priority || 'High').charAt(0).toUpperCase() + (resultObj.priority || 'High').slice(1).toLowerCase(),
              recommended_department: department,
              confidence: confidence,
              detected_features: resultObj.detected_features || [],
              needs_manual_verification: resultObj.needs_manual_verification ?? (confidence < 0.80)
            });
          } catch (e) {
            const errObj = new Error(`Structured JSON parse error: ${e.message}`);
            errObj.statusCode = 422;
            errObj.errorCode = 'AI_PARSE_ERROR';
            reject(errObj);
          }
        } else {
          let errorCode = 'AI_SERVER_ERROR';
          let errorReason = `Gemini API returned status ${res.statusCode}`;

          if (res.statusCode === 429) {
            errorCode = 'AI_QUOTA_EXCEEDED';
            errorReason = 'AI Vision temporarily unavailable because the AI service quota has been reached.';
          } else if (res.statusCode === 401) {
            errorCode = 'AI_AUTHENTICATION_ERROR';
            errorReason = 'Gemini API Authentication Failed (HTTP 401). Please check GEMINI_API_KEY.';
          } else if (res.statusCode === 403) {
            errorCode = 'AI_PERMISSION_ERROR';
            errorReason = 'Gemini API Permission Denied (HTTP 403).';
          } else if (res.statusCode === 404) {
            errorCode = 'AI_MODEL_NOT_FOUND';
            errorReason = 'Configured Gemini Model Not Found (HTTP 404).';
          } else if (res.statusCode === 400) {
            errorCode = 'AI_INVALID_PAYLOAD';
            errorReason = 'Invalid Image Payload or Request (HTTP 400 Bad Request).';
          }

          const errObj = new Error(errorReason);
          errObj.statusCode = res.statusCode;
          errObj.errorCode = errorCode;
          reject(errObj);
        }
      });
    });

    req.on('error', (err) => {
      const errObj = new Error(`Network transport error: ${err.message}`);
      errObj.statusCode = 500;
      errObj.errorCode = 'AI_NETWORK_ERROR';
      reject(errObj);
    });

    req.on('timeout', () => {
      req.destroy();
      const errObj = new Error('API connection timeout (30s)');
      errObj.statusCode = 504;
      errObj.errorCode = 'AI_TIMEOUT';
      reject(errObj);
    });

    req.write(payload);
    req.end();
  });
}

async function analyzeComplaintPhoto(fileInput) {
  let imageHash = '';
  try {
    let buf;
    if (Buffer.isBuffer(fileInput)) buf = fileInput;
    else if (fileInput && fileInput.buffer) buf = fileInput.buffer;
    else if (typeof fileInput === 'string' && fs.existsSync(fileInput)) buf = fs.readFileSync(fileInput);
    if (buf) imageHash = crypto.createHash('sha256').update(buf).digest('hex');
  } catch (e) {}

  try {
    const aiResult = await callDirectGeminiVision(fileInput);
    return aiResult;
  } catch (err) {
    if (err.statusCode === 404 || err.errorCode === 'AI_MODEL_NOT_FOUND') {
      try {
        console.log('[NAGARSETU Backend AI] Primary model 404, attempting fallback model gemini-3.5-flash...');
        const fallbackResult = await callDirectGeminiVision(fileInput, 'gemini-3.5-flash');
        return fallbackResult;
      } catch (fbErr) {
        err = fbErr;
      }
    }
    console.error('[NAGARSETU Backend Error]', err.message);
    return {
      success: false,
      statusCode: err.statusCode || 500,
      error: err.errorCode || 'AI_SERVER_ERROR',
      message: err.message || 'Gemini Vision AI Analysis failed.',
      retryable: (err.statusCode === 429 || err.statusCode === 504 || err.statusCode === 500),
      analysis_id: crypto.randomUUID(),
      image_hash: imageHash,
      model: 'none',
      is_civic_issue: false,
      category: 'Other Civic Issue',
      title: '', // Keep title clean
      description: '', // Keep description clean
      priority: 'Medium',
      recommended_department: 'Public Works Department',
      confidence: 0.0,
      detected_features: [],
      needs_manual_verification: true
    };
  }
}

module.exports = {
  analyzeComplaintPhoto
};
