import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/cycleServices';
import { LoadingState, StatusBadge, PageHeader } from '../../components/StateComponents.jsx';

export default function AdminPaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [refunds, setRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'paid', 'pending', 'failed', 'expired', 'refunds'
  const [search, setSearch] = useState('');

  // Invoice audit modal state
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  // Refund actions state
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [refundModalMode, setRefundModalMode] = useState(null); // 'review' | 'process' | 'view'
  const [reviewDecision, setReviewDecision] = useState('APPROVED');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewAmount, setReviewAmount] = useState('');
  const [processMethod, setProcessMethod] = useState('PAYMOB_ONLINE');
  const [processRef, setProcessRef] = useState('');
  const [processNotes, setProcessNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');
  const [actionError, setActionError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      adminService.payments(),
      adminService.refunds().catch(() => ({ data: [] })),
    ])
      .then(([payRes, refRes]) => {
        setPayments(payRes.data || []);
        setRefunds(refRes.data || []);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load payments and financial records.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Filter and search payments
  const filteredPayments = useMemo(() => {
    return payments.filter((item) => {
      if (activeTab === 'paid' && item.status !== 'Paid') return false;
      if (
        activeTab === 'pending' &&
        item.status !== 'Pending' &&
        item.status !== 'Invoice Issued' &&
        item.status !== 'Payment Initiated'
      )
        return false;
      if (activeTab === 'failed' && item.status !== 'Failed') return false;
      if (activeTab === 'expired' && item.status !== 'Expired' && item.status !== 'Overdue') return false;

      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const studentName = item.student?.fullName?.toLowerCase() || '';
      const studentEmail = item.student?.email?.toLowerCase() || '';
      const invNum = (item.invoiceNumber || item._id || '').toLowerCase();
      const courseTitle = item.course?.title?.toLowerCase() || '';
      const txnRef = (
        item.latestTransaction?.providerReference ||
        item.latestTransaction?.transactionId ||
        ''
      ).toLowerCase();

      return (
        studentName.includes(q) ||
        studentEmail.includes(q) ||
        invNum.includes(q) ||
        courseTitle.includes(q) ||
        txnRef.includes(q)
      );
    });
  }, [payments, activeTab, search]);

  // Filter and search refunds
  const filteredRefunds = useMemo(() => {
    return refunds.filter((item) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const studentName = item.student?.fullName?.toLowerCase() || '';
      const studentEmail = item.student?.email?.toLowerCase() || '';
      const refNum = (item.referenceNumber || item._id || '').toLowerCase();
      const invNum = (item.invoice?.invoiceNumber || '').toLowerCase();
      const courseTitle = (item.course?.title || '').toLowerCase();

      return (
        studentName.includes(q) ||
        studentEmail.includes(q) ||
        refNum.includes(q) ||
        invNum.includes(q) ||
        courseTitle.includes(q)
      );
    });
  }, [refunds, search]);

  // Aggregate KPI stats
  const totalCount = payments.length;
  const paidCount = payments.filter((p) => p.status === 'Paid').length;
  const pendingCount = payments.filter(
    (p) => p.status === 'Pending' || p.status === 'Invoice Issued' || p.status === 'Payment Initiated'
  ).length;
  const failedCount = payments.filter((p) => p.status === 'Failed').length;
  const totalRevenue = payments
    .filter((p) => p.status === 'Paid')
    .reduce((sum, p) => sum + (p.amount || 0), 0);
  const pendingRefundsCount = refunds.filter((r) => r.status === 'PENDING_REVIEW').length;

  const handleExportCSV = () => {
    if (activeTab === 'refunds') {
      if (!filteredRefunds.length) return;
      const headers = ['Refund Ref', 'Invoice #', 'Student Name', 'Email', 'Requested (EGP)', 'Approved (EGP)', 'Status', 'Date'];
      const rows = filteredRefunds.map((r) => [
        `"${r.referenceNumber || r._id}"`,
        `"${r.invoice?.invoiceNumber || ''}"`,
        `"${r.student?.fullName || ''}"`,
        `"${r.student?.email || ''}"`,
        r.requestedAmount || 0,
        r.approvedAmount || 0,
        `"${r.status}"`,
        `"${new Date(r.createdAt).toLocaleDateString()}"`,
      ]);
      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
      const link = document.createElement('a');
      link.setAttribute('href', encodeURI(csvContent));
      link.setAttribute('download', `EGSA_Refund_Requests_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (!filteredPayments || filteredPayments.length === 0) return;
    const headers = ['Invoice Number', 'Student Name', 'Email', 'National ID', 'Course Title', 'Package Type', 'Amount (EGP)', 'Status', 'Due Date', 'Created At'];
    const rows = filteredPayments.map((p) => [
      `"${p.invoiceNumber || p._id}"`,
      `"${p.student?.fullName || ''}"`,
      `"${p.student?.email || ''}"`,
      `"${p.student?.nationalId || ''}"`,
      `"${p.course?.title || ''}"`,
      `"${p.packageType || 'WITHOUT_TRANSPORTATION'}"`,
      p.amount || 0,
      `"${p.status}"`,
      `"${p.dueDate ? new Date(p.dueDate).toLocaleDateString() : ''}"`,
      `"${new Date(p.createdAt).toLocaleDateString()}"`,
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `EGSA_Tuition_Payments_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const openReviewModal = (refund) => {
    setSelectedRefund(refund);
    setReviewDecision('APPROVED');
    setReviewNote('');
    setReviewAmount(refund.requestedAmount || '');
    setActionError('');
    setActionSuccess('');
    setRefundModalMode('review');
  };

  const openProcessModal = (refund) => {
    setSelectedRefund(refund);
    setProcessMethod('PAYMOB_ONLINE');
    setProcessRef('');
    setProcessNotes('');
    setActionError('');
    setActionSuccess('');
    setRefundModalMode('process');
  };

  const openViewModal = (refund) => {
    setSelectedRefund(refund);
    setActionError('');
    setActionSuccess('');
    setRefundModalMode('view');
  };

  const closeRefundModal = () => {
    setSelectedRefund(null);
    setRefundModalMode(null);
    setActionError('');
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRefund) return;
    setActionLoading(true);
    setActionError('');
    try {
      await adminService.reviewRefund(selectedRefund._id, {
        decision: reviewDecision,
        decisionNote: reviewNote,
        approvedAmount: reviewDecision === 'APPROVED' ? Number(reviewAmount) : undefined,
      });
      setActionSuccess(`Refund request ${reviewDecision === 'APPROVED' ? 'approved' : 'rejected'} successfully.`);
      setTimeout(() => {
        closeRefundModal();
        load();
      }, 1000);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to review refund request.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleProcessSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRefund) return;
    if (processMethod === 'BANK_TRANSFER' && !processRef.trim()) {
      setActionError('Bank transfer reference number is required for manual bank settlements.');
      return;
    }
    setActionLoading(true);
    setActionError('');
    try {
      await adminService.processRefund(selectedRefund._id, {
        settlementMethod: processMethod,
        manualReference: processRef.trim() || undefined,
        notes: processNotes.trim() || undefined,
      });
      setActionSuccess('Refund settled and finalized successfully.');
      setTimeout(() => {
        closeRefundModal();
        load();
      }, 1200);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to process refund.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <LoadingState label="Loading EGSA financial ledger and tuition payments…" />;

  return (
    <div className="container-fluid py-4 px-md-5">
      <PageHeader
        title="Tuition, Payments & Refunds Ledger"
        subtitle="Audit student tuition invoices, gateway transactions, refund review workflows, and financial snapshots."
        breadcrumbs={[
          { label: 'Admin Management', to: '/admin/applications' },
          { label: 'Payments & Refunds' },
        ]}
      />

      {/* Action Toolbar */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4 pb-2 border-bottom">
        <div className="text-muted small">
          <i className="bi bi-wallet2 me-1 text-primary"></i> Financial records, gateway telemetry, and refund queues
        </div>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-primary btn-sm"
            onClick={handleExportCSV}
            disabled={activeTab === 'refunds' ? filteredRefunds.length === 0 : filteredPayments.length === 0}
            title="Export filtered records to CSV"
          >
            <i className="bi bi-file-earmark-spreadsheet me-1"></i> Export CSV
          </button>
          <button className="btn btn-outline-secondary btn-sm" onClick={load} title="Refresh records">
            <i className="bi bi-arrow-clockwise me-1"></i> Refresh Ledger
          </button>
        </div>
      </div>

      {actionSuccess && !refundModalMode && (
        <div className="alert alert-success alert-dismissible fade show mb-4" role="alert">
          <i className="fa-solid fa-circle-check me-2"></i> {actionSuccess}
          <button type="button" className="btn-close" onClick={() => setActionSuccess('')}></button>
        </div>
      )}

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
            <span className="text-muted small text-uppercase fw-bold">Refund Requests</span>
            <h3 className="fw-bold text-danger mt-1 mb-0">{refunds.length}</h3>
            <span className="text-muted small text-danger fw-semibold">
              {pendingRefundsCount} pending administrative review
            </span>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-danger mb-4">{error}</div>}

      {/* Filters and Search Bar */}
      <div className="egsa-card p-3 mb-4 shadow-sm">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-stretch align-items-md-center gap-3">
          {/* Tab Filter */}
          <div className="btn-group btn-group-sm flex-wrap">
            <button
              className={`btn ${activeTab === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setActiveTab('all')}
            >
              All Invoices ({totalCount})
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
              Expired
            </button>
            <button
              className={`btn ${activeTab === 'refunds' ? 'btn-danger' : 'btn-outline-danger'}`}
              onClick={() => setActiveTab('refunds')}
            >
              <i className="fa-solid fa-rotate-left me-1"></i>
              Refund Requests ({refunds.length})
              {pendingRefundsCount > 0 && (
                <span className="badge bg-light text-danger ms-1">{pendingRefundsCount}</span>
              )}
            </button>
          </div>

          {/* Search Input */}
          <div className="position-relative" style={{ minWidth: '280px' }}>
            <input
              type="text"
              className="form-control form-control-sm ps-4"
              placeholder={
                activeTab === 'refunds'
                  ? 'Search refunds by student, ref, inv…'
                  : 'Search by student, email, invoice #, ref…'
              }
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

      {/* Main Content: Refunds Queue vs Invoices Ledger */}
      {activeTab === 'refunds' ? (
        filteredRefunds.length === 0 ? (
          <div className="egsa-card text-center p-5 shadow-sm">
            <i className="fa-solid fa-rotate-left fs-1 text-muted mb-3"></i>
            <h5 className="fw-bold text-dark">No refund requests found</h5>
            <p className="text-muted small">No student refund requests match your current filters.</p>
          </div>
        ) : (
          <div className="egsa-card p-0 shadow-sm overflow-hidden">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light small text-uppercase text-muted border-bottom">
                  <tr>
                    <th className="ps-4">Refund Ref</th>
                    <th>Student</th>
                    <th>Invoice & Program</th>
                    <th>Requested / Approved</th>
                    <th>Refund Destination</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th className="pe-4 text-end">Action</th>
                  </tr>
                </thead>
                <tbody className="small">
                  {filteredRefunds.map((ref) => {
                    const student = ref.student || {};
                    const inv = ref.invoice || {};
                    const course = ref.course || {};

                    return (
                      <tr key={ref._id}>
                        <td className="ps-4">
                          <span className="fw-bold text-danger font-monospace">
                            {ref.referenceNumber || ref._id.slice(-8).toUpperCase()}
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
                            {inv.invoiceNumber || 'INV-REF'}
                          </span>
                        </td>
                        <td>
                          <div>
                            <span className="fw-bold text-dark">
                              {(ref.requestedAmount || 0).toLocaleString()} {ref.currency || 'EGP'}
                            </span>
                            {ref.approvedAmount != null && (
                              <div className="text-success small" style={{ fontSize: '0.78rem' }}>
                                Appr: {ref.approvedAmount.toLocaleString()} {ref.currency || 'EGP'}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className="badge bg-light text-dark border">
                            {ref.refundDestination?.refundMethod === 'BANK_TRANSFER'
                              ? `Bank (${ref.refundDestination?.bankName || 'Transfer'})`
                              : 'Original Card / Method'}
                          </span>
                          {ref.refundDestination?.accountNumberMasked && (
                            <div className="font-monospace text-muted" style={{ fontSize: '0.72rem' }}>
                              {ref.refundDestination.accountNumberMasked}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${
                              ref.status === 'REFUNDED'
                                ? 'bg-success'
                                : ref.status === 'APPROVED'
                                ? 'bg-info text-dark'
                                : ref.status === 'PENDING_REVIEW'
                                ? 'bg-warning text-dark'
                                : ref.status === 'REJECTED'
                                ? 'bg-danger'
                                : 'bg-secondary'
                            }`}
                          >
                            {ref.status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <span className="text-muted">{new Date(ref.createdAt).toLocaleDateString()}</span>
                        </td>
                        <td className="pe-4 text-end">
                          <div className="d-flex gap-1 justify-content-end">
                            {ref.status === 'PENDING_REVIEW' && (
                              <button
                                className="btn btn-warning btn-sm py-0 px-2 fw-semibold"
                                onClick={() => openReviewModal(ref)}
                                title="Review and approve/reject refund request"
                              >
                                Review
                              </button>
                            )}
                            {ref.status === 'APPROVED' && (
                              <button
                                className="btn btn-success btn-sm py-0 px-2 fw-semibold"
                                onClick={() => openProcessModal(ref)}
                                title="Process and settle refund"
                              >
                                Settle
                              </button>
                            )}
                            <button
                              className="btn btn-outline-secondary btn-sm py-0 px-2"
                              onClick={() => openViewModal(ref)}
                              title="View full refund audit trail"
                            >
                              Audit
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : filteredPayments.length === 0 ? (
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

                  return (
                    <tr key={item._id}>
                      <td className="ps-4">
                        <span className="fw-bold text-primary-egsa">
                          {item.invoiceNumber || `INV-${item._id.slice(-6).toUpperCase()}`}
                        </span>
                        {item.refundStatus && item.refundStatus !== 'NONE' && (
                          <div className="badge bg-warning-subtle text-warning-emphasis small d-inline-block ms-1">
                            {item.refundStatus}
                          </div>
                        )}
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
                            {txn.provider || 'PAYMOB'}
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
                        {selectedInvoice.latestTransaction?.provider || 'PAYMOB'} (
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

      {/* Refund Review Modal */}
      {refundModalMode === 'review' && selectedRefund && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0" style={{ borderRadius: 'var(--radius-md)' }}>
              <form onSubmit={handleReviewSubmit}>
                <div className="modal-header bg-warning-subtle">
                  <h5 className="modal-title fw-bold text-dark">
                    <i className="fa-solid fa-clipboard-check me-2"></i>
                    Review Refund Request — {selectedRefund.referenceNumber}
                  </h5>
                  <button type="button" className="btn-close" onClick={closeRefundModal}></button>
                </div>
                <div className="modal-body p-4">
                  {actionError && <div className="alert alert-danger small py-2">{actionError}</div>}
                  {actionSuccess && <div className="alert alert-success small py-2">{actionSuccess}</div>}

                  <div className="p-3 bg-light rounded border mb-3 small">
                    <div><strong>Student:</strong> {selectedRefund.student?.fullName} ({selectedRefund.student?.email})</div>
                    <div><strong>Course:</strong> {selectedRefund.course?.title}</div>
                    <div><strong>Invoice Amount:</strong> {(selectedRefund.invoice?.amount || 0).toLocaleString()} {selectedRefund.currency || 'EGP'}</div>
                    <div><strong>Requested Amount:</strong> <span className="text-danger fw-bold">{(selectedRefund.requestedAmount || 0).toLocaleString()} {selectedRefund.currency || 'EGP'}</span></div>
                    <div className="mt-2"><strong>Reason Stated by Student:</strong></div>
                    <div className="fst-italic text-muted ps-2 border-start mt-1">{selectedRefund.reason}</div>
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold small">Administrative Decision</label>
                    <div className="d-flex gap-3">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="reviewDecision"
                          id="decApprove"
                          value="APPROVED"
                          checked={reviewDecision === 'APPROVED'}
                          onChange={() => setReviewDecision('APPROVED')}
                        />
                        <label className="form-check-label text-success fw-bold" htmlFor="decApprove">
                          Approve Request
                        </label>
                      </div>
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="reviewDecision"
                          id="decReject"
                          value="REJECTED"
                          checked={reviewDecision === 'REJECTED'}
                          onChange={() => setReviewDecision('REJECTED')}
                        />
                        <label className="form-check-label text-danger fw-bold" htmlFor="decReject">
                          Reject Request
                        </label>
                      </div>
                    </div>
                  </div>

                  {reviewDecision === 'APPROVED' && (
                    <div className="mb-3">
                      <label className="form-label fw-semibold small">Approved Amount ({selectedRefund.currency || 'EGP'})</label>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min="1"
                        max={selectedRefund.requestedAmount}
                        value={reviewAmount}
                        onChange={(e) => setReviewAmount(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label fw-semibold small">
                      {reviewDecision === 'APPROVED' ? 'Decision Notes (Optional)' : 'Rejection Reason (Required)'}
                    </label>
                    <textarea
                      className="form-control form-control-sm"
                      rows="3"
                      placeholder={reviewDecision === 'APPROVED' ? 'Administrative approval remarks…' : 'Explain why this refund request was not approved…'}
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      required={reviewDecision === 'REJECTED'}
                    ></textarea>
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={closeRefundModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={actionLoading}>
                    {actionLoading ? 'Saving Decision…' : 'Submit Decision'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Refund Process/Settle Modal */}
      {refundModalMode === 'process' && selectedRefund && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0" style={{ borderRadius: 'var(--radius-md)' }}>
              <form onSubmit={handleProcessSubmit}>
                <div className="modal-header bg-success-subtle">
                  <h5 className="modal-title fw-bold text-dark">
                    <i className="fa-solid fa-money-bill-transfer me-2 text-success"></i>
                    Process & Settle Refund — {selectedRefund.referenceNumber}
                  </h5>
                  <button type="button" className="btn-close" onClick={closeRefundModal}></button>
                </div>
                <div className="modal-body p-4">
                  {actionError && <div className="alert alert-danger small py-2">{actionError}</div>}
                  {actionSuccess && <div className="alert alert-success small py-2">{actionSuccess}</div>}

                  <div className="p-3 bg-light rounded border mb-3 small">
                    <div><strong>Student:</strong> {selectedRefund.student?.fullName}</div>
                    <div><strong>Approved Refund Amount:</strong> <span className="text-success fw-bold fs-6">{(selectedRefund.approvedAmount || selectedRefund.requestedAmount || 0).toLocaleString()} {selectedRefund.currency || 'EGP'}</span></div>
                    <div><strong>Destination Method:</strong> {selectedRefund.refundDestination?.refundMethod}</div>
                    {selectedRefund.refundDestination?.bankName && (
                      <div><strong>Bank:</strong> {selectedRefund.refundDestination.bankName}</div>
                    )}
                    {selectedRefund.refundDestination?.accountNumberMasked && (
                      <div><strong>Account:</strong> <code className="text-dark">{selectedRefund.refundDestination.accountNumberMasked}</code></div>
                    )}
                  </div>

                  <div className="mb-3">
                    <label className="form-label fw-bold small">Settlement Channel</label>
                    <select
                      className="form-select form-select-sm"
                      value={processMethod}
                      onChange={(e) => setProcessMethod(e.target.value)}
                    >
                      <option value="PAYMOB_ONLINE">Paymob Payment Gateway (Online Automated Refund)</option>
                      <option value="BANK_TRANSFER">Egyptian Banking Network / Wire Transfer</option>
                    </select>
                  </div>

                  {processMethod === 'BANK_TRANSFER' && (
                    <div className="mb-3">
                      <label className="form-label fw-semibold small">Bank Transfer Transaction Reference *</label>
                      <input
                        type="text"
                        className="form-control form-control-sm font-monospace"
                        placeholder="e.g. CIB-TXN-2026-981240 or MISR-ACH-4412"
                        value={processRef}
                        onChange={(e) => setProcessRef(e.target.value)}
                        required
                      />
                      <div className="form-text small">Enter authoritative bank settlement wire or ACH reference.</div>
                    </div>
                  )}

                  <div className="mb-3">
                    <label className="form-label fw-semibold small">Finance Notes (Optional)</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows="2"
                      placeholder="Audit note for accounting ledger…"
                      value={processNotes}
                      onChange={(e) => setProcessNotes(e.target.value)}
                    ></textarea>
                  </div>

                  <div className="alert alert-warning small mb-0">
                    <i className="fa-solid fa-triangle-exclamation me-1"></i>
                    <strong>Important:</strong> Settling this refund updates the student invoice balance, marks this transaction as refunded in the ledger, and notifies the student.
                  </div>
                </div>
                <div className="modal-footer bg-light">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={closeRefundModal}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success btn-sm" disabled={actionLoading}>
                    {actionLoading ? 'Processing Settlement…' : 'Confirm & Finalize Refund'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Refund View Audit Modal */}
      {refundModalMode === 'view' && selectedRefund && (
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
                  <i className="fa-solid fa-file-shield me-2 text-primary-egsa"></i>
                  Refund Request Audit Record — {selectedRefund.referenceNumber}
                </h5>
                <button type="button" className="btn-close" onClick={closeRefundModal}></button>
              </div>
              <div className="modal-body p-4">
                <div className="row g-3 mb-4">
                  <div className="col-md-6">
                    <div className="p-3 bg-light rounded border h-100 small">
                      <span className="text-muted text-uppercase fw-bold d-block mb-1">Student</span>
                      <h6 className="fw-bold text-dark mb-1">{selectedRefund.student?.fullName}</h6>
                      <div className="text-muted">{selectedRefund.student?.email}</div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="p-3 bg-light rounded border h-100 small">
                      <span className="text-muted text-uppercase fw-bold d-block mb-1">Financial State</span>
                      <div><strong>Status:</strong> <span className="badge bg-secondary ms-1">{selectedRefund.status}</span></div>
                      <div><strong>Requested:</strong> {(selectedRefund.requestedAmount || 0).toLocaleString()} {selectedRefund.currency}</div>
                      <div><strong>Approved:</strong> {(selectedRefund.approvedAmount ?? selectedRefund.requestedAmount ?? 0).toLocaleString()} {selectedRefund.currency}</div>
                    </div>
                  </div>
                </div>

                <h6 className="fw-bold text-dark mb-2">Audit History</h6>
                <div className="p-3 bg-light rounded border small">
                  {selectedRefund.auditLog && selectedRefund.auditLog.length > 0 ? (
                    <div className="timeline">
                      {selectedRefund.auditLog.map((log, idx) => (
                        <div key={idx} className="mb-2 pb-2 border-bottom">
                          <div className="d-flex justify-content-between">
                            <strong>{log.action}</strong>
                            <span className="text-muted">{new Date(log.timestamp).toLocaleString()}</span>
                          </div>
                          <div className="text-muted mt-1">{log.details || log.reason || 'No additional details'}</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted">No audit events recorded yet.</div>
                  )}
                </div>
              </div>
              <div className="modal-footer bg-light">
                <button type="button" className="btn btn-outline-secondary btn-sm" onClick={closeRefundModal}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
