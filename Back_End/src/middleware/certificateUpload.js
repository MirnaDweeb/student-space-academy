const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AppError } = require('./error');

// Ensure destination directory exists
const certUploadDir = path.join(__dirname, '../../uploads/certificates');
if (!fs.existsSync(certUploadDir)) {
  fs.mkdirSync(certUploadDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, certUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    cb(null, `egsa_cert_${uniqueSuffix}${ext}`);
  },
});

// File validation filter (PDF, PNG, JPG, JPEG, WEBP)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
  ];
  const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'];

  const ext = path.extname(file.originalname).toLowerCase();
  const isMimeValid = allowedMimeTypes.includes(file.mimetype);
  const isExtValid = allowedExtensions.includes(ext);

  if (isMimeValid && isExtValid) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Invalid certificate file format. Please upload an official certificate in PDF, PNG, or JPG format.',
        400
      ),
      false
    );
  }
};

// Max 15MB per certificate document
const certificateUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB
  },
});

module.exports = certificateUpload;
