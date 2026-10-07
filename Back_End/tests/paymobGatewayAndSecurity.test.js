jest.mock('../src/models/Invoice');
jest.mock('../src/models/PaymentTransaction');
jest.mock('../src/models/Application');
jest.mock('../src/models/Enrollment');
jest.mock('../src/models/Cohort');
jest.mock('../src/models/Course');
jest.mock('../src/models/User');
jest.mock('../src/models/RefundAccount');
jest.mock('../src/models/RefundRequest');
jest.mock('../src/services/notificationService');
jest.mock('../src/utils/email');

const crypto = require('crypto');
const mongoose = require('mongoose');
const PaymobPaymentProvider = require('../src/services/paymentProviders/PaymobPaymentProvider');
const MockPaymentProvider = require('../src/services/paymentProviders/MockPaymentProvider');
const { getPaymentProvider } = require('../src/services/paymentProviders');
const paymentService = require('../src/services/paymentService');
const paymentController = require('../src/controllers/paymentController');

const PaymentTransaction = require('../src/models/PaymentTransaction');
const Invoice = require('../src/models/Invoice');
const Application = require('../src/models/Application');
const Enrollment = require('../src/models/Enrollment');
const Cohort = require('../src/models/Cohort');
const Course = require('../src/models/Course');
const RefundAccount = require('../src/models/RefundAccount');

function mockQuery(result) {
  const q = {
    populate: jest.fn(),
    sort: jest.fn(),
  };
  q.populate.mockReturnValue(q);
  q.sort.mockReturnValue(q);
  q.then = function (resolve, reject) {
    return Promise.resolve(result).then(resolve, reject);
  };
  return q;
}

describe('EGSA Space Academy — Paymob Gateway & Payment Security Hardening Suite', () => {
  const hmacSecret = 'test_egsa_hmac_secret_key_512';
  let provider;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.PAYMOB_API_KEY = 'test_api_key_paymob';
    process.env.PAYMOB_INTEGRATION_ID = '987654';
    process.env.PAYMOB_IFRAME_ID = '12345';
    process.env.PAYMOB_HMAC_SECRET = hmacSecret;
    provider = new PaymobPaymentProvider();
  });

  afterAll(() => {
    delete process.env.PAYMOB_API_KEY;
    delete process.env.PAYMOB_INTEGRATION_ID;
    delete process.env.PAYMOB_IFRAME_ID;
    delete process.env.PAYMOB_HMAC_SECRET;
  });

  describe('1. Paymob HMAC-SHA512 Cryptographic Verification', () => {
    function computeValidHmac(data, secret) {
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
      return crypto.createHmac('sha512', secret).update(concatenated).digest('hex');
    }

    it('successfully validates authentic Paymob HMAC callback', () => {
      const callbackData = {
        amount_cents: '300000',
        created_at: '2026-10-06T12:00:00Z',
        currency: 'EGP',
        error_occured: 'false',
        has_parent_transaction: 'false',
        id: '998877',
        integration_id: '987654',
        is_3d_secure: 'true',
        is_auth: 'false',
        is_capture: 'false',
        is_refunded: 'false',
        is_standalone_payment: 'true',
        is_voided: 'false',
        order: { id: '554433' },
        owner: '112233',
        pending: 'false',
        source_data: { pan: '2345', sub_type: 'MasterCard', type: 'card' },
        success: 'true',
      };

      const validHmac = computeValidHmac(callbackData, hmacSecret);
      const isValid = provider.verifyWebhookHmac(callbackData, validHmac);
      expect(isValid).toBe(true);
    });

    it('rejects tampered transaction callback with forged amount_cents', () => {
      const authenticData = {
        amount_cents: '300000',
        created_at: '2026-10-06T12:00:00Z',
        currency: 'EGP',
        error_occured: 'false',
        has_parent_transaction: 'false',
        id: '998877',
        integration_id: '987654',
        is_3d_secure: 'true',
        is_auth: 'false',
        is_capture: 'false',
        is_refunded: 'false',
        is_standalone_payment: 'true',
        is_voided: 'false',
        order: { id: '554433' },
        owner: '112233',
        pending: 'false',
        source_data: { pan: '2345', sub_type: 'MasterCard', type: 'card' },
        success: 'true',
      };

      const validHmac = computeValidHmac(authenticData, hmacSecret);

      // Attacker changes amount_cents to 50000 (trying to pay less)
      const tamperedData = { ...authenticData, amount_cents: '50000' };
      const isValid = provider.verifyWebhookHmac(tamperedData, validHmac);
      expect(isValid).toBe(false);
    });

    it('rejects callback with invalid or missing HMAC token', () => {
      const data = { id: '123', success: 'true' };
      expect(provider.verifyWebhookHmac(data, '')).toBe(false);
      expect(provider.verifyWebhookHmac(data, null)).toBe(false);
      expect(provider.verifyWebhookHmac(data, 'invalid_hex_string')).toBe(false);
    });

    it('throws configuration error when PAYMOB_HMAC_SECRET is missing', () => {
      delete process.env.PAYMOB_HMAC_SECRET;
      expect(() => provider.verifyWebhookHmac({ id: '1' }, 'any_hmac')).toThrow(
        /PAYMOB_HMAC_SECRET is not configured/
      );
    });
  });

  describe('2. Provider Factory & Currency Hardening', () => {
    it('returns PaymobPaymentProvider when configured or requested', () => {
      const prov = getPaymentProvider('PAYMOB');
      expect(prov).toBeInstanceOf(PaymobPaymentProvider);
      expect(prov.name).toBe('PAYMOB');
    });

    it('rejects non-EGP currencies strictly for Egyptian Space Agency operations', async () => {
      const invoice = { _id: 'inv-1', currency: 'USD', amount: 100 };
      const transaction = { _id: 'tx-1', currency: 'USD', amount: 100 };
      const student = { fullName: 'Ali Space', email: 'ali@egsa.gov.eg' };

      await expect(
        provider.initiatePayment({ invoice, transaction, student, returnUrl: 'http://localhost' })
      ).rejects.toThrow(/Only Egyptian Pounds \(EGP\) are accepted/);
    });
  });

  describe('3. Payment Controller & Security Protections', () => {
    it('rejects payment initiation if student does not own the invoice', async () => {
      const studentAId = new mongoose.Types.ObjectId();
      const invoiceId = new mongoose.Types.ObjectId();

      // Invoice.findOne returning null because student does not own it
      Invoice.findOne.mockImplementation(() => mockQuery(null));

      const req = {
        params: {},
        user: { _id: studentAId, role: 'student' },
        body: { invoiceId: invoiceId.toString() },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() };
      const next = jest.fn();

      await paymentController.initiatePayment(req, res, next);

      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error.message).toMatch(/Invoice not found/i);
    });

    it('webhook rejects requests with missing or invalid HMAC', async () => {
      const req = {
        query: { hmac: 'forged_hmac_hash' },
        body: {
          type: 'TRANSACTION',
          obj: {
            id: 998877,
            amount_cents: 300000,
            currency: 'EGP',
            success: true,
          },
        },
      };
      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() };
      const next = jest.fn();

      await paymentController.handleGatewayWebhook(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, message: expect.stringMatching(/HMAC/i) })
      );
    });

    it('rejects duplicate or replayed transaction settlement idempotently', async () => {
      const req = {
        query: { hmac: 'valid_mock_hmac' },
        body: {
          type: 'TRANSACTION',
          obj: {
            id: 998877,
            amount_cents: 300000,
            currency: 'EGP',
            success: true,
            order: { merchant_order_id: 'TXN_IDEMPOTENT_1' },
          },
        },
      };

      // Spy on provider verifyWebhookHmac to return true
      jest.spyOn(PaymobPaymentProvider.prototype, 'verifyWebhookHmac').mockReturnValue(true);

      // Simulate existing already-paid transaction in database with chained populate
      const existingTx = {
        _id: 'tx-already-paid',
        transactionId: 'TXN_IDEMPOTENT_1',
        status: 'Paid',
        invoice: 'inv-1',
      };
      PaymentTransaction.findOne.mockImplementation(() => mockQuery(existingTx));

      const res = { json: jest.fn(), status: jest.fn().mockReturnThis(), send: jest.fn() };
      const next = jest.fn();

      await paymentController.handleGatewayWebhook(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ received: true, status: 'already_settled' })
      );
    });
  });

  describe('4. Authoritative Pricing Enforcement', () => {
    it('calculates pricing using backend course rates without trusting frontend input', () => {
      const course = {
        price: 4500,
        transportationPrice: 750,
        currency: 'EGP',
      };

      // Case 1: Without shuttle
      const priceWithoutShuttle = paymentService.calculatePricing(course, 'WITHOUT_TRANSPORTATION');
      expect(priceWithoutShuttle.basePrice).toBe(4500);
      expect(priceWithoutShuttle.baseAmount).toBe(4500);
      expect(priceWithoutShuttle.transportationPrice).toBe(0);
      expect(priceWithoutShuttle.totalAmount).toBe(4500);
      expect(priceWithoutShuttle.currency).toBe('EGP');

      // Case 2: With shuttle
      const priceWithShuttle = paymentService.calculatePricing(course, 'WITH_TRANSPORTATION');
      expect(priceWithShuttle.basePrice).toBe(4500);
      expect(priceWithShuttle.transportationPrice).toBe(750);
      expect(priceWithShuttle.totalAmount).toBe(5250);
      expect(priceWithShuttle.packageType).toBe('WITH_TRANSPORTATION');
    });
  });
});
