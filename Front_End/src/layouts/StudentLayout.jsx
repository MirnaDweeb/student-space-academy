import React, { useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { notificationService } from '../services/cycleServices';
import StudentSidebar from '../components/student/StudentSidebar.jsx';
import StudentHeader from '../components/student/StudentHeader.jsx';
import { ConfirmModal } from '../components/StateComponents.jsx';
import './StudentLayout.css';

export default function StudentLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Desktop sidebar collapsed state (persisted in localStorage)
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('egsa_sidebar_collapsed') === 'true';
  });

  // Mobile sidebar drawer state
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  // Unread notifications count
  const [unreadCount, setUnreadCount] = useState(0);

  // Logout confirm modal
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  const fetchUnreadCount = useCallback(() => {
    notificationService
      .list()
      .then((res) => {
        const items = res.data || [];
        const unread = items.filter((n) => !n.isRead).length;
        setUnreadCount(unread);
      })
      .catch(() => {
        // Silently fail if unauthorized or backend not reachable
      });
  }, []);

  useEffect(() => {
    fetchUnreadCount();
    // Poll notifications every 60 seconds
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  const handleToggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('egsa_sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = () => {
    setShowLogoutConfirm(false);
    logout();
    navigate('/login');
  };

  return (
    <div className="student-portal-wrapper">
      {/* Persistent Student Sidebar */}
      <StudentSidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={handleToggleCollapse}
        isMobileOpen={isMobileOpen}
        setIsMobileOpen={setIsMobileOpen}
        unreadCount={unreadCount}
        user={user}
        onLogout={() => setShowLogoutConfirm(true)}
      />

      {/* Main Content Area (automatically adapts to sidebar width) */}
      <div className={`student-main-wrapper ${isCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Lightweight Top Header */}
        <StudentHeader
          onToggleMobileSidebar={() => setIsMobileOpen(true)}
          onToggleCollapseDesktop={handleToggleCollapse}
          isCollapsed={isCollapsed}
          unreadCount={unreadCount}
          user={user}
        />

        {/* Dynamic Main Page Content */}
        <main className="student-content-container">
          <Outlet context={{ unreadCount, refreshNotifications: fetchUnreadCount }} />
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      <ConfirmModal
        show={showLogoutConfirm}
        title="Sign Out"
        message="Are you sure you want to log out of the EGSA Space Academy Student Portal?"
        confirmText="Logout"
        confirmVariant="danger"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />
    </div>
  );
}
