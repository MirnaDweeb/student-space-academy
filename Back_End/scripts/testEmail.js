/**
 * EGSA Space Academy — Safe SMTP & Registration Email Diagnostic Utility
 *
 * Usage:
 *   node scripts/testEmail.js [optional-recipient@example.com]
 *
 * Example:
 *   node scripts/testEmail.js student@example.com
 */

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const {
  buildTransport,
  verifySmtpConnection,
  sendRegistrationConfirmationEmail,
} = require('../src/utils/email');

async function main() {
  console.log('===============================================================');
  console.log('  EGSA Space Academy — SMTP & Registration Email Diagnostic');
  console.log('===============================================================\n');

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || '587';
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS || process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || 'Egyptian Space Agency - Space Academy <no-reply@egsa-academy.example>';

  console.log('Current SMTP Configuration (.env):');
  console.log(`  - Host: ${host || '(not set)'}`);
  console.log(`  - Port: ${port}`);
  console.log(`  - User: ${user || '(not set)'}`);
  console.log(`  - Password: ${pass ? `[CONFIGURED (${pass.length} chars)]` : '[NOT SET]'}`);
  console.log(`  - From: ${from}\n`);

  const isPlaceholder = (
    !host ||
    host === 'smtp.example.com' ||
    !user ||
    user === 'user@example.com' ||
    !pass ||
    pass === 'changeme'
  );

  if (isPlaceholder) {
    console.log('[mail] SMTP configuration is using placeholder values in .env.');
    console.log('[mail] Real emails cannot be dispatched until real credentials are provided.\n');
    console.log('To configure Gmail SMTP with a secure App Password:');
    console.log('  1. Enable 2-Step Verification in your Google Account (myaccount.google.com).');
    console.log('  2. Go to Security -> 2-Step Verification -> App Passwords.');
    console.log('  3. Create an App Password for "Mail" (16 characters, e.g. "abcd efgh ijkl mnop").');
    console.log('  4. Update Back_End/.env:');
    console.log('       SMTP_HOST=smtp.gmail.com');
    console.log('       SMTP_PORT=587');
    console.log('       SMTP_USER=your-email@gmail.com');
    console.log('       SMTP_PASS=your-16-char-app-password');
    console.log('       SMTP_FROM="Egyptian Space Agency - Space Academy <your-email@gmail.com>"');
    console.log('\n  5. Run this test again:');
    console.log('       node scripts/testEmail.js your-email@gmail.com\n');
    process.exit(0);
  }

  // 1. Verify SMTP Connection
  console.log('1. Testing SMTP connection and handshake...');
  const verification = await verifySmtpConnection();
  if (!verification.verified) {
    console.error(`[mail] SMTP connection failed: ${verification.error}`);
    console.error('\nTroubleshooting tips for Gmail:');
    console.error('  - Verify that you are using a 16-character Gmail App Password, not your standard Gmail login password.');
    console.error('  - Ensure 2-Step Verification is active on the Google Account.');
    console.error('  - Ensure SMTP_PORT is 587 (with secure false) or 465 (with secure true).');
    process.exit(1);
  }

  console.log('✓ [mail] SMTP connection verified successfully.\n');

  // 2. Dispatch Test Email
  const recipient = process.argv[2] || process.env.TEST_EMAIL_RECIPIENT || user;
  console.log(`2. Dispatching official registration confirmation email to: ${recipient}...`);

  try {
    const result = await sendRegistrationConfirmationEmail({
      to: recipient,
      fullName: 'Test Space Cadet',
      email: recipient,
    });

    console.log(`\n✓ [mail] Registration confirmation sent successfully to ${recipient}`);
    if (result.messageId) {
      console.log(`  Message ID: ${result.messageId}`);
    }
    console.log('\nPlease check your inbox (and spam/junk folder) to verify real delivery.');
  } catch (sendErr) {
    console.error(`[mail] Failed to send email: ${sendErr.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[mail] Unexpected diagnostic failure:', err.message);
  process.exit(1);
});
