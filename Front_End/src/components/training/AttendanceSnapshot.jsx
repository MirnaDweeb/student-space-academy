import React from 'react';
import { Link } from 'react-router-dom';
import { ProgressBar } from '../StateComponents';

/**
 * AttendanceSnapshot
 * Rendered on My Training ("Training Mission Control").
 * Implements Section 27 specifications with graduated warnings and attendance breakdown.
 */
export default function AttendanceSnapshot({ attendanceRecord }) {
  if (!attendanceRecord) return null;

  const percentage = attendanceRecord.percentage ?? 100;
  const totalSessions = attendanceRecord.totalSessions || 0;
  const presentSessions = attendanceRecord.presentSessions ?? attendanceRecord.presentCount ?? 0;
  const lateSessions = attendanceRecord.lateSessions ?? attendanceRecord.lateCount ?? 0;
  const absentSessions = attendanceRecord.absentSessions ?? attendanceRecord.absentCount ?? 0;
  const excusedSessions = attendanceRecord.excusedSessions ?? attendanceRecord.excusedCount ?? 0;
  
  const warningState = attendanceRecord.warningState || 'NORMAL';
  const certEligibility = attendanceRecord.certificateEligibility || 'ON_TRACK';

  // Institutional status badge configuration
  const getStatusConfig = () => {
    switch (warningState) {
      case 'ATTENTION':
        return {
          label: 'ATTENTION',
          badgeClass: 'bg-warning text-dark',
          borderClass: 'border-warning',
          message: 'Your attendance is approaching the permitted absence limit.',
        };
      case 'WARNING':
        return {
          label: 'WARNING',
          badgeClass: 'bg-danger text-white',
          borderClass: 'border-danger',
          message: 'Continued absence may affect your training and certificate eligibility.',
        };
      case 'FINAL_WARNING':
        return {
          label: 'FINAL WARNING',
          badgeClass: 'bg-danger text-white',
          borderClass: 'border-danger',
          message: 'Attendance is at critical level. Further absence will forfeit certificate eligibility.',
        };
      case 'CERTIFICATE_INELIGIBLE':
        return {
          label: 'CERTIFICATE INELIGIBLE',
          badgeClass: 'bg-dark text-white',
          borderClass: 'border-danger',
          message: 'Your current absence rate exceeds the permitted limit for this course.',
        };
      case 'NORMAL':
      default:
        return {
          label: 'ON TRACK',
          badgeClass: 'bg-success text-white',
          borderClass: 'border-success',
          message: 'Attendance is comfortably on track with Academy regulations.',
        };
    }
  };

  const statusInfo = getStatusConfig();

  return (
    <div className={`egsa-card p-4 mb-4 border-start border-4 ${statusInfo.borderClass}`}>
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
          <i className="fa-solid fa-clipboard-user text-primary-egsa"></i>
          Attendance Mission Control
        </h6>
        <span className={`badge ${statusInfo.badgeClass} px-2 py-1 fw-bold`} style={{ letterSpacing: '0.5px' }}>
          {statusInfo.label}
        </span>
      </div>

      <div className="d-flex align-items-baseline gap-2 mb-2">
        <h3 className="fw-bold text-dark mb-0">{percentage}%</h3>
        <span className="small text-muted">Course Attendance Rate</span>
      </div>

      <div className="mb-3">
        <ProgressBar
          percent={percentage}
          height={8}
        />
      </div>

      {/* Warning / Attention Message */}
      {warningState !== 'NORMAL' && (
        <div className="p-2 px-3 rounded bg-light border small text-dark mb-3">
          <i className="fa-solid fa-triangle-exclamation text-warning me-1"></i>
          {statusInfo.message}
        </div>
      )}

      {/* Supporting Breakdown */}
      <div className="row g-2 text-center mb-3">
        <div className="col-3">
          <div className="p-2 border rounded bg-light">
            <span className="d-block small text-muted" style={{ fontSize: '11px' }}>Present</span>
            <strong className="text-success fs-6">{presentSessions}</strong>
          </div>
        </div>
        <div className="col-3">
          <div className="p-2 border rounded bg-light">
            <span className="d-block small text-muted" style={{ fontSize: '11px' }}>Late</span>
            <strong className="text-warning fs-6">{lateSessions}</strong>
          </div>
        </div>
        <div className="col-3">
          <div className="p-2 border rounded bg-light">
            <span className="d-block small text-muted" style={{ fontSize: '11px' }}>Excused</span>
            <strong className="text-info fs-6">{excusedSessions}</strong>
          </div>
        </div>
        <div className="col-3">
          <div className="p-2 border rounded bg-light">
            <span className="d-block small text-muted" style={{ fontSize: '11px' }}>Absent</span>
            <strong className={`fs-6 ${absentSessions > 0 ? 'text-danger' : 'text-muted'}`}>{absentSessions}</strong>
          </div>
        </div>
      </div>

      <div className="d-grid">
        <Link to="/student/attendance" className="btn btn-outline-secondary btn-sm">
          <i className="fa-solid fa-calendar-check me-1"></i> View Full Attendance Records
        </Link>
      </div>
    </div>
  );
}
