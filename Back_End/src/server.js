require('dotenv').config();
const app = require('./app');
const connectDB = require('./config/db');
const { processExpiredInvoices } = require('./services/paymentService');
const { verifySmtpConnection, isSmtpConfigured } = require('./utils/email');
const { ensureDefaultReadinessQuestions } = require('./services/defaultReadinessInitService');

const PORT = process.env.PORT || 5000;

connectDB().then(async () => {
  await ensureDefaultReadinessQuestions();
  app.listen(PORT, async () => {
    console.log(`[SERVER] EGSA Space Academy API running on port ${PORT}`);

    // Section 6: SMTP Connection Verification at startup
    if (isSmtpConfigured()) {
      console.log('[mail] SMTP configuration detected');
      console.log('[mail] Verifying SMTP connection...');
      const smtpCheck = await verifySmtpConnection();
      if (smtpCheck.verified) {
        console.log('[mail] SMTP connection verified');
      } else {
        if (smtpCheck.isAuthFailure) {
          console.error('[mail] SMTP authentication failed');
        } else {
          console.error(`[mail] SMTP connection failed: ${smtpCheck.error}`);
        }
      }
    } else {
      console.log('[mail] SMTP configuration missing or using default placeholders in .env');
      console.log('[mail] Real confirmation emails will NOT be sent until SMTP_USER and SMTP_PASS are configured.');
    }

    // Run an initial sweep of expired reservations, then schedule every 10 minutes
    processExpiredInvoices().catch(err => console.error('[EXPIRY JOB] Startup run failed:', err.message));
    setInterval(() => {
      processExpiredInvoices().catch(err => console.error('[EXPIRY JOB] Scheduled run failed:', err.message));
    }, 10 * 60 * 1000).unref();
  });
});
