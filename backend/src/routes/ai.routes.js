const express = require('express');
const router = express.Router();
const { uploadSingleImage } = require('../middleware/upload');
const { analyzeComplaintPhoto } = require('../services/aiService');
const https = require('https');

// Safely log GEMINI_API_KEY configuration status on module load (NEVER log the actual secret key)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log(`[NAGARSETU AI] Gemini API configured: ${Boolean(GEMINI_API_KEY)}`);

/**
 * Real Gemini Health Check Endpoint
 * GET /api/ai/health
 * Verifies API key, client initialization, reachability, and model gemini-3.6-flash
 */
router.get('/health', async (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_VISION_MODEL || 'gemini-3.6-flash';

  if (!key) {
    console.error('[NAGARSETU AI Health Check] Failed: GEMINI_API_KEY missing in environment.');
    return res.status(500).json({
      configured: false,
      model,
      reachable: false,
      error: 'GEMINI_API_KEY is not configured in backend environment variables.'
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
      contents: [{ parts: [{ text: 'Reply with exactly: NAGARSETU_GEMINI_OK' }] }]
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
            
            console.log(`[NAGARSETU AI Health Check] Success. Model: ${model}, Reply: ${replyText.trim()}`);
            return sendRes(200, {
              configured: true,
              model,
              reachable: true,
              reply: replyText.trim(),
              error: null
            });
          } catch (e) {
            console.error('[NAGARSETU AI Health Check] JSON parse error:', e.message);
            return sendRes(500, {
              configured: true,
              model,
              reachable: false,
              error: 'Failed to parse response from Gemini API'
            });
          }
        } else {
          let errorMsg = `Gemini API returned status ${healthRes.statusCode}`;
          if (healthRes.statusCode === 429) {
            errorMsg = 'Gemini API Quota Exceeded (HTTP 429). Please retry in 60 seconds.';
          } else if (healthRes.statusCode === 401) {
            errorMsg = 'Gemini API Authentication Failed (HTTP 401). Please check API configuration.';
          }
          console.error(`[NAGARSETU AI Health Check] Failed: ${errorMsg}`);
          return sendRes(healthRes.statusCode, {
            configured: true,
            model,
            reachable: false,
            error: errorMsg
          });
        }
      });
    });

    healthReq.on('error', (err) => {
      console.error('[NAGARSETU AI Health Check] Network error:', err.message);
      return sendRes(500, {
        configured: true,
        model,
        reachable: false,
        error: 'Network error connecting to Gemini API'
      });
    });

    healthReq.on('timeout', () => {
      healthReq.destroy(new Error('Timeout connecting to Gemini API (15s)'));
    });

    healthReq.write(payload);
    healthReq.end();
  } catch (err) {
    console.error('[NAGARSETU AI Health Check] Exception:', err.message);
    return sendRes(500, {
      configured: true,
      model,
      reachable: false,
      error: 'AI Health Check request failed.'
    });
  }
});

/**
 * Direct Image Vision Analysis Endpoint
 * POST /api/ai/analyze
 * Accepts uploaded photo file and returns Gemini 3.6 Flash structured classification
 */
router.post('/analyze', uploadSingleImage('photo'), async (req, res) => {
  const reqTime = new Date().toISOString();
  console.log(`[${reqTime}] [NAGARSETU AI] Request received: POST /api/ai/analyze`);

  try {
    if (!req.file || (!req.file.buffer && !req.file.path)) {
      console.error(`[${reqTime}] [NAGARSETU AI] Error: No photo file provided.`);
      return res.status(400).json({
        success: false,
        error: 'INVALID_IMAGE',
        message: 'No valid photo file provided in request (expected multipart file field "photo").'
      });
    }

    console.log(`[${reqTime}] [NAGARSETU AI] Image received: originalname="${req.file.originalname}", size=${req.file.size || req.file.buffer?.length} bytes, mimetype="${req.file.mimetype}"`);

    // Pass req.file (contains in-memory buffer or disk path) directly
    const aiAnalysis = await analyzeComplaintPhoto(req.file);

    if (aiAnalysis.success === false) {
      const statusCode = aiAnalysis.statusCode || 500;
      console.error(`[${reqTime}] [NAGARSETU AI] Vision analysis returned error status ${statusCode}:`, aiAnalysis.error || aiAnalysis.message);
      return res.status(statusCode).json({
        success: false,
        error: aiAnalysis.error || 'AI_SERVER_ERROR',
        message: 'AI Vision analysis is temporarily unavailable. Please try again.',
        retryable: aiAnalysis.retryable ?? true
      });
    }

    console.log(`[${reqTime}] [NAGARSETU AI] Success: model="${aiAnalysis.model}", category="${aiAnalysis.category}", department="${aiAnalysis.recommended_department}"`);
    return res.json({
      success: true,
      ai: aiAnalysis
    });
  } catch (err) {
    console.error(`[${reqTime}] [NAGARSETU AI] Express analyze route error:`, err.message);
    return res.status(500).json({
      success: false,
      error: 'AI_SERVER_ERROR',
      message: 'Failed to analyze photo. An internal processing error occurred.'
    });
  }
});

module.exports = router;
