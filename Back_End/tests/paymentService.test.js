jest.mock('../src/models/Invoice');
jest.mock('../src/models/PaymentTransaction');
jest.mock('../src/models/Application');
jest.mock('../src/models/Enrollment');
jest.mock('../src/models/Cohort');
jest.mock('../src/services/notificationService');

const Invoice = require('../src/models/Invoice');
const PaymentTransaction = require('../src/models/PaymentTransaction');
const Application = require('../src/models/Application');
const Enrollment = require('../src/models/Enrollment');
const Cohort = require('../src/models/Cohort');
const { notify } = require('../src/services/notificationService');
const { issueInvoice, confirmPayment, PAYMENT_DEADLINE_HOURS } = require('../src/services/paymentService');

describe('paymentService', () => {
  afterEach(() => jest.clearAllMocks());

  test('PAYMENT_DEADLINE_HOURS is 72, matching the required business rule', () => {
    expect(PAYMENT_DEADLINE_HOURS).toBe(72);
  });

  test('issueInvoice sets dueDate to exactly 72 hours before the course start date', async () => {
    const startDate = new Date('2026-06-01T00:00:00Z');
    const course = { _id: 'course-1', price: 3000, currency: 'EGP', startDate };
    Invoice.create.mockResolvedValue({});

    await issueInvoice({ student: 'student-1', application: 'app-1', course });

    const callArg = Invoice.create.mock.calls[0][0];
    const expectedDueDate = new Date(startDate.getTime() - 72 * 60 * 60 * 1000);
    expect(callArg.dueDate.getTime()).toBe(expectedDueDate.getTime());
    expect(callArg.status).toBe('Invoice Issued');
  });

  test('issueInvoice marks status Not Required for free (zero-price) courses', async () => {
    const course = { _id: 'course-1', price: 0, currency: 'EGP', startDate: new Date() };
    Invoice.create.mockResolvedValue({});

    await issueInvoice({ student: 'student-1', application: 'app-1', course });

    expect(Invoice.create.mock.calls[0][0].status).toBe('Not Required');
  });

  test('issueInvoice preserves a historical price snapshot independent of later Course.price changes', async () => {
    const course = { _id: 'course-1', price: 3000, currency: 'EGP', startDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) };
    Invoice.create.mockResolvedValue({});

    await issueInvoice({ student: 'student-1', application: 'app-1', course });
    const snapshot = Invoice.create.mock.calls[0][0];

    // Simulate the course price changing after the invoice was issued.
    course.price = 9999;

    expect(snapshot.coursePriceAtPurchase).toBe(3000);
    expect(snapshot.amount).toBe(3000);
    expect(snapshot.amount).not.toBe(course.price);
  });

  test('issueInvoice adds transportationAmount into the total when provided', async () => {
    const course = { _id: 'course-1', price: 2000, currency: 'EGP', startDate: new Date() };
    Invoice.create.mockResolvedValue({});

    await issueInvoice({ student: 'student-1', application: 'app-1', course, transportationAmount: 300 });

    const callArg = Invoice.create.mock.calls[0][0];
    expect(callArg.transportationAmount).toBe(300);
    expect(callArg.amount).toBe(2300);
  });

  test('confirmPayment rejects and releases the seat + cancels the application when the 72-hour deadline has passed', async () => {
    const pastDueDate = new Date(Date.now() - 1000 * 60 * 60); // 1 hour ago
    const invoice = {
      _id: 'invoice-1',
      student: 'student-1',
      course: 'course-1',
      amount: 3000,
      application: 'app-1',
      dueDate: pastDueDate,
      status: 'Invoice Issued',
      save: jest.fn().mockResolvedValue(true),
    };
    const application = {
      _id: 'app-1',
      status: 'Eligible - Payment Pending',
      statusHistory: [],
      cohort: 'cohort-1',
      save: jest.fn().mockResolvedValue(true),
    };
    Application.findById.mockResolvedValue(application);
    Cohort.findOneAndUpdate.mockResolvedValue({ _id: 'cohort-1', seatsTaken: 4 });

    await expect(confirmPayment({ invoice })).rejects.toThrow(/deadline passed/i);

    expect(invoice.status).toBe('Overdue');
    expect(invoice.save).toHaveBeenCalled();
    // Seat released atomically, guarded so it never goes negative.
    expect(Cohort.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'cohort-1', seatsTaken: { $gt: 0 } },
      { $inc: { seatsTaken: -1 } }
    );
    expect(application.status).toBe('Cancelled');
    expect(application.save).toHaveBeenCalled();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'student-1', type: 'error' }));
    expect(PaymentTransaction.create).not.toHaveBeenCalled();
  });

  test('confirmPayment succeeds, marks invoice Paid, confirms application, and creates an Enrollment when within the deadline', async () => {
    const futureDueDate = new Date(Date.now() + 1000 * 60 * 60 * 24); // 1 day from now
    const invoice = {
      _id: 'invoice-1',
      student: 'student-1',
      course: 'course-1',
      amount: 3000,
      dueDate: futureDueDate,
      status: 'Invoice Issued',
      application: 'app-1',
    };
    Invoice.findOneAndUpdate.mockResolvedValue({ ...invoice, status: 'Paid' });
    PaymentTransaction.create.mockResolvedValue({ _id: 'txn-1', status: 'Paid' });

    const application = {
      _id: 'app-1',
      status: 'Eligible - Payment Pending',
      statusHistory: [],
      cohort: 'cohort-1',
      save: jest.fn().mockResolvedValue(true),
    };
    Application.findById.mockResolvedValue(application);
    Enrollment.create.mockResolvedValue({ _id: 'enrollment-1' });

    const result = await confirmPayment({ invoice, method: 'Card' });

    expect(Invoice.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'invoice-1', status: { $in: ['Invoice Issued', 'Pending', 'Not Required'] } },
      { $set: { status: 'Paid' } },
      { new: true }
    );
    expect(PaymentTransaction.create).toHaveBeenCalled();
    expect(application.status).toBe('Confirmed');
    expect(application.save).toHaveBeenCalled();
    expect(Enrollment.create).toHaveBeenCalledWith(
      expect.objectContaining({ student: 'student-1', course: 'course-1', status: 'Confirmed' })
    );
    expect(result.transaction).toBeDefined();
  });

  test('confirmPayment is idempotent: a duplicate payment attempt on an already-claimed invoice is rejected, not double-processed', async () => {
    const invoice = {
      _id: 'invoice-1',
      student: 'student-1',
      course: 'course-1',
      amount: 3000,
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
      status: 'Invoice Issued',
      application: 'app-1',
    };
    // Simulates a second concurrent call finding the invoice already claimed
    // by the first: the conditional findOneAndUpdate matches nothing.
    Invoice.findOneAndUpdate.mockResolvedValue(null);

    await expect(confirmPayment({ invoice, method: 'Card' })).rejects.toThrow(/already been paid/i);
    expect(PaymentTransaction.create).not.toHaveBeenCalled();
    expect(Enrollment.create).not.toHaveBeenCalled();
  });

  test('confirmPayment does not enforce the deadline for free (Not Required) invoices', async () => {
    const pastDueDate = new Date(Date.now() - 1000 * 60 * 60);
    const invoice = {
      _id: 'invoice-2',
      student: 'student-1',
      course: 'course-2',
      amount: 0,
      dueDate: pastDueDate,
      status: 'Not Required',
      application: 'app-2',
    };
    Invoice.findOneAndUpdate.mockResolvedValue({ ...invoice, status: 'Paid' });
    PaymentTransaction.create.mockResolvedValue({ _id: 'txn-2', status: 'Paid' });
    Application.findById.mockResolvedValue(null);

    await expect(confirmPayment({ invoice })).resolves.toBeDefined();
    expect(Cohort.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
