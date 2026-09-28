/**
 * Payment Provider Interface
 * Standard abstraction for integrating academic tuition payment gateways
 * (e.g. Development Mock, Paymob, Fawry, Stripe).
 */
class PaymentProviderInterface {
  constructor(name) {
    this.name = name;
  }

  /**
   * Initiates a payment session with the gateway provider.
   * @param {Object} params
   * @param {Object} params.invoice
   * @param {Object} params.transaction
   * @param {Object} params.student
   * @param {String} params.returnUrl
   * @returns {Promise<{ success: boolean, paymentUrl?: string, sessionToken?: string, transactionId: string, isMock: boolean }>}
   */
  async initiatePayment(params) {
    throw new Error('initiatePayment must be implemented by payment provider subclass');
  }

  /**
   * Verifies the authenticity and execution status of a transaction.
   * @param {Object} params
   * @param {String} params.transactionId
   * @param {Object} params.payload
   * @returns {Promise<{ isVerified: boolean, status: 'SUCCESS'|'FAILED'|'PENDING', paidAmount: number, currency: string, providerReference: string, rawResponse: any }>}
   */
  async verifyPayment(params) {
    throw new Error('verifyPayment must be implemented by payment provider subclass');
  }
}

module.exports = PaymentProviderInterface;
