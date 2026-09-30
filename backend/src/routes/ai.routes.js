const express = require('express');
const router = express.Router();
const { uploadSingleImage } = require('../middleware/upload');
const { analyzeComplaintPhoto } = require('../services/aiService');
const { authenticateToken } = require('../middleware/auth');

/**
 * Lightweight Gemini Health Check Endpoint
 * GET /api/ai/health
 * Returns status based strictly on environment configuration without external API calls
 */
router.get('/health', (req, res) => {
  const key = process.env.GEMINI_API_KEY;
  const geminiConfigured = Boolean(key && key.trim() !== '' && key !== 'your_gemini_api_key_here');
  return res.status(200).json({
    status: 'ok',
    geminiConfigured
  });
});

/**
 * Direct Image Vision Analysis Endpoint
 * POST /api/ai/analyze
 * Accepts uploaded photo file and returns Gemini 2.5 Flash structured classification
 */
router.post('/analyze', authenticateToken, uploadSingleImage('photo'), async (req, res) => {
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

    const photoUrl = req.file?.publicUrl || req.file?.supabaseUrl || (req.file?.filename ? `/uploads/${req.file.filename}` : undefined);
    if (photoUrl) {
      aiAnalysis.photo_url = photoUrl;
    }

    console.log(`[${reqTime}] [NAGARSETU AI] Success: model="${aiAnalysis.model}", category="${aiAnalysis.category}", department="${aiAnalysis.recommended_department}"`);
    return res.json({
      success: true,
      photo_url: photoUrl,
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
