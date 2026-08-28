const multer = require('multer');
const path = require('path');

// Allowed image MIME types and extensions
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];
const MAX_FILE_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE_BYTES, 10) || 10 * 1024 * 1024; // 10MB default

// Memory storage engine keeps uploaded file in buffer (req.file.buffer)
// This is 100% serverless compatible and avoids write errors on Vercel read-only filesystems.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (!file) {
    return cb(new Error('No file provided'), false);
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  const mimetype = (file.mimetype || '').toLowerCase();

  if (!ALLOWED_MIME_TYPES.includes(mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error('Only valid image files (.jpg, .jpeg, .png, .webp) are allowed!'), false);
  }

  cb(null, true);
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: MAX_FILE_SIZE }
});

/**
 * Binary Header (Magic Bytes) Verification Middleware
 * Validates actual binary content header of req.file.buffer to ensure non-executable image payload
 */
function validateUploadedImageMagicBytes(req, res, next) {
  if (!req.file || !req.file.buffer) {
    return next();
  }

  const buffer = req.file.buffer;
  if (buffer.length < 4) {
    return res.status(400).json({ error: 'Uploaded file payload is invalid or empty.' });
  }

  const hexHeader = buffer.slice(0, 12).toString('hex').toLowerCase();

  // Magic Bytes Check:
  // JPEG: Starts with ffd8ff
  // PNG: Starts with 89504e47
  // WebP: Starts with 52494646 (RIFF) and contains 57454250 (WEBP)
  const isJpeg = hexHeader.startsWith('ffd8ff');
  const isPng = hexHeader.startsWith('89504e47');
  const isWebp = hexHeader.startsWith('52494646') && buffer.slice(8, 12).toString('ascii') === 'WEBP';

  if (!isJpeg && !isPng && !isWebp) {
    return res.status(400).json({
      error: 'Invalid image format. Binary signature does not match a genuine JPEG, PNG, or WebP image.'
    });
  }

  next();
}

module.exports = {
  upload,
  validateUploadedImageMagicBytes
};
