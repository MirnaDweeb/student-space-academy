import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { dashboardService } from '../../services/studentService';
import { attendanceService } from '../../services/studentPortalServices';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, ErrorState, StatusBadge, ProgressBar } from '../../components/StateComponents.jsx';
import {
  LearningTrajectory,
  ProgressRing,
  AttendanceHealth,
  MissionGateAlert,
} from '../../components/AerospaceComponents.jsx';

export default function DashboardPage() {
  const { user: authUser } = useAuth();
  const [data, setData] = useState(null);
  const [attendanceData, setAttendanceData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    Promise.all([
      dashboardService.get(),
      attendanceService.getStudentAttendance().catch(() => null),
    ])
      .then(([dashRes, attRes]) => {
        setData(dashRes.data);
        setAttendanceData(attRes);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load dashboard.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <LoadingState label="Loading your Academy dashboard…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const {
    profile,
    learningPath,
    currentApplication,
    applications = [],
    upcomingEnrollments = [],
    pendingActions = [],
    recommendations = [],
    notifications = [],
  } = data;

  const progressPct = learningPath && learningPath.totalCourses > 0
    ? Math.round((learningPath.completedCount / learningPath.totalCourses) * 100)
    : 0;

  let currentStage = 'application';
  if (upcomingEnrollments.length > 0) {
    currentStage = 'training';
  } else if (
    currentApplication?.status === 'Confirmed' ||
    currentApplication?.status === 'Enrolled'
  ) {
    currentStage = 'enrollment';
  } else if (
    currentApplication?.status === 'Accepted' ||
    currentApplication?.status === 'Eligible - Payment Pending' ||
    currentApplication?.status === 'Readiness Required'
  ) {
    currentStage = 'selection';
  } else if (applications.length > 0) {
    currentStage = 'application';
  }

  // Derive most urgent mission gate action
  let urgentGate = null;
  if (currentApplication?.status === 'Accepted' || currentApplication?.status === 'Eligible - Payment Pending') {
    urgentGate = {
      type: 'urgent',
      badge: 'PAYMENT GATE',
      title: 'Tuition Settlement & Package Selection Required',
      message: `Your application for "${currentApplication.course?.title}" is accepted! Select your package and settle tuition to confirm your seat.`,
      deadline: '72h Deadline',
      actionLabel: 'Select Package & Pay',
      actionLink: '/student/payments',
    };
  } else if (currentApplication?.status === 'Readiness Required') {
    urgentGate = {
      type: 'urgent',
      badge: 'DIAGNOSTIC GATE',
      title: 'Prerequisite Readiness Assessment Required',
      message: `Complete the 10-question technical diagnostic for "${currentApplication.course?.title}" to finalize review.`,
      deadline: 'Pre-flight Check',
      actionLabel: 'Start Readiness Test',
      actionLink: `/student/readiness/start?courseId=${currentApplication.course?._id}`,
    };
  }

  return (
    <div>
      {/* Aerospace Mission Cockpit Hero */}
      <div className="mission-cockpit-hero mb-4">
        <div className="row align-items-center">
          <div className="col-lg-8">
            <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
              <span className="telemetry-chip pulse">
                <span className="status-dot"></span>
                <span>MISSION STATION: EGSA CAIRO</span>
              </span>
              <span className="telemetry-chip d-none d-sm-inline-flex">
                LAT 29.9792° N / LON 31.1342° E
              </span>
              <span className="telemetry-chip text-warning">
                CYCLE 2026/27 · ACTIVE
              </span>
            </div>

            <h2 className="h3 fw-bold mb-2">
              Welcome back, {authUser?.fullName || profile?.user?.fullName || 'Cadet Sara'}.
            </h2>
            <p className="mb-3 text-white-50" style={{ maxWidth: '640px' }}>
              {profile?.learningGoal
                ? `Active Specialization: ${profile.learningGoal.title}. Continue your Space Academy training and track your milestone trajectory.`
                : 'Welcome to the Egyptian Space Agency platform. Select your aerospace specialization to activate tailored curriculum pathways.'}
            </p>

            <div className="d-flex flex-wrap gap-2 pt-1">
              {!profile?.learningGoal && (
                <Link to="/student/goal" className="btn btn-accent btn-sm px-3">
                  <i className="fa-solid fa-bullseye me-1"></i> Select Track Goal
                </Link>
              )}
              <Link
                to="/student/programs"
                className="btn btn-light btn-sm px-3 text-primary-egsa fw-semibold"
              >
                <i className="fa-solid fa-compass me-1"></i> Explore Programs
              </Link>
              <Link
                to="/student/training"
                className="btn btn-outline-light btn-sm px-3"
              >
                <i className="fa-solid fa-graduation-cap me-1"></i> My Training ({upcomingEnrollments.length})
              </Link>
            </div>
          </div>

          <div className="col-lg-4 d-none d-lg-flex justify-content-end align-items-center pe-3">
            <div
              className="text-center p-3 rounded"
              style={{
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(4px)',
              }}
            >
              <div className="small text-white-50 mb-1 text-uppercase tracking-wider">
                Specialization Mastery
              </div>
              <ProgressRing
                percent={progressPct}
                size={110}
                label="Completed"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Urgent Mission Gate Banner if action is required */}
      {urgentGate && (
        <MissionGateAlert
          type={urgentGate.type}
          badge={urgentGate.badge}
          title={urgentGate.title}
          message={urgentGate.message}
          deadline={urgentGate.deadline}
          actionLabel={urgentGate.actionLabel}
          actionLink={urgentGate.actionLink}
        />
      )}

      {/* Signature Aerospace Component: Learning Trajectory */}
      <LearningTrajectory currentStage={currentStage} />

      {/* Metric Cards Row */}
      <div className="row g-3 mb-4">
        <div className="col-6 col-md-3">
          <div className="egsa-card h-100 d-flex flex-column justify-content-between p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Active Missions</span>
              <span className="p-2 rounded bg-light text-primary-egsa">
                <i className="fa-solid fa-graduation-cap"></i>
              </span>
            </div>
            <div>
              <h3 className="fw-bold mb-0 text-dark">{upcomingEnrollments.length}</h3>
              <small className="text-muted">Enrolled Courses</small>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="egsa-card h-100 d-flex flex-column justify-content-between p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Applications</span>
              <span className="p-2 rounded bg-light text-secondary-egsa">
                <i className="fa-solid fa-clipboard-list"></i>
              </span>
            </div>
            <div>
              <h3 className="fw-bold mb-0 text-dark">{applications.length}</h3>
              <small className="text-muted">Total Submitted</small>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="egsa-card h-100 d-flex flex-column justify-content-between p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Attendance Health</span>
              <span className="p-2 rounded bg-light text-accent-egsa">
                <i className="fa-solid fa-calendar-check"></i>
              </span>
            </div>
            <div>
              <h3 className="fw-bold mb-0 text-dark">
                {attendanceData ? `${attendanceData.overallPercentage}%` : '—'}
              </h3>
              <small
                className={
                  attendanceData?.overallPercentage >= 85
                    ? 'text-secondary-egsa fw-medium'
                    : 'text-muted'
                }
              >
                {attendanceData?.overallPercentage >= 85
                  ? 'Accreditation Qualified'
                  : '85% Minimum Required'}
              </small>
            </div>
          </div>
        </div>

        <div className="col-6 col-md-3">
          <div className="egsa-card h-100 d-flex flex-column justify-content-between p-3">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <span className="text-muted small fw-semibold">Roadmap Progress</span>
              <span className="p-2 rounded bg-light text-primary-egsa">
                <i className="fa-solid fa-bars-progress"></i>
              </span>
            </div>
            <div>
              <h3 className="fw-bold mb-0 text-dark">{progressPct}%</h3>
              <small className="text-muted">
                {learningPath
                  ? `${learningPath.completedCount}/${learningPath.totalCourses} Modules Done`
                  : 'Goal Not Set'}
              </small>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column & Right Sidebar */}
      <div className="row g-4">
        <div className="col-lg-8">
          {/* Current Application Alert */}
          {currentApplication && (
            <div className="egsa-card mb-4 border-start border-4 border-primary">
              <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-2">
                <div>
                  <span className="text-muted small text-uppercase fw-bold tracking-wide">Latest Application</span>
                  <h5 className="mb-0 text-dark fw-bold">{currentApplication.course?.title}</h5>
                </div>
                <StatusBadge status={currentApplication.status} />
              </div>
              <p className="text-muted small mb-3">
                Applied on {new Date(currentApplication.createdAt).toLocaleDateString()}
              </p>
              <div className="d-flex flex-wrap gap-2">
                <Link to={`/student/applications/${currentApplication._id}`} className="btn btn-primary btn-sm">
                  View Application Details <i className="fa-solid fa-arrow-right ms-1"></i>
                </Link>
                {currentApplication.status === 'Eligible - Payment Pending' && (
                  <Link to="/student/payments" className="btn btn-accent btn-sm">
                    <i className="fa-solid fa-credit-card me-1"></i> Proceed to Payment
                  </Link>
                )}
                {currentApplication.status === 'Readiness Required' && (
                  <Link to={`/student/readiness/start?courseId=${currentApplication.course?._id}`} className="btn btn-outline-primary btn-sm">
                    <i className="fa-solid fa-pen-to-square me-1"></i> Start Readiness Assessment
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Learning Path Progress */}
          {learningPath && (
            <div className="egsa-card mb-4">
              <div className="d-flex justify-content-between align-items-center mb-2">
                <h6 className="mb-0 fw-bold text-dark">
                  <i className="fa-solid fa-route text-secondary-egsa me-2"></i>
                  Learning Path — {learningPath.title}
                </h6>
                <Link to="/student/learning-path" className="small text-decoration-none">
                  View Roadmap <i className="fa-solid fa-chevron-right small"></i>
                </Link>
              </div>
              <p className="text-muted small mb-2">
                {learningPath.completedCount} of {learningPath.totalCourses} courses completed in this specialization
              </p>
              <ProgressBar percent={progressPct} showLabel />
            </div>
          )}

          {/* Upcoming Training Section */}
          <div className="egsa-card mb-4">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0 fw-bold text-dark">
                <i className="fa-solid fa-chalkboard-user text-primary-egsa me-2"></i>
                My Enrolled Training
              </h6>
              <Link to="/student/training" className="small text-decoration-none">
                View All Training
              </Link>
            </div>
            {upcomingEnrollments.length === 0 ? (
              <div className="text-center py-4 text-muted">
                <i className="fa-solid fa-user-graduate fa-2x mb-2 text-primary-egsa opacity-50"></i>
                <p className="mb-2">No active course enrollments yet.</p>
                <Link to="/student/programs" className="btn btn-outline-primary btn-sm">
                  Browse Available Programs
                </Link>
              </div>
            ) : (
              <div className="list-group list-group-flush">
                {upcomingEnrollments.map((enr) => (
                  <div key={enr._id} className="list-group-item px-0 py-3 d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2">
                    <div>
                      <h6 className="mb-1 text-dark fw-bold">{enr.course?.title}</h6>
                      <div className="text-muted small d-flex flex-wrap gap-3">
                        <span><i className="fa-regular fa-calendar me-1"></i> {enr.course?.startDate ? new Date(enr.course.startDate).toLocaleDateString() : 'TBA'}</span>
                        <span><i className="fa-solid fa-location-dot me-1"></i> {enr.course?.deliveryMode || 'Onsite'}</span>
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <Link to="/student/attendance" className="btn btn-outline-secondary btn-sm" title="View Attendance">
                        <i className="fa-solid fa-calendar-check me-1"></i> Attendance
                      </Link>
                      <Link to="/student/media" className="btn btn-outline-primary btn-sm" title="Course Materials">
                        <i className="fa-solid fa-folder-open me-1"></i> Media
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recommended Courses */}
          {recommendations?.length > 0 && (
            <div className="egsa-card">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0 fw-bold text-dark">
                  <i className="fa-solid fa-wand-magic-sparkles text-accent-egsa me-2"></i>
                  Recommended For Your Goal
                </h6>
                <Link to="/student/programs" className="small text-decoration-none">
                  All Courses
                </Link>
              </div>
              <div className="row g-3">
                {recommendations.slice(0, 4).map((c) => (
                  <div key={c._id} className="col-md-6">
                    <div className="p-3 border rounded h-100 d-flex flex-column justify-content-between bg-light-subtle">
                      <div>
                        <div className="d-flex justify-content-between align-items-start mb-1">
                          <span className="badge bg-primary-egsa small">{c.level}</span>
                          <span className="fw-bold small text-accent-egsa">
                            {c.price != null ? `${c.price} EGP` : 'TBA'}
                          </span>
                        </div>
                        <h6 className="fw-semibold text-dark mb-1">{c.title}</h6>
                        <p className="text-muted small mb-3 text-truncate-2">
                          {c.shortDescription || c.overview || 'Comprehensive space technology training.'}
                        </p>
                      </div>
                      <div className="d-flex gap-2 mt-auto">
                        <Link to={`/student/courses/${c._id}`} className="btn btn-outline-primary btn-sm flex-grow-1">
                          Details
                        </Link>
                        {c.price != null && (
                          <Link to={`/student/courses/${c._id}/fit`} className="btn btn-primary btn-sm flex-grow-1">
                            Check Fit
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Actions & Notifications */}
        <div className="col-lg-4">
          {/* Pending Actions Alert Box */}
          {pendingActions?.length > 0 && (
            <div className="egsa-card mb-4 border-start border-4 border-warning">
              <div className="d-flex align-items-center gap-2 mb-2">
                <i className="fa-solid fa-bell text-warning fs-5"></i>
                <h6 className="mb-0 fw-bold text-dark">Pending Next Actions</h6>
              </div>
              <p className="text-muted small mb-3">Required steps to progress in your space academy cycle:</p>
              <ul className="list-unstyled mb-0 d-flex flex-direction-column flex-column gap-2">
                {pendingActions.map((action, idx) => (
                  <li key={idx} className="p-2 bg-light rounded d-flex align-items-start gap-2 small">
                    <i className="fa-solid fa-circle-exclamation text-danger-egsa mt-1"></i>
                    <span className="fw-medium text-dark">{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Quick Portal Navigation shortcuts */}
          <div className="egsa-card mb-4">
            <h6 className="mb-3 fw-bold text-dark">Quick Portal Access</h6>
            <div className="d-grid gap-2">
              <Link to="/student/attendance" className="btn btn-light text-start d-flex align-items-center justify-content-between p-2">
                <span><i className="fa-solid fa-calendar-check text-primary-egsa me-2"></i> Attendance Records</span>
                <i className="fa-solid fa-arrow-right text-muted small"></i>
              </Link>
              <Link to="/student/assessments" className="btn btn-light text-start d-flex align-items-center justify-content-between p-2">
                <span><i className="fa-solid fa-list-check text-primary-egsa me-2"></i> Assessments & Quizzes</span>
                <i className="fa-solid fa-arrow-right text-muted small"></i>
              </Link>
              <Link to="/student/evaluation" className="btn btn-light text-start d-flex align-items-center justify-content-between p-2">
                <span><i className="fa-solid fa-star-half-stroke text-primary-egsa me-2"></i> Course Evaluations</span>
                <i className="fa-solid fa-arrow-right text-muted small"></i>
              </Link>
              <Link to="/student/media" className="btn btn-light text-start d-flex align-items-center justify-content-between p-2">
                <span><i className="fa-solid fa-photo-film text-primary-egsa me-2"></i> Training Media & Labs</span>
                <i className="fa-solid fa-arrow-right text-muted small"></i>
              </Link>
              <Link to="/student/certificate" className="btn btn-light text-start d-flex align-items-center justify-content-between p-2">
                <span><i className="fa-solid fa-award text-accent-egsa me-2"></i> Official Certificate</span>
                <i className="fa-solid fa-arrow-right text-muted small"></i>
              </Link>
            </div>
          </div>

          {/* Recent Notifications */}
          <div className="egsa-card">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h6 className="mb-0 fw-bold text-dark">Recent Notifications</h6>
              <Link to="/student/notifications" className="small text-decoration-none">
                View All
              </Link>
            </div>
            {notifications?.length === 0 ? (
              <p className="text-muted small mb-0">No new notifications.</p>
            ) : (
              <div className="d-flex flex-column gap-2">
                {notifications.slice(0, 4).map((n) => (
                  <div key={n._id} className="p-2 rounded bg-light-subtle border">
                    <div className="fw-semibold small text-dark">{n.title}</div>
                    <div className="text-muted small text-truncate">{n.message}</div>
                    <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                      {new Date(n.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
