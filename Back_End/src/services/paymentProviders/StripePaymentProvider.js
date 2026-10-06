const PaymentProviderInterface = require('./PaymentProviderInterface');
let Stripe = null;
try {
  Stripe = require('stripe');
} catch (e) {
  // Stripe package will be required when Stripe provider is actively used
}

/**
 * StripePaymentProvider
 * Real gateway implementation utilizing Stripe Checkout Sessions & Webhooks.
 * Enforces server-side price calculation and secure signature verification.
 */
class StripePaymentProvider extends PaymentProviderInterface {
  constructor() {
    super('STRIPE');
    this.stripeClient = null;
  }

  getStripeClient() {
    if (this.stripeClient) {
      return this.stripeClient;
    }
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey || secretKey === 'sk_test_placeholder') {
      const err = new Error('STRIPE_SECRET_KEY is not configured in backend environment variables. Please provide a valid Stripe Secret Key (e.g. sk_test_...) to enable card payments.');
      err.statusCode = 400;
      throw err;
    }
    if (!Stripe) {
      Stripe = require('stripe');
    }
    this.stripeClient = new Stripe(secretKey);
    return this.stripeClient;
  }

  /**
   * Initiates a hosted Stripe Checkout Session.
   */
  async initiatePayment({ invoice, transaction, student, returnUrl }) {
    const stripe = this.getStripeClient();
    const clientBase = process.env.CLIENT_URL || 'http://localhost:5173';

    // Strictly validate authoritative amount from invoice (never client submitted)
    const amountInCents = Math.round(Number(invoice.amount) * 100);
    if (!amountInCents || amountInCents <= 0) {
      throw new Error(`Invalid invoice payable amount: ${invoice.amount}`);
    }

    const courseTitle = invoice.course?.title || 'EGSA Space Academy Training Program';
    const packageDesc = invoice.packageType === 'WITH_TRANSPORTATION'
      ? 'Tuition + Academy Transportation'
      : 'Tuition (Standard)';

    let session;
    try {
      session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        ...(student?.email ? { customer_email: student.email } : {}),
        client_reference_id: invoice._id.toString(),
        expires_at: Math.floor(Date.now() / 1000) + 1860, // 31-minute checkout session expiration (prevents clock skew)
        metadata: {
          invoiceId: invoice._id.toString(),
          transactionId: transaction.transactionId,
          studentId: student?._id ? student._id.toString() : (invoice.student?.toString() || ''),
          applicationId: invoice.application ? (invoice.application._id || invoice.application).toString() : '',
          courseId: invoice.course ? (invoice.course._id || invoice.course).toString() : '',
          packageType: invoice.packageType || 'WITHOUT_TRANSPORTATION',
        },
        line_items: [
          {
            price_data: {
              currency: (invoice.currency || 'EGP').toLowerCase(),
              product_data: {
                name: `EGSA Space Academy: ${courseTitle}`,
                description: `Invoice: ${invoice.invoiceNumber || invoice._id} · ${packageDesc}`,
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        success_url: `${clientBase}/student/payments?session_id={CHECKOUT_SESSION_ID}&invoiceId=${invoice._id}`,
        cancel_url: `${clientBase}/student/payments?cancelled=true&invoiceId=${invoice._id}`,
      });
    } catch (err) {
      if (err.type === 'StripeInvalidRequestError') {
        if (err.message && (err.message.includes('currency') || err.message.includes('payment_method'))) {
          const cfgErr = new Error(
            `Stripe payment gateway configuration error: The currency "${invoice.currency || 'EGP'}" or card payment method is not supported by your Stripe account. Details: ${err.message}`
          );
          cfgErr.statusCode = 400;
          throw cfgErr;
        }
      }
      const apiErr = new Error(`Stripe Checkout Session initialization failed: ${err.message}`);
      apiErr.statusCode = 400;
      throw apiErr;
    }

    transaction.stripeCheckoutSessionId = session.id;
    if (session.payment_intent) {
      transaction.stripePaymentIntentId = session.payment_intent.toString();
    }

    return {
      success: true,
      provider: this.name,
      isMock: false,
      sessionToken: session.id,
      providerReference: session.id,
      paymentUrl: session.url,
      redirectUrl: session.url,
      transactionId: transaction.transactionId,
      notice: 'Stripe hosted checkout session initialized.',
    };
  }

  /**
   * Verifies the authenticity and execution status of a transaction against authoritative records.
   * Never trusts client-supplied session objects. Performs direct live Stripe retrieval or uses
   * cryptographically verified webhook event objects.
   */
  async verifyPayment({ transactionId, payload = {}, transaction, invoice, student }) {
    const stripe = this.getStripeClient();

    // Session ID strictly resolved from stored transaction or explicit lookup
    const sessionId =
      transaction?.stripeCheckoutSessionId ||
      payload.sessionId ||
      payload.providerReference ||
      payload.verifiedSession?.id;

    if (!sessionId && !payload.verifiedSession) {
      throw new Error('Stripe session identifier is required for verification.');
    }

    // Never accept unverified payload.session from clients.
    // Use verifiedSession (from HMAC-validated webhook) or live retrieval from Stripe API.
    const session = payload.verifiedSession || (await stripe.checkout.sessions.retrieve(sessionId));

    if (!session || typeof session !== 'object') {
      return {
        isVerified: false,
        status: 'FAILED',
        failureReason: 'Unable to retrieve valid session from payment provider.',
        paidAmount: 0,
        currency: (invoice?.currency || 'EGP').toUpperCase(),
      };
    }

    // Verify session ID matches stored transaction if transaction is provided
    if (transaction?.stripeCheckoutSessionId && session.id !== transaction.stripeCheckoutSessionId) {
      return {
        isVerified: false,
        status: 'FAILED',
        failureReason: `Session ID mismatch: received ${session.id}, expected ${transaction.stripeCheckoutSessionId}`,
        paidAmount: 0,
        currency: (invoice?.currency || 'EGP').toUpperCase(),
      };
    }

    // Mode check
    if (session.mode !== 'payment') {
      return {
        isVerified: false,
        status: 'FAILED',
        failureReason: `Invalid checkout session mode: ${session.mode}`,
        paidAmount: 0,
        currency: (invoice?.currency || 'EGP').toUpperCase(),
      };
    }

    // Payment status check
    if (session.payment_status !== 'paid') {
      const isExpired = session.status === 'expired';
      return {
        isVerified: false,
        status: isExpired ? 'CANCELLED' : 'FAILED',
        failureReason: `Stripe checkout session not settled. Payment status: ${session.payment_status}`,
        paidAmount: 0,
        currency: (session.currency || 'egp').toUpperCase(),
        providerReference: session.id,
        rawResponse: session,
      };
    }

    // Authoritative Currency Check
    const expectedCurrency = (invoice?.currency || transaction?.currency || 'EGP').toLowerCase();
    if (String(session.currency || '').toLowerCase() !== expectedCurrency) {
      return {
        isVerified: false,
        status: 'FAILED',
        failureReason: `Currency mismatch: payment was ${session.currency}, expected ${expectedCurrency}`,
        paidAmount: 0,
        currency: (session.currency || 'egp').toUpperCase(),
      };
    }

    // Authoritative Amount Check in Minor Units
    const targetAmount = invoice?.amount != null ? invoice.amount : transaction?.amount;
    if (targetAmount != null) {
      const expectedAmountMinor = Math.round(Number(targetAmount) * 100);
      if (Number(session.amount_total) !== expectedAmountMinor) {
        return {
          isVerified: false,
          status: 'FAILED',
          failureReason: `Amount mismatch: paid ${session.amount_total} minor units, expected ${expectedAmountMinor}`,
          paidAmount: (session.amount_total || 0) / 100,
          currency: (session.currency || 'egp').toUpperCase(),
        };
      }
    }

    // Ownership & Metadata Checks
    const studentIdStr = student?._id
      ? student._id.toString()
      : transaction?.student?._id
      ? transaction.student._id.toString()
      : transaction?.student
      ? transaction.student.toString()
      : null;

    if (studentIdStr && session.metadata?.studentId && session.metadata.studentId !== studentIdStr) {
      return {
        isVerified: false,
        status: 'FAILED',
        failureReason: 'Student ownership mismatch on payment session metadata.',
        paidAmount: 0,
        currency: (session.currency || 'egp').toUpperCase(),
      };
    }

    const txIdStr = transactionId || transaction?.transactionId;
    if (txIdStr && session.metadata?.transactionId && session.metadata.transactionId !== txIdStr) {
      return {
        isVerified: false,
        status: 'FAILED',
        failureReason: 'Transaction identifier mismatch on payment session metadata.',
        paidAmount: 0,
        currency: (session.currency || 'egp').toUpperCase(),
      };
    }

    const invoiceIdStr = invoice?._id ? invoice._id.toString() : transaction?.invoice?._id ? transaction.invoice._id.toString() : null;
    if (invoiceIdStr && session.metadata?.invoiceId && session.metadata.invoiceId !== invoiceIdStr) {
      return {
        isVerified: false,
        status: 'FAILED',
        failureReason: 'Invoice identifier mismatch on payment session metadata.',
        paidAmount: 0,
        currency: (session.currency || 'egp').toUpperCase(),
      };
    }

    const intentId = typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || session.id;

    return {
      isVerified: true,
      status: 'SUCCESS',
      paidAmount: (session.amount_total || 0) / 100,
      currency: (session.currency || 'egp').toUpperCase(),
      providerReference: intentId,
      rawResponse: {
        id: session.id,
        payment_intent: intentId,
        payment_status: session.payment_status,
      },
    };
  }

  /**
   * Constructs and verifies a cryptographic webhook event from Stripe.
   */
  constructWebhookEvent(rawBody, signature, secret) {
    const stripe = this.getStripeClient();
    const webhookSecret = secret || process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured in backend environment variables.');
    }
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}

module.exports = StripePaymentProvider;
