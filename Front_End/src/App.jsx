import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

import MainLayout from './layouts/MainLayout.jsx';
import StudentLayout from './layouts/StudentLayout.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';

// Auth & Public Pages
import LandingPage from './pages/LandingPage.jsx';
import LoginPage from './pages/auth/LoginPage.jsx';
import RegisterPage from './pages/auth/RegisterPage.jsx';
import { VerifyEmailPage, ForgotPasswordPage, ResetPasswordPage } from './pages/auth/AuthExtras.jsx';

// Student Portal Pages (13 Core Sections + Lifecycle Sub-routes)
import DashboardPage from './pages/student/DashboardPage.jsx';
import ExploreProgramsPage from './pages/student/ExploreProgramsPage.jsx';
import CourseDetailsPage from './pages/student/CourseDetailsPage.jsx';
import CourseFitPage from './pages/student/CourseFitPage.jsx';
import ApplicationsPage from './pages/student/ApplicationsPage.jsx';
import ApplicationDetailPage from './pages/student/ApplicationDetailPage.jsx';
import FoundationReviewPage from './pages/student/FoundationReviewPage.jsx';
import TrainingPage from './pages/student/TrainingPage.jsx';
import AttendancePage from './pages/student/AttendancePage.jsx';
import AssessmentsPage from './pages/student/AssessmentsPage.jsx';
import ReadinessStartPage from './pages/student/ReadinessStartPage.jsx';
import ReadinessAssessmentPage from './pages/student/ReadinessAssessmentPage.jsx';
import ReadinessResultPage from './pages/student/ReadinessResultPage.jsx';
import ProgressPage from './pages/student/ProgressPage.jsx';
import GoalPage from './pages/student/GoalPage.jsx';
import LearningPathPage from './pages/student/LearningPathPage.jsx';
import EvaluationPage from './pages/student/EvaluationPage.jsx';
import PaymentsPage from './pages/student/PaymentsPage.jsx';
import MockCheckoutPage from './pages/student/MockCheckoutPage.jsx';
import MediaPage from './pages/student/MediaPage.jsx';
import CertificatePage from './pages/student/CertificatePage.jsx';
import NotificationsPage from './pages/student/NotificationsPage.jsx';
import ProfilePage from './pages/student/ProfilePage.jsx';
import AdminLayout from './layouts/AdminLayout.jsx';
import AdminDashboardPage from './pages/admin/AdminDashboardPage.jsx';
import AdminApplicationsPage from './pages/admin/AdminApplicationsPage.jsx';
import AdminCohortsPage from './pages/admin/AdminCohortsPage.jsx';
import AdminAttendancePage from './pages/admin/AdminAttendancePage.jsx';
import AdminAssessmentsPage from './pages/admin/AdminAssessmentsPage.jsx';
import AdminMediaPage from './pages/admin/AdminMediaPage.jsx';
import AdminPaymentsPage from './pages/admin/AdminPaymentsPage.jsx';
import AdminCertificatesPage from './pages/admin/AdminCertificatesPage.jsx';

export default function App() {
  return (
    <Routes>
      {/* Public Pages with MainLayout */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Route>

      {/* Protected Student Portal with StudentLayout (Persistent Sidebar) */}
      <Route path="/student" element={<ProtectedRoute />}>
        {/* Isolated Mock Checkout Route (Without StudentLayout frame when embedded) */}
        <Route path="payments/mock-checkout" element={<MockCheckoutPage />} />

        <Route element={<StudentLayout />}>
          {/* Index Redirect */}
          <Route index element={<Navigate to="/student/dashboard" replace />} />

          {/* 1. Dashboard */}
          <Route path="dashboard" element={<DashboardPage />} />

          {/* 2. Explore Programs */}
          <Route path="programs" element={<ExploreProgramsPage />} />
          <Route path="courses" element={<ExploreProgramsPage />} />
          <Route path="courses/:id" element={<CourseDetailsPage />} />
          <Route path="courses/:id/fit" element={<CourseFitPage />} />

          {/* 3. My Applications */}
          <Route path="applications" element={<ApplicationsPage />} />
          <Route path="applications/:id" element={<ApplicationDetailPage />} />
          <Route path="applications/:id/foundation" element={<FoundationReviewPage />} />

          {/* 4. My Training */}
          <Route path="training" element={<TrainingPage />} />
          <Route path="enrollments" element={<TrainingPage />} />

          {/* 5. Attendance */}
          <Route path="attendance" element={<AttendancePage />} />

          {/* 6. Assessments */}
          <Route path="assessments" element={<AssessmentsPage />} />
          <Route path="readiness/start" element={<ReadinessStartPage />} />
          <Route path="readiness/:attemptId" element={<ReadinessAssessmentPage />} />
          <Route path="readiness/:attemptId/result" element={<ReadinessResultPage />} />

          {/* 7. My Progress */}
          <Route path="progress" element={<ProgressPage />} />
          <Route path="goal" element={<GoalPage />} />
          <Route path="learning-path" element={<LearningPathPage />} />

          {/* 8. Evaluation */}
          <Route path="evaluation" element={<EvaluationPage />} />
          <Route path="feedback" element={<EvaluationPage />} />

          {/* 9. Payments */}
          <Route path="payments" element={<PaymentsPage />} />

          {/* 10. My Media */}
          <Route path="media" element={<MediaPage />} />

          {/* 11. Certificate */}
          <Route path="certificate" element={<CertificatePage />} />
          <Route path="certificates" element={<CertificatePage />} />

          {/* 12. Notifications */}
          <Route path="notifications" element={<NotificationsPage />} />

          {/* 13. My Profile */}
          <Route path="profile" element={<ProfilePage />} />

          {/* Catch-all student route */}
          <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
        </Route>
      </Route>

      {/* Protected Admin Routes */}
      <Route path="/admin" element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<AdminLayout />}>
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="applications" element={<AdminApplicationsPage />} />
          <Route path="cohorts" element={<AdminCohortsPage />} />
          <Route path="attendance" element={<AdminAttendancePage />} />
          <Route path="assessments" element={<AdminAssessmentsPage />} />
          <Route path="media" element={<AdminMediaPage />} />
          <Route path="payments" element={<AdminPaymentsPage />} />
          <Route path="certificates" element={<AdminCertificatesPage />} />
          <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
        </Route>
      </Route>

      {/* Global Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
