import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { studentService, learningPathService } from '../../services/studentService';
import { attendanceService, portalAssessmentService } from '../../services/studentPortalServices';
import { LoadingState, ErrorState, EmptyState, PageHeader, ProgressBar } from '../../components/StateComponents.jsx';

export default function ProgressPage() {
  const [profile, setProfile] = useState(null);
  const [learningPath, setLearningPath] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      studentService.getMe().catch(() => ({ data: { profile: {} } })),
      learningPathService.recommended().catch(() => ({ data: null })),
      attendanceService.getStudentAttendance().catch(() => ({ overallPercentage: 0 })),
      portalAssessmentService.getAssessments().catch(() => ({ courseAssessments: [] })),
    ])
      .then(([profRes, pathRes, attRes, assessRes]) => {
        setProfile(profRes.data?.profile || {});
        setLearningPath(pathRes.data || null);
        setAttendance(attRes);
        setAssessments(assessRes.courseAssessments || []);
      })
      .catch((err) => setError(err.message || 'Failed to load progress data.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <LoadingState label="Analyzing your Academy academic progress…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  const completedCourses = profile?.completedCourses || [];
  const totalPathCourses = learningPath?.courses?.length || 4;
  const completedPathCount = completedCourses.length;
  const pathPct = totalPathCourses > 0 ? Math.round((completedPathCount / totalPathCourses) * 100) : 0;

  const attendanceRate = attendance?.overallPercentage ?? 100;
  const minAttendance = attendance?.policy?.minimumAttendancePercentage || 85;
  const certEligibility = attendance?.certificateEligibility || 'ON_TRACK';
  const isAttendanceAtRisk = certEligibility === 'AT_RISK';
  const isAttendanceIneligible = certEligibility === 'INELIGIBLE';
  
  let attendanceStatusLabel = 'On Track';
  let attendanceStatusClass = 'bg-success text-white';
  if (isAttendanceIneligible) {
    attendanceStatusLabel = 'Certificate Ineligible';
    attendanceStatusClass = 'bg-danger text-white';
  } else if (isAttendanceAtRisk) {
    attendanceStatusLabel = 'At Risk';
    attendanceStatusClass = 'bg-warning text-dark';
  }

  const passedAssessments = assessments.filter((a) => a.status === 'Completed').length;
  const totalAssessments = assessments.length || 4;
  const assessmentPct = totalAssessments > 0 ? Math.round((passedAssessments / totalAssessments) * 100) : 0;

  // Comprehensive milestone progress
  const milestones = [
    {
      title: 'Academy Registration & Student Profile',
      description: 'Identity verification, STEM degree details, and profile activation.',
      status: profile?.profileCompleted ? 'completed' : 'pending',
    },
    {
      title: 'Specialization Track & Learning Goal',
      description: profile?.learningGoal
        ? `Aligned with ${profile.learningGoal.title || 'Selected Goal'}.`
        : 'Select an EGSA specialization track to configure your learning path.',
      status: profile?.learningGoal ? 'completed' : 'pending',
      actionLink: !profile?.learningGoal ? '/student/goal' : null,
      actionText: 'Choose Goal',
    },
    {
      title: 'Prerequisite Verification & Readiness Clearance',
      description: 'Satisfying mandatory prerequisites and passing diagnostic assessments.',
      status: 'completed',
    },
    {
      title: 'Active Cohort Training & Lab Attendance',
      description: `Training Attendance: ${attendanceRate}% · Status: ${attendanceStatusLabel} (Minimum ${minAttendance}% required).`,
      status: isAttendanceIneligible ? 'pending' : (attendanceRate >= minAttendance && !isAttendanceAtRisk ? 'completed' : 'in_progress'),
    },
    {
      title: 'Technical Quizzes & Practical Mission Capstone',
      description: `${passedAssessments} of ${totalAssessments} graded assessments fulfilled.`,
      status: passedAssessments === totalAssessments ? 'completed' : 'in_progress',
    },
    {
      title: 'End-of-Course Evaluation & Academic Board Review',
      description: 'Submitting feedback and receiving clearance from the Egyptian Space Agency board.',
      status: 'upcoming',
    },
    {
      title: 'EGSA Space Academy Credential & Certificate',
      description: isAttendanceIneligible
        ? 'Certificate ineligibility enforced due to attendance threshold violation.'
        : 'Official verified digital credential with public cryptographic verification token.',
      status: isAttendanceIneligible ? 'pending' : 'upcoming',
    },
  ];

  return (
    <div>
      <PageHeader
        title="My Progress & Academic Milestones"
        subtitle="Holistic overview of learning path completion, attendance compliance, assessment scores, and graduation requirements."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'My Progress' },
        ]}
        actions={
          <div className="d-flex gap-2">
            <Link to="/student/goal" className="btn btn-outline-secondary btn-sm">
              <i className="fa-solid fa-bullseye me-1"></i> Change Goal
            </Link>
            <Link to="/student/learning-path" className="btn btn-primary btn-sm">
              <i className="fa-solid fa-route me-1"></i> View Path Roadmap
            </Link>
          </div>
        }
      />

      {/* High-level Progress Metric Cards */}
      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="egsa-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold text-dark mb-0">Path Completion</h6>
              <span className="badge bg-primary-egsa">{pathPct}%</span>
            </div>
            <p className="text-muted small mb-3">
              {learningPath ? learningPath.title : 'Learning Path'}
            </p>
            <ProgressBar percent={pathPct} height={8} />
            <small className="text-muted d-block mt-2">
              {completedPathCount} of {totalPathCourses} courses completed
            </small>
          </div>
        </div>

        <div className="col-md-4">
          <div className="egsa-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold text-dark mb-0">Training Attendance</h6>
              <span className={`badge ${attendanceStatusClass}`}>
                {attendanceRate}% · {attendanceStatusLabel}
              </span>
            </div>
            <p className="text-muted small mb-3">
              Minimum {minAttendance}% required for graduation clearance
            </p>
            <ProgressBar
              percent={attendanceRate}
              height={8}
              color={isAttendanceIneligible ? '#DF4F4C' : isAttendanceAtRisk ? '#F59E0B' : 'var(--color-secondary)'}
            />
            <small className={`d-block mt-2 ${isAttendanceIneligible ? 'text-danger' : isAttendanceAtRisk ? 'text-warning-emphasis' : 'text-secondary-egsa'}`}>
              {isAttendanceIneligible
                ? 'Certificate Ineligible based on attendance'
                : isAttendanceAtRisk
                ? 'Attendance At Risk — recovery required'
                : 'Attendance Status: On Track'}
            </small>
          </div>
        </div>

        <div className="col-md-4">
          <div className="egsa-card p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <h6 className="fw-bold text-dark mb-0">Assessments & Exams</h6>
              <span className="badge bg-secondary-egsa">{assessmentPct}%</span>
            </div>
            <p className="text-muted small mb-3">
              Quizzes, practical simulations & final capstone
            </p>
            <ProgressBar percent={assessmentPct} height={8} />
            <small className="text-muted d-block mt-2">
              {passedAssessments} of {totalAssessments} completed assessments
            </small>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Left Column: Milestone Timeline */}
        <div className="col-lg-8">
          <div className="egsa-card p-4 mb-4">
            <h5 className="fw-bold text-dark mb-4">
              <i className="fa-solid fa-flag-checkered text-primary-egsa me-2"></i>
              Space Academy Milestone Journey
            </h5>

            <div className="ps-2">
              {milestones.map((m, idx) => {
                const isCompleted = m.status === 'completed';
                const isInProgress = m.status === 'in_progress';
                return (
                  <div key={idx}>
                    <div className="path-node mb-2 align-items-start">
                      <div
                        className={`dot mt-1 ${
                          isCompleted ? 'completed' : isInProgress ? 'current' : 'upcoming'
                        }`}
                      >
                        {isCompleted ? (
                          <i className="fa-solid fa-check"></i>
                        ) : isInProgress ? (
                          <i className="fa-solid fa-spinner fa-spin-pulse"></i>
                        ) : (
                          idx + 1
                        )}
                      </div>
                      <div className="flex-grow-1">
                        <div className="d-flex flex-wrap justify-content-between align-items-center">
                          <h6 className="fw-bold text-dark mb-1">{m.title}</h6>
                          {isCompleted && (
                            <span className="badge bg-light text-secondary-egsa border border-secondary-subtle small">
                              Completed
                            </span>
                          )}
                          {isInProgress && (
                            <span className="badge bg-light text-primary-egsa border border-primary-subtle small">
                              In Progress
                            </span>
                          )}
                        </div>
                        <p className="text-muted small mb-2">{m.description}</p>
                        {m.actionLink && (
                          <Link to={m.actionLink} className="btn btn-outline-primary btn-sm mb-2">
                            {m.actionText} <i className="fa-solid fa-arrow-right ms-1 small"></i>
                          </Link>
                        )}
                      </div>
                    </div>
                    {idx < milestones.length - 1 && <div className="path-connector ms-3 my-1"></div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: What Remains Before Graduation */}
        <div className="col-lg-4">
          <div className="egsa-card p-4 mb-4 border-start border-4 border-primary">
            <h6 className="fw-bold text-dark mb-3">
              <i className="fa-solid fa-list-check text-primary-egsa me-2"></i>
              Remaining Requirements
            </h6>
            <p className="text-muted small mb-3">
              Complete the following items to achieve certification in your program:
            </p>

            <ul className="list-unstyled d-flex flex-column gap-2 small mb-0">
              <li className="p-2 rounded bg-light border d-flex align-items-start gap-2">
                <i className="fa-solid fa-circle-dot text-primary-egsa mt-1"></i>
                <div>
                  <strong className="text-dark d-block">Practical Lab Submissions</strong>
                  <span className="text-muted">Complete ADCS simulation report and flight software assignment.</span>
                </div>
              </li>
              <li className="p-2 rounded bg-light border d-flex align-items-start gap-2">
                <i className="fa-solid fa-circle-dot text-primary-egsa mt-1"></i>
                <div>
                  <strong className="text-dark d-block">Maintain ≥85% Attendance</strong>
                  <span className="text-muted">Attend remaining scheduled lectures & ground station drills.</span>
                </div>
              </li>
              <li className="p-2 rounded bg-light border d-flex align-items-start gap-2">
                <i className="fa-solid fa-circle-dot text-primary-egsa mt-1"></i>
                <div>
                  <strong className="text-dark d-block">Course Evaluation Form</strong>
                  <span className="text-muted">Submit official student feedback before final certificate issue.</span>
                </div>
              </li>
              <li className="p-2 rounded bg-light border d-flex align-items-start gap-2">
                <i className="fa-solid fa-circle-dot text-primary-egsa mt-1"></i>
                <div>
                  <strong className="text-dark d-block">Mission Capstone Defense</strong>
                  <span className="text-muted">Present CubeSat end-to-end design to the faculty panel.</span>
                </div>
              </li>
            </ul>
          </div>

          <div className="egsa-card p-4">
            <h6 className="fw-bold text-dark mb-2">Need Guidance?</h6>
            <p className="text-muted small mb-3">
              Your Space Academy academic advisor can help optimize your learning sequence and prerequisite planning.
            </p>
            <Link to="/student/notifications" className="btn btn-outline-secondary btn-sm w-100">
              <i className="fa-solid fa-envelope me-1"></i> Check Academy Announcements
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
