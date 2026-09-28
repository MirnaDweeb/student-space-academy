import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/cycleServices';
import { LoadingState, StatusBadge, PageHeader } from '../../components/StateComponents.jsx';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'paid', 'pending', 'failed', 'expired'
  const [search, setSearch] = useState('');

  // Audit detail modal state
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    adminService
      .payments()
      .then((res) => setPayments(res.data || []))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load payments and financial records.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Filter and search
  const filteredPayments = useMemo(() => {
    return payments.filter((item) => {
      // Tab filter
      if (activeTab === 'paid' && item.status !== 'Paid') return false;
      if (activeTab === 'pending' && item.status !== 'Pending' && item.status !== 'Invoice Issued' && item.status !== 'Payment Initiated')
        return false;
      if (activeTab === 'failed' && item.status !== 'Failed') return false;
      if (activeTab === 'expired' && item.status !== 'Expired' && item.status !== 'Overdue') return false;

      // Text search
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const studentName = item.student?.fullName?.toLowerCase() || '';
      const studentEmail = item.student?.email?.toLowerCase() || '';
      const invNum = (item.invoiceNumber || item._id || '').toLowerCase();
      const courseTitle = item.course?.title?.toLowerCase() || '';
      const txnRef = (item.latestTransaction?.providerReference || item.latestTransaction?.transactionId || '').toLowerCase();

      return (
        studentName.includes(q) ||
        studentEmail.includes(q) ||
        invNum.includes(q) ||
        courseTitle.includes(q) ||
        txnRef.includes(q)
      );
    });
  }, [payments, activeTab, search]);

  // Aggregate KPI stats
  const totalCount = payments.length;
  const paidCount = payments.filter((p) => p.status === 'Paid').length;
  const pendingCount = payments.filter((p) => p.status === 'Pending' || p.status === 'Invoice Issued' || p.status === 'Payment Initiated').length;
  const failedCount = payments.filter((p) => p.status === 'Failed').length;
  const totalRevenue = payments
    .filter((p) => p.status === 'Paid')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  if (loading) return <LoadingState label="Loading EGSA financial ledger and tuition payments…" />;

  return (
    <div className="container-fluid py-4 px-md-5">
      <PageHeader
        title="Tuition & Payments Ledger"
        subtitle="Audit student tuition invoices, gateway transactions, transportation options, and financial snapshots."
        breadcrumbs={[
          { label: 'Admin Management', to: '/admin/applications' },
          { label: 'Payments' },
        ]}
      />

      {/* Admin Section Tabs Navigation */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4 pb-2 border-bottom">
        <ul className="nav nav-pills">
          <li className="nav-item">
            <Link to="/admin/applications" className="nav-link text-muted">
              <i className="fa-solid fa-file-signature me-2"></i>
              Admissions Applications
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/admin/certificates" className="nav-link text-muted">
              <i className="fa-solid fa-award me-2"></i>
              Certificate Queue
            </Link>
          </li>
          <li className="nav-item">
            <Link to="/admin/payments" className="nav-link active bg-primary-egsa text-white">
              <i className="fa-solid fa-credit-card me-2"></i>
              Payments & Invoices
            </Link>
          </li>
        </ul>
        <button className="btn btn-outline-secondary btn-sm" onClick={load} title="Refresh records">
          <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh Ledger
        </button>
      </div>

      {/* KPI Stats Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-primary shadow-sm">
            <span className="text-muted small text-uppercase fw-bold">Total Invoices</span>
            <h3 className="fw-bold text-dark mt-1 mb-0">{totalCount}</h3>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-success shadow-sm">
            <span className="text-muted small text-uppercase fw-bold">Total Collected (Paid)</span>
            <h3 className="fw-bold text-success mt-1 mb-0">{totalRevenue.toLocaleString()} EGP</h3>
            <span className="text-muted small">{paidCount} confirmed payment(s)</span>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-warning shadow-sm">
            <span className="text-muted small text-uppercase fw-bold">Pending Tuition</span>
            <h3 className="fw-bold text-warning mt-1 mb-0">{pendingCount}</h3>
            <span className="text-muted small">Awaiting student checkout</span>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-danger shadow-sm">
            <span className="text-muted small text-uppercase fw-bold">Failed / Cancelled</span>
            <h3 className="fw-bold text-danger mt-1 mb-0">{failedCount}</h3>
            <span className="text-muted small">Declined transactions</span>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger mb-4">{error}</div>}

      {/* Filters and Search Bar */}
      <div className="egsa-card p-3 mb-4 shadow-sm">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-3">
          {/* Tab Filter */}
          <div className="btn-group btn-group-sm">
            <button
              className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('all')}
            >
              All ({totalCount})
            </button>
            <button
              className={`btn ${activeTab === 'paid' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('paid')}
            >
              Paid ({paidCount})
            </button>
            <button
              className={`btn ${activeTab === 'pending' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('pending')}
            >
              Pending ({pendingCount})
            </button>
            <button
              className={`btn ${activeTab === 'failed' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('failed')}
            >
              Failed ({failedCount})
            </button>
            <button
              className={`btn ${activeTab === 'expired' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('expired')}
            >
              Expired / Overdue
            </button>
          </div>

          {/* Search Input */}
          <div className="position-relative" style={{ minWidth: '280px' }}>
            <input
              type="text"
              className="form-control form-control-sm ps-4"
              placeholder="Search by student, email, invoice #, ref…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <i className="fa-solid fa-magnifying-glass text-muted position-absolute top-50 start-0 translate-middle-y ms-2 small"></i>
            {search && (
              <button
                className="btn btn-link position-absolute top-50 end-0 translate-middle-y p-0 me-2 text-muted"
                onClick={() => setSearch('')}
              >
                <i className="fa-solid fa-xmark small"></i>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Ledger Table */}
      {filteredPayments.length === 0 ? (
        <div className="egsa-card text-center p-5 shadow-sm">
          <i className="fa-solid fa-receipt fs-1 text-muted mb-3"></i>
          <h5 className="fw-bold text-dark">No records found</h5>
          <p className="text-muted small">No payment transactions match your active filters.</p>
        </div>
      ) : (
        <div className="egsa-card p-0 shadow-sm overflow-hidden">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light small text-uppercase text-muted border-bottom">
                <tr>
                  <th className="ps-4">Invoice #</th>
                  <th>Student</th>
                  <th>Course & Cohort</th>
                  <th>Package</th>
                  <th>Total Due</th>
                  <th>Status</th>
                  <th>Provider / Ref</th>
                  <th>Date</th>
                  <th className="pe-4 text-end">Action</th>
                </tr>
              </thead>
              <tbody className="small">
                {filteredPayments.map((item) => {
                  const student = item.student || {};
                  const course = item.course || {};
                  const cohort = item.cohort || item.application?.cohort;
                  const txn = item.latestTransaction || {};
                  const isPaid = item.status === 'Paid';

                  return (
                    <tr key={item._id}>
                      <td className="ps-4">
                        <span className="fw-bold text-primary-egsa">
                          {item.invoiceNumber || `INV-${item._id.slice(-6).toUpperCase()}`}
                        </span>
                      </td>
                      <td>
                        <div className="fw-semibold text-dark">{student.fullName || 'Student'}</div>
                        <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                          {student.email}
                        </span>
                      </td>
                      <td>
                        <div className="fw-medium text-dark">{course.title || 'Course Tuition'}</div>
                        <span className="text-muted" style={{ fontSize: '0.78rem' }}>
                          {cohort?.name || (typeof cohort === 'string' ? cohort : 'General Cohort')}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            item.packageType === 'WITH_TRANSPORTATION'
                              ? 'bg-info-subtle text-info-emphasis'
                              : 'bg-light text-dark border'
                          }`}
                        >
                          {item.packageType === 'WITH_TRANSPORTATION' ? 'Course + Shuttle' : 'Course Only'}
                        </span>
                      </td>
                      <td>
                        <span className="fw-bold text-dark">
                          {(item.amount || 0).toLocaleString()} {item.currency || 'EGP'}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        <div className="text-truncate" style={{ maxWidth: '140px' }} title={txn.providerReference || txn.transactionId}>
                          <span className="badge bg-secondary-subtle text-secondary small me-1">
                            {txn.provider || 'GATEWAY'}
                          </span>
                          <span className="text-muted font-monospace" style={{ fontSize: '0.75rem' }}>
                            {txn.providerReference?.slice(-8) || txn.transactionId?.slice(-8) || '—'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className="text-muted">
                          {item.paidAt
                            ? new Date(item.paidAt).toLocaleDateString()
                            : new Date(item.createdAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="pe-4 text-end">
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => setSelectedInvoice(item)}
                        >
                          <i className="fa-solid fa-eye me-1"></i> Audit Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice & Audit Details Modal */}
      {selectedInvoice && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow border-0" style={{ borderRadius: 'var(--radius-md)' }}>
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold text-dark">
                  <i className="fa-solid fa-file-invoice-dollar me-2 text-primary-egsa"></i>
                  Invoice Audit Record — {selectedInvoice.invoiceNumber || selectedInvoice._id}
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedInvoice(null)}
                ></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <div className="p-3 bg-light rounded border h-100">
                      <span className="text-muted small text-uppercase fw-bold d-block mb-2">Student & Candidate</span>
                      <h6 className="fw-bold text-dark mb-1">{selectedInvoice.student?.fullName}</h6>
                      <div className="text-muted small mb-1">
                        <i className="fa-regular fa-envelope me-1"></i> {selectedInvoice.student?.email}
                      </div>
                      <div className="text-muted small">
                        <i className="fa-solid fa-id-card me-1"></i> National ID: {selectedInvoice.student?.nationalId || 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="col-md-6">
                    <div className="p-3 bg-light rounded border h-100">
                      <span className="text-muted small text-uppercase fw-bold d-block mb-2">Academic Program</span>
                      <h6 className="fw-bold text-dark mb-1">{selectedInvoice.course?.title}</h6>
                      <div className="text-muted small mb-1">
                        <i className="fa-solid fa-users me-1"></i> Cohort: {selectedInvoice.cohort?.name || selectedInvoice.application?.cohort?.name || 'General Intake'}
                      </div>
                      <div className="text-muted small">
                        <i className="fa-regular fa-calendar-days me-1"></i> Start Date: {selectedInvoice.course?.startDate ? new Date(selectedInvoice.course.startDate).toLocaleDateString() : 'TBA'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Financial Snapshot */}
                <h6 className="fw-bold text-dark mb-2">Financial Snapshot at Issuance</h6>
                <div className="table-responsive mb-3 border rounded">
                  <table className="table table-sm table-borderless mb-0">
                    <tbody>
                      <tr className="border-bottom">
                        <td className="ps-3 text-muted">Base Course Tuition</td>
                        <td className="pe-3 text-end fw-semibold">
                          {(selectedInvoice.baseAmount ?? selectedInvoice.coursePriceAtPurchase ?? selectedInvoice.amount).toLocaleString()} {selectedInvoice.currency || 'EGP'}
                        </td>
                      </tr>
                      <tr className="border-bottom">
                        <td className="ps-3 text-muted">
                          Transportation Fee ({selectedInvoice.packageType === 'WITH_TRANSPORTATION' ? 'Selected' : 'Not Selected'})
                        </td>
                        <td className="pe-3 text-end fw-semibold">
                          {(selectedInvoice.transportationAmount ?? 0).toLocaleString()} {selectedInvoice.currency || 'EGP'}
                        </td>
                      </tr>
                      <tr className="bg-light fw-bold">
                        <td className="ps-3 text-dark">Total Invoice Amount</td>
                        <td className="pe-3 text-end text-primary-egsa fs-6">
                          {(selectedInvoice.amount || 0).toLocaleString()} {selectedInvoice.currency || 'EGP'}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Transaction & Audit Metadata */}
                <h6 className="fw-bold text-dark mb-2">Gateway & Transaction Telemetry</h6>
                <div className="p-3 bg-light rounded border small">
                  <div className="row g-2">
                    <div className="col-sm-6">
                      <span className="text-muted d-block">Status:</span>
                      <StatusBadge status={selectedInvoice.status} />
                    </div>
                    <div className="col-sm-6">
                      <span className="text-muted d-block">Provider:</span>
                      <strong className="text-dark">
                        {selectedInvoice.latestTransaction?.provider || 'MOCK_SANDBOX'} (
                        {selectedInvoice.latestTransaction?.isMock ? 'Sandbox Mode' : 'Live Gateway'})
                      </strong>
                    </div>
                    <div className="col-sm-6">
                      <span className="text-muted d-block">Transaction ID / Reference:</span>
                      <code className="text-dark">
                        {selectedInvoice.latestTransaction?.providerReference || selectedInvoice.latestTransaction?.transactionId || 'N/A'}
                      </code>
                    </div>
                    <div className="col-sm-6">
                      <span className="text-muted d-block">Settled / Paid At:</span>
                      <strong className="text-dark">
                        {selectedInvoice.paidAt ? new Date(selectedInvoice.paidAt).toLocaleString() : 'Not Yet Paid'}
                      </strong>
                    </div>
                    <div className="col-sm-6">
                      <span className="text-muted d-block">72-Hour Deadline (Due At):</span>
                      <strong className="text-dark">
                        {selectedInvoice.dueAt || selectedInvoice.dueDate ? new Date(selectedInvoice.dueAt || selectedInvoice.dueDate).toLocaleString() : 'No explicit deadline'}
                      </strong>
                    </div>
                    <div className="col-sm-6">
                      <span className="text-muted d-block">Issued At:</span>
                      <strong className="text-dark">
                        {new Date(selectedInvoice.issuedAt || selectedInvoice.createdAt).toLocaleString()}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-footer bg-light justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setSelectedInvoice(null)}
                >
                  Close
                </button>
                <Link
                  to={`/admin/applications`}
                  className="btn btn-outline-primary btn-sm"
                  onClick={() => setSelectedInvoice(null)}
                >
                  <i className="fa-solid fa-arrow-up-right-from-square me-1"></i> View Admissions
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
