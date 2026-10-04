import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Notifications Preview Section for Egyptian Space Agency Dashboard.
 * Displays real unread count, latest notifications, type icons, timestamps, and read states.
 */
export default function NotificationsPreview({
  notifications = [],
  unreadCount = 0,
}) {
  const getNotificationIcon = (type) => {
    switch (type) {
      case 'success':
        return { icon: 'fa-circle-check', colorClass: 'text-success' };
      case 'warning':
        return { icon: 'fa-triangle-exclamation', colorClass: 'text-warning' };
      case 'error':
        return { icon: 'fa-circle-exclamation', colorClass: 'text-danger' };
      case 'info':
      default:
        return { icon: 'fa-circle-info', colorClass: 'text-primary-egsa' };
    }
  };

  const formatTimestamp = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffHours < 1) {
      const diffMins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
      return `${diffMins}m ago`;
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  };

  const displayedNotifications = notifications.slice(0, 5);

  return (
    <div className="egsa-institutional-card mb-4" aria-labelledby="notifications-heading">
      <div className="card-header-clean">
        <div className="d-flex align-items-center gap-2">
          <span className="card-header-icon-pill">
            <i className="fa-solid fa-bell text-primary-egsa"></i>
          </span>
          <div>
            <span className="card-overline">Academy Communications</span>
            <h2 id="notifications-heading" className="card-heading-title">System Notifications</h2>
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          {unreadCount > 0 ? (
            <span className="badge-unread-indicator">
              {unreadCount} unread
            </span>
          ) : (
            <span className="badge-all-read">All read</span>
          )}
          <Link to="/student/notifications" className="clean-action-link">
            View All <i className="fa-solid fa-arrow-right ms-1"></i>
          </Link>
        </div>
      </div>

      {displayedNotifications.length === 0 ? (
        <div className="empty-training-state py-4 text-center">
          <div className="empty-state-icon-circle-sm">
            <i className="fa-regular fa-bell-slash text-muted"></i>
          </div>
          <p className="empty-state-description mb-0">
            No notifications at this time. All official communications are up to date.
          </p>
        </div>
      ) : (
        <div className="notifications-compact-list">
          {displayedNotifications.map((notif) => {
            const { icon, colorClass } = getNotificationIcon(notif.type);
            const isUnread = notif.isRead === false;

            return (
              <div
                key={notif._id}
                className={`notification-item-compact ${isUnread ? 'is-unread' : 'is-read'}`}
              >
                <div className={`notif-icon-wrap ${colorClass}`}>
                  <i className={`fa-solid ${icon}`}></i>
                </div>

                <div className="notif-content-wrap">
                  <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                    <span className="notif-title-text">{notif.title}</span>
                    <span className="notif-timestamp-text">{formatTimestamp(notif.createdAt)}</span>
                  </div>
                  <p className="notif-message-text mb-0">{notif.message}</p>
                </div>

                {isUnread && <span className="notif-unread-dot" title="Unread"></span>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
