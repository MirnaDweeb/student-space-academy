import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Premium Institutional Statistics Grid for Egyptian Space Agency Dashboard.
 * Displays only authentic backend metrics: Enrolled Courses, Applications, Attendance Rate, Roadmap Progress, Certificates.
 */
export default function DashboardStats({
  enrollmentsCount = 0,
  applicationsCount = 0,
  activeApplicationsCount = 0,
  attendanceData,
  progressPct = 0,
  learningPath,
  certificatesCount = 0,
}) {
  const attendanceRate = attendanceData?.overallPercentage;
  const isAttendanceQualified = attendanceRate != null && attendanceRate >= 85;

  const stats = [
    {
      id: 'enrolled',
      label: 'Enrolled Programs',
      value: enrollmentsCount,
      unit: '',
      status: enrollmentsCount > 0 ? 'Active Training' : 'No Active Cycles',
      statusClass: enrollmentsCount > 0 ? 'status-positive' : 'status-neutral',
      icon: 'fa-graduation-cap',
      link: '/student/training',
    },
    {
      id: 'applications',
      label: 'Applications',
      value: applicationsCount,
      unit: '',
      status:
        activeApplicationsCount > 0
          ? `${activeApplicationsCount} in Review`
          : applicationsCount > 0
          ? 'History Logged'
          : 'None Submitted',
      statusClass: activeApplicationsCount > 0 ? 'status-active' : 'status-neutral',
      icon: 'fa-file-lines',
      link: '/student/applications',
    },
    {
      id: 'attendance',
      label: 'Attendance Rate',
      value: attendanceRate != null ? attendanceRate : '—',
      unit: attendanceRate != null ? '%' : '',
      status:
        attendanceRate != null
          ? isAttendanceQualified
            ? 'Qualified (≥85%)'
            : 'Below 85% Gate'
          : 'Awaiting Records',
      statusClass:
        attendanceRate != null
          ? isAttendanceQualified
            ? 'status-positive'
            : 'status-warning'
          : 'status-neutral',
      icon: 'fa-calendar-check',
      link: '/student/attendance',
    },
    {
      id: 'roadmap',
      label: 'Roadmap Progress',
      value: progressPct,
      unit: '%',
      status: learningPath
        ? `${learningPath.completedCount}/${learningPath.totalCourses} Modules`
        : 'Track Pending',
      statusClass: progressPct > 0 ? 'status-positive' : 'status-neutral',
      icon: 'fa-bars-progress',
      link: '/student/learning-path',
    },
    {
      id: 'certificates',
      label: 'Credentials Issued',
      value: certificatesCount,
      unit: '',
      status: certificatesCount > 0 ? 'Verified Credentials' : 'In Progress',
      statusClass: certificatesCount > 0 ? 'status-gold' : 'status-neutral',
      icon: 'fa-award',
      link: '/student/certificate',
    },
  ];

  return (
    <section className="dashboard-stats-grid mb-4" aria-label="Academic & Training Key Metrics">
      {stats.map((stat, idx) => (
        <Link
          key={stat.id}
          to={stat.link}
          className="dashboard-stat-card"
          style={{ animationDelay: `${idx * 60}ms` }}
          title={`View ${stat.label}`}
        >
          <div className="stat-card-header">
            <span className="stat-card-label">{stat.label}</span>
            <div className="stat-card-icon-wrap">
              <i className={`fa-solid ${stat.icon}`}></i>
            </div>
          </div>

          <div className="stat-card-body">
            <div className="stat-card-value">
              {stat.value}
              {stat.unit && <span className="stat-card-unit">{stat.unit}</span>}
            </div>
            <div className={`stat-card-status ${stat.statusClass}`}>
              <span className="status-dot-sm"></span>
              <span>{stat.status}</span>
            </div>
          </div>
        </Link>
      ))}
    </section>
  );
}
