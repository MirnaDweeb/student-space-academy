import React from 'react';

export default function TrainingJourney({
  enrollment,
  attendanceRecord,
  assessments = [],
  evaluationStatus,
  isCertified = false,
}) {
  if (!enrollment) return null;

  const isCompleted = enrollment.status === 'Completed';
  const isActive = enrollment.status === 'Active';
  const isUpcoming = enrollment.status === 'Confirmed';

  const pastSessionsCount = attendanceRecord?.sessions?.filter((s) => s.status !== 'Upcoming').length || 0;
  const totalSessions = attendanceRecord?.totalSessions || 5;

  const hasAssessmentsStarted = assessments.some((a) => a.status === 'Completed' || a.status === 'Submitted');
  const allAssessmentsDone = assessments.length > 0 && assessments.every((a) => a.status === 'Completed' || a.status === 'Submitted');

  const evalSubmitted = evaluationStatus?.isCompleted;

  const stages = [
    {
      id: 1,
      title: 'Enrollment Confirmed',
      desc: 'Application approved and seat confirmed',
      status: 'Completed',
    },
    {
      id: 2,
      title: 'Training Started',
      desc: 'Cohort inducted into EGSA training track',
      status: isActive || isCompleted ? 'Completed' : 'Upcoming',
    },
    {
      id: 3,
      title: 'Curriculum & Labs',
      desc: `${pastSessionsCount} of ${totalSessions} sessions logged`,
      status: isCompleted ? 'Completed' : isActive ? 'In Progress' : 'Upcoming',
    },
    {
      id: 4,
      title: 'Technical Assessments',
      desc: allAssessmentsDone ? 'All assessments submitted' : hasAssessmentsStarted ? 'Assessments underway' : 'Scheduled',
      status: isCompleted || allAssessmentsDone ? 'Completed' : hasAssessmentsStarted ? 'In Progress' : 'Upcoming',
    },
    {
      id: 5,
      title: 'Course Evaluation',
      desc: evalSubmitted ? 'Feedback submitted' : 'Student review and feedback',
      status: evalSubmitted ? 'Completed' : isCompleted ? 'Action Required' : 'Upcoming',
    },
    {
      id: 6,
      title: 'EGSA Credential',
      desc: isCertified ? 'Official certificate verified' : 'Academic board clearance',
      status: isCertified ? 'Completed' : 'Upcoming',
    },
  ];

  return (
    <div className="egsa-card p-4 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
          <i className="fa-solid fa-timeline text-primary-egsa"></i>
          Training Mission Lifecycle
        </h6>
        <span className="badge bg-light text-muted border small">
          Verified Lifecycle Milestones
        </span>
      </div>

      <div className="row g-2">
        {stages.map((st) => {
          let badgeClass = 'bg-light text-muted border';
          let borderClass = 'border-light-subtle bg-light-subtle';
          let icon = 'fa-circle';

          if (st.status === 'Completed') {
            badgeClass = 'bg-success-subtle text-success border border-success-subtle';
            borderClass = 'border-success-subtle bg-white';
            icon = 'fa-circle-check text-success';
          } else if (st.status === 'In Progress') {
            badgeClass = 'bg-primary text-white';
            borderClass = 'border-primary bg-white shadow-xs';
            icon = 'fa-spinner fa-spin text-primary';
          } else if (st.status === 'Action Required') {
            badgeClass = 'bg-warning text-dark';
            borderClass = 'border-warning bg-white shadow-xs';
            icon = 'fa-triangle-exclamation text-warning';
          }

          return (
            <div key={st.id} className="col-sm-6 col-lg-4">
              <div className={`p-3 border rounded h-100 ${borderClass}`}>
                <div className="d-flex justify-content-between align-items-center mb-1">
                  <span className="badge rounded-pill bg-light text-dark border small">
                    Step 0{st.id}
                  </span>
                  <span className={`badge small ${badgeClass}`}>{st.status}</span>
                </div>
                <strong className="text-dark small d-block mb-1">{st.title}</strong>
                <p className="text-muted small mb-0" style={{ fontSize: '0.75rem' }}>
                  {st.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
