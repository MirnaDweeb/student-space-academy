import React, { useEffect, useState } from 'react';
import { portalAssessmentService } from '../../services/studentPortalServices';
import InstructorAssessmentModal from '../../components/assessments/InstructorAssessmentModal.jsx';
import AdminReadinessModal from '../../components/assessments/AdminReadinessModal.jsx';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';

export default function AdminAssessmentsPage() {
  const [assessments, setAssessments] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isGradingModalOpen, setIsGradingModalOpen] = useState(false);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [listRes, statsRes] = await Promise.all([
        portalAssessmentService.listAssessments().catch(() => []),
        portalAssessmentService.getOverviewStats().catch(() => null),
      ]);
      setAssessments(listRes || []);
      setStats(statsRes?.data || statsRes || null);
    } catch (err) {
      setError(err.message || 'Failed to load assessment data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) return <LoadingState label="Loading academic assessments and grading queue..." />;

  const {
    totalAssessments = assessments.length,
    totalSubmissions = 0,
    pendingEvaluations = 0,
    passingRate = 0,
  } = stats || {};

  return (
    <div className="container-fluid py-4 px-md-5">
      <PageHeader
        title="Assessments & Academic Grading"
        subtitle="Review cohort assessments, evaluate student assignment submissions, apply grading rubrics, and finalize marks."
        breadcrumbs={[
          { label: 'Admin Command', to: '/admin/dashboard' },
          { label: 'Assessments' },
        ]}
        actions={
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={loadData}>
              <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh
            </button>
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => setIsQuestionModalOpen(true)}
            >
              <i className="fa-solid fa-list-check me-1"></i> Readiness Question Bank
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setIsGradingModalOpen(true)}
            >
              <i className="fa-solid fa-clipboard-check me-1"></i> Open Grading Cockpit
            </button>
          </div>
        }
      />

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="fa-solid fa-triangle-exclamation me-2"></i> {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* KPI Stats */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-primary shadow-sm">
            <span className="text-muted small text-uppercase fw-bold">Active Assessments</span>
            <h3 className="fw-bold text-dark mt-1 mb-0">{totalAssessments}</h3>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-info shadow-sm">
            <span className="text-muted small text-uppercase fw-bold">Submissions Received</span>
            <h3 className="fw-bold text-info-emphasis mt-1 mb-0">{totalSubmissions}</h3>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-warning shadow-sm">
            <span className="text-muted small text-uppercase fw-bold">Pending Evaluation</span>
            <h3 className="fw-bold text-warning mt-1 mb-0">{pendingEvaluations}</h3>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-success shadow-sm">
            <span className="text-muted small text-uppercase fw-bold">Cohort Passing Rate</span>
            <h3 className="fw-bold text-success mt-1 mb-0">{passingRate}%</h3>
          </div>
        </div>
      </div>

      {/* Assessments List Table */}
      {assessments.length === 0 ? (
        <EmptyState
          icon="fa-file-lines"
          title="No Assessments Published"
          message="There are currently no active academic assessments published for cohorts."
        />
      ) : (
        <div className="table-responsive egsa-card p-3 shadow-sm mb-4">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h6 className="fw-bold text-dark mb-0">Cohort Assessment Registry</h6>
            <button
              className="btn btn-outline-primary btn-sm"
              onClick={() => setIsGradingModalOpen(true)}
            >
              <i className="fa-solid fa-graduation-cap me-1"></i> Grade with Rubric
            </button>
          </div>

          <table className="table table-hover align-middle mb-0 small">
            <thead>
              <tr className="text-muted">
                <th>Assessment Title</th>
                <th>Type</th>
                <th>Course & Cohort</th>
                <th>Passing Score</th>
                <th>Max Score</th>
                <th>Due Date</th>
                <th className="text-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((item) => (
                <tr key={item._id}>
                  <td>
                    <div className="fw-bold text-dark">{item.title}</div>
                    {item.description && (
                      <div className="text-muted text-truncate" style={{ maxWidth: 280, fontSize: '0.75rem' }}>
                        {item.description}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                      {item.type || 'Assignment'}
                    </span>
                  </td>
                  <td>
                    <div className="fw-medium text-dark">{item.course?.title || 'EGSA Course'}</div>
                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>{item.cohort?.name || 'Cohort'}</div>
                  </td>
                  <td>
                    <span className="fw-bold text-success">{item.passingScore || 70}%</span>
                  </td>
                  <td>{item.maxScore || 100} pts</td>
                  <td>
                    {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : 'No Deadline'}
                  </td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => setIsGradingModalOpen(true)}
                    >
                      <i className="fa-solid fa-pen-nib me-1"></i> Grade
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Embedded Instructor Assessment Grading Modal */}
      <InstructorAssessmentModal
        isOpen={isGradingModalOpen}
        onClose={() => setIsGradingModalOpen(false)}
        onRefreshData={loadData}
      />

      {/* Admin Readiness Question Management Cockpit Modal */}
      <AdminReadinessModal
        isOpen={isQuestionModalOpen}
        onClose={() => setIsQuestionModalOpen(false)}
      />
    </div>
  );
}
