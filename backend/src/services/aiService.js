const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');

const VALID_TAXONOMY = {
  'Road Damage / Pothole': 'Roads & Public Works Department (PWD)',
  'Water Leakage / Pipeline': 'Water Supply & Sewerage Board',
  'Garbage / Waste': 'Sanitation & Solid Waste Management',
  'Drainage / Sewage': 'Drainage & Sewerage Department',
  'Streetlight / Electrical': 'Electrical & Public Lighting Department',
  'Traffic Infrastructure': 'Traffic Engineering & Control Department',
  'Public Infrastructure Damage': 'Roads & Public Works Department (PWD)',
  'Other Civic Issue': 'Roads & Public Works Department (PWD)'
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
  return VALID_TAXONOMY[category] || 'Roads & Public Works Department (PWD)';
}

async function callDirectGeminiVision(filePath) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_VISION_MODEL || 'gemini-3.6-flash';

  if (!apiKey) {
    throw new Error('Gemini analysis failed: status: 401 reason: GEMINI_API_KEY missing in server environment');
  }

  if (!fs.existsSync(filePath)) {
    throw new Error(`Gemini analysis failed: status: 400 reason: Image file not found at ${filePath}`);
  }

  const stats = fs.statSync(filePath);
  if (stats.size === 0) {
    throw new Error('Gemini analysis failed: status: 400 reason: Image file size is 0 bytes');
  }

  const fileBuffer = fs.readFileSync(filePath);
  const base64Image = fileBuffer.toString('base64');
  const imageHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  const analysisId = crypto.randomUUID();

  const ext = path.extname(filePath).toLowerCase();
  let mimeType = 'image/jpeg';
  if (ext === '.png') mimeType = 'image/png';
  if (ext === '.webp') mimeType = 'image/webp';

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
            reject(new Error(`Gemini analysis failed: status: 422 reason: Structured JSON parse error: ${e.message}`));
          }
        } else {
          let errorReason = `API error response: ${data}`;
          if (res.statusCode === 429) {
            errorReason = 'Gemini API Rate Limit / Quota Exceeded (HTTP 429 RESOURCE_EXHAUSTED). Free tier limit reached. Please retry in 30s.';
          } else if (res.statusCode === 401) {
            errorReason = 'Gemini API Authentication Failed (HTTP 401 Unauthorized). Please check GEMINI_API_KEY.';
          } else if (res.statusCode === 400) {
            errorReason = 'Invalid Image Payload or Request (HTTP 400 Bad Request).';
          }
          reject(new Error(`Gemini analysis failed: status: ${res.statusCode} reason: ${errorReason}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Gemini analysis failed: status: 500 reason: Network transport error: ${err.message}`));
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Gemini analysis failed: status: 504 reason: API connection timeout (30s)'));
    });

    req.write(payload);
    req.end();
  });
}

async function analyzeComplaintPhoto(filePath) {
  let imageHash = '';
  try {
    const fileBuffer = fs.readFileSync(filePath);
    imageHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  } catch (e) {}

  try {
    const aiResult = await callDirectGeminiVision(filePath);
    return aiResult;
  } catch (err) {
    console.error('[NAGARSETU Backend Error]', err.message);
    return {
      analysis_id: crypto.randomUUID(),
      image_hash: imageHash,
      model: 'none',
      is_civic_issue: false,
      category: 'Other Civic Issue',
      title: 'AI Analysis Failed',
      description: err.message,
      priority: 'Medium',
      recommended_department: 'Public Works Department (PWD)',
      confidence: 0.0,
      detected_features: [],
      needs_manual_verification: true,
      error: err.message
    };
  }
}

module.exports = {
  analyzeComplaintPhoto
};
