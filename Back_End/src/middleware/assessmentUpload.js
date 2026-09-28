const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { AppError } = require('./error');

// Ensure destination directory exists
const assessmentUploadDir = path.join(__dirname, '../../uploads/assessments');
if (!fs.existsSync(assessmentUploadDir)) {
  fs.mkdirSync(assessmentUploadDir, { recursive: true });
}

// Storage configuration with sanitized naming
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, assessmentUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1e9)}`;
    cb(null, `egsa_submission_${uniqueSuffix}${ext}`);
  },
});

// Forbidden dangerous executable extensions
const FORBIDDEN_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.bin', '.msi', '.com',
  '.vbs', '.ps1', '.scr', '.jar', '.apk', '.php', '.phtml',
  '.pl', '.py', '.cgi', '.action'
]);

// Allowed MIME types
const ALLOWED_MIME_TYPES = new Set([
  // Documents & Data
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/json',
  // Archives
  'application/zip',
  'application/x-zip-compressed',
  'application/x-tar',
  'application/gzip',
  // Images & Diagrams
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set([
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.txt', '.csv', '.json', '.zip', '.tar', '.gz',
  '.jpg', '.jpeg', '.png', '.webp',
]);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // 1. Immediately forbid dangerous executable extensions
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return cb(
      new AppError(
        'Executable and script files are strictly prohibited for academic submissions.',
        400
      ),
      false
    );
  }

  // 2. Validate MIME type & extension
  const isMimeAllowed = ALLOWED_MIME_TYPES.has(file.mimetype);
  const isExtAllowed = ALLOWED_EXTENSIONS.has(ext);

  if (isMimeAllowed && isExtAllowed) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Unsupported file format. Please upload approved project files (PDF, Word, Excel, PowerPoint, ZIP, CSV, TXT, or images).',
        400
      ),
      false
    );
  }
};

const assessmentUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB maximum file size
  },
});

module.exports = assessmentUpload;
