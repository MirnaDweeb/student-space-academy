import React from 'react';

export default function TrainingStatus({ status, size = 'md' }) {
  const normalized = status || 'Confirmed';

  const config = {
    Active: {
      label: 'Mission In Progress',
      badgeClass: 'bg-success-subtle text-success border border-success-subtle',
      dotClass: 'bg-success',
      icon: 'fa-circle-play',
    },
    Confirmed: {
      label: 'Scheduled / Upcoming',
      badgeClass: 'bg-primary-subtle text-primary border border-primary-subtle',
      dotClass: 'bg-primary',
      icon: 'fa-calendar-check',
    },
    Completed: {
      label: 'Mission Completed',
      badgeClass: 'bg-secondary-subtle text-secondary border border-secondary-subtle',
      dotClass: 'bg-secondary',
      icon: 'fa-circle-check',
    },
    Suspended: {
      label: 'Mission Suspended',
      badgeClass: 'bg-warning-subtle text-warning border border-warning-subtle',
      dotClass: 'bg-warning',
      icon: 'fa-circle-pause',
    },
    Cancelled: {
      label: 'Cancelled',
      badgeClass: 'bg-danger-subtle text-danger border border-danger-subtle',
      dotClass: 'bg-danger',
      icon: 'fa-circle-xmark',
    },
  }[normalized] || {
    label: normalized,
    badgeClass: 'bg-light text-dark border',
    dotClass: 'bg-secondary',
    icon: 'fa-circle-info',
  };

  const isSmall = size === 'sm';

  return (
    <span
      className={`badge d-inline-flex align-items-center gap-1 fw-semibold ${config.badgeClass} ${
        isSmall ? 'px-2 py-1 small' : 'px-3 py-2'
      }`}
      style={{ letterSpacing: '0.02em' }}
    >
      <i className={`fa-solid ${config.icon} small`}></i>
      <span>{config.label}</span>
    </span>
  );
}
