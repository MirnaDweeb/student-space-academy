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
    if (!secretKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured in backend environment variables.');
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

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: student?.email || undefined,
      client_reference_id: invoice._id.toString(),
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
   * Verifies the status of a checkout session or payment intent.
   */
  async verifyPayment({ transactionId, payload = {} }) {
    const stripe = this.getStripeClient();
    const sessionId = payload.sessionId || payload.session?.id || payload.providerReference;

    if (!sessionId) {
      throw new Error('Stripe session identifier is required for verification.');
    }

    const session = payload.session || (await stripe.checkout.sessions.retrieve(sessionId));

    if (session.payment_status === 'paid') {
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

    return {
      isVerified: true,
      status: 'FAILED',
      failureReason: `Stripe checkout session not settled. Payment status: ${session.payment_status}`,
      paidAmount: 0,
      currency: (session.currency || 'egp').toUpperCase(),
      providerReference: session.id,
      rawResponse: session,
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
