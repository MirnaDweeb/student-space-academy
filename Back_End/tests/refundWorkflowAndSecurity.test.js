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

const mongoose = require('mongoose');
const { encryptSensitiveData, decryptSensitiveData, maskIdentifier } = require('../src/utils/encryption');
const paymentService = require('../src/services/paymentService');
const RefundAccount = require('../src/models/RefundAccount');
const RefundRequest = require('../src/models/RefundRequest');
const PaymentTransaction = require('../src/models/PaymentTransaction');
const Invoice = require('../src/models/Invoice');

// Helper to mock chained .populate().sort() mongoose queries
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

describe('EGSA Space Academy — Phase 9 Refund Policy & Security Workflow Suite', () => {
  const studentAId = new mongoose.Types.ObjectId();
  const studentBId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const invoiceId = new mongoose.Types.ObjectId();
  const transactionId = new mongoose.Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('1. AES-256-GCM Encryption & Masking at Rest', () => {
    it('encrypts sensitive bank account numbers with unique IV and auth tag', () => {
      const plaintext = '1234567890123456';
      const encrypted = encryptSensitiveData(plaintext);

      expect(encrypted).not.toBeNull();
      expect(encrypted).not.toBe(plaintext);

      // Verify format is iv:authTag:encryptedHex
      const parts = encrypted.split(':');
      expect(parts.length).toBe(3);
      expect(parts[0].length).toBe(24); // 12 bytes IV hex = 24 hex chars
      expect(parts[1].length).toBe(32); // 16 bytes AuthTag hex = 32 hex chars
    });

    it('decrypts encrypted bank data back to original plaintext', () => {
      const originalIban = 'EG380002000100000000001234567';
      const encrypted = encryptSensitiveData(originalIban);
      const decrypted = decryptSensitiveData(encrypted);

      expect(decrypted).toBe(originalIban);
    });

    it('correctly masks IBAN and bank account numbers for UI and audit logs', () => {
      const iban = 'EG380002000100000000001234567';
      const masked = maskIdentifier(iban, 'IBAN');

      expect(masked.startsWith('EG')).toBe(true);
      expect(masked.endsWith('4567')).toBe(true);
      expect(masked.includes('***')).toBe(true);
      expect(masked).not.toBe(iban);
    });

    it('returns empty string or null gracefully when encrypting null/undefined', () => {
      expect(encryptSensitiveData(null)).toBeNull();
      expect(decryptSensitiveData(null)).toBeNull();
      expect(maskIdentifier('')).toBe('N/A');
    });
  });

  describe('2. Student Refund Destination Account Management', () => {
    it('validates bank name and account number when student selects BANK_TRANSFER', async () => {
      await expect(
        paymentService.saveStudentRefundAccount({
          studentId: studentAId,
          refundMethod: 'BANK_TRANSFER',
          accountHolderName: 'Ahmed Student',
          bankName: '', // Missing
          accountNumber: '12345678',
        })
      ).rejects.toThrow(/Bank name is required/i);

      await expect(
        paymentService.saveStudentRefundAccount({
          studentId: studentAId,
          refundMethod: 'BANK_TRANSFER',
          accountHolderName: 'Ahmed Student',
          bankName: 'Banque Misr',
          accountNumber: '', // Missing
        })
      ).rejects.toThrow(/account number or IBAN is required/i);
    });

    it('saves encrypted refund account and logs consent and audit metadata', async () => {
      RefundAccount.findOne.mockResolvedValue(null);

      const mockSavedAccount = {
        student: studentAId,
        accountHolderName: 'Ahmed Student',
        refundMethod: 'BANK_TRANSFER',
        bankName: 'National Bank of Egypt',
        accountNumberMasked: '************1234',
        ibanMasked: 'EG******************5678',
        setAccountNumber: jest.fn(),
        setIban: jest.fn(),
        isVerified: true,
        auditLog: [],
        save: jest.fn().mockResolvedValue(true),
      };

      RefundAccount.mockImplementation(() => mockSavedAccount);

      const result = await paymentService.saveStudentRefundAccount({
        studentId: studentAId,
        refundMethod: 'BANK_TRANSFER',
        accountHolderName: 'Ahmed Student',
        bankName: 'National Bank of Egypt',
        accountNumber: '00123456781234',
        iban: 'EG380002000100000000005678',
        ipAddress: '192.168.1.1',
      });

      expect(mockSavedAccount.save).toHaveBeenCalled();
      expect(mockSavedAccount.auditLog.length).toBeGreaterThan(0);
      expect(mockSavedAccount.auditLog[0].action).toBe('REFUND_ACCOUNT_UPDATED');
    });
  });

  describe('3. Student Refund Request Lifecycle & Eligibility', () => {
    it('rejects refund request on unpaid or non-existent invoices', async () => {
      Invoice.findOne.mockImplementation(() =>
        mockQuery({
          _id: invoiceId,
          student: studentAId,
          status: 'Pending', // Not paid!
        })
      );

      await expect(
        paymentService.requestRefund({
          invoiceId,
          studentId: studentAId,
          amount: 3000,
          reason: 'Schedule conflict',
        })
      ).rejects.toThrow(/only be submitted for settled\/paid invoices/i);
    });

    it('rejects refund request if requested amount exceeds refundable balance', async () => {
      const paidInvoice = {
        _id: invoiceId,
        student: studentAId,
        status: 'Paid',
        amount: 3000,
        currency: 'EGP',
      };
      Invoice.findOne.mockImplementation(() => mockQuery(paidInvoice));

      const transaction = {
        _id: transactionId,
        invoice: invoiceId,
        student: studentAId,
        amount: 3000,
        refundableBalance: 1000, // Only 1,000 EGP refundable remaining
        status: 'Partially_Refunded',
      };
      PaymentTransaction.findOne.mockImplementation(() => mockQuery(transaction));

      await expect(
        paymentService.requestRefund({
          invoiceId,
          studentId: studentAId,
          amount: 2500, // Exceeds 1000!
          reason: 'Partial cancellation',
        })
      ).rejects.toThrow(/exceeds maximum refundable balance/i);
    });

    it('creates refund request in Pending Review state with audit trail', async () => {
      const paidInvoice = {
        _id: invoiceId,
        student: studentAId,
        course: new mongoose.Types.ObjectId(),
        status: 'Paid',
        amount: 3000,
        currency: 'EGP',
        save: jest.fn().mockResolvedValue(true),
      };
      Invoice.findOne.mockImplementation(() => mockQuery(paidInvoice));

      const transaction = {
        _id: transactionId,
        invoice: invoiceId,
        student: studentAId,
        amount: 3000,
        refundableBalance: 3000,
        status: 'Paid',
      };
      PaymentTransaction.findOne.mockImplementation(() => mockQuery(transaction));

      RefundAccount.findOne.mockResolvedValue({
        student: studentAId,
        accountHolderName: 'Ahmed Space',
        refundMethod: 'ORIGINAL_PAYMENT_METHOD',
        accountNumberMasked: '****',
        ibanMasked: '****',
      });

      RefundRequest.findOne.mockResolvedValue(null); // No duplicate pending request

      const mockCreatedRefundReq = {
        _id: new mongoose.Types.ObjectId(),
        refundNumber: 'EGSA-REF-TEST01',
        status: 'Pending Review',
        amount: 3000,
      };
      RefundRequest.create = jest.fn().mockResolvedValue(mockCreatedRefundReq);

      const result = await paymentService.requestRefund({
        invoiceId,
        studentId: studentAId,
        amount: 3000,
        reason: 'Medical exemption supported by paperwork',
      });

      expect(RefundRequest.create).toHaveBeenCalled();
      expect(result.status).toBe('Pending Review');
    });
  });

  describe('4. Administrative Review & Settle Flow', () => {
    it('approves refund request and sets status to Approved', async () => {
      const refundReq = {
        _id: new mongoose.Types.ObjectId(),
        status: 'Pending Review',
        amount: 3000,
        currency: 'EGP',
        auditLog: [],
        save: jest.fn().mockResolvedValue(true),
      };

      RefundRequest.findById.mockImplementation(() => mockQuery(refundReq));

      const reviewed = await paymentService.adminReviewRefund({
        refundRequestId: refundReq._id,
        adminId,
        decision: 'Approved',
        decisionNote: 'Verified and approved by Director of Space Academy Admissions',
        approvedAmount: 3000,
      });

      expect(refundReq.status).toBe('Approved');
      expect(refundReq.adminDecision.approvedAmount).toBe(3000);
      expect(refundReq.save).toHaveBeenCalled();
    });

    it('rejects refund request with mandatory explanation note', async () => {
      const refundReq = {
        _id: new mongoose.Types.ObjectId(),
        status: 'Pending Review',
        amount: 3000,
        auditLog: [],
        save: jest.fn().mockResolvedValue(true),
      };

      RefundRequest.findById.mockImplementation(() => mockQuery(refundReq));

      await expect(
        paymentService.adminReviewRefund({
          refundRequestId: refundReq._id,
          adminId,
          decision: 'Rejected',
          decisionNote: '', // Missing
        })
      ).rejects.toThrow(/Decision note is required when rejecting/i);

      await paymentService.adminReviewRefund({
        refundRequestId: refundReq._id,
        adminId,
        decision: 'Rejected',
        decisionNote: 'Requested after the course start date contrary to Academy policy',
      });

      expect(refundReq.status).toBe('Rejected');
    });

    it('settles refund via Egyptian bank transfer and updates accounting balances', async () => {
      const mockInvoice = {
        _id: invoiceId,
        amount: 3000,
        refundAmount: 0,
        status: 'Paid',
        save: jest.fn().mockResolvedValue(true),
      };

      const mockTx = {
        _id: transactionId,
        amount: 3000,
        refundAmount: 0,
        refundableBalance: 3000,
        save: jest.fn().mockResolvedValue(true),
      };

      const mockRefund = {
        _id: new mongoose.Types.ObjectId(),
        status: 'Approved',
        amount: 3000,
        currency: 'EGP',
        adminDecision: { approvedAmount: 3000 },
        transaction: mockTx,
        invoice: mockInvoice,
        student: { _id: studentAId },
        auditLog: [],
        execution: {},
        save: jest.fn().mockResolvedValue(true),
      };

      RefundRequest.findById.mockImplementation(() => mockQuery(mockRefund));

      PaymentTransaction.findById.mockResolvedValue(mockTx);
      Invoice.findById.mockResolvedValue(mockInvoice);

      const result = await paymentService.adminProcessRefund({
        refundRequestId: mockRefund._id,
        adminId,
        settlementMethod: 'BANK_TRANSFER',
        manualReference: 'NBE-WIRE-2026-9901',
        notes: 'Transferred via NBE corporate banking',
      });

      expect(mockRefund.status).toBe('Refunded');
      expect(mockRefund.execution.settlementMethod).toBe('BANK_TRANSFER');
      expect(mockTx.refundAmount).toBe(3000);
      expect(mockTx.refundableBalance).toBe(0);
      expect(mockTx.status).toBe('Refunded');
      expect(mockInvoice.refundStatus).toBe('Refunded');
      expect(mockTx.save).toHaveBeenCalled();
      expect(mockInvoice.save).toHaveBeenCalled();
    });
  });
});
