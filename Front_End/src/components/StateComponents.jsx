import React from 'react';
import { Link } from 'react-router-dom';

const STATUS_CLASS_MAP = {
  // Success / Ready / Positive states
  ready: 'ready',
  confirmed: 'ready',
  paid: 'ready',
  completed: 'ready',
  active: 'ready',
  issued: 'ready',
  present: 'ready',
  passed: 'ready',
  enrolled: 'ready',
  eligible: 'ready',
  accepted: 'ready',
  approved: 'ready',
  verified: 'ready',
  'selected_for_publication': 'ready',
  'selected for publication': 'ready',
  excused: 'ready',

  // Pending / In Review states
  'eligible - payment pending': 'pending',
  'payment_pending': 'pending',
  'payment pending': 'pending',
  pending: 'pending',
  'invoice issued': 'pending',
  'manual review': 'pending',
  'conditionally ready': 'pending',
  'conditionally eligible': 'pending',
  'readiness required': 'pending',
  submitted: 'pending',
  waitlisted: 'pending',
  'in progress': 'pending',
  'under review': 'pending',
  scheduled: 'pending',
  draft: 'pending',
  name_submitted: 'pending',
  'name submitted': 'pending',
  under_preparation: 'pending',
  'under preparation': 'pending',
  pending_review: 'pending',
  'pending review': 'pending',

  // Caution / Foundation states
  'foundation required': 'gold',
  'foundation recommended': 'gold',
  'needs information': 'gold',
  late: 'gold',
  achievement: 'gold',
  warning: 'gold',
  attention: 'gold',
  final_warning: 'gold',
  'final warning': 'gold',

  // Error / Cancelled / Negative states
  'not eligible': 'error',
  failed: 'error',
  cancelled: 'error',
  overdue: 'error',
  'no show': 'error',
  absent: 'error',
  incomplete: 'error',
  revoked: 'error',
  rejected: 'error',
  voided: 'error',
  expired: 'error',
  certificate_ineligible: 'error',
  'certificate ineligible': 'error',
};

const STATUS_ICON_MAP = {
  ready: 'fa-check-circle',
  confirmed: 'fa-check-circle',
  paid: 'fa-circle-check',
  completed: 'fa-circle-check',
  active: 'fa-play-circle',
  issued: 'fa-award',
  present: 'fa-check',
  passed: 'fa-check-double',
  accepted: 'fa-envelope-open-text',
  approved: 'fa-thumbs-up',
  verified: 'fa-shield-halved',
  'selected_for_publication': 'fa-star',
  'selected for publication': 'fa-star',
  excused: 'fa-file-shield',
  'eligible - payment pending': 'fa-clock',
  'payment_pending': 'fa-clock',
  'payment pending': 'fa-clock',
  pending: 'fa-hourglass-half',
  'invoice issued': 'fa-receipt',
  'manual review': 'fa-user-clock',
  'readiness required': 'fa-pen-to-square',
  submitted: 'fa-paper-plane',
  waitlisted: 'fa-clock-rotate-left',
  'in progress': 'fa-spinner fa-spin-pulse',
  'under review': 'fa-magnifying-glass',
  name_submitted: 'fa-user-tag',
  'name submitted': 'fa-user-tag',
  under_preparation: 'fa-gears',
  'under preparation': 'fa-gears',
  'foundation required': 'fa-triangle-exclamation',
  'foundation recommended': 'fa-lightbulb',
  'needs information': 'fa-circle-question',
  late: 'fa-person-walking-dashed-line-arrow-right',
  warning: 'fa-triangle-exclamation',
  attention: 'fa-circle-exclamation',
  final_warning: 'fa-triangle-exclamation',
  'final warning': 'fa-triangle-exclamation',
  'not eligible': 'fa-circle-xmark',
  failed: 'fa-circle-xmark',
  cancelled: 'fa-ban',
  overdue: 'fa-calendar-xmark',
  'no show': 'fa-user-xmark',
  absent: 'fa-xmark',
  revoked: 'fa-ban',
  rejected: 'fa-circle-xmark',
  voided: 'fa-file-circle-xmark',
  expired: 'fa-hourglass-end',
  certificate_ineligible: 'fa-circle-minus',
  'certificate ineligible': 'fa-circle-minus',
};

export function StatusBadge({ status, showIcon = true }) {
  if (!status) return null;
  const key = String(status).toLowerCase();
  const cls = STATUS_CLASS_MAP[key] || 'pending';
  const icon = STATUS_ICON_MAP[key] || 'fa-circle-info';

  return (
    <span className={`status-badge ${cls}`}>
      {showIcon && <i className={`fa-solid ${icon} me-1 small`}></i>}
      {status}
    </span>
  );
}

export function ProgressBar({ percent = 0, height = 8, color, showLabel = false }) {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  return (
    <div className="w-100">
      <div className="progress-track" style={{ height: `${height}px` }}>
        <div
          className="progress-fill"
          style={{
            width: `${clamped}%`,
            ...(color ? { backgroundColor: color } : {}),
          }}
        />
      </div>
      {showLabel && (
        <div className="d-flex justify-content-between text-muted small mt-1">
          <span>Progress</span>
          <span>{clamped}%</span>
        </div>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Loading…', minHeight = '300px' }) {
  return (
    <div
      className="d-flex flex-column align-items-center justify-content-center py-5 text-muted"
      style={{ minHeight }}
    >
      <div className="spinner-border text-primary-egsa mb-3" style={{ width: '2.5rem', height: '2.5rem' }} role="status">
        <span className="visually-hidden">Loading...</span>
      </div>
      <div className="fw-medium">{label}</div>
    </div>
  );
}

export function EmptyState({
  icon = 'fa-folder-open',
  title = 'Nothing here yet',
  message,
  actionLabel,
  actionLink,
  onAction,
}) {
  return (
    <div className="egsa-card text-center py-5 my-3">
      <div
        className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
        style={{ width: '70px', height: '70px', background: 'rgba(58, 105, 133, 0.08)' }}
      >
        <i className={`fa-solid ${icon} fa-2x text-primary-egsa`}></i>
      </div>
      <h5 className="mb-2 text-dark">{title}</h5>
      {message && <p className="text-muted small mx-auto mb-4" style={{ maxWidth: '440px' }}>{message}</p>}
      {actionLabel && actionLink && (
        <Link to={actionLink} className="btn btn-primary btn-sm px-3">
          {actionLabel}
        </Link>
      )}
      {actionLabel && onAction && !actionLink && (
        <button className="btn btn-primary btn-sm px-3" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.', onRetry, minHeight = '250px' }) {
  return (
    <div
      className="egsa-card text-center py-5 my-3 border-danger-subtle"
      style={{ minHeight }}
    >
      <div
        className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3"
        style={{ width: '60px', height: '60px', background: 'rgba(223, 79, 76, 0.12)' }}
      >
        <i className="fa-solid fa-triangle-exclamation fa-2x text-danger-egsa"></i>
      </div>
      <h6 className="text-danger-egsa fw-bold mb-2">Error Encountered</h6>
      <p className="text-muted small mx-auto mb-3" style={{ maxWidth: '480px' }}>{message}</p>
      {onRetry && (
        <button className="btn btn-outline-primary btn-sm" onClick={onRetry}>
          <i className="fa-solid fa-rotate-right me-1"></i> Try Again
        </button>
      )}
    </div>
  );
}

export function PageHeader({ title, subtitle, breadcrumbs = [], actions = null }) {
  return (
    <div className="mb-4">
      {breadcrumbs.length > 0 && (
        <nav aria-label="breadcrumb" className="mb-2">
          <ol className="breadcrumb mb-0 small">
            {breadcrumbs.map((crumb, idx) => (
              <li
                key={idx}
                className={`breadcrumb-item ${idx === breadcrumbs.length - 1 ? 'active text-muted' : ''}`}
                aria-current={idx === breadcrumbs.length - 1 ? 'page' : undefined}
              >
                {crumb.to && idx !== breadcrumbs.length - 1 ? (
                  <Link to={crumb.to} className="text-decoration-none text-muted">
                    {crumb.label}
                  </Link>
                ) : (
                  crumb.label
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-2">
        <div>
          <h2 className="h4 fw-bold mb-1 text-dark">{title}</h2>
          {subtitle && <p className="text-muted small mb-0">{subtitle}</p>}
        </div>
        {actions && <div className="d-flex align-items-center gap-2 mt-2 mt-md-0">{actions}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ show, title, message, confirmText = 'Confirm', confirmVariant = 'primary', onConfirm, onCancel }) {
  if (!show) return null;
  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      role="dialog"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1060 }}
    >
      <div className="modal-dialog modal-dialog-centered" role="document">
        <div className="modal-content shadow border-0" style={{ borderRadius: 'var(--radius-md)' }}>
          <div className="modal-header border-bottom-0 pb-0">
            <h5 className="modal-title fw-bold">{title}</h5>
            <button type="button" className="btn-close" aria-label="Close" onClick={onCancel}></button>
          </div>
          <div className="modal-body py-3">
            <p className="text-muted mb-0">{message}</p>
          </div>
          <div className="modal-footer border-top-0 pt-0">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onCancel}>
              Cancel
            </button>
            <button type="button" className={`btn btn-${confirmVariant} btn-sm`} onClick={onConfirm}>
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
