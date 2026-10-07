import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { readinessService, applicationService } from '../../services/cycleServices';
import { LoadingState, ErrorState, PageHeader } from '../../components/StateComponents.jsx';

const OUTCOME_CONFIG = {
  READY: {
    label: 'ELIGIBLE — READY FOR ADMISSIONS',
    badgeClass: 'bg-success',
    icon: 'fa-circle-check',
    title: 'Readiness Requirements Satisfied',
    description:
      'Congratulations! You have demonstrated strong comprehension of foundational principles, analytical reasoning, and technical readiness.',
  },
  ELIGIBLE: {
    label: 'ELIGIBLE — READY FOR ADMISSIONS',
    badgeClass: 'bg-success',
    icon: 'fa-circle-check',
    title: 'Readiness Requirements Satisfied',
    description:
      'Congratulations! You satisfy the prerequisite readiness standards for admissions processing and seat allocation.',
  },
  CONDITIONALLY_READY: {
    label: 'CONDITIONALLY READY — RECOMMENDED PREPARATION',
    badgeClass: 'bg-primary-egsa',
    icon: 'fa-circle-info',
    title: 'Conditional Readiness Achieved',
    description:
      'You demonstrated adequate grasp of core concepts. Focus on the identified review areas during initial cohort modules.',
  },
  FOUNDATION_REQUIRED: {
    label: 'FOUNDATION RECOMMENDED — PREPARATORY FOCUS ADVISED',
    badgeClass: 'bg-warning text-dark',
    icon: 'fa-triangle-exclamation',
    title: 'Preparatory Foundation Recommended',
    description:
      'Your assessment score indicates that preparatory foundational modules are recommended before advancing to specialized coursework.',
  },
  FOUNDATION_RECOMMENDED: {
    label: 'FOUNDATION RECOMMENDED — PREPARATORY FOCUS ADVISED',
    badgeClass: 'bg-warning text-dark',
    icon: 'fa-triangle-exclamation',
    title: 'Preparatory Foundation Recommended',
    description:
      'Your assessment score indicates that foundational review is advised. Please explore the suggested preparatory modules.',
  },
  MANUAL_REVIEW: {
    label: 'MANUAL REVIEW — COMMITTEE EVALUATION',
    badgeClass: 'bg-secondary',
    icon: 'fa-clipboard-user',
    title: 'Academic Committee Review Required',
    description:
      'Your assessment has been routed to the EGSA Academic Committee for individualized review and readiness advisement.',
  },
};

export default function ReadinessResultPage() {
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submittingApp, setSubmittingApp] = useState(false);
  const navigate = useNavigate();

  const load = () => {
    setLoading(true);
    setError('');
    readinessService
      .result(attemptId)
      .then((res) => setAttempt(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load readiness result.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [attemptId]);

  const handleCreateOrContinueApplication = async () => {
    if (!attempt?.course?._id) return;
    setSubmittingApp(true);
    try {
      const res = await applicationService.create({
        courseId: attempt.course._id,
        readinessAttemptId: attempt._id,
      });
      navigate(`/student/applications/${res.data._id}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to link or create application.');
    } finally {
      setSubmittingApp(false);
    }
  };

  if (loading) return <LoadingState label="Grading and analyzing your readiness assessment…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!attempt) return null;

  const outcomeKey = attempt.outcome || 'MANUAL_REVIEW';
  const cfg = OUTCOME_CONFIG[outcomeKey] || OUTCOME_CONFIG.MANUAL_REVIEW;

  const linkedApp = attempt.application;
  const linkedInvoice = attempt.invoice;

  const isCrossfit = attempt.course && (attempt.course.slug === 'crossfit-functional-fitness-program' || /crossfit/i.test(attempt.course.title));
  const isEligible = ['READY', 'ELIGIBLE', 'CONDITIONALLY_READY'].includes(outcomeKey);
  const isAccepted = linkedApp && ['Accepted', 'Eligible - Payment Pending'].includes(linkedApp.status);
  const isPaid = linkedInvoice && linkedInvoice.status === 'Paid';
  const isPayable =
    linkedInvoice && ['Invoice Issued', 'Pending', 'Payment Initiated'].includes(linkedInvoice.status);

  const directEnrollPermitted = attempt.course?.directEnrollmentPermitted !== false;
  const totalCount = attempt.answers?.length || attempt.questions?.length || 12;
  const correctCount = attempt.answers
    ? attempt.answers.filter((a) => a.isCorrect).length
    : Math.round(((attempt.score || 0) / 100) * totalCount);

  return (
    <div>
      <PageHeader
        title="Readiness Assessment Evaluation"
        subtitle={attempt.course?.title || 'Diagnostic Assessment Report'}
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Assessments', to: '/student/assessments' },
          { label: 'Readiness Result' },
        ]}
      />

      <div className="row justify-content-center">
        <div className="col-lg-8">
          {/* Main Score & Outcome Card */}
          <div className="egsa-card text-center mb-4 p-5 shadow-sm">
            <div className="text-muted small text-uppercase fw-bold mb-2 tracking-wide">
              Official Composite Score
            </div>
            <h1 className="display-3 fw-bold text-primary-egsa mb-1">{attempt.score}%</h1>
            <div className="text-muted fw-semibold small mb-3">
              {correctCount} of {totalCount} Questions Answered Correctly
            </div>

            <div className="mb-3">
              <span className={`badge ${cfg.badgeClass} px-3 py-2 fs-6 fw-semibold`}>
                <i className={`fa-solid ${cfg.icon} me-2`}></i>
                {cfg.label}
              </span>
            </div>

            <h5 className="fw-bold text-dark mb-2">{cfg.title}</h5>
            <p className="text-muted small mx-auto mb-3" style={{ maxWidth: '520px' }}>
              {cfg.description}
            </p>

            <div className="d-flex justify-content-center gap-3 text-muted small pt-3 border-top">
              <span>
                <i className="fa-regular fa-clock me-1 text-primary-egsa"></i>
                Submitted: {new Date(attempt.submittedAt || Date.now()).toLocaleDateString()}
              </span>
              <span>
                <i className="fa-solid fa-graduation-cap me-1 text-primary-egsa"></i>
                Program: {attempt.course?.title}
              </span>
            </div>
          </div>

          {/* Medical & Safety / Academic Advisory Disclaimer */}
          {isCrossfit ? (
            <div className="alert alert-warning border-warning-subtle d-flex align-items-start gap-3 mb-4 shadow-sm">
              <i className="fa-solid fa-heart-pulse fa-lg text-danger mt-1"></i>
              <div className="small">
                <strong className="d-block mb-1 text-dark">Health, Safety & Training Disclaimer:</strong>
                This readiness assessment evaluates foundational knowledge of functional fitness, exercise form,
                and workout safety. It is <strong>neither a medical clearance nor clinical certification of physical fitness</strong>.
                Always consult a qualified healthcare provider before commencing intense physical conditioning.
              </div>
            </div>
          ) : (
            <div className="alert alert-info border-info-subtle d-flex align-items-start gap-3 mb-4 shadow-sm">
              <i className="fa-solid fa-compass fa-lg text-primary-egsa mt-1"></i>
              <div className="small">
                <strong className="d-block mb-1 text-dark">Academic & Foundational Readiness Advisory:</strong>
                This diagnostic report evaluates prerequisite conceptual understanding, problem solving, and
                learning readiness. Your score has been recorded to ensure proper academic placement and optimal
                progression in your chosen space academy program.
              </div>
            </div>
          )}

          {/* Knowledge Gaps Card */}
          {attempt.knowledgeGaps?.length > 0 && (
            <div className="egsa-card mb-4 border-start border-4 border-warning p-4 shadow-sm">
              <h6 className="fw-bold text-dark mb-2">
                <i className="fa-solid fa-triangle-exclamation text-warning me-2"></i>
                Recommended Review Areas & Topics
              </h6>
              <p className="text-muted small mb-2">
                Based on your responses, our coaching system suggests reviewing these specific functional domains:
              </p>
              <ul className="mb-0 small text-muted">
                {attempt.knowledgeGaps.map((gap, idx) => (
                  <li key={idx} className="mb-1">
                    <span className="fw-semibold text-dark">{gap}</span> — Review standard cues, scaling methods, and proper tempo.
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommended Foundation Course (if applicable) */}
          {attempt.recommendedCourse && (
            <div className="egsa-card mb-4 border-start border-4 border-primary p-4 shadow-sm">
              <span className="badge bg-primary-egsa mb-2">Suggested Preparatory Course</span>
              <h5 className="fw-bold text-dark mb-1">{attempt.recommendedCourse.title}</h5>
              <p className="text-muted small mb-3">
                This foundation course covers the prerequisite technical topics and conditioning fundamentals
                recommended prior to advancing to {attempt.course.title}.
              </p>
              <Link
                to={`/student/courses/${attempt.recommendedCourse._id}`}
                className="btn btn-outline-primary btn-sm"
              >
                View Foundation Course Details
              </Link>
            </div>
          )}

          {/* Admissions & Payment Journey Status Card */}
          <div className="egsa-card p-4 mb-4 bg-light border shadow-sm">
            <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <i className="fa-solid fa-route text-primary-egsa"></i>
              Your Admissions & Enrollment Next Steps
            </h6>

            {isPaid ? (
              <div className="p-3 bg-white rounded border d-flex justify-content-between align-items-center">
                <div>
                  <div className="badge bg-success mb-1">Enrolled & Confirmed</div>
                  <h6 className="fw-bold text-dark mb-0">You are enrolled in this course!</h6>
                  <small className="text-muted">Payment verified and seat allocated.</small>
                </div>
                <Link to="/student/dashboard" className="btn btn-primary btn-sm">
                  Go to Student Dashboard
                </Link>
              </div>
            ) : isPayable && isAccepted ? (
              <div className="p-3 bg-white rounded border d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <div className="badge bg-success mb-1">Admissions Accepted</div>
                  <h6 className="fw-bold text-dark mb-0">Seat Reserved — Invoice Ready for Payment</h6>
                  <small className="text-muted">
                    Total: {linkedInvoice.amount} {linkedInvoice.currency || 'EGP'} · Due:{' '}
                    {new Date(linkedInvoice.dueDate).toLocaleDateString()}
                  </small>
                </div>
                <Link
                  to={`/student/payments?invoiceId=${linkedInvoice._id}&applicationId=${linkedApp._id}`}
                  className="btn btn-accent px-4 py-2 fw-bold"
                >
                  <i className="fa-solid fa-credit-card me-2"></i>
                  {linkedInvoice.status === 'Payment Initiated' ? 'Continue Payment' : 'Pay Now'}
                </Link>
              </div>
            ) : linkedApp ? (
              <div className="p-3 bg-white rounded border d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <div className="badge bg-info text-dark mb-1">Status: {linkedApp.status}</div>
                  <h6 className="fw-bold text-dark mb-0">Application Connected</h6>
                  <small className="text-muted d-block">
                    {linkedApp.status === 'Under Review' || linkedApp.status === 'Manual Review'
                      ? 'Your application and readiness attempt are currently being reviewed by the Admissions Committee.'
                      : linkedApp.status === 'Foundation Recommended'
                      ? 'Preparatory foundational concepts recommended before specialized coursework. Direct admission remains available.'
                      : 'Application reference: ' + (linkedApp.referenceNumber || linkedApp._id)}
                  </small>
                </div>
                <div className="d-flex gap-2 flex-wrap">
                  {linkedApp.status === 'Foundation Recommended' && (
                    <Link to={`/student/applications/${linkedApp._id}/foundation`} className="btn btn-outline-warning text-dark btn-sm fw-semibold">
                      <i className="fa-solid fa-graduation-cap me-1"></i> Review Foundation Request
                    </Link>
                  )}
                  {linkedApp.status === 'Foundation Recommended' && directEnrollPermitted && (
                    <Link to={`/student/applications/${linkedApp._id}`} className="btn btn-primary btn-sm fw-semibold">
                      <i className="fa-solid fa-credit-card me-1"></i> Proceed to Direct Enrollment
                    </Link>
                  )}
                  {linkedApp.status !== 'Foundation Recommended' && (
                    <Link to={`/student/applications/${linkedApp._id}`} className="btn btn-primary btn-sm">
                      View Application Details
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-white rounded border d-flex justify-content-between align-items-center flex-wrap gap-2">
                <div>
                  <h6 className="fw-bold text-dark mb-0">Application Not Yet Formally Registered</h6>
                  <small className="text-muted">
                    Submit your application now to connect your score ({attempt.score}%) to the admissions seat queue.
                  </small>
                </div>
                <button
                  type="button"
                  className="btn btn-primary px-4 py-2"
                  onClick={handleCreateOrContinueApplication}
                  disabled={submittingApp}
                >
                  {submittingApp ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                      Registering Application…
                    </>
                  ) : (
                    <>
                      Submit Application <i className="fa-solid fa-arrow-right ms-2"></i>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Bottom Actions */}
          <div className="d-flex justify-content-between align-items-center mt-4">
            <Link to="/student/programs" className="btn btn-outline-secondary">
              <i className="fa-solid fa-arrow-left me-1"></i> Explore Programs
            </Link>

            {linkedApp && (
              <Link to={`/student/applications/${linkedApp._id}`} className="btn btn-outline-primary">
                View Application #{linkedApp.referenceNumber || ''}
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
