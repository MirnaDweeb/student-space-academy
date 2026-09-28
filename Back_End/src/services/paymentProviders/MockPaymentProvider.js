const crypto = require('crypto');
const PaymentProviderInterface = require('./PaymentProviderInterface');

/**
 * MockPaymentProvider
 * High-fidelity simulated payment gateway provider for development and testing.
 * Clearly separates DEVELOPMENT/MOCK mode from real payment gateways.
 */
class MockPaymentProvider extends PaymentProviderInterface {
  constructor() {
    super('DEVELOPMENT_MOCK');
  }

  async initiatePayment({ invoice, transaction, student, returnUrl }) {
    const sessionToken = `mock_sess_${crypto.randomBytes(16).toString('hex')}`;
    const providerReference = `EGSA_MOCK_REF_${Date.now()}`;
    const clientBase = process.env.CLIENT_URL || 'http://localhost:5173';
    const fallbackReturnUrl = `${clientBase}/student/payments?invoiceId=${invoice._id}&sessionToken=${sessionToken}`;

    return {
      success: true,
      provider: this.name,
      isMock: true,
      sessionToken,
      providerReference,
      paymentUrl: returnUrl || fallbackReturnUrl,
      transactionId: transaction.transactionId,
      notice: 'DEVELOPMENT MOCK GATEWAY: Simulated sandbox financial processing.',
    };
  }

  async verifyPayment({ transactionId, payload = {} }) {
    // If client requested a simulated failure or payload indicates failure
    if (payload.simulateFailure === true || payload.status === 'FAILED') {
      return {
        isVerified: true,
        status: 'FAILED',
        failureReason: payload.failureReason || 'Simulated card decline: Insufficient test funds.',
        paidAmount: 0,
        currency: 'EGP',
        providerReference: payload.providerReference || `MOCK_FAIL_${Date.now()}`,
        isMock: true,
        rawResponse: { simulated: true, outcome: 'REJECTED' },
      };
    }

    // Default: successful simulated authorization
    return {
      isVerified: true,
      status: 'SUCCESS',
      paidAmount: payload.amount,
      currency: payload.currency || 'EGP',
      providerReference: payload.providerReference || `EGSA_MOCK_TXN_${Date.now()}`,
      isMock: true,
      rawResponse: {
        simulated: true,
        outcome: 'APPROVED',
        authorizationCode: `AUTH_${Math.floor(100000 + Math.random() * 900000)}`,
        gatewayTimestamp: new Date().toISOString(),
      },
    };
  }
}

module.exports = MockPaymentProvider;
