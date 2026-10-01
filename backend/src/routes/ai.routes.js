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
  let configuredKeyCount = 0;
  for (let i = 1; i <= 5; i++) {
    const k = process.env[`GEMINI_API_KEY_${i}`];
    if (k && k.trim() !== '' && k !== 'your_gemini_api_key_here' && !k.includes('placeholder')) {
      configuredKeyCount++;
    }
  }

  // Fallback to legacy single or comma-separated GEMINI_API_KEY if slot keys not set
  if (configuredKeyCount === 0 && process.env.GEMINI_API_KEY) {
    const raw = process.env.GEMINI_API_KEY.trim();
    if (raw && raw !== 'your_gemini_api_key_here' && !raw.includes('placeholder')) {
      if (raw.includes(',')) {
        configuredKeyCount = raw.split(',').map(s => s.trim()).filter(k => k && k !== 'your_gemini_api_key_here' && !k.includes('placeholder')).length;
      } else {
        configuredKeyCount = 1;
      }
    }
  }

  const aiConfigured = configuredKeyCount > 0;

  return res.status(200).json({
    status: 'ok',
    aiConfigured,
    geminiConfigured: aiConfigured,
    configured: aiConfigured,
    reachable: aiConfigured,
    configuredKeyCount,
    model: 'gemini-2.5-flash'
  });
});

/**
 * Direct Image Vision Analysis Endpoint
 * POST /api/ai/analyze
 * Accepts uploaded photo file and returns Gemini 2.5 Flash structured classification
 */
router.post('/analyze', (req, res, next) => {
  if (req.headers['authorization']) {
    return authenticateToken(req, res, next);
  }
  next();
}, uploadSingleImage('photo'), async (req, res) => {
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

    const fs = require('fs');
    let buffer = req.file.buffer;
    if (!buffer && req.file.path && fs.existsSync(req.file.path)) {
      buffer = fs.readFileSync(req.file.path);
    }

    if (!buffer || buffer.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_IMAGE',
        message: 'Uploaded photo file is empty or unreadable.'
      });
    }

    // Pass buffer + mimetype directly to aiService
    const aiAnalysis = await analyzeComplaintPhoto({
      buffer,
      mimetype: req.file.mimetype || 'image/jpeg',
      originalname: req.file.originalname || 'photo.jpg',
      size: buffer.length
    });

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

    // Attach 4-Quadrant Risk Matrix to AI classification
    try {
      const { calculateRiskAssessment, inferRiskScores } = require('../services/riskMatrixService');
      const inferred = inferRiskScores(aiAnalysis);
      const riskAssessment = calculateRiskAssessment({
        ...inferred,
        category: aiAnalysis.category,
        priority: aiAnalysis.priority || aiAnalysis.urgency,
        support_count: 1
      });
      aiAnalysis.risk_assessment = riskAssessment;
      aiAnalysis.safety_score = riskAssessment.safety_score;
      aiAnalysis.disruption_score = riskAssessment.disruption_score;
      aiAnalysis.health_environment_score = riskAssessment.health_environment_score;
      aiAnalysis.defect_severity_score = riskAssessment.defect_severity_score;
      aiAnalysis.risk_score = riskAssessment.risk_score;
      aiAnalysis.priority_rank = riskAssessment.priority_rank;
    } catch (riskErr) {
      console.warn('[NAGARSETU AI] Risk assessment computation note:', riskErr.message);
    }

    return res.json({
      success: true,
      photo_url: photoUrl,
      ai: aiAnalysis,
      category: aiAnalysis.category,
      title: aiAnalysis.title,
      description: aiAnalysis.description,
      priority: aiAnalysis.priority,
      department: aiAnalysis.department || aiAnalysis.recommended_department
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
