const multer = require('multer');

// Magic byte signature patterns for safe image formats
const MAGIC_BYTES = {
  jpeg: [0xFF, 0xD8, 0xFF],
  png:  [0x89, 0x50, 0x4E, 0x47],
  gif:  [0x47, 0x49, 0x46, 0x38],
  webp: [0x52, 0x49, 0x46, 0x46] // RIFF header
};

/**
 * Validates file buffer against known image magic byte signatures.
 * @param {Buffer} buffer 
 * @returns {boolean}
 */
function isValidImageMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return false;

  const isJpeg = MAGIC_BYTES.jpeg.every((byte, i) => buffer[i] === byte);
  const isPng  = MAGIC_BYTES.png.every((byte, i) => buffer[i] === byte);
  const isGif  = MAGIC_BYTES.gif.every((byte, i) => buffer[i] === byte);
  const isWebp = MAGIC_BYTES.webp.every((byte, i) => buffer[i] === byte);

  return isJpeg || isPng || isGif || isWebp;
}

// Memory storage engine keeps uploaded file in buffer (req.file.buffer)
const storage = multer.memoryStorage();

const maxMb = parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) || 10;

const fileFilter = (req, file, cb) => {
  if (file && file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only valid image files (JPEG, PNG, WEBP, GIF) are allowed!'), false);
  }
};

const multerUpload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: maxMb * 1024 * 1024 }
});

// Middleware wrapper that performs second-pass Magic Byte buffer verification
function uploadSingleImage(fieldName) {
  return (req, res, next) => {
    multerUpload.single(fieldName)(req, res, (err) => {
      if (err) {
        return next(err);
      }

      if (req.file) {
        if (!isValidImageMagicBytes(req.file.buffer)) {
          return res.status(400).json({
            error: 'Security Error: File content magic bytes do not match a valid image format. Upload rejected.'
          });
        }
      }

      next();
    });
  };
}

module.exports = {
  uploadSingleImage,
  multerUpload,
  isValidImageMagicBytes
};
