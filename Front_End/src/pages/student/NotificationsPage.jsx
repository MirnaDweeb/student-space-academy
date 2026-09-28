import React, { useEffect, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { notificationService } from '../../services/cycleServices';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';

const TYPE_CONFIG = {
  info: {
    icon: 'fa-circle-info',
    badgeClass: 'text-primary-egsa bg-light border border-primary-subtle',
  },
  success: {
    icon: 'fa-circle-check',
    badgeClass: 'text-success bg-light border border-success-subtle',
  },
  warning: {
    icon: 'fa-triangle-exclamation',
    badgeClass: 'text-warning bg-light border border-warning-subtle',
  },
  error: {
    icon: 'fa-circle-xmark',
    badgeClass: 'text-danger-egsa bg-light border border-danger-subtle',
  },
};

export default function NotificationsPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);

  // Outlet context from StudentLayout
  const outletCtx = useOutletContext();
  const refreshNotifications = outletCtx?.refreshNotifications;

  const load = () => {
    setLoading(true);
    setError('');
    notificationService
      .list()
      .then((res) => setItems(res.data || []))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load notifications.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleMarkRead = async (id) => {
    try {
      await notificationService.markRead(id);
      setItems((prev) => prev.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
      if (refreshNotifications) refreshNotifications();
    } catch {
      // Ignore failure
    }
  };

  const handleMarkAllRead = async () => {
    const unreadItems = items.filter((n) => !n.isRead);
    await Promise.all(unreadItems.map((n) => notificationService.markRead(n._id).catch(() => null)));
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    if (refreshNotifications) refreshNotifications();
  };

  const unreadCount = items.filter((n) => !n.isRead).length;
  const displayedItems = filterUnread ? items.filter((n) => !n.isRead) : items;

  if (loading) return <LoadingState label="Loading your Academy notifications…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Notifications & System Alerts"
        subtitle="Stay updated with admissions milestones, payment deadlines, assessment releases, and cohort schedule changes."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Notifications' },
        ]}
        actions={
          unreadCount > 0 && (
            <button className="btn btn-outline-primary btn-sm" onClick={handleMarkAllRead}>
              <i className="fa-solid fa-check-double me-1"></i> Mark All as Read ({unreadCount})
            </button>
          )
        }
      />

      {/* Filter Tabs */}
      <div className="d-flex gap-2 mb-4">
        <button
          className={`btn btn-sm rounded-pill px-3 ${!filterUnread ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setFilterUnread(false)}
        >
          All Notifications ({items.length})
        </button>
        <button
          className={`btn btn-sm rounded-pill px-3 ${filterUnread ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setFilterUnread(true)}
        >
          Unread Only ({unreadCount})
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon="fa-bell-slash"
          title="No notifications"
          message="You're all caught up! Updates regarding your applications and training will appear here."
        />
      ) : displayedItems.length === 0 ? (
        <EmptyState
          icon="fa-check-double"
          title="All caught up"
          message="No unread notifications to display."
          actionLabel="View All Notifications"
          onAction={() => setFilterUnread(false)}
        />
      ) : (
        <div className="egsa-card p-0 overflow-hidden shadow-sm">
          {displayedItems.map((n, idx) => {
            const cfg = TYPE_CONFIG[n.type] || TYPE_CONFIG.info;
            const isUnread = !n.isRead;

            return (
              <div
                key={n._id}
                className={`p-3 p-md-4 d-flex gap-3 align-items-start ${
                  idx !== displayedItems.length - 1 ? 'border-bottom' : ''
                }`}
                style={{
                  backgroundColor: isUnread ? 'rgba(58, 105, 133, 0.04)' : 'transparent',
                  transition: 'background-color 0.15s ease',
                }}
              >
                {/* Icon */}
                <div
                  className={`rounded-circle d-flex align-items-center justify-content-center p-2 mt-1 ${cfg.badgeClass}`}
                  style={{ width: '38px', height: '38px', flexShrink: 0 }}
                >
                  <i className={`fa-solid ${cfg.icon} fa-lg`}></i>
                </div>

                {/* Notification Content */}
                <div className="flex-grow-1">
                  <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
                    <h6 className={`mb-0 ${isUnread ? 'fw-bold text-dark' : 'text-muted'}`}>{n.title}</h6>
                    <div className="d-flex align-items-center gap-2">
                      {isUnread && (
                        <span className="badge bg-primary-egsa rounded-pill small" style={{ fontSize: '0.65rem' }}>
                          New
                        </span>
                      )}
                      <small className="text-muted" style={{ fontSize: '0.78rem' }}>
                        {new Date(n.createdAt).toLocaleString()}
                      </small>
                    </div>
                  </div>

                  <p className="text-muted small mb-2">{n.message}</p>

                  <div className="d-flex flex-wrap align-items-center gap-3">
                    {n.relatedApplication && (
                      <Link
                        to={`/student/applications/${n.relatedApplication}`}
                        className="small text-decoration-none fw-semibold text-primary-egsa"
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square me-1"></i> View Application
                      </Link>
                    )}
                    {n.relatedCourse && (
                      <Link
                        to={`/student/courses/${n.relatedCourse}`}
                        className="small text-decoration-none fw-semibold text-secondary-egsa"
                      >
                        <i className="fa-solid fa-graduation-cap me-1"></i> View Course
                      </Link>
                    )}
                    {isUnread && (
                      <button
                        type="button"
                        className="btn btn-link btn-sm p-0 text-muted small text-decoration-none"
                        onClick={() => handleMarkRead(n._id)}
                      >
                        <i className="fa-solid fa-check me-1"></i> Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
