import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Admissions Journey Section for Egyptian Space Agency Dashboard.
 * Displays the real admissions pipeline lifecycle for the student's active application.
 */
export default function AdmissionsJourney({ application }) {
  if (!application) {
    return (
      <div className="egsa-institutional-card mb-4" aria-labelledby="admissions-heading">
        <div className="card-header-clean">
          <div className="d-flex align-items-center gap-2">
            <span className="card-header-icon-pill">
              <i className="fa-solid fa-clipboard-check text-secondary-egsa"></i>
            </span>
            <div>
              <span className="card-overline">Admissions & Enrollment</span>
              <h2 id="admissions-heading" className="card-heading-title">Admissions Pipeline Journey</h2>
            </div>
          </div>
          <Link to="/student/programs" className="clean-action-link">
            Explore Programs <i className="fa-solid fa-arrow-right ms-1"></i>
          </Link>
        </div>
        <div className="empty-training-state py-4 text-center">
          <div className="empty-state-icon-circle">
            <i className="fa-solid fa-file-signature"></i>
          </div>
          <h3 className="empty-state-title">No Active Application in Pipeline</h3>
          <p className="empty-state-description">
            You currently have no applications undergoing admissions review.
            Select a specialized space technology program to initiate your admissions trajectory.
          </p>
          <Link to="/student/programs" className="btn btn-outline-primary btn-sm px-3 mt-2">
            <i className="fa-solid fa-compass me-1"></i> View Available Programs
          </Link>
        </div>
      </div>
    );
  }

  const { status, referenceNumber, course, cohort, createdAt } = application;
  const courseTitle = course?.title || 'Space Academy Course';
  const cohortName = cohort?.name || 'Upcoming Cohort';

  // Map 5 formal admissions pipeline milestones
  // 1. Application Submitted
  // 2. Readiness / Eligibility
  // 3. Review & Seat Allocation
  // 4. Payment & Tuition
  // 5. Enrolled in Cohort

  const isRejected = status === 'Rejected';
  const isWaitlisted = status === 'Waitlisted';

  // Derive step states based on actual backend status
  const getStepStatus = (stepIndex) => {
    if (isRejected) {
      return stepIndex === 0 ? 'completed' : 'blocked';
    }

    switch (stepIndex) {
      case 0: // Application Submitted
        return 'completed';

      case 1: // Readiness / Eligibility
        if (status === 'Readiness Required') return 'active';
        if (
          ['Accepted', 'Eligible - Payment Pending', 'Confirmed', 'Enrolled'].includes(status)
        )
          return 'completed';
        if (['Submitted', 'Under Review'].includes(status)) return 'in_progress';
        return 'upcoming';

      case 2: // Review & Seat Allocation
        if (['Under Review', 'Manual Review'].includes(status)) return 'active';
        if (['Accepted', 'Eligible - Payment Pending', 'Confirmed', 'Enrolled'].includes(status))
          return 'completed';
        return 'upcoming';

      case 3: // Payment & Tuition
        if (['Accepted', 'Eligible - Payment Pending'].includes(status)) return 'active';
        if (['Confirmed', 'Enrolled'].includes(status)) return 'completed';
        return 'upcoming';

      case 4: // Enrolled in Cohort
        if (['Confirmed', 'Enrolled'].includes(status)) return 'completed';
        return 'upcoming';

      default:
        return 'upcoming';
    }
  };

  const steps = [
    { label: 'Application Submitted', sublabel: 'Form & Documents' },
    { label: 'Readiness & Eligibility', sublabel: 'Diagnostic Gate' },
    { label: 'Seat Allocation', sublabel: 'Committee Review' },
    { label: 'Payment & Settle', sublabel: 'Tuition Confirmation' },
    { label: 'Cohort Enrollment', sublabel: 'Active Admission' },
  ];

  return (
    <div className="egsa-institutional-card mb-4" aria-labelledby="admissions-heading">
      <div className="card-header-clean">
        <div className="d-flex align-items-center gap-2">
          <span className="card-header-icon-pill">
            <i className="fa-solid fa-clipboard-check text-secondary-egsa"></i>
          </span>
          <div>
            <span className="card-overline">Admissions Trajectory</span>
            <h2 id="admissions-heading" className="card-heading-title">Application Pipeline Status</h2>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="application-ref-tag">
            {referenceNumber || 'EGSA-APP'}
          </span>
          <Link
            to={`/student/applications/${application._id}`}
            className="clean-action-link"
          >
            Full Details <i className="fa-solid fa-arrow-right ms-1"></i>
          </Link>
        </div>
      </div>

      {/* Program Summary Strip */}
      <div className="application-strip-summary">
        <div>
          <span className="strip-label">Program Applied:</span>
          <span className="strip-value">{courseTitle}</span>
          <span className="strip-cohort">({cohortName})</span>
        </div>
        <div className="d-flex align-items-center gap-3">
          <span className="text-muted small">
            Submitted: {new Date(createdAt).toLocaleDateString()}
          </span>
          <span className={`status-badge-institutional status-${status.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
            {status}
          </span>
        </div>
      </div>

      {/* 5-Step Visual Stepper */}
      <div className="pipeline-stepper-container">
        <div className="pipeline-steps-wrapper">
          {steps.map((step, idx) => {
            const stepState = getStepStatus(idx);
            return (
              <div key={idx} className={`pipeline-step-node state-${stepState}`}>
                <div className="pipeline-node-indicator">
                  {stepState === 'completed' ? (
                    <i className="fa-solid fa-check"></i>
                  ) : stepState === 'active' ? (
                    <i className="fa-solid fa-arrow-right-long"></i>
                  ) : stepState === 'blocked' ? (
                    <i className="fa-solid fa-xmark"></i>
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>
                <div className="pipeline-node-info">
                  <span className="pipeline-node-label">{step.label}</span>
                  <span className="pipeline-node-sublabel d-none d-md-block">
                    {stepState === 'completed'
                      ? 'Fulfilled'
                      : stepState === 'active'
                      ? 'Current Action'
                      : stepState === 'blocked'
                      ? 'Halted'
                      : 'Upcoming'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Next Action Callout based on status */}
      <div className="pipeline-action-callout">
        {status === 'Readiness Required' ? (
          <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3">
            <div>
              <div className="callout-title text-warning">
                <i className="fa-solid fa-pen-to-square me-2"></i>
                Prerequisite Technical Assessment Required
              </div>
              <div className="callout-desc">
                Complete the 10-question technical diagnostic for this program to qualify for committee review.
              </div>
            </div>
            <Link
              to={`/student/readiness/start?courseId=${course?._id}`}
              className="btn btn-warning btn-sm px-3 fw-bold text-dark flex-shrink-0"
            >
              Start Readiness Assessment <i className="fa-solid fa-arrow-right ms-1"></i>
            </Link>
          </div>
        ) : status === 'Accepted' || status === 'Eligible - Payment Pending' ? (
          <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3">
            <div>
              <div className="callout-title text-success">
                <i className="fa-solid fa-circle-check me-2"></i>
                Admissions Accepted — Settle Tuition & Confirm Seat
              </div>
              <div className="callout-desc">
                Your application has been accepted. Select your logistics package and complete payment to finalize cohort enrollment.
              </div>
            </div>
            <Link
              to="/student/payments"
              className="btn btn-accent btn-sm px-3 fw-bold flex-shrink-0"
            >
              <i className="fa-solid fa-credit-card me-1"></i> Proceed to Payment
            </Link>
          </div>
        ) : isRejected ? (
          <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3">
            <div>
              <div className="callout-title text-danger">
                <i className="fa-solid fa-circle-xmark me-2"></i>
                Application Status: Not Accepted for Current Cycle
              </div>
              <div className="callout-desc">
                {application.rejectionReason ||
                  'The program capacity has reached its limit or admissions criteria were not met. You are invited to explore alternative tracks.'}
              </div>
            </div>
            <Link to="/student/programs" className="btn btn-outline-primary btn-sm flex-shrink-0">
              Browse Other Programs
            </Link>
          </div>
        ) : (
          <div className="d-flex flex-column flex-sm-row align-items-start align-items-sm-center justify-content-between gap-3">
            <div>
              <div className="callout-title text-primary-egsa">
                <i className="fa-solid fa-clock-rotate-left me-2"></i>
                Application Under Active Committee Review
              </div>
              <div className="callout-desc">
                The Egyptian Space Agency admissions board is evaluating submitted academic credentials. No student action is needed at this time.
              </div>
            </div>
            <Link
              to={`/student/applications/${application._id}`}
              className="btn btn-outline-primary btn-sm flex-shrink-0"
            >
              View Application Details
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
