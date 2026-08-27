const multer = require('multer');

// Memory storage engine keeps uploaded file in buffer (req.file.buffer)
// This is 100% serverless compatible and avoids write errors on Vercel read-only filesystems.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file && file.mimetype && file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

module.exports = upload;
