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
    const mockCheckoutUrl = `${clientBase}/student/payments/mock-checkout?sessionToken=${sessionToken}&invoiceId=${invoice._id}&amount=${transaction.amount}&currency=${transaction.currency || 'EGP'}&transactionId=${transaction.transactionId}`;

    return {
      success: true,
      provider: this.name,
      isMock: true,
      sessionToken,
      providerReference,
      iframeUrl: mockCheckoutUrl,
      paymentUrl: mockCheckoutUrl,
      transactionId: transaction.transactionId,
      notice: 'DEVELOPMENT MOCK GATEWAY: Isolated sandbox checkout frame for local testing.',
    };
  }

  async verifyPayment({ transactionId, payload = {} }) {
    // If client requested a simulated failure or payload indicates failure / cancellation
    if (payload.simulateFailure === true || payload.status === 'FAILED' || payload.status === 'CANCELLED') {
      return {
        isVerified: true,
        status: payload.status === 'CANCELLED' ? 'CANCELLED' : 'FAILED',
        failureReason: payload.failureReason || 'Simulated payment cancellation or failure.',
        paidAmount: 0,
        currency: 'EGP',
        providerReference: payload.providerReference || `MOCK_${payload.status || 'FAIL'}_${Date.now()}`,
        isMock: true,
        rawResponse: { simulated: true, outcome: payload.status || 'REJECTED' },
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
