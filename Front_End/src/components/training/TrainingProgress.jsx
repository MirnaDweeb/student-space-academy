import React from 'react';
import { ProgressBar } from '../StateComponents';

export default function TrainingProgress({
  enrollment,
  attendanceRecord,
  assessments = [],
}) {
  if (!enrollment) return null;

  const isCompleted = enrollment.status === 'Completed';
  const isUpcoming = enrollment.status === 'Confirmed';

  const course = enrollment.course || {};
  const totalModules = course.modules?.length || course.duration || 5;

  // Session attendance dimensions
  const totalSessions = attendanceRecord?.totalSessions || totalModules;
  const presentSessions = attendanceRecord?.presentSessions || 0;
  const lateSessions = attendanceRecord?.lateSessions || 0;
  const attendedSessions = presentSessions + lateSessions;
  const completedSessionsCount = attendanceRecord?.sessions?.filter((s) => s.status !== 'Upcoming').length || 0;
  const remainingSessions = Math.max(totalSessions - completedSessionsCount, 0);

  // Assessment dimensions
  const totalAssessments = assessments.length;
  const completedAssessments = assessments.filter((a) => a.status === 'Completed' || a.score != null).length;

  // Real progress computation
  let overallPercent = 0;
  if (isCompleted) {
    overallPercent = 100;
  } else if (isUpcoming) {
    overallPercent = 0;
  } else {
    // Active training: combine attended sessions ratio (60%) and assessment completion ratio (40%)
    const sessionRatio = totalSessions > 0 ? completedSessionsCount / totalSessions : 0;
    const assessmentRatio = totalAssessments > 0 ? completedAssessments / totalAssessments : 0;
    overallPercent = Math.min(Math.round((sessionRatio * 0.6 + assessmentRatio * 0.4) * 100), 95);
  }

  // Attendance rate
  const attendanceRate = attendanceRecord?.percentage ?? (completedSessionsCount > 0 ? 100 : 0);

  return (
    <div className="egsa-card p-4 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
          <i className="fa-solid fa-chart-line text-primary-egsa"></i>
          Training Mission Progress Telemetry
        </h6>
        <span className="badge bg-light text-dark border px-3 py-1">
          Overall: <strong className="text-primary-egsa fs-6">{overallPercent}%</strong>
        </span>
      </div>

      <div className="mb-4">
        <ProgressBar percent={overallPercent} height={10} />
      </div>

      {/* 4 Metric Dimension Cards */}
      <div className="row g-3">
        {/* Dimension 1: Curriculum Modules */}
        <div className="col-sm-6 col-lg-3">
          <div className="p-3 border rounded bg-light-subtle h-100">
            <div className="text-muted small mb-1 d-flex align-items-center gap-1">
              <i className="fa-solid fa-layer-group text-primary-egsa"></i>
              Curriculum Modules
            </div>
            <div className="fs-5 fw-bold text-dark">
              {isCompleted ? totalModules : Math.min(completedSessionsCount, totalModules)}{' '}
              <span className="text-muted fs-6 fw-normal">/ {totalModules} Days</span>
            </div>
            <small className="text-muted d-block mt-1">
              {remainingSessions > 0 && !isCompleted ? `${remainingSessions} modules remaining` : 'Full syllabus covered'}
            </small>
          </div>
        </div>

        {/* Dimension 2: Training Sessions */}
        <div className="col-sm-6 col-lg-3">
          <div className="p-3 border rounded bg-light-subtle h-100">
            <div className="text-muted small mb-1 d-flex align-items-center gap-1">
              <i className="fa-regular fa-calendar-check text-secondary-egsa"></i>
              Training Sessions
            </div>
            <div className="fs-5 fw-bold text-dark">
              {isCompleted ? totalSessions : completedSessionsCount}{' '}
              <span className="text-muted fs-6 fw-normal">/ {totalSessions} Sessions</span>
            </div>
            <small className="text-muted d-block mt-1">
              {attendedSessions} logged attendances
            </small>
          </div>
        </div>

        {/* Dimension 3: Attendance Rate */}
        <div className="col-sm-6 col-lg-3">
          <div className="p-3 border rounded bg-light-subtle h-100">
            <div className="text-muted small mb-1 d-flex align-items-center gap-1">
              <i className="fa-solid fa-user-check text-success"></i>
              Session Attendance
            </div>
            <div className="fs-5 fw-bold text-dark">
              {attendanceRate}%
            </div>
            <small className="text-muted d-block mt-1">
              {completedSessionsCount > 0 ? `${presentSessions} present, ${lateSessions} late` : 'Awaiting first session'}
            </small>
          </div>
        </div>

        {/* Dimension 4: Assessments & Quizzes */}
        <div className="col-sm-6 col-lg-3">
          <div className="p-3 border rounded bg-light-subtle h-100">
            <div className="text-muted small mb-1 d-flex align-items-center gap-1">
              <i className="fa-solid fa-list-check text-accent-egsa"></i>
              Assessments
            </div>
            <div className="fs-5 fw-bold text-dark">
              {completedAssessments}{' '}
              <span className="text-muted fs-6 fw-normal">/ {totalAssessments} Submitted</span>
            </div>
            <small className="text-muted d-block mt-1">
              {totalAssessments - completedAssessments > 0
                ? `${totalAssessments - completedAssessments} remaining tasks`
                : 'All milestones completed'}
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
