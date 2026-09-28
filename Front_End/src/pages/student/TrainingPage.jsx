import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { enrollmentService, notificationService } from '../../services/cycleServices';
import {
  attendanceService,
  portalAssessmentService,
  evaluationService,
  certificateCriteriaService,
} from '../../services/studentPortalServices';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';

// Training Cockpit Modular Components
import StudentTrainingHero from '../../components/training/StudentTrainingHero';
import TrainingProgress from '../../components/training/TrainingProgress';
import LearningTrajectory from '../../components/training/LearningTrajectory';
import NextTrainingAction from '../../components/training/NextTrainingAction';
import TrainingSchedule from '../../components/training/TrainingSchedule';
import AttendanceSnapshot from '../../components/training/AttendanceSnapshot';
import AssessmentSnapshot from '../../components/training/AssessmentSnapshot';
import CurriculumProgress from '../../components/training/CurriculumProgress';
import InstructorCard from '../../components/training/InstructorCard';
import TrainingResources from '../../components/training/TrainingResources';
import TrainingNotifications from '../../components/training/TrainingNotifications';
import TrainingQuickActions from '../../components/training/TrainingQuickActions';
import TrainingJourney from '../../components/training/TrainingJourney';
import QRCheckInModal from '../../components/training/QRCheckInModal';
import TrainingMediaSnapshot from '../../components/training/TrainingMediaSnapshot';
import TrainingAssessmentsSection from '../../components/training/TrainingAssessmentsSection';

export default function TrainingPage() {
  const [enrollments, setEnrollments] = useState([]);
  const [attendanceData, setAttendanceData] = useState(null);
  const [assessmentsData, setAssessmentsData] = useState([]);
  const [evaluations, setEvaluations] = useState([]);
  const [certStatus, setCertStatus] = useState(null);
  const [notifications, setNotifications] = useState([]);

  const [selectedIdx, setSelectedIdx] = useState(0);
  const [filterTab, setFilterTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // QR Modal State
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedSessionForQR, setSelectedSessionForQR] = useState(null);

  const loadAllTrainingData = async () => {
    setLoading(true);
    setError('');

    try {
      const [
        enrRes,
        attRes,
        assessRes,
        evalRes,
        certRes,
        notifRes,
      ] = await Promise.all([
        enrollmentService.my().catch(() => ({ data: [] })),
        attendanceService.getStudentAttendance().catch(() => null),
        portalAssessmentService.getAssessments().catch(() => ({ courseAssessments: [] })),
        evaluationService.getEvaluations().catch(() => []),
        certificateCriteriaService.getCertificateStatus().catch(() => null),
        notificationService.list().catch(() => ({ data: [] })),
      ]);

      const enrList = enrRes.data || [];
      setEnrollments(enrList);
      setAttendanceData(attRes);
      setAssessmentsData(assessRes.courseAssessments || []);
      setEvaluations(evalRes || []);
      setCertStatus(certRes);
      setNotifications(notifRes.data || []);

      // Default selection priority: first Active, then Confirmed, then 0
      const activeIdx = enrList.findIndex((e) => e.status === 'Active');
      if (activeIdx !== -1) {
        setSelectedIdx(activeIdx);
      } else {
        setSelectedIdx(0);
      }
    } catch (err) {
      setError(err.message || 'Failed to initialize Training Mission Control.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllTrainingData();
  }, []);

  const now = new Date();

  // Categorize enrollments
  const currentTraining = enrollments.filter((e) => {
    if (e.status === 'Active') return true;
    if (e.status === 'Confirmed') {
      const startDate = e.cohort?.startDate || e.course?.startDate;
      return startDate && new Date(startDate) <= now;
    }
    return false;
  });

  const upcomingTraining = enrollments.filter((e) => {
    if (e.status === 'Confirmed') {
      const startDate = e.cohort?.startDate || e.course?.startDate;
      return !startDate || new Date(startDate) > now;
    }
    return false;
  });

  const completedTraining = enrollments.filter((e) => e.status === 'Completed');

  const getFilteredList = () => {
    if (filterTab === 'current') return currentTraining;
    if (filterTab === 'upcoming') return upcomingTraining;
    if (filterTab === 'completed') return completedTraining;
    return enrollments;
  };

  const displayedList = getFilteredList();

  // Active selected enrollment
  const currentEnrollment = displayedList[selectedIdx] || displayedList[0] || enrollments[selectedIdx] || enrollments[0];
  const activeCourse = currentEnrollment?.course;

  // Correlated telemetry for active enrollment
  const currentAttendanceRecord = attendanceData?.courses?.find(
    (c) => String(c.enrollmentId) === String(currentEnrollment?._id) || String(c.courseId) === String(activeCourse?._id)
  ) || attendanceData?.courses?.[0] || null;

  const currentCourseAssessments = assessmentsData.filter(
    (a) => String(a.courseId) === String(activeCourse?._id)
  );

  const currentEvaluation = evaluations.find(
    (ev) => String(ev.courseId) === String(activeCourse?._id)
  ) || null;

  if (loading) {
    return <LoadingState label="Initializing Training Mission Control telemetry…" />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={loadAllTrainingData} />;
  }

  // 1. EMPTY STATE: No Enrollments at all
  if (enrollments.length === 0) {
    return (
      <div>
        <PageHeader
          title="Training Mission Control"
          subtitle="Real-time cockpit for active cohort training, daily syllabus milestones, session logs, and technical assessments."
          breadcrumbs={[
            { label: 'Portal', to: '/student/dashboard' },
            { label: 'My Training' },
          ]}
          actions={
            <Link to="/student/programs" className="btn btn-primary btn-sm">
              <i className="fa-solid fa-compass me-1"></i> Explore Space Programs
            </Link>
          }
        />

        <EmptyState
          icon="fa-satellite-dish"
          title="You don't have an active training program yet"
          message="Once your application is approved and enrollment confirmed, your Training Mission Control, live session schedule, and lab curriculum will activate here."
          actionLabel="Browse Accredited Programs"
          actionLink="/student/programs"
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Training Mission Control"
        subtitle="Real-time operations center for your enrolled cohort: track daily syllabus progress, laboratory check-ins, assessments, and technical materials."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'My Training' },
        ]}
        actions={
          <div className="d-flex gap-2">
            <Link to="/student/programs" className="btn btn-outline-primary btn-sm">
              <i className="fa-solid fa-compass me-1"></i> Catalog
            </Link>
            <Link to="/student/attendance" className="btn btn-primary btn-sm">
              <i className="fa-solid fa-calendar-check me-1"></i> Attendance Log
            </Link>
          </div>
        }
      />

      {/* Filter Tabs & Quick Categorization */}
      <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-4">
        <div className="d-flex flex-wrap gap-2">
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 ${filterTab === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => {
              setFilterTab('all');
              setSelectedIdx(0);
            }}
          >
            All Programs ({enrollments.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 ${filterTab === 'current' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => {
              setFilterTab('current');
              setSelectedIdx(0);
            }}
          >
            Active Missions ({currentTraining.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 ${filterTab === 'upcoming' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => {
              setFilterTab('upcoming');
              setSelectedIdx(0);
            }}
          >
            Upcoming ({upcomingTraining.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm rounded-pill px-3 ${filterTab === 'completed' ? 'btn-primary' : 'btn-outline-secondary'}`}
            onClick={() => {
              setFilterTab('completed');
              setSelectedIdx(0);
            }}
          >
            Completed ({completedTraining.length})
          </button>
        </div>

        {displayedList.length > 1 && (
          <span className="text-muted small">
            Displaying {selectedIdx + 1} of {displayedList.length} programs
          </span>
        )}
      </div>

      {/* Filter Category Empty State */}
      {displayedList.length === 0 ? (
        <EmptyState
          icon="fa-filter"
          title="No training matches this filter"
          message="Switch tabs to inspect all your enrolled programs and cohort schedules."
          actionLabel="View All Programs"
          onAction={() => {
            setFilterTab('all');
            setSelectedIdx(0);
          }}
        />
      ) : (
        <>
          {/* A. Training Command Header */}
          <StudentTrainingHero
            enrollment={currentEnrollment}
            allEnrollments={displayedList}
            selectedIndex={selectedIdx}
            onSelectIndex={(idx) => setSelectedIdx(idx)}
          />

          {/* B. Urgent Next Training Action / Session Notice */}
          <NextTrainingAction
            enrollment={currentEnrollment}
            attendanceRecord={currentAttendanceRecord}
            assessments={currentCourseAssessments}
            evaluationStatus={currentEvaluation}
            onMarkAttendance={(session) => {
              setSelectedSessionForQR(session);
              setIsQRModalOpen(true);
            }}
          />

          {/* C. Multidimensional Progress Telemetry */}
          <TrainingProgress
            enrollment={currentEnrollment}
            attendanceRecord={currentAttendanceRecord}
            assessments={currentCourseAssessments}
          />

          {/* D. Main Mission Content Grid */}
          <div className="row g-4">
            {/* Left 7 Columns: Trajectory, Schedule & Curriculum */}
            <div className="col-lg-7">
              {/* Learning Trajectory Timeline */}
              <LearningTrajectory
                enrollment={currentEnrollment}
                attendanceRecord={currentAttendanceRecord}
              />

              {/* Day-by-Day Session Agendas & Schedule */}
              <TrainingSchedule
                attendanceRecord={currentAttendanceRecord}
                course={activeCourse}
              />

              {/* Official Course Curriculum Browser */}
              <CurriculumProgress
                course={activeCourse}
                enrollment={currentEnrollment}
                attendanceRecord={currentAttendanceRecord}
              />

              {/* Assessments Section inside My Training */}
              <TrainingAssessmentsSection
                enrollment={currentEnrollment}
                onRefresh={loadAllTrainingData}
              />
            </div>

            {/* Right 5 Columns: Telemetry Snapshots, Actions, Resources, Faculty */}
            <div className="col-lg-5">
              {/* Attendance Snapshot */}
              <AttendanceSnapshot
                attendanceRecord={currentAttendanceRecord}
              />

              {/* Assessments Snapshot */}
              <AssessmentSnapshot
                assessments={currentCourseAssessments}
                onRefresh={loadAllTrainingData}
              />

              {/* Quick Actions Hub */}
              <TrainingQuickActions
                enrollment={currentEnrollment}
                isCertified={certStatus?.isCertified}
              />

              {/* Faculty & Instructor Card */}
              <InstructorCard
                course={activeCourse}
              />

              {/* Authorized Course Materials & Digital Tools */}
              <TrainingResources
                course={activeCourse}
              />

              {/* Training Media Submissions Snapshot */}
              <TrainingMediaSnapshot
                course={activeCourse}
                enrollment={currentEnrollment}
              />

              {/* Training Dispatch & Operational Notifications */}
              <TrainingNotifications
                notifications={notifications}
                courseId={activeCourse?._id}
              />
            </div>
          </div>

          {/* E. Verified Training Mission Lifecycle Journey */}
          <div className="mt-4">
            <TrainingJourney
              enrollment={currentEnrollment}
              attendanceRecord={currentAttendanceRecord}
              assessments={currentCourseAssessments}
              evaluationStatus={currentEvaluation}
              isCertified={certStatus?.isCertified}
            />
          </div>

          {/* QR Attendance Check-in Modal */}
          <QRCheckInModal
            isOpen={isQRModalOpen}
            onClose={() => setIsQRModalOpen(false)}
            onSuccess={() => loadAllTrainingData()}
            initialSession={selectedSessionForQR}
          />
        </>
      )}
    </div>
  );
}
