const nodemailer = require('nodemailer');

function isSmtpConfigured() {
  const host = (process.env.SMTP_HOST || '').trim();
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').trim();

  if (!host || host === 'smtp.example.com' || host === 'localhost') return false;
  if (!user || user === 'user@example.com') return false;
  if (!pass || pass === 'changeme') return false;
  return true;
}

function buildTransport() {
  if (!isSmtpConfigured()) return null;

  const host = (process.env.SMTP_HOST || '').trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = (process.env.SMTP_USER || '').trim();
  const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').trim();
  const isSecure = port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure: isSecure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
}

async function verifySmtpConnection() {
  if (!isSmtpConfigured()) {
    const host = (process.env.SMTP_HOST || '').trim();
    const user = (process.env.SMTP_USER || '').trim();
    const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || '').trim();
    const reasons = [];
    if (!host || host === 'smtp.example.com') reasons.push('SMTP_HOST is missing or placeholder (smtp.example.com)');
    if (!user || user === 'user@example.com') reasons.push('SMTP_USER is missing or placeholder (user@example.com)');
    if (!pass || pass === 'changeme') reasons.push('SMTP_PASS is missing or placeholder (changeme)');

    return {
      configured: false,
      verified: false,
      message: `SMTP not configured in .env: ${reasons.join(', ')}`,
      error: reasons.join(', '),
    };
  }

  const transport = buildTransport();
  if (!transport) {
    return {
      configured: false,
      verified: false,
      message: 'Failed to create SMTP transporter.',
      error: 'Transporter creation failed',
    };
  }

  try {
    await transport.verify();
    return {
      configured: true,
      verified: true,
      message: 'SMTP connection verified successfully.',
    };
  } catch (err) {
    const isAuth = err.code === 'EAUTH' || err.responseCode === 535 || (err.message && err.message.includes('Username and Password'));
    return {
      configured: true,
      verified: false,
      isAuthFailure: isAuth,
      error: isAuth ? 'SMTP authentication failed (invalid credentials)' : (err.message || 'SMTP connection failed'),
    };
  }
}

function getBaseTemplate({ titleEn, titleAr, contentHtml, actionUrl, actionTextEn, actionTextAr }) {
  return `
<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titleEn}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F8FAFB; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #14232C; }
    .container { max-width: 600px; margin: 40px auto; background: #FFFFFF; border-radius: 12px; overflow: hidden; border: 1px solid #DDE4E8; box-shadow: 0 4px 16px rgba(14, 26, 34, 0.05); }
    .header { background: #0B192C; padding: 32px 24px; text-align: center; border-bottom: 3px solid #1E7C85; }
    .logo-badge { display: inline-block; padding: 6px 14px; background: rgba(30, 124, 133, 0.25); border: 1px solid #1E7C85; border-radius: 20px; color: #D4B87C; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 12px; }
    .header h1 { margin: 0; color: #FFFFFF; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 6px 0 0; color: #8799A5; font-size: 13px; }
    .body { padding: 36px 32px; line-height: 1.6; }
    .arabic-block { text-align: right; direction: rtl; font-family: 'Cairo', Tahoma, sans-serif; background: #F1F5F7; padding: 16px 20px; border-radius: 8px; border-right: 4px solid #1E7C85; margin-bottom: 24px; }
    .btn-wrap { text-align: center; margin: 32px 0; }
    .btn { display: inline-block; background: #1E7C85; color: #FFFFFF !important; font-weight: 600; font-size: 15px; padding: 14px 32px; border-radius: 8px; text-decoration: none; box-shadow: 0 4px 12px rgba(30, 124, 133, 0.3); }
    .btn:hover { background: #166067; }
    .fallback { font-size: 12px; color: #5A6D78; word-break: break-all; background: #FAFBFB; padding: 12px; border-radius: 6px; border: 1px dashed #CBD5E1; }
    .footer { background: #FAFBFB; padding: 24px 32px; text-align: center; border-top: 1px solid #EDF2F4; font-size: 12px; color: #8799A5; line-height: 1.5; }
    .footer-seal { font-weight: 600; color: #3A6985; margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '')}/assets/logo.png" alt="EGSA Logo" width="60" height="60" style="display:block;margin:0 auto 10px;border:0;outline:none;object-fit:contain;" onerror="this.style.display='none'" />
      <div class="logo-badge">Egyptian Space Agency</div>
      <h1>EGSA Space Academy</h1>
      <p>Smart Training & Space Capabilities Platform</p>
    </div>
    <div class="body">
      <div class="arabic-block">
        <h3 style="margin: 0 0 8px; color: #0E1A22; font-size: 17px;">${titleAr}</h3>
        <p style="margin: 0; color: #334155; font-size: 14px;">وكالة الفضاء المصرية — منصة إدارة التدريب والتأهيل الفضائي</p>
      </div>

      ${contentHtml}

      ${actionUrl ? `
        <div class="btn-wrap">
          <a href="${actionUrl}" class="btn" target="_blank">${actionTextEn} | ${actionTextAr}</a>
        </div>
        <p style="font-size: 13px; color: #5A6D78; margin-top: 24px;">If the button does not work, copy and paste the following link into your browser:</p>
        <div class="fallback">${actionUrl}</div>
      ` : ''}
    </div>
    <div class="footer">
      <div class="footer-seal">Egyptian Space Agency (EGSA) — وكالة الفضاء المصرية</div>
      <p style="margin: 4px 0 0;">This is an automated institutional message from the Space Academy. If you did not request this action, please safely disregard this email.</p>
    </div>
  </div>
</body>
</html>
  `;
}

async function sendEmail({ to, subject, html, text }) {
  const user = (process.env.SMTP_USER || '').trim();
  const configuredFrom = (process.env.SMTP_FROM || '').trim();
  const from = configuredFrom || (user ? `Egyptian Space Agency - Space Academy <${user}>` : 'Egyptian Space Agency - Space Academy <no-reply@egsa-academy.example>');

  if (!isSmtpConfigured()) {
    console.log(`[mail] Cannot send email to ${to}: SMTP not configured or using default placeholders in .env`);
    return {
      success: false,
      simulated: true,
      reason: 'SMTP configuration is missing or using placeholder values in .env',
    };
  }

  const transport = buildTransport();
  if (!transport) {
    console.log(`[mail] Cannot send email to ${to}: Transporter build failed`);
    return {
      success: false,
      reason: 'Failed to initialize SMTP transporter',
    };
  }

  try {
    const info = await transport.sendMail({
      from,
      to,
      subject,
      html,
      text,
    });
    console.log(`[mail] Message accepted, id: ${info.messageId}`);
    return {
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    };
  } catch (err) {
    const isAuth = err.code === 'EAUTH' || err.responseCode === 535 || (err.message && err.message.includes('Username and Password'));
    const sanitizedError = isAuth ? 'SMTP authentication failed' : (err.message || 'SMTP transmission error');
    console.error(`[mail] Failed to send email to ${to}: ${sanitizedError}`);
    throw new Error(sanitizedError);
  }
}

/**
 * Sends institutional email verification link (Email 1)
 */
async function sendVerificationEmail({ to, fullName, verificationUrl }) {
  const titleEn = 'Verify Your Email Address — EGSA Space Academy';
  const titleAr = 'تأكيد البريد الإلكتروني — أكاديمية الفضاء المصرية';

  const contentHtml = `
    <p>Dear <strong>${fullName || 'Space Cadet'}</strong>,</p>
    <p>Thank you for registering at the <strong>EGSA Space Academy</strong>. To activate your account and access training programs, please verify your email address by clicking the button below.</p>
    <div style="direction: rtl; text-align: right; margin-top: 24px; padding-top: 18px; border-top: 1px solid #EDF2F4; color: #334155; font-size: 14px; font-family: 'Cairo', Tahoma, sans-serif;">
      <p>عزيزي/عزيزتي <strong>${fullName || ''}</strong>،</p>
      <p>شكراً لتسجيلك في <strong>أكاديمية الفضاء المصرية</strong>. لتفعيل حسابك والبدء في استكشاف البرامج التدريبية، يُرجى تأكيد بريدك الإلكتروني عبر الرابط أدناه.</p>
    </div>
  `;

  const html = getBaseTemplate({
    titleEn,
    titleAr,
    contentHtml,
    actionUrl: verificationUrl,
    actionTextEn: 'Verify Email Address',
    actionTextAr: 'تأكيد البريد الإلكتروني',
  });

  return sendEmail({
    to,
    subject: 'EGSA Space Academy — Verify Your Email | تأكيد البريد الإلكتروني',
    html,
    text: `Dear ${fullName}, please verify your EGSA Space Academy account by visiting: ${verificationUrl}`,
  });
}

/**
 * Sends institutional password reset link
 */
async function sendPasswordResetEmail({ to, fullName, resetUrl }) {
  const titleEn = 'Password Reset Request — EGSA Space Academy';
  const titleAr = 'طلب إعادة تعيين كلمة المرور — أكاديمية الفضاء المصرية';

  const contentHtml = `
    <p>Dear <strong>${fullName || 'Space Cadet'}</strong>,</p>
    <p>We received a request to reset your password for your EGSA Space Academy account. Click the button below to choose a new password. This link will expire in 1 hour.</p>
    <div style="direction: rtl; text-align: right; margin-top: 24px; padding-top: 18px; border-top: 1px solid #EDF2F4; color: #334155; font-size: 14px; font-family: 'Cairo', Tahoma, sans-serif;">
      <p>عزيزي/عزيزتي <strong>${fullName || ''}</strong>،</p>
      <p>تلقينا طلباً لإعادة تعيين كلمة المرور لحسابكم في <strong>أكاديمية الفضاء المصرية</strong>. يُرجى النقر على الرابط أدناه لتعيين كلمة مرور جديدة. الرابط صالح لمدة ساعة واحدة.</p>
    </div>
  `;

  const html = getBaseTemplate({
    titleEn,
    titleAr,
    contentHtml,
    actionUrl: resetUrl,
    actionTextEn: 'Reset Password',
    actionTextAr: 'إعادة تعيين كلمة المرور',
  });

  return sendEmail({
    to,
    subject: 'EGSA Space Academy — Password Reset Request | إعادة تعيين كلمة المرور',
    html,
    text: `Dear ${fullName}, reset your password at: ${resetUrl}`,
  });
}

/**
 * Sends official institutional registration confirmation email
 */
async function sendRegistrationConfirmationEmail({ to, fullName, email, verificationUrl }) {
  const recipientEmail = (email || to || '').trim().toLowerCase();
  if (!recipientEmail) {
    throw new Error('Recipient email is missing or empty.');
  }
  const studentName = (fullName || 'Space Academy Candidate').trim();
  const clientUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';

  const titleEn = verificationUrl
    ? 'Confirm Registration & Verify Email — EGSA Space Academy'
    : 'Registration Confirmation — Egyptian Space Agency Space Academy';
  const titleAr = verificationUrl
    ? 'تأكيد التسجيل وتفعيل الحساب — أكاديمية الفضاء المصرية'
    : 'تأكيد التسجيل — أكاديمية الفضاء المصرية';

  const contentHtml = `
    <p>Dear <strong>${studentName}</strong>,</p>
    <p>Thank you for registering with the <strong>Egyptian Space Agency Space Academy</strong>.</p>
    <p>Your account registration has been received successfully.</p>
    
    <div style="background: #F1F5F7; border: 1px solid #DDE4E8; border-left: 4px solid #1E7C85; border-radius: 6px; padding: 14px 18px; margin: 20px 0;">
      <p style="margin: 0; color: #5A6D78; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Registered email:</p>
      <p style="margin: 4px 0 0; color: #0E1A22; font-size: 16px; font-weight: 700; font-family: monospace;">${recipientEmail}</p>
    </div>

    ${verificationUrl ? `
      <p style="font-weight: 600; color: #0E1A22;">To complete your registration and activate your student portal account, please verify your email address by clicking the verification button below:</p>
    ` : `
      <p>Your registration has been received successfully. Future updates regarding your academy activities will be sent to this email address.</p>
      <p>Please use the same email address when signing in to the Space Academy platform.</p>
    `}
    
    <div style="direction: rtl; text-align: right; margin-top: 28px; padding-top: 20px; border-top: 1px solid #EDF2F4; color: #334155; font-size: 14px; font-family: 'Cairo', Tahoma, sans-serif;">
      <p>عزيزي/عزيزتي <strong>${studentName}</strong>،</p>
      <p>شكراً لتسجيلك في <strong>أكاديمية الفضاء المصرية</strong>.</p>
      <p>تم استلام طلب تسجيلكم بنجاح.</p>
      <div style="background: #FFFFFF; border: 1px solid #DDE4E8; border-right: 4px solid #1E7C85; border-radius: 6px; padding: 12px 16px; margin: 16px 0;">
        <p style="margin: 0; color: #5A6D78; font-size: 12px; font-weight: 600;">البريد الإلكتروني المسجل:</p>
        <p style="margin: 4px 0 0; color: #0E1A22; font-size: 15px; font-weight: 700; font-family: monospace; direction: ltr; text-align: right;">${recipientEmail}</p>
      </div>
      ${verificationUrl ? `
        <p style="font-weight: 600; color: #0E1A22;">لتفعيل حسابكم وبدء التقدم للبرامج الفضائية، يُرجى النقر على زر تأكيد البريد الإلكتروني أدناه.</p>
      ` : `
        <p>تم استلام طلب تسجيلكم بنجاح. سيتم إرسال كافة التحديثات المستقبلية المتعلقة بالأنشطة الأكاديمية إلى هذا البريد الإلكتروني.</p>
        <p>يرجى استخدام هذا البريد الإلكتروني لتسجيل الدخول إلى منصة الأكاديمية.</p>
      `}
    </div>

    <p style="margin-top: 24px; color: #14232C; font-size: 14px;">Best regards,<br><br><strong>Egyptian Space Agency</strong><br>Space Academy</p>
  `;

  const html = getBaseTemplate({
    titleEn,
    titleAr,
    contentHtml,
    actionUrl: verificationUrl || `${clientUrl}/login`,
    actionTextEn: verificationUrl ? 'Verify Email Address' : 'Sign In to Portal',
    actionTextAr: verificationUrl ? 'تأكيد البريد الإلكتروني' : 'تسجيل الدخول للمنصة',
  });

  const text = `Dear ${studentName},

Thank you for registering with the Egyptian Space Agency Space Academy.

Your account registration has been successfully received.

Registered email:
${recipientEmail}

${verificationUrl ? `Please verify your email address to activate your account: ${verificationUrl}` : `Sign in to your account at: ${clientUrl}/login`}

Best regards,
Egyptian Space Agency Space Academy`;

  return sendEmail({
    to: recipientEmail,
    subject: verificationUrl
      ? 'EGSA Space Academy — Confirm Registration & Verify Email | تأكيد التسجيل'
      : 'Registration Confirmation - Egyptian Space Agency Space Academy',
    html,
    text,
  });
}

/**
 * Sends application submitted acknowledgement email
 */
async function sendApplicationSubmittedEmail({ to, fullName, courseTitle, applicationNumber, preferredLanguage = 'en' }) {
  const titleEn = 'Application Submitted & Under Review';
  const titleAr = 'تم استلام طلب التقديم وهو قيد المراجعة';
  const clientUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';

  const contentHtml = `
    <div style="background: #EBF3F5; border-left: 4px solid #1E7C85; padding: 14px 18px; border-radius: 6px; margin-bottom: 20px;">
      <strong style="color: #0E1A22; font-size: 14px;">Application Number: <span style="font-family: monospace; color: #1E7C85; font-size: 16px;">${applicationNumber || 'EGSA-APP'}</span></strong>
    </div>

    <p>Dear <strong>${fullName || 'Space Cadet'}</strong>,</p>
    <p>Your application for the <strong>${courseTitle}</strong> training program has been successfully submitted and is currently <strong>Under Review</strong> by the EGSA Academic Committee.</p>
    <p>You can track the live evaluation and seat allocation status of your application at any time directly through your Student Portal.</p>

    <div style="direction: rtl; text-align: right; margin-top: 24px; padding-top: 18px; border-top: 1px solid #EDF2F4; color: #334155; font-size: 14px; font-family: 'Cairo', Tahoma, sans-serif;">
      <p>عزيزي/عزيزتي <strong>${fullName || ''}</strong>،</p>
      <p>تم استلام طلب تقديمكم لبرنامج <strong>${courseTitle}</strong> بنجاح، والطلب حالياً <strong>قيد المراجعة</strong> من قِبل اللجنة الأكاديمية لوكالة الفضاء المصرية (رقم الطلب: ${applicationNumber || 'EGSA-APP'}).</p>
      <p>يمكنكم متابعة حالة الطلب لحظياً من خلال البوابة التدريبية.</p>
    </div>
  `;

  const html = getBaseTemplate({
    titleEn,
    titleAr,
    contentHtml,
    actionUrl: `${clientUrl}/student/applications`,
    actionTextEn: 'View Application Status',
    actionTextAr: 'متابعة حالة الطلب',
  });

  return sendEmail({
    to,
    subject: `EGSA Space Academy — Application Under Review: ${courseTitle} | طلبك قيد المراجعة`,
    html,
    text: `Dear ${fullName}, your application for ${courseTitle} has been submitted (Application: ${applicationNumber}) and is under review.`,
  });
}

/**
 * Sends application accepted email with transportation pricing options & payment deadline
 */
async function sendApplicationAcceptedEmail({
  to,
  fullName,
  courseTitle,
  cohortName,
  applicationNumber,
  basePrice = 0,
  transportationPrice = 500,
  paymentDeadline,
  portalUrl,
}) {
  const titleEn = 'Congratulations — Application Accepted';
  const titleAr = 'تهانينا — تم قبول طلب انضمامك للبرنامج التدريبي';
  const clientUrl = portalUrl || process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const deadlineString = paymentDeadline ? new Date(paymentDeadline).toLocaleString() : '72 hours prior to course start';
  const withTransPrice = Number(basePrice) + Number(transportationPrice);

  const contentHtml = `
    <div style="background: #E8F5E9; border-left: 4px solid #2E7D32; padding: 16px 20px; border-radius: 6px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 6px; color: #1B5E20; font-size: 17px;">Application Accepted · تم قبول الطلب</h3>
      <p style="margin: 0; color: #2E7D32; font-size: 13px;">Application Reference: <strong>${applicationNumber || 'EGSA-APP'}</strong></p>
    </div>

    <p>Dear <strong>${fullName || 'Space Cadet'}</strong>,</p>
    <p>Congratulations! We are delighted to inform you that your application for <strong>${courseTitle}</strong>${cohortName ? ` (${cohortName})` : ''} has been <strong>Accepted</strong> by the Egyptian Space Agency.</p>
    
    <div style="background: #FAFBFB; border: 1px solid #DDE4E8; border-radius: 8px; padding: 18px; margin: 20px 0;">
      <h4 style="margin: 0 0 12px; color: #14232C; font-size: 15px; border-bottom: 1px solid #EDF2F4; padding-bottom: 8px;">Official Training & Transportation Pricing Options</h4>
      
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #EDF2F4;">
          <td style="padding: 10px 0; color: #475569;"><strong>Option A: Course Only</strong><br><span style="font-size: 12px; color: #64748B;">Tuition, labs, assessment & certification</span></td>
          <td style="padding: 10px 0; text-align: right; font-weight: 700; color: #1E7C85; font-size: 16px;">${basePrice} EGP</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #475569;"><strong>Option B: Course + Daily Transportation</strong><br><span style="font-size: 12px; color: #64748B;">Tuition + agency air-conditioned transit shuttle</span></td>
          <td style="padding: 10px 0; text-align: right; font-weight: 700; color: #0B192C; font-size: 16px;">${withTransPrice} EGP</td>
        </tr>
      </table>
    </div>

    <div style="background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 6px; padding: 12px 16px; margin: 20px 0; font-size: 13px; color: #92400E;">
      <i style="font-weight: bold;">Payment Deadline:</i> <strong>${deadlineString}</strong>. Your seat reservation is provisional until payment confirmation.
    </div>

    <p style="font-size: 14px;">Please open your Student Portal, select your preferred package option, and finalize your payment to confirm your official seat in the cohort.</p>

    <div style="direction: rtl; text-align: right; margin-top: 24px; padding-top: 18px; border-top: 1px solid #EDF2F4; color: #334155; font-size: 14px; font-family: 'Cairo', Tahoma, sans-serif;">
      <p>تهانينا <strong>${fullName || ''}</strong>،</p>
      <p>يسعدنا إعلامك بقبول طلب التحاقك ببرنامج <strong>${courseTitle}</strong>. يرجى الدخول إلى البوابة واختيار باقة التدريب (مع أو بدون الانتقالات) واستكمال سداد الرسوم لتأكيد المقعد النهائي قبل: <strong>${deadlineString}</strong>.</p>
    </div>
  `;

  const html = getBaseTemplate({
    titleEn,
    titleAr,
    contentHtml,
    actionUrl: `${clientUrl}/student/payments`,
    actionTextEn: 'Choose Package & Pay',
    actionTextAr: 'اختيار الباقة والسداد',
  });

  return sendEmail({
    to,
    subject: `EGSA Space Academy — Application Accepted: ${courseTitle} | تهانينا، تم قبول طلبك`,
    html,
    text: `Congratulations ${fullName}! Your application for ${courseTitle} was accepted. Choose your package and complete payment: ${clientUrl}/student/payments`,
  });
}

/**
 * Sends application rejection notification
 */
async function sendApplicationRejectedEmail({ to, fullName, courseTitle, reason, preferredLanguage = 'en' }) {
  const titleEn = 'EGSA Space Academy — Application Update';
  const titleAr = 'تحديث بخصوص طلب التقديم — أكاديمية الفضاء المصرية';
  const clientUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';

  const contentHtml = `
    <p>Dear <strong>${fullName || 'Space Cadet'}</strong>,</p>
    <p>Thank you for your interest in the <strong>${courseTitle}</strong> program at the Egyptian Space Agency.</p>
    <p>After careful evaluation of candidate prerequisites and available cohort capacity, we regret to inform you that we are unable to accept your application for this specific training cycle.</p>
    
    ${reason ? `
      <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-left: 4px solid #64748B; padding: 14px 18px; border-radius: 6px; margin: 20px 0;">
        <strong style="color: #334155; font-size: 13px;">Review Feedback:</strong>
        <p style="margin: 6px 0 0; color: #475569; font-size: 14px;">${reason}</p>
      </div>
    ` : ''}

    <p>You are encouraged to explore our foundational courses, complete readiness evaluations, and reapply for upcoming cycles.</p>

    <div style="direction: rtl; text-align: right; margin-top: 24px; padding-top: 18px; border-top: 1px solid #EDF2F4; color: #334155; font-size: 14px; font-family: 'Cairo', Tahoma, sans-serif;">
      <p>عزيزي/عزيزتي <strong>${fullName || ''}</strong>،</p>
      <p>نشكر اهتمامكم بالتقديم لبرنامج <strong>${courseTitle}</strong>. بعد مراجعة المتطلبات والطاقة الاستيعابية، نأسف لإبلاغكم بتعذر قبول الطلب لهذه الدورة التدريبية.</p>
      ${reason ? `<p><strong>ملاحظات المراجعة:</strong> ${reason}</p>` : ''}
      <p>نرحب دائماً بتقديمكم في الدورات التأسيسية والدورات القادمة عبر المنصة.</p>
    </div>
  `;

  const html = getBaseTemplate({
    titleEn,
    titleAr,
    contentHtml,
    actionUrl: `${clientUrl}/student/programs`,
    actionTextEn: 'Explore Other Programs',
    actionTextAr: 'استكشاف برامج أخرى',
  });

  return sendEmail({
    to,
    subject: `EGSA Space Academy — Application Update: ${courseTitle} | تحديث طلب التقديم`,
    html,
    text: `Dear ${fullName}, thank you for applying to ${courseTitle}. Your application was not accepted for this cycle. View other programs at ${clientUrl}/student/programs`,
  });
}

/**
 * Sends payment confirmation and official training schedule email
 */
async function sendPaymentAndEnrollmentConfirmedEmail({
  to,
  fullName,
  courseTitle,
  cohortName,
  packageType = 'WITHOUT_TRANSPORTATION',
  amountPaid = 0,
  paymentReference,
  paymentDate,
  schedule = {},
  preferredLanguage = 'en',
}) {
  const titleEn = 'Payment Confirmed & Enrollment Finalized';
  const titleAr = 'تأكيد السداد وتأكيد الالتحاق النهائي بالدورة التدريبية';
  const clientUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
  const isWithTrans = packageType === 'WITH_TRANSPORTATION';
  const packageLabel = isWithTrans ? 'Course + Transportation' : 'Course Only (Without Transportation)';
  const packageLabelAr = isWithTrans ? 'شامل التدريب والانتقالات' : 'التدريب فقط (بدون انتقالات)';

  const contentHtml = `
    <div style="background: #E8F5E9; border-left: 4px solid #2E7D32; padding: 16px 20px; border-radius: 6px; margin-bottom: 24px;">
      <h3 style="margin: 0 0 6px; color: #1B5E20; font-size: 17px;">Payment Successful · Enrollment Confirmed</h3>
      <p style="margin: 0; color: #2E7D32; font-size: 13px;">Transaction ID: <strong>${paymentReference || 'EGSA-TXN'}</strong></p>
    </div>

    <p>Dear <strong>${fullName || 'Space Cadet'}</strong>,</p>
    <p>Your payment for <strong>${courseTitle}</strong> has been successfully confirmed. Your seat is now officially locked in the training cohort.</p>

    <!-- Payment Receipt Box -->
    <div style="background: #FAFBFB; border: 1px solid #DDE4E8; border-radius: 8px; padding: 18px; margin: 20px 0;">
      <h4 style="margin: 0 0 12px; color: #14232C; font-size: 15px; border-bottom: 1px solid #EDF2F4; padding-bottom: 8px;">Official Payment Receipt</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Program:</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1E293B;">${courseTitle}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Selected Package:</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1E7C85;">${packageLabel}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Amount Paid:</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0F172A; font-size: 15px;">${amountPaid} EGP</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Payment Date:</td>
          <td style="padding: 6px 0; text-align: right; color: #334155;">${paymentDate ? new Date(paymentDate).toLocaleDateString() : new Date().toLocaleDateString()}</td>
        </tr>
      </table>
    </div>

    <!-- Official Training Schedule Box -->
    <div style="background: #F1F5F9; border: 1px solid #CBD5E1; border-radius: 8px; padding: 18px; margin: 20px 0;">
      <h4 style="margin: 0 0 12px; color: #0F172A; font-size: 15px; border-bottom: 1px solid #E2E8F0; padding-bottom: 8px;">Official Training Mission Schedule</h4>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        ${cohortName ? `
          <tr>
            <td style="padding: 6px 0; color: #64748B;">Cohort / Intake:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1E293B;">${cohortName}</td>
          </tr>
        ` : ''}
        ${schedule.startDate ? `
          <tr>
            <td style="padding: 6px 0; color: #64748B;">Start Date:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1E293B;">${new Date(schedule.startDate).toLocaleDateString()}</td>
          </tr>
        ` : ''}
        ${schedule.endDate ? `
          <tr>
            <td style="padding: 6px 0; color: #64748B;">End Date:</td>
            <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #1E293B;">${new Date(schedule.endDate).toLocaleDateString()}</td>
          </tr>
        ` : ''}
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Training Hours:</td>
          <td style="padding: 6px 0; text-align: right; color: #1E293B;">${schedule.hours || '10:00 AM – 03:00 PM'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Location:</td>
          <td style="padding: 6px 0; text-align: right; color: #1E293B;">${schedule.location || 'Egyptian Space Agency (EGSA), Space City, Cairo'}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Transportation:</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; color: ${isWithTrans ? '#166534' : '#64748B'};">
            ${isWithTrans ? 'Agency Air-Conditioned Shuttle Included' : 'Self Transportation'}
          </td>
        </tr>
      </table>
    </div>

    <div style="direction: rtl; text-align: right; margin-top: 24px; padding-top: 18px; border-top: 1px solid #EDF2F4; color: #334155; font-size: 14px; font-family: 'Cairo', Tahoma, sans-serif;">
      <p>عزيزي/عزيزتي <strong>${fullName || ''}</strong>،</p>
      <p>تم استلام سداد رسوم برنامج <strong>${courseTitle}</strong> بنجاح (المبلغ: <strong>${amountPaid} ج.م</strong> — الباقة: <strong>${packageLabelAr}</strong>). تم تأكيد التحاقك النهائي بالبرنامج التدريبي وإدراجك في جدول المحاضرات الرسمي.</p>
    </div>
  `;

  const html = getBaseTemplate({
    titleEn,
    titleAr,
    contentHtml,
    actionUrl: `${clientUrl}/student/training`,
    actionTextEn: 'Go to My Training',
    actionTextAr: 'الانتقال إلى تدريبي',
  });

  return sendEmail({
    to,
    subject: `EGSA Space Academy — Payment & Enrollment Confirmed: ${courseTitle} | تأكيد السداد والالتحاق`,
    html,
    text: `Payment confirmed for ${courseTitle}! Package: ${packageLabel}. Amount: ${amountPaid} EGP. Reference: ${paymentReference}. Access your training cockpit: ${clientUrl}/student/training`,
  });
}

/**
 * 7. Official Certificate Ready & Issued Email
 */
async function sendCertificateReadyEmail({ to, fullName, courseTitle, recipientName, certificateId }) {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const titleEn = 'Your Official EGSA Space Academy Certificate Is Ready';
  const titleAr = 'شهادة إتمام وتخرج معتمدة من وكالة الفضاء المصرية';

  const contentHtml = `
    <p style="font-size: 16px; font-weight: 600; color: #0E1A22; margin-bottom: 8px;">
      Dear ${fullName || recipientName || 'Cadet Graduate'},
    </p>
    <p style="color: #475569; margin-bottom: 20px;">
      Congratulations! Your official Egyptian Space Agency training certificate has been reviewed, prepared, and formally issued by the Academy Administration.
    </p>

    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 18px; margin-bottom: 24px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Course / Program:</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #0E1A22;">${courseTitle}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Name on Certificate:</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 700; color: #0F2B48;">${recipientName}</td>
        </tr>
        ${certificateId ? `
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Certificate ID:</td>
          <td style="padding: 6px 0; text-align: right; font-family: monospace; font-weight: 600; color: #1E7C85;">${certificateId}</td>
        </tr>
        ` : ''}
        <tr>
          <td style="padding: 6px 0; color: #64748B;">Issuing Authority:</td>
          <td style="padding: 6px 0; text-align: right; font-weight: 600; color: #D4B87C;">Egyptian Space Agency (EGSA)</td>
        </tr>
      </table>
    </div>

    <div style="direction: rtl; text-align: right; margin-top: 24px; padding-top: 18px; border-top: 1px solid #EDF2F4; color: #334155; font-size: 14px; font-family: 'Cairo', Tahoma, sans-serif;">
      <p>عزيزي/عزيزتي <strong>${fullName || recipientName || ''}</strong>،</p>
      <p>يسر وكالة الفضاء المصرية أن تعلن عن اعتماد وإصدار شهادة تخرجك الرسمية لبرنامج <strong>${courseTitle}</strong> بالاسم المعتمد: <strong>${recipientName}</strong>. يمكنك الآن استعراض وتحميل شهادتك الرقمية المعتمدة مباشرة من بوابة المتدرب.</p>
    </div>
  `;

  const html = getBaseTemplate({
    titleEn,
    titleAr,
    contentHtml,
    actionUrl: `${clientUrl}/student/certificate`,
    actionTextEn: 'View Official Certificate',
    actionTextAr: 'استعراض الشهادة الرسمية',
  });

  return sendEmail({
    to,
    subject: `EGSA Space Academy — Your Certificate Is Ready: ${courseTitle} | شهادتك جاهزة للتحميل`,
    html,
    text: `Dear ${fullName || recipientName}, your official EGSA Space Academy certificate for ${courseTitle} has been issued with the name "${recipientName}". Access and download your certificate: ${clientUrl}/student/certificate`,
  });
}

module.exports = {
  isSmtpConfigured,
  buildTransport,
  verifySmtpConnection,
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendRegistrationConfirmationEmail,
  sendApplicationSubmittedEmail,
  sendApplicationAcceptedEmail,
  sendApplicationRejectedEmail,
  sendPaymentAndEnrollmentConfirmedEmail,
  sendCertificateReadyEmail,
};

