const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const FormData = require('form-data');

const PYTHON_AI_SERVICE_URL = process.env.PYTHON_AI_URL || 'http://localhost:8000/analyze';

async function callPythonAiService(filePath) {
  return new Promise((resolve, reject) => {
    try {
      const form = new FormData();
      form.append('file', fs.createReadStream(filePath), {
        filename: path.basename(filePath)
      });

      const req = http.request(PYTHON_AI_SERVICE_URL, {
        method: 'POST',
        headers: form.getHeaders()
      }, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (e) {
              reject(e);
            }
          } else {
            reject(new Error(`Python AI service returned status ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      form.pipe(req);
    } catch (err) {
      reject(err);
    }
  });
}

function fallbackAnalysis(filePath) {
  let imageHash = '';
  try {
    const fileBuffer = fs.readFileSync(filePath);
    imageHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
  } catch (e) { }

  return {
    analysis_id: crypto.randomUUID(),
    image_hash: imageHash,
    model: 'fallback_manual',
    is_civic_issue: false,
    category: 'Other Civic Issue',
    title: 'AI Analysis Unavailable',
    description: 'AI service unavailable. Please select category and fill complaint details manually.',
    priority: 'Medium',
    recommended_department: 'Public Works Department (PWD)',
    confidence: 0.0,
    detected_features: [],
    needs_manual_verification: true
  };
}

async function analyzeComplaintPhoto(filePath) {
  try {
    const aiResult = await callPythonAiService(filePath);
    return aiResult;
  } catch (err) {
    console.log('[NAGARSETU Backend] Python AI microservice error or unavailable:', err.message);
    return fallbackAnalysis(filePath);
  }
}

module.exports = {
  analyzeComplaintPhoto
};
