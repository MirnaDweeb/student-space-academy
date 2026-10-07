import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { applicationService } from '../../services/cycleServices';
import { LoadingState, ErrorState, StatusBadge, PageHeader } from '../../components/StateComponents.jsx';

export function computeAdmissionsPipeline(application) {
  if (!application) return [];

  const course = application.course || {};
  const cohort = application.cohort || {};
  const readiness = application.readinessAttempt || null;
  const invoice = application.invoice || null;
  const enrollment = application.enrollment || null;
  const status = application.status || 'Draft';
  const fit = application.fitResultSnapshot || null;

  // 1. Application Submitted Step
  const step1 = {
    key: 'Submitted',
    label: 'Application Submitted',
    state: 'completed',
    statusText: 'Completed',
    subtitle: `Application registered ref: ${application.referenceNumber || application._id?.slice(-6)?.toUpperCase()}`,
    date: application.submittedAt || application.createdAt,
    action: null,
  };

  // 2. Readiness / Eligibility Step
  const isDirectPermitted = course.directEnrollmentPermitted !== false;
  const isPrereqBlocked =
    fit?.result === 'Foundation Required' ||
    fit?.result === 'Not Eligible';

  const isFoundationRecommended =
    status === 'Foundation Recommended' ||
    readiness?.outcome === 'FOUNDATION_REQUIRED' ||
    readiness?.outcome === 'FOUNDATION_RECOMMENDED';

  const isReadinessCompleted =
    application.eligibilityStatus === 'Eligible' ||
    (readiness && readiness.status === 'Submitted' && !isFoundationRecommended);

  const isReadinessInProgress =
    application.eligibilityStatus === 'In Progress' ||
    (readiness && readiness.status === 'InProgress');

  let step2;
  if (isPrereqBlocked) {
    step2 = {
      key: 'Readiness',
      label: 'Readiness / Eligibility',
      state: 'blocked',
      statusText: 'Prerequisite Required',
      subtitle: 'Prerequisite academic courses required prior to enrollment',
      action: {
        label: 'Review Prerequisite Requirements',
        to: `/student/courses/${course._id}/fit`,
        variant: 'outline-warning',
        icon: 'fa-solid fa-triangle-exclamation',
      },
    };
  } else if (isFoundationRecommended) {
    step2 = {
      key: 'Readiness',
      label: 'Readiness / Eligibility',
      state: 'warning',
      statusText: isDirectPermitted ? 'Foundation Recommended (Advisory)' : 'Foundation Required',
      subtitle: readiness?.score != null
        ? `Readiness score: ${readiness.score}% — Academic prerequisites met. Foundational review advised.`
        : 'Foundational review advised prior to specialization.',
      action: {
        label: 'Review Foundation Request',
        to: `/student/applications/${application._id}/foundation`,
        variant: 'outline-warning',
        icon: 'fa-solid fa-graduation-cap',
      },
    };
  } else if (isReadinessCompleted) {
    step2 = {
      key: 'Readiness',
      label: 'Readiness / Eligibility',
      state: 'completed',
      statusText: 'Completed / Eligible',
      subtitle: readiness?.score != null
        ? `Readiness passed: ${readiness.score}% score (${readiness.outcome?.replace(/_/g, ' ') || 'READY'})`
        : 'Eligibility requirements satisfied',
      action: null,
    };
  } else if (isReadinessInProgress) {
    step2 = {
      key: 'Readiness',
      label: 'Readiness / Eligibility',
      state: 'current',
      statusText: 'In Progress',
      subtitle: 'Readiness assessment session in progress',
      action: {
        label: 'Continue Readiness Assessment',
        to: `/student/readiness/start?courseId=${course._id}`,
        variant: 'primary',
        icon: 'fa-solid fa-pen-to-square',
      },
    };
  } else {
    // Not started yet
    step2 = {
      key: 'Readiness',
      label: 'Readiness / Eligibility',
      state: isDirectPermitted ? 'completed' : 'current',
      statusText: isDirectPermitted ? 'Optional / Direct Entry' : 'Action Required',
      subtitle: isDirectPermitted
        ? 'Diagnostic assessment is optional. Direct entry permitted.'
        : 'Complete readiness pre-test to qualify for seat review',
      action: isDirectPermitted ? null : {
        label: 'Complete Readiness / Eligibility',
        to: `/student/readiness/start?courseId=${course._id}`,
        variant: 'primary',
        icon: 'fa-solid fa-pen-to-square',
      },
    };
  }

  // 3. Review & Seat Allocation Step
  let step3;
  if (isPrereqBlocked) {
    step3 = {
      key: 'Review',
      label: 'Review & Seat Allocation',
      state: 'blocked',
      statusText: 'Not Available',
      subtitle: 'Seat allocation locked due to prerequisite requirements',
      action: null,
    };
  } else if (status === 'Foundation Recommended') {
    if (isDirectPermitted) {
      step3 = {
        key: 'Review',
        label: 'Review & Seat Allocation',
        state: 'current',
        statusText: 'Direct Admission Available',
        subtitle: 'Direct enrollment permitted. You may proceed directly to seat reservation and tuition payment.',
        action: {
          label: 'Enroll & Pay Now',
          to: `/student/payments?applicationId=${application._id}`,
          variant: 'primary',
          icon: 'fa-solid fa-credit-card',
        },
      };
    } else {
      step3 = {
        key: 'Review',
        label: 'Review & Seat Allocation',
        state: 'blocked',
        statusText: 'Not Available',
        subtitle: 'Seat allocation awaiting prerequisite foundation completion',
        action: null,
      };
    }
  } else if (!isReadinessCompleted && !isDirectPermitted) {
    step3 = {
      key: 'Review',
      label: 'Review & Seat Allocation',
      state: 'locked',
      statusText: 'Upcoming milestone',
      subtitle: 'Locked — Complete Readiness / Eligibility first',
      action: null,
    };
  } else if (status === 'Rejected') {
    step3 = {
      key: 'Review',
      label: 'Review & Seat Allocation',
      state: 'blocked',
      statusText: 'Application Rejected',
      subtitle: application.rejectionReason || 'Application not accepted for this training intake',
      action: null,
    };
  } else if (status === 'Waitlisted') {
    step3 = {
      key: 'Review',
      label: 'Review & Seat Allocation',
      state: 'warning',
      statusText: 'Waitlisted',
      subtitle: `Position #${application.waitlistPosition || 1} on waitlist. Awaiting seat availability.`,
      action: null,
    };
  } else if (['Submitted', 'Under Review', 'Manual Review'].includes(status)) {
    step3 = {
      key: 'Review',
      label: 'Review & Seat Allocation',
      state: 'current',
      statusText: 'Under Review',
      subtitle: 'Academic Committee reviewing application and allocating seats',
      action: null,
    };
  } else if (['Accepted', 'Eligible - Payment Pending', 'Confirmed', 'In Progress', 'Completed'].includes(status)) {
    step3 = {
      key: 'Review',
      label: 'Review & Seat Allocation',
      state: 'completed',
      statusText: 'Seat Allocated & Approved',
      subtitle: `Approved for cohort: ${cohort.name || 'Assigned Cohort'}`,
      action: null,
    };
  } else {
    step3 = {
      key: 'Review',
      label: 'Review & Seat Allocation',
      state: 'locked',
      statusText: 'Upcoming milestone',
      subtitle: 'Awaiting academic evaluation',
      action: null,
    };
  }

  // 4. Payment & Confirmation Step
  const isPaid = invoice?.status === 'Paid' || ['Confirmed', 'In Progress', 'Completed'].includes(status);
  let step4;
  if (['Accepted', 'Eligible - Payment Pending'].includes(status)) {
    if (isPaid) {
      step4 = {
        key: 'Payment',
        label: 'Payment & Confirmation',
        state: 'completed',
        statusText: 'Payment Confirmed',
        subtitle: `Tuition settled (${invoice?.amount?.toLocaleString() || 0} ${invoice?.currency || 'EGP'})`,
        action: null,
      };
    } else {
      step4 = {
        key: 'Payment',
        label: 'Payment & Confirmation',
        state: 'current',
        statusText: 'Payment Required',
        subtitle: 'Seat reserved. Complete payment to confirm official enrollment.',
        action: {
          label: invoice?.status === 'Payment Initiated' ? 'Continue Payment' : 'Pay Now',
          to: `/student/payments?invoiceId=${invoice?._id || (typeof invoice === 'string' ? invoice : '')}&applicationId=${application._id}`,
          variant: 'primary',
          icon: invoice?.status === 'Payment Initiated' ? 'fa-solid fa-spinner fa-spin' : 'fa-solid fa-credit-card',
        },
      };
    }
  } else if (['Confirmed', 'In Progress', 'Completed'].includes(status) || isPaid) {
    step4 = {
      key: 'Payment',
      label: 'Payment & Confirmation',
      state: 'completed',
      statusText: 'Payment Confirmed',
      subtitle: `Tuition settled (${invoice?.amount?.toLocaleString() || 0} ${invoice?.currency || 'EGP'})`,
      action: null,
    };
  } else if (status === 'Foundation Recommended' && isDirectPermitted) {
    step4 = {
      key: 'Payment',
      label: 'Payment & Confirmation',
      state: 'upcoming',
      statusText: 'Available via Direct Enrollment',
      subtitle: 'Direct payment open upon seat reservation.',
      action: null,
    };
  } else {
    step4 = {
      key: 'Payment',
      label: 'Payment & Confirmation',
      state: 'locked',
      statusText: 'Payment Locked',
      subtitle: 'Accessible after formal acceptance or direct enrollment selection',
      action: null,
    };
  }

  // 5. Enrolled in Cohort Step
  let step5;
  if (['Confirmed', 'In Progress', 'Completed'].includes(status) || enrollment) {
    step5 = {
      key: 'Enrolled',
      label: 'Enrolled in Cohort',
      state: 'completed',
      statusText: 'Enrolled in Cohort',
      subtitle: `${cohort.name || 'Training Cohort'}${cohort.startDate ? ' • Starts ' + new Date(cohort.startDate).toLocaleDateString() : ''}`,
      action: {
        label: 'View Training & Schedule',
        to: '/student/training',
        variant: 'secondary',
        icon: 'fa-solid fa-award',
      },
    };
  } else {
    step5 = {
      key: 'Enrolled',
      label: 'Enrolled in Cohort',
      state: 'locked',
      statusText: 'Upcoming milestone',
      subtitle: 'Final enrollment will be confirmed upon payment settlement',
      action: null,
    };
  }

  return [step1, step2, step3, step4, step5];
}

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelError, setCancelError] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const navigate = useNavigate();

  const handleDirectEnroll = async () => {
    setEnrolling(true);
    try {
      const res = await applicationService.directEnroll(id);
      const invId = res.invoice?._id || application?.invoice?._id;
      if (invId) {
        navigate(`/student/payments?invoiceId=${invId}&applicationId=${id}`);
      } else {
        navigate(`/student/payments?applicationId=${id}`);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process direct enrollment.');
      setEnrolling(false);
    }
  };

  const load = () => {
    setLoading(true);
    setError('');
    applicationService
      .get(id)
      .then((res) => setApplication(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load application.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleCancelApplication = async () => {
    setCancelling(true);
    setCancelError('');
    try {
      await applicationService.cancel(id);
      setShowCancelModal(false);
      load();
    } catch (err) {
      setCancelError(err.response?.data?.message || 'Failed to cancel application.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) return <LoadingState label="Loading application details…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!application) return null;

  const course = application.course || {};
  const cohort = application.cohort || {};
  const readiness = application.readinessAttempt || null;
  const fit = application.fitResultSnapshot || null;
  const history = application.statusHistory || [];
  const canCancel = ['Draft', 'Submitted', 'Under Review', 'Manual Review', 'Accepted', 'Eligible - Payment Pending', 'Waitlisted'].includes(application.status);

  return (
    <div>
      <PageHeader
        title={course.title || 'Application Details'}
        subtitle={`Application ID: ${application._id}`}
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'My Applications', to: '/student/applications' },
          { label: course.title || 'Details' },
        ]}
        actions={
          <div className="d-flex gap-2">
            <Link to="/student/applications" className="btn btn-outline-secondary btn-sm">
              <i className="fa-solid fa-arrow-left me-1"></i> Back to Applications
            </Link>
            {canCancel && (
              <button
                type="button"
                className="btn btn-outline-danger btn-sm"
                onClick={() => setShowCancelModal(true)}
              >
                <i className="fa-solid fa-ban me-1"></i> Cancel Application
              </button>
            )}
          </div>
        }
      />

      <div className="row g-4">
        {/* Main Left Column */}
        <div className="col-lg-8">
          {/* Status Header Banner */}
          <div className="egsa-card mb-4 p-4">
            <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3">
              <div>
                <small className="text-muted text-uppercase fw-bold">Current Application Status</small>
                <div className="mt-1">
                  <StatusBadge status={application.status} />
                </div>
              </div>
              <div className="text-sm-end text-muted small">
                <div>Applied: {new Date(application.createdAt).toLocaleDateString()}</div>
                <div>Last updated: {new Date(application.updatedAt).toLocaleDateString()}</div>
              </div>
            </div>

            {/* Contextual guidance message */}
            <div className="p-3 bg-light rounded border">
              {(application.status === 'Accepted' || application.status === 'Eligible - Payment Pending') && (
                <div>
                  <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3">
                    <div>
                      <h6 className="fw-bold text-success mb-1">
                        <i className="fa-solid fa-circle-check text-success me-2"></i>
                        Application Accepted — Complete Payment to Confirm Seat
                      </h6>
                      <p className="text-muted small mb-0">
                        Congratulations! Your application has been approved by the EGSA Academic Committee. Please choose your package and complete payment.
                      </p>
                    </div>
                    <Link to={`/student/payments?applicationId=${application._id}`} className="btn btn-primary btn-sm px-3 mt-2 mt-sm-0">
                      <i className="fa-solid fa-credit-card me-1"></i> Choose Package & Pay
                    </Link>
                  </div>

                  {/* Pricing Package Options Preview */}
                  <div className="row g-2 pt-2 border-top">
                    <div className="col-sm-6">
                      <div className="p-2 border rounded bg-white">
                        <div className="small fw-bold text-dark">Option A: Course Only</div>
                        <div className="fs-6 fw-bold text-primary-egsa">
                          {(course.price || 0).toLocaleString()} {course.currency || 'EGP'}
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>Self transportation</small>
                      </div>
                    </div>
                    <div className="col-sm-6">
                      <div className="p-2 border rounded bg-white">
                        <div className="small fw-bold text-dark">Option B: Course + Transportation</div>
                        <div className="fs-6 fw-bold text-success">
                          {((course.price || 0) + (course.transportationPrice != null ? course.transportationPrice : 500)).toLocaleString()} {course.currency || 'EGP'}
                        </div>
                        <small className="text-muted" style={{ fontSize: '0.75rem' }}>Includes Agency Shuttle Bus</small>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {application.status === 'Under Review' && (
                <div>
                  <h6 className="fw-bold text-primary-egsa mb-1">
                    <i className="fa-solid fa-clock-rotate-left me-2"></i>
                    Application Under Review
                  </h6>
                  <p className="text-muted small mb-0">
                    Your application and eligibility results are currently under review by the EGSA Academic Committee. Decisions and seat allocation are published upon review completion.
                  </p>
                </div>
              )}

              {application.status === 'Submitted' && (
                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
                  <div>
                    <h6 className="fw-bold text-primary-egsa mb-1">
                      <i className="fa-solid fa-file-circle-check me-2"></i>
                      Application Submitted — Readiness Assessment Required
                    </h6>
                    <p className="text-muted small mb-0">
                      Your application has been registered. Please complete the prerequisite readiness assessment to qualify for seat review.
                    </p>
                  </div>
                  <Link to={`/student/readiness/start?courseId=${course._id}`} className="btn btn-primary btn-sm px-3 mt-2 mt-sm-0 text-nowrap">
                    <i className="fa-solid fa-pen-to-square me-1"></i> Start Assessment
                  </Link>
                </div>
              )}

              {application.status === 'Rejected' && (
                <div>
                  <h6 className="fw-bold text-danger mb-1">
                    <i className="fa-solid fa-circle-xmark me-2"></i>
                    Application Status Update
                  </h6>
                  <p className="text-muted small mb-2">
                    After careful review, we are unable to accept your application for this training intake.
                  </p>
                  {application.rejectionReason && (
                    <div className="alert alert-light border small text-dark py-2 px-3 mb-2">
                      <strong>Reason:</strong> {application.rejectionReason}
                    </div>
                  )}
                  <Link to="/catalog" className="btn btn-outline-secondary btn-sm">
                    <i className="fa-solid fa-compass me-1"></i> Explore Available Courses
                  </Link>
                </div>
              )}

              {application.status === 'Readiness Required' && (
                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
                  <div>
                    <h6 className="fw-bold text-dark mb-1">
                      <i className="fa-solid fa-pen-to-square text-primary-egsa me-2"></i>
                      Readiness Assessment Required
                    </h6>
                    <p className="text-muted small mb-0">
                      Complete the 10-question prerequisite check to verify readiness for this advanced syllabus.
                    </p>
                  </div>
                  <Link to={`/student/readiness/start?courseId=${course._id}`} className="btn btn-primary btn-sm px-3 mt-2 mt-sm-0">
                    Start Assessment
                  </Link>
                </div>
              )}

              {application.status === 'Foundation Recommended' && (
                <div>
                  <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-2">
                    <div>
                      <h6 className="fw-bold text-dark mb-1">
                        <i className="fa-solid fa-triangle-exclamation text-warning me-2"></i>
                        Foundation Preparation Recommended
                      </h6>
                      <p className="text-muted small mb-0">
                        {course.directEnrollmentPermitted !== false
                          ? 'Your readiness assessment indicates foundational review is advised. Because direct enrollment is permitted, you may proceed with payment or review recommendations.'
                          : 'Prerequisite analysis indicates foundational concepts are required prior to this specialization.'}
                      </p>
                    </div>
                    <div className="d-flex gap-2 flex-wrap mt-2 mt-sm-0">
                      <Link
                        to={`/student/applications/${application._id}/foundation`}
                        className="btn btn-outline-warning btn-sm fw-semibold"
                      >
                        <i className="fa-solid fa-graduation-cap me-1"></i> Review Foundation Request
                      </Link>
                      {course.directEnrollmentPermitted !== false && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm fw-bold px-3"
                          onClick={handleDirectEnroll}
                          disabled={enrolling}
                        >
                          <i className="fa-solid fa-credit-card me-1"></i> Enroll & Pay Now
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {application.status === 'Manual Review' && (
                <div>
                  <h6 className="fw-bold text-primary-egsa mb-1">
                    <i className="fa-solid fa-user-clock me-2"></i>
                    Academic Board Review in Progress
                  </h6>
                  <p className="text-muted small mb-0">
                    Your academic profile and experience are being evaluated by our space systems faculty. Decisions are normally published within 48 business hours.
                  </p>
                </div>
              )}

              {application.status === 'Confirmed' && (
                <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
                  <div>
                    <h6 className="fw-bold text-secondary-egsa mb-1">
                      <i className="fa-solid fa-award me-2"></i>
                      Admission Confirmed & Enrolled
                    </h6>
                    <p className="text-muted small mb-0">
                      You are officially registered for this cohort. View your schedule, attendance, and training materials in My Training.
                    </p>
                  </div>
                  <Link to="/student/training" className="btn btn-secondary btn-sm px-3 mt-2 mt-sm-0">
                    Go to Training
                  </Link>
                </div>
              )}

              {application.status === 'Waitlisted' && (
                <div>
                  <h6 className="fw-bold text-warning mb-1">
                    <i className="fa-solid fa-hourglass-half me-2"></i>
                    Waitlisted — Seat Allocation Pending
                  </h6>
                  <p className="text-muted small mb-2">
                    This training cohort has reached maximum capacity. You are placed in position{' '}
                    <strong className="badge bg-warning text-dark fs-6 px-2 py-1">
                      #{application.waitlistPosition || 1}
                    </strong>{' '}
                    on the waitlist. If an enrolled applicant withdraws or an unpaid seat reservation expires, your application will be automatically promoted and an acceptance invoice will be issued.
                  </p>
                </div>
              )}

              {(application.status === 'Cancelled' || application.status === 'No Show') && (
                <div>
                  <h6 className="fw-bold text-danger-egsa mb-1">
                    <i className="fa-solid fa-ban me-2"></i>
                    Application Cancelled / Expired
                  </h6>
                  <p className="text-muted small mb-0">
                    This reservation has been cancelled. If your payment window lapsed, seats have been returned to the open pool.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Dual Evaluation Breakdown Card */}
          <div className="egsa-card mb-4 p-4 shadow-sm">
            <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <i className="fa-solid fa-clipboard-check text-primary-egsa"></i>
              Admissions Evaluation & Readiness Standards
            </h6>
            <div className="row g-3">
              <div className="col-md-4">
                <div className="p-3 bg-light rounded border h-100">
                  <div className="text-muted small fw-bold text-uppercase mb-1">Prerequisite Fit</div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className={`badge ${fit?.result === 'Eligible' || application.eligibilityStatus === 'Eligible' ? 'bg-success' : 'bg-warning text-dark'}`}>
                      {fit?.result || (application.eligibilityStatus === 'Eligible' ? 'Eligible' : 'Under Review')}
                    </span>
                  </div>
                  <small className="text-muted d-block">
                    {fit?.result === 'Eligible' || application.eligibilityStatus === 'Eligible'
                      ? 'Academic qualifications and prerequisite experience satisfied.'
                      : 'Prerequisite requirements undergoing verification.'}
                  </small>
                </div>
              </div>

              <div className="col-md-4">
                <div className="p-3 bg-light rounded border h-100">
                  <div className="text-muted small fw-bold text-uppercase mb-1">Readiness Assessment</div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className={`badge ${
                      readiness?.outcome === 'READY' || readiness?.outcome === 'ELIGIBLE'
                        ? 'bg-success'
                        : readiness?.outcome === 'FOUNDATION_REQUIRED' || application.status === 'Foundation Recommended'
                        ? 'bg-warning text-dark'
                        : 'bg-secondary'
                    }`}>
                      {readiness?.outcome?.replace(/_/g, ' ') || (application.status === 'Foundation Recommended' ? 'Foundation Recommended' : 'Diagnostic Complete')}
                    </span>
                    {readiness?.score != null && (
                      <span className="fw-bold text-primary-egsa small">({readiness.score}%)</span>
                    )}
                  </div>
                  <small className="text-muted d-block">
                    {readiness?.outcome === 'FOUNDATION_REQUIRED' || application.status === 'Foundation Recommended'
                      ? 'Diagnostic assessment suggests foundational conditioning review.'
                      : 'Diagnostic assessment successfully verified.'}
                  </small>
                </div>
              </div>

              <div className="col-md-4">
                <div className="p-3 bg-light rounded border h-100">
                  <div className="text-muted small fw-bold text-uppercase mb-1">Admission Mode</div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className={`badge ${course.directEnrollmentPermitted !== false ? 'bg-info text-dark' : 'bg-secondary'}`}>
                      {course.directEnrollmentPermitted !== false ? 'Direct Enrollment Active' : 'Prerequisite Gated'}
                    </span>
                  </div>
                  <small className="text-muted d-block">
                    {course.directEnrollmentPermitted !== false
                      ? 'Readiness is optional; direct enrollment and payment permitted.'
                      : 'Readiness completion is mandatory prior to seat allocation.'}
                  </small>
                </div>
              </div>
            </div>
          </div>

          {/* Application Pipeline Timeline */}
          {(() => {
            const pipelineSteps = computeAdmissionsPipeline(application);
            return (
              <div className="egsa-card mb-4 p-4">
                <div className="d-flex justify-content-between align-items-center mb-4">
                  <div>
                    <h6 className="fw-bold text-dark mb-1">Admissions Pipeline Journey</h6>
                    <small className="text-muted">Real-time lifecycle tracking from application submission to cohort enrollment.</small>
                  </div>
                  <span className="badge bg-light text-dark border font-monospace">
                    Ref: {application.referenceNumber || application._id?.slice(-6)?.toUpperCase()}
                  </span>
                </div>

                <div className="ps-2">
                  {pipelineSteps.map((step, idx) => (
                    <div key={step.key} className="mb-2">
                      <div className="path-node mb-1">
                        <div className={`dot ${step.state}`}>
                          {step.state === 'completed' ? (
                            <i className="fa-solid fa-check"></i>
                          ) : step.state === 'warning' ? (
                            <i className="fa-solid fa-triangle-exclamation"></i>
                          ) : step.state === 'blocked' ? (
                            <i className="fa-solid fa-ban"></i>
                          ) : step.state === 'current' ? (
                            <i className="fa-solid fa-circle-dot"></i>
                          ) : (
                            <i className="fa-solid fa-lock" style={{ fontSize: '0.65rem' }}></i>
                          )}
                        </div>
                        <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center flex-grow-1 gap-2">
                          <div>
                            <div className="d-flex align-items-center gap-2">
                              <span className="fw-semibold text-dark">{step.label}</span>
                              <span
                                className={`badge ${
                                  step.state === 'completed'
                                    ? 'bg-success-subtle text-success border border-success-subtle'
                                    : step.state === 'current'
                                    ? 'bg-primary-subtle text-primary-egsa border border-primary-subtle'
                                    : step.state === 'warning'
                                    ? 'bg-warning-subtle text-warning-emphasis border border-warning-subtle'
                                    : step.state === 'blocked'
                                    ? 'bg-danger-subtle text-danger border border-danger-subtle'
                                    : 'bg-light text-muted border'
                                }`}
                                style={{ fontSize: '0.72rem' }}
                              >
                                {step.statusText}
                              </span>
                            </div>
                            <div className="text-muted small mt-0.5">{step.subtitle}</div>
                          </div>

                          {step.action && (
                            <Link
                              to={step.action.to}
                              className={`btn btn-${step.action.variant || 'primary'} btn-sm px-3 mt-1 mt-sm-0 text-nowrap`}
                            >
                              {step.action.icon && <i className={`${step.action.icon} me-1`}></i>}
                              {step.action.label}
                            </Link>
                          )}
                        </div>
                      </div>
                      {idx < pipelineSteps.length - 1 && <div className="path-connector"></div>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Readiness Assessment Snapshot (if available) */}
          {readiness && (
            <div className="egsa-card mb-4 p-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold text-dark mb-0">
                  <i className="fa-solid fa-square-poll-vertical text-primary-egsa me-2"></i>
                  Readiness Assessment Result
                </h6>
                <span className="badge bg-secondary-egsa fs-6">{readiness.score}% Score</span>
              </div>
              <div className="p-3 bg-light rounded mb-3">
                <div className="row g-2 text-center">
                  <div className="col-4">
                    <small className="text-muted d-block">Outcome</small>
                    <strong className="text-dark small">{readiness.outcome}</strong>
                  </div>
                  <div className="col-4">
                    <small className="text-muted d-block">Questions</small>
                    <strong className="text-dark small">{readiness.answers?.length || 10} Answered</strong>
                  </div>
                  <div className="col-4">
                    <small className="text-muted d-block">Completed</small>
                    <strong className="text-dark small">{new Date(readiness.completedAt || readiness.createdAt).toLocaleDateString()}</strong>
                  </div>
                </div>
              </div>
              {readiness.knowledgeGaps?.length > 0 && (
                <div>
                  <small className="fw-bold text-danger-egsa d-block mb-1">Identified Focus Areas:</small>
                  <ul className="small text-muted mb-0">
                    {readiness.knowledgeGaps.map((gap, i) => (
                      <li key={i}>{gap}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Status History Audit Trail */}
          {history.length > 0 && (
            <div className="egsa-card p-4">
              <h6 className="fw-bold text-dark mb-3">
                <i className="fa-solid fa-clock-rotate-left text-muted me-2"></i>
                Status Change History
              </h6>
              <div className="table-responsive">
                <table className="table table-sm align-middle mb-0 small">
                  <thead>
                    <tr className="text-muted">
                      <th>Timestamp</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, i) => (
                      <tr key={i}>
                        <td className="text-muted">{new Date(h.changedAt).toLocaleString()}</td>
                        <td>
                          <StatusBadge status={h.status} showIcon={false} />
                        </td>
                        <td className="text-dark">{h.note || 'Status updated by system.'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Program & Cohort Details */}
        <div className="col-lg-4">
          <div className="egsa-card p-4 mb-4">
            <h6 className="fw-bold text-dark mb-3">Program Summary</h6>
            <div className="mb-2">
              <span className="badge bg-primary-egsa mb-1">{course.category}</span>
              <h5 className="fw-bold text-dark mb-1">{course.title}</h5>
              <p className="text-muted small mb-0">{course.level}</p>
            </div>
            <hr />
            <ul className="list-unstyled small d-flex flex-column gap-2 mb-3">
              <li className="d-flex justify-content-between">
                <span className="text-muted">Tuition:</span>
                <strong className="text-accent-egsa">{course.price != null ? `${course.price} EGP` : 'TBA'}</strong>
              </li>
              <li className="d-flex justify-content-between">
                <span className="text-muted">Duration:</span>
                <strong className="text-dark">{course.duration ? `${course.duration} ${course.durationUnit}` : 'TBA'}</strong>
              </li>
              <li className="d-flex justify-content-between">
                <span className="text-muted">Delivery Mode:</span>
                <strong className="text-dark">{course.deliveryMode}</strong>
              </li>
              <li className="d-flex justify-content-between">
                <span className="text-muted">Location:</span>
                <strong className="text-dark">{course.location || 'EGSA Cairo'}</strong>
              </li>
            </ul>

            <Link to={`/student/courses/${course._id}`} className="btn btn-outline-primary btn-sm w-100">
              <i className="fa-solid fa-circle-info me-1"></i> View Full Course Syllabus
            </Link>
          </div>

          {/* Cohort Card */}
          {cohort && (
            <div className="egsa-card p-4">
              <h6 className="fw-bold text-dark mb-3">Assigned Cohort</h6>
              <div className="p-3 bg-light rounded mb-3">
                <div className="fw-bold text-dark mb-1">{cohort.name || 'Upcoming Cohort'}</div>
                <div className="text-muted small">
                  {cohort.startDate ? `Starts: ${new Date(cohort.startDate).toLocaleDateString()}` : 'Dates announced soon'}
                </div>
              </div>
              <ul className="list-unstyled small d-flex flex-column gap-2 mb-0">
                <li className="d-flex justify-content-between">
                  <span className="text-muted">Capacity:</span>
                  <strong className="text-dark">{cohort.capacity || 30} students</strong>
                </li>
                <li className="d-flex justify-content-between">
                  <span className="text-muted">Seats Reserved:</span>
                  <strong className="text-secondary-egsa">{cohort.seatsTaken || 0} filled</strong>
                </li>
                <li className="d-flex justify-content-between">
                  <span className="text-muted">Cohort Status:</span>
                  <strong className="text-dark">{cohort.status || 'Scheduled'}</strong>
                </li>
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 480 }}>
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold text-danger">
                  <i className="fa-solid fa-triangle-exclamation me-2"></i> Cancel Application
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                ></button>
              </div>
              <div className="modal-body py-4">
                <p className="text-dark mb-2">
                  Are you sure you want to cancel your application for <strong>{course.title}</strong>?
                </p>
                <div className="alert alert-warning small mb-0">
                  <i className="fa-solid fa-circle-info me-1"></i>
                  If a seat reservation was currently held for you, it will be immediately released and granted to the next applicant on the waitlist. Any pending tuition invoice will be cancelled.
                </div>
                {cancelError && (
                  <div className="alert alert-danger small mt-3 mb-0">
                    {cancelError}
                  </div>
                )}
              </div>
              <div className="modal-footer border-top">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setShowCancelModal(false)}
                  disabled={cancelling}
                >
                  Keep Application
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={handleCancelApplication}
                  disabled={cancelling}
                >
                  {cancelling ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                      Cancelling...
                    </>
                  ) : (
                    'Confirm Cancellation'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
