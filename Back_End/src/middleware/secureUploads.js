const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Media = require('../models/Media');
const Certificate = require('../models/Certificate');
const StudentSubmission = require('../models/StudentSubmission');

/**
 * Extracts and verifies JWT from Bearer header or token query parameter.
 */
async function authenticateRequest(req) {
  let token = null;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded || !decoded.id) return null;
    const user = await User.findById(decoded.id).select('-password');
    return user || null;
  } catch (_) {
    return null;
  }
}

/**
 * Middleware guarding access to sensitive files stored in /uploads
 */
async function secureUploadsHandler(req, res, next) {
  try {
    const rawPath = req.path; // e.g. /media/xxx.jpg or /certificates/xxx.pdf
    const normalizedPath = path.normalize(rawPath).replace(/^(\.\.[\/\\])+/, '');
    const segments = normalizedPath.split(/[\\/]/).filter(Boolean);

    if (segments.length === 0) {
      return res.status(403).json({ success: false, message: 'Forbidden access.' });
    }

    const category = segments[0]; // 'media', 'certificates', 'assessments', etc.
    const filename = segments[segments.length - 1];
    const fullDiskPath = path.join(__dirname, '../../uploads', ...segments);

    if (!fs.existsSync(fullDiskPath)) {
      return res.status(404).json({ success: false, message: 'Requested file not found on server.' });
    }

    // 1. Media handling (training photos, student projects, workshop documentation)
    if (category === 'media') {
      return res.sendFile(fullDiskPath);
    }

    // 2. Certificates handling
    if (category === 'certificates') {
      const certDoc = await Certificate.findOne({ fileUrl: { $regex: filename } });
      const user = await authenticateRequest(req);

      // Allow if verification token matches or if verified staff / owner
      const reqToken = req.query && (req.query.verifyToken || req.query.token);
      if (certDoc && reqToken && certDoc.verificationToken === reqToken && certDoc.status === 'Issued') {
        return res.sendFile(fullDiskPath);
      }

      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required to view official certificate records.' });
      }

      const isStaff = ['admin', 'superadmin', 'instructor'].includes(user.role);
      const isOwner = certDoc && String(certDoc.student) === String(user._id);

      if (isStaff || isOwner) {
        return res.sendFile(fullDiskPath);
      }

      return res.status(403).json({ success: false, message: 'Access denied: unauthorized certificate access.' });
    }

    // 3. Assessments handling
    if (category === 'assessments') {
      const user = await authenticateRequest(req);
      if (!user) {
        return res.status(401).json({ success: false, message: 'Authentication required to access assessment materials and student submissions.' });
      }

      const isStaff = ['instructor', 'admin', 'superadmin'].includes(user.role);
      if (isStaff) {
        return res.sendFile(fullDiskPath);
      }

      const submission = await StudentSubmission.findOne({ 'file.fileName': filename });
      if (submission && String(submission.student) === String(user._id)) {
        return res.sendFile(fullDiskPath);
      }

      return res.status(403).json({ success: false, message: 'Access denied to this academic assessment file.' });
    }

    // 4. Any other category (e.g. disputes, general)
    const user = await authenticateRequest(req);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }
    if (['admin', 'superadmin'].includes(user.role)) {
      return res.sendFile(fullDiskPath);
    }

    return res.status(403).json({ success: false, message: 'Access denied.' });
  } catch (err) {
    next(err);
  }
}

module.exports = secureUploadsHandler;
