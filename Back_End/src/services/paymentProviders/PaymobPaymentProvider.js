const crypto = require('crypto');
const PaymentProviderInterface = require('./PaymentProviderInterface');

/**
 * PaymobPaymentProvider
 * Production-ready payment provider adapter for Egyptian Space Agency (EGSA) Academy.
 * Integrates officially with Paymob Accept (Central Bank of Egypt licensed gateway)
 * for native EGP card processing, secure embedded iframe checkout, HMAC-SHA512 verification,
 * and authoritative refund processing.
 */
class PaymobPaymentProvider extends PaymentProviderInterface {
  constructor() {
    super('PAYMOB');
    this.baseUrl = process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com/api';
  }

  getApiKey() {
    return process.env.PAYMOB_API_KEY;
  }

  getIntegrationId() {
    return process.env.PAYMOB_INTEGRATION_ID;
  }

  getIframeId() {
    return process.env.PAYMOB_IFRAME_ID;
  }

  getHmacSecret() {
    return process.env.PAYMOB_HMAC_SECRET;
  }

  /**
   * Helper HTTP client using Node 18+ native fetch
   */
  async request(endpoint, options = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers || {}),
    };

    const res = await fetch(url, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.detail || data.message || (typeof data === 'string' ? data : JSON.stringify(data));
      const err = new Error(`Paymob Gateway Error (${res.status}): ${msg}`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  /**
   * Step 1: Authenticate with Paymob to obtain short-lived Auth Token
   */
  async authenticate() {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error(
        'PAYMOB_API_KEY is not configured in backend environment variables. Please provide a valid Paymob API key or switch to DEVELOPMENT_MOCK.'
      );
    }
    const data = await this.request('/auth/tokens', {
      method: 'POST',
      body: JSON.stringify({ api_key: apiKey }),
    });
    return data.token;
  }

  /**
   * Initiates payment order and generates secure payment key for embedded checkout.
   */
  async initiatePayment({ invoice, transaction, student, returnUrl }) {
    const apiKey = this.getApiKey();
    const integrationId = this.getIntegrationId();
    const iframeId = this.getIframeId();

    if (!apiKey || !integrationId || !iframeId) {
      throw new Error(
        'Paymob gateway is not fully configured. Missing PAYMOB_API_KEY, PAYMOB_INTEGRATION_ID, or PAYMOB_IFRAME_ID in environment variables.'
      );
    }

    const currency = (transaction.currency || invoice.currency || 'EGP').toUpperCase();
    if (currency !== 'EGP') {
      throw new Error(
        `Currency "${currency}" is not supported by EGSA payment gateway. Only Egyptian Pounds (EGP) are accepted.`
      );
    }

    const amountCents = Math.round(Number(transaction.amount) * 100);

    // 1. Auth token
    const authToken = await this.authenticate();

    // 2. Register Order
    const orderData = await this.request('/ecommerce/orders', {
      method: 'POST',
      body: JSON.stringify({
        auth_token: authToken,
        delivery_needed: 'false',
        amount_cents: amountCents,
        currency: 'EGP',
        merchant_order_id: transaction.transactionId,
        items: [
          {
            name: invoice.course?.title || 'EGSA Space Academy Course Tuition',
            amount_cents: amountCents,
            description: `Tuition settlement for invoice ${invoice.invoiceNumber || invoice._id}`,
            quantity: '1',
          },
        ],
      }),
    });

    const orderId = orderData.id;

    // Split student full name
    const nameParts = (student?.fullName || 'EGSA Student').trim().split(/\s+/);
    const firstName = nameParts[0] || 'EGSA';
    const lastName = nameParts.slice(1).join(' ') || 'Student';

    // 3. Request Payment Key
    const paymentKeyData = await this.request('/acceptance/payment_keys', {
      method: 'POST',
      body: JSON.stringify({
        auth_token: authToken,
        amount_cents: amountCents,
        expiration: 3600, // 1 hour session window
        order_id: orderId,
        billing_data: {
          apartment: 'NA',
          email: student?.email || 'student@space.egsa.gov.eg',
          floor: 'NA',
          first_name: firstName,
          street: 'Space City, Regional Ring Rd',
          building: 'EGSA HQ',
          phone_number: student?.phone || '+201000000000',
          shipping_method: 'PKG',
          postal_code: '11835',
          city: 'Cairo',
          country: 'EG',
          last_name: lastName,
          state: 'Cairo',
        },
        currency: 'EGP',
        integration_id: Number(integrationId),
      }),
    });

    const paymentKey = paymentKeyData.token;
    const iframeUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${paymentKey}`;

    return {
      success: true,
      provider: this.name,
      orderId: String(orderId),
      paymentKey,
      paymentUrl: iframeUrl,
      iframeUrl,
      iframeId,
      sessionToken: paymentKey,
      providerReference: String(orderId),
      isMock: false,
      notice: 'Paymob PCI-DSS Level 1 compliant secure checkout initialized.',
    };
  }

  /**
   * Cryptographically verifies Paymob HMAC-SHA512 transaction callback.
   * @param {Object} data - Transaction callback object or query params
   * @param {string} receivedHmac - The HMAC hash sent in header or query
   * @returns {boolean}
   */
  verifyWebhookHmac(data, receivedHmac) {
    const hmacSecret = this.getHmacSecret();
    if (!hmacSecret) {
      throw new Error('PAYMOB_HMAC_SECRET is not configured in backend environment variables.');
    }
    if (!receivedHmac || typeof receivedHmac !== 'string') {
      return false;
    }

    // Paymob specifies exact concatenation order for callback values
    const orderId =
      data.order?.id !== undefined
        ? data.order.id
        : data['order.id'] !== undefined
        ? data['order.id']
        : data.order;

    const sourceDataPan = data.source_data?.pan || data['source_data.pan'] || '';
    const sourceDataSubType = data.source_data?.sub_type || data['source_data.sub_type'] || '';
    const sourceDataType = data.source_data?.type || data['source_data.type'] || '';

    const values = [
      data.amount_cents,
      data.created_at,
      data.currency,
      data.error_occured,
      data.has_parent_transaction,
      data.id,
      data.integration_id,
      data.is_3d_secure,
      data.is_auth,
      data.is_capture,
      data.is_refunded,
      data.is_standalone_payment,
      data.is_voided,
      orderId,
      data.owner,
      data.pending,
      sourceDataPan,
      sourceDataSubType,
      sourceDataType,
      data.success,
    ];

    const concatenated = values.map((v) => (v === undefined || v === null ? '' : String(v))).join('');
    const calculatedHmac = crypto.createHmac('sha512', hmacSecret).update(concatenated).digest('hex');

    try {
      return crypto.timingSafeEqual(
        Buffer.from(calculatedHmac.toLowerCase(), 'utf8'),
        Buffer.from(receivedHmac.toLowerCase(), 'utf8')
      );
    } catch (_) {
      return false;
    }
  }

  /**
   * Verifies the authenticity and execution status of a transaction.
   * Never trusts client-supplied success flags.
   */
  async verifyPayment({ transactionId, payload = {}, transaction, invoice, student }) {
    // 1. If payload was already verified via cryptographically signed webhook
    if (payload.verifiedCallbackData) {
      const cb = payload.verifiedCallbackData;

      // Validate transaction / order reference
      const cbOrderId = String(cb.order?.id || cb.order || '');
      const expectedOrderId = String(transaction.providerOrderId || transaction.providerReference || '');
      if (expectedOrderId && cbOrderId && cbOrderId !== expectedOrderId) {
        return {
          isVerified: false,
          status: 'FAILED',
          failureReason: `Order ID mismatch: received ${cbOrderId}, expected ${expectedOrderId}`,
        };
      }

      // Validate currency
      const cbCurrency = String(cb.currency || '').toUpperCase();
      const expectedCurrency = (transaction.currency || 'EGP').toUpperCase();
      if (cbCurrency !== expectedCurrency) {
        return {
          isVerified: false,
          status: 'FAILED',
          failureReason: `Currency mismatch: received ${cbCurrency}, expected ${expectedCurrency}`,
        };
      }

      // Validate amount in cents
      const expectedCents = Math.round(Number(transaction.amount) * 100);
      const receivedCents = Number(cb.amount_cents);
      if (receivedCents !== expectedCents) {
        return {
          isVerified: false,
          status: 'FAILED',
          failureReason: `Amount mismatch: received ${receivedCents} cents, expected ${expectedCents} cents`,
        };
      }

      const isSuccess = cb.success === true || cb.success === 'true';
      if (!isSuccess) {
        return {
          isVerified: true,
          status: 'FAILED',
          failureReason: cb.data?.message || 'Payment was declined by card issuer.',
          providerReference: String(cb.id || cb.order?.id || ''),
          rawResponse: cb,
        };
      }

      return {
        isVerified: true,
        status: 'SUCCESS',
        paidAmount: receivedCents / 100,
        currency: expectedCurrency,
        providerReference: String(cb.id || cb.order?.id || ''),
        rawResponse: cb,
      };
    }

    // 2. Authoritative live query to Paymob API
    try {
      const authToken = await this.authenticate();
      const ref = transaction.providerReference || payload.transactionId;
      if (!ref) {
        throw new Error('Transaction or Order reference is required for Paymob verification.');
      }

      // Query transaction by transaction id or order query
      const queryEndpoint = `/acceptance/transactions/${ref}`;
      const txData = await this.request(queryEndpoint, {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      const isSuccess = txData.success === true;
      const expectedCents = Math.round(Number(transaction.amount) * 100);
      const receivedCents = Number(txData.amount_cents);

      if (receivedCents !== expectedCents) {
        return {
          isVerified: false,
          status: 'FAILED',
          failureReason: `Amount mismatch: received ${receivedCents} cents, expected ${expectedCents} cents`,
        };
      }

      if (isSuccess && !txData.is_voided && !txData.is_refunded) {
        return {
          isVerified: true,
          status: 'SUCCESS',
          paidAmount: receivedCents / 100,
          currency: 'EGP',
          providerReference: String(txData.id),
          rawResponse: txData,
        };
      }

      return {
        isVerified: true,
        status: 'FAILED',
        failureReason: txData.data?.message || 'Transaction not settled.',
        providerReference: String(txData.id || ref),
        rawResponse: txData,
      };
    } catch (err) {
      return {
        isVerified: false,
        status: 'PENDING',
        failureReason: `Paymob verification query failed: ${err.message}`,
      };
    }
  }

  /**
   * Processes a refund via Paymob Refund API
   * @param {Object} params
   * @param {Object} params.transaction
   * @param {number} params.amount
   * @param {string} params.reason
   */
  async processRefund({ transaction, amount, reason }) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('PAYMOB_API_KEY is not configured for automated gateway refund.');
    }

    const authToken = await this.authenticate();
    const amountCents = Math.round(Number(amount) * 100);

    const ref = transaction.providerReference;
    if (!ref) {
      throw new Error('Transaction provider reference is required to execute gateway refund.');
    }

    const refundRes = await this.request('/acceptance/void_refund/refund', {
      method: 'POST',
      body: JSON.stringify({
        auth_token: authToken,
        transaction_id: Number(ref),
        amount_cents: amountCents,
      }),
    });

    return {
      success: true,
      refundReference: String(refundRes.id || refundRes.transaction_id || `PAYMOB_REF_${Date.now()}`),
      amountRefunded: amount,
      rawResponse: refundRes,
    };
  }
}

module.exports = PaymobPaymentProvider;
