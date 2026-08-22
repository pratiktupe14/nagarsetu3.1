const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');
const { analyzeComplaintPhoto } = require('../services/aiService');
const https = require('https');

// Safely log GEMINI_API_KEY configuration status on module load
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log(`[NAGARSETU AI] GEMINI_API_KEY configured: ${Boolean(GEMINI_API_KEY)}`);

/**
 * Real Gemini Health Check Endpoint
 * GET /api/ai/health
 * Safely tests Gemini 3.6 Flash authentication with a simple text prompt.
 */
router.get('/health', async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_VISION_MODEL || 'gemini-3.6-flash';

  if (!key) {
    return res.status(500).json({
      configured: false,
      model,
      reachable: false,
      error: 'GEMINI_API_KEY is not configured in backend environment variables (.env).'
    });
  }

  let responded = false;
  const sendRes = (statusCode, data) => {
    if (responded) return;
    responded = true;
    return res.status(statusCode).json(data);
  };

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const payload = JSON.stringify({
      contents: [{ parts: [{ text: 'Return exactly the word OK.' }] }]
    });

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 15000
    };

    const healthReq = https.request(url, options, (healthRes) => {
      let data = '';
      healthRes.on('data', (chunk) => { data += chunk; });
      healthRes.on('end', () => {
        if (healthRes.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            const replyText = parsed.candidates?.[0]?.content?.parts?.[0]?.text || '';
            return sendRes(200, {
              configured: true,
              model,
              reachable: true,
              reply: replyText.trim(),
              error: null
            });
          } catch (e) {
            return sendRes(500, {
              configured: true,
              model,
              reachable: false,
              error: 'Failed to parse JSON response from Gemini API.'
            });
          }
        } else {
          return sendRes(healthRes.statusCode, {
            configured: true,
            model,
            reachable: false,
            error: `Gemini API returned status ${healthRes.statusCode}: ${data}`
          });
        }
      });
    });

    healthReq.on('error', (err) => {
      return sendRes(500, {
        configured: true,
        model,
        reachable: false,
        error: `Network error connecting to Gemini API: ${err.message}`
      });
    });

    healthReq.on('timeout', () => {
      healthReq.destroy(new Error('Timeout connecting to Gemini API (15s)'));
    });

    healthReq.write(payload);
    healthReq.end();
  } catch (err) {
    return sendRes(500, {
      configured: true,
      model,
      reachable: false,
      error: err.message
    });
  }
});

/**
 * Direct Image Vision Analysis Endpoint
 * POST /api/ai/analyze
 * Accepts uploaded photo file and returns Gemini 3.6 Flash structured classification
 */
router.post('/analyze', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No photo file provided in request (expected multipart file field "photo").'
      });
    }

    const fullPath = req.file.path;
    const aiAnalysis = await analyzeComplaintPhoto(fullPath);

    if (aiAnalysis.error) {
      return res.status(500).json({
        success: false,
        error: aiAnalysis.error,
        ai: aiAnalysis
      });
    }

    return res.json({
      success: true,
      photo_url: `/uploads/${req.file.filename}`,
      ai: aiAnalysis
    });
  } catch (err) {
    console.error('[NAGARSETU AI] Express analyze route error:', err);
    return res.status(500).json({
      success: false,
      error: `Failed to analyze photo: ${err.message}`
    });
  }
});

module.exports = router;
