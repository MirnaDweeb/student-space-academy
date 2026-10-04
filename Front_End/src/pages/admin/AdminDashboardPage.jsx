import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/cycleServices';
import { LoadingState, ErrorState, PageHeader } from '../../components/StateComponents.jsx';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOverview = () => {
    setLoading(true);
    setError('');
    adminService
      .overview()
      .then((res) => setStats(res.data || {}))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load administration overview.'))
      .finally(() => setLoading(false));
  };

  useEffect(loadOverview, []);

  if (loading) return <LoadingState label="Loading Command Center telemetry..." />;
  if (error) return <ErrorState message={error} onRetry={loadOverview} />;

  const {
    studentCount = 0,
    courseCount = 0,
    applicationCount = 0,
    enrollmentCount = 0,
  } = stats || {};

  return (
    <div className="container-fluid py-4 px-md-5">
      <PageHeader
        title="Academy Command Center"
        subtitle="Live platform metrics, admissions throughput, active cohorts, and operational status."
        breadcrumbs={[{ label: 'Admin Command' }]}
        actions={
          <button className="btn btn-outline-secondary btn-sm" onClick={loadOverview}>
            <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh Metrics
          </button>
        }
      />

      {/* KPI Cards */}
      <div className="row g-4 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-4 border-start border-4 border-primary shadow-sm h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted text-uppercase fw-bold small">Registered Students</span>
              <div className="bg-primary-subtle text-primary p-2 rounded-circle">
                <i className="fa-solid fa-user-graduate fs-5"></i>
              </div>
            </div>
            <h2 className="fw-bold text-dark mb-1">{studentCount}</h2>
            <small className="text-muted">Verified candidate profiles</small>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-4 border-start border-4 border-info shadow-sm h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted text-uppercase fw-bold small">Training Programs</span>
              <div className="bg-info-subtle text-info-emphasis p-2 rounded-circle">
                <i className="fa-solid fa-satellite fs-5"></i>
              </div>
            </div>
            <h2 className="fw-bold text-dark mb-1">{courseCount}</h2>
            <small className="text-muted">Active space science courses</small>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-4 border-start border-4 border-warning shadow-sm h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted text-uppercase fw-bold small">Total Applications</span>
              <div className="bg-warning-subtle text-warning-emphasis p-2 rounded-circle">
                <i className="fa-solid fa-file-signature fs-5"></i>
              </div>
            </div>
            <h2 className="fw-bold text-dark mb-1">{applicationCount}</h2>
            <small className="text-muted">Admissions pipeline volume</small>
          </div>
        </div>

        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-4 border-start border-4 border-success shadow-sm h-100">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <span className="text-muted text-uppercase fw-bold small">Confirmed Enrollments</span>
              <div className="bg-success-subtle text-success p-2 rounded-circle">
                <i className="fa-solid fa-circle-check fs-5"></i>
              </div>
            </div>
            <h2 className="fw-bold text-success mb-1">{enrollmentCount}</h2>
            <small className="text-muted">Active students in training</small>
          </div>
        </div>
      </div>

      {/* Quick Action Operation Cards */}
      <div className="row g-4 mb-4">
        <div className="col-md-6 col-lg-4">
          <div className="egsa-card p-4 shadow-sm h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className="fa-solid fa-file-signature text-primary fs-5"></i>
                <h5 className="fw-bold mb-0">Admissions Queue</h5>
              </div>
              <p className="text-muted small mb-3">
                Review applicant prerequisites, evaluate readiness results, issue 72h payment invoices, and promote waitlisted candidates.
              </p>
            </div>
            <Link to="/admin/applications" className="btn btn-outline-primary btn-sm w-100">
              Manage Applications <i className="fa-solid fa-arrow-right ms-1"></i>
            </Link>
          </div>
        </div>

        <div className="col-md-6 col-lg-4">
          <div className="egsa-card p-4 shadow-sm h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className="fa-solid fa-layer-group text-info-emphasis fs-5"></i>
                <h5 className="fw-bold mb-0">Cohorts & Capacity</h5>
              </div>
              <p className="text-muted small mb-3">
                Audit cohort seat allocations, monitor capacity limits, configure new intakes, and adjust registration schedules.
              </p>
            </div>
            <Link to="/admin/cohorts" className="btn btn-outline-info btn-sm w-100">
              Inspect Cohorts <i className="fa-solid fa-arrow-right ms-1"></i>
            </Link>
          </div>
        </div>

        <div className="col-md-6 col-lg-4">
          <div className="egsa-card p-4 shadow-sm h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className="fa-solid fa-clipboard-user text-secondary fs-5"></i>
                <h5 className="fw-bold mb-0">Sessions & Attendance</h5>
              </div>
              <p className="text-muted small mb-3">
                Broadcast live session QR tokens, track on-time and late attendance rates, and review student attendance dispute requests.
              </p>
            </div>
            <Link to="/admin/attendance" className="btn btn-outline-secondary btn-sm w-100">
              Attendance Roster <i className="fa-solid fa-arrow-right ms-1"></i>
            </Link>
          </div>
        </div>

        <div className="col-md-6 col-lg-4">
          <div className="egsa-card p-4 shadow-sm h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className="fa-solid fa-credit-card text-success fs-5"></i>
                <h5 className="fw-bold mb-0">Tuition & Financials</h5>
              </div>
              <p className="text-muted small mb-3">
                Inspect institutional invoice statuses, transaction references, transportation choices, and export real accounting CSVs.
              </p>
            </div>
            <Link to="/admin/payments" className="btn btn-outline-success btn-sm w-100">
              Payments Ledger <i className="fa-solid fa-arrow-right ms-1"></i>
            </Link>
          </div>
        </div>

        <div className="col-md-6 col-lg-4">
          <div className="egsa-card p-4 shadow-sm h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className="fa-solid fa-award text-warning fs-5"></i>
                <h5 className="fw-bold mb-0">Certificate Issuance</h5>
              </div>
              <p className="text-muted small mb-3">
                Verify the 4 certificate completion gates, review submitted student names, upload official credentials, and revoke if required.
              </p>
            </div>
            <Link to="/admin/certificates" className="btn btn-outline-warning btn-sm w-100">
              Certificate Requests <i className="fa-solid fa-arrow-right ms-1"></i>
            </Link>
          </div>
        </div>

        <div className="col-md-6 col-lg-4">
          <div className="egsa-card p-4 shadow-sm h-100 d-flex flex-column justify-content-between">
            <div>
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className="fa-solid fa-photo-film text-danger fs-5"></i>
                <h5 className="fw-bold mb-0">Media Moderation</h5>
              </div>
              <p className="text-muted small mb-3">
                Moderate student training photos, laboratory snapshots, approve for public agency gallery, or request revisions.
              </p>
            </div>
            <Link to="/admin/media" className="btn btn-outline-danger btn-sm w-100">
              Moderate Media <i className="fa-solid fa-arrow-right ms-1"></i>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
