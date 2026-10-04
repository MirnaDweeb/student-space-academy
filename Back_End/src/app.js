require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const path = require('path');
const { notFound, errorHandler } = require('./middleware/error');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const goalRoutes = require('./routes/goalRoutes');
const learningPathRoutes = require('./routes/learningPathRoutes');
const courseRoutes = require('./routes/courseRoutes');
const readinessRoutes = require('./routes/readinessRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const bundleRoutes = require('./routes/bundleRoutes');
const adminRoutes = require('./routes/adminRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const evaluationRoutes = require('./routes/evaluationRoutes');
const dashboardController = require('./controllers/dashboardController');
const { protect } = require('./middleware/auth');

const secureUploadsHandler = require('./middleware/secureUploads');

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: process.env.CLIENT_URL || '*', credentials: true }));
app.use(
  express.json({
    limit: '25mb',
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ limit: '25mb', extended: true }));
app.use(morgan('dev'));

// Protected serving for uploaded institutional training media, certificates, and academic submissions
app.use('/uploads', secureUploadsHandler);

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use('/api', limiter);

app.get(['/api/health', '/api/v1/health'], (req, res) => res.json({ success: true, message: 'EGSA Academy API is running.' }));

app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/goals', goalRoutes);
app.use('/api/learning-paths', learningPathRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/readiness', readinessRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/certificates', certificateRoutes);
app.use('/api/bundles', bundleRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/assessments', assessmentRoutes);
app.use('/api/evaluations', evaluationRoutes);
app.get('/api/dashboard', protect, dashboardController.getDashboard);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
