import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { assessmentService } from '../../services/cycleServices';
import AssessmentCard from '../assessments/AssessmentCard';
import AssessmentDetails from '../assessments/AssessmentDetails';
import { getAssessmentText } from '../../utils/assessmentTranslations';

export default function TrainingAssessmentsSection({ enrollment, onRefresh }) {
  const { language = 'en' } = useAuth();
  const t = getAssessmentText(language);
  const isAr = language === 'ar';

  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'submitted' | 'evaluated' | 'all'
  const [data, setData] = useState({
    assessments: [],
    sections: { upcoming: [], submitted: [], evaluated: [] },
    summary: {},
  });
  const [loading, setLoading] = useState(false);
  const [selectedAssessment, setSelectedAssessment] = useState(null);

  const courseId = enrollment?.course?._id;

  const loadAssessments = async () => {
    if (!enrollment) return;
    setLoading(true);
    try {
      const res = await assessmentService.my(courseId ? { courseId } : {});
      const payload = res.data || res;
      const allItems = payload.assessments || [];

      // Filter by enrolled cohort/course strictly
      const cohortId = String(enrollment.cohort?._id || enrollment.cohort || '');
      const filteredItems = cohortId
        ? allItems.filter((a) => String(a.cohortId || a.cohort?._id || a.cohort || '') === cohortId || String(a.courseId) === String(courseId))
        : allItems.filter((a) => String(a.courseId) === String(courseId));

      const sections = {
        upcoming: filteredItems.filter((a) => a.status === 'Upcoming'),
        submitted: filteredItems.filter((a) => a.status === 'Submitted' || a.status === 'Pending Evaluation'),
        evaluated: filteredItems.filter((a) => a.status === 'Evaluated'),
      };

      setData({
        assessments: filteredItems,
        sections,
        summary: payload.summary || {},
      });
    } catch (err) {
      console.error('[TRAINING ASSESSMENTS] Failed to load:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAssessments();
  }, [enrollment?._id, courseId]);

  const upcomingList = data.sections?.upcoming || [];
  const submittedList = data.sections?.submitted || [];
  const evaluatedList = data.sections?.evaluated || [];
  const allList = data.assessments || [];

  let currentList = upcomingList;
  if (activeTab === 'submitted') currentList = submittedList;
  if (activeTab === 'evaluated') currentList = evaluatedList;
  if (activeTab === 'all') currentList = allList;

  return (
    <div className="egsa-card p-4 mb-4 shadow-sm border" id="training-assessments-section">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center mb-3 pb-2 border-bottom gap-2">
        <div className="d-flex align-items-center gap-2">
          <div
            className="d-flex align-items-center justify-content-center rounded-3"
            style={{ width: '38px', height: '38px', backgroundColor: '#e0f2fe', color: '#0369a1' }}
          >
            <i className="fa-solid fa-list-check fa-lg"></i>
          </div>
          <div>
            <h5 className="fw-bold text-dark mb-0">
              {t.assessmentsTitle}
            </h5>
            <span className="text-secondary small">
              {enrollment?.course?.title || 'Enrolled Course'} &bull; {enrollment?.cohort?.name || 'Cohort'}
            </span>
          </div>
        </div>

        <Link to="/student/assessments" className="btn btn-outline-primary btn-sm fw-semibold d-inline-flex align-items-center gap-1">
          <span>{isAr ? 'عرض الكل بالتفصيل' : 'All Assessments'}</span>
          <i className={`fa-solid ${isAr ? 'fa-arrow-left' : 'fa-arrow-right'} fs-8 ms-1`}></i>
        </Link>
      </div>

      {/* Tabs: Upcoming / Submitted / Evaluated */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <button
          type="button"
          className={`btn btn-sm rounded-pill px-3 transition-all ${
            activeTab === 'upcoming' ? 'btn-primary shadow-sm' : 'btn-outline-secondary'
          }`}
          onClick={() => setActiveTab('upcoming')}
        >
          <i className="fa-solid fa-calendar-day me-1"></i>
          {t.upcomingTab} ({upcomingList.length})
        </button>

        <button
          type="button"
          className={`btn btn-sm rounded-pill px-3 transition-all ${
            activeTab === 'submitted' ? 'btn-primary shadow-sm' : 'btn-outline-secondary'
          }`}
          onClick={() => setActiveTab('submitted')}
        >
          <i className="fa-solid fa-hourglass-half me-1"></i>
          {t.submittedTab} ({submittedList.length})
        </button>

        <button
          type="button"
          className={`btn btn-sm rounded-pill px-3 transition-all ${
            activeTab === 'evaluated' ? 'btn-primary shadow-sm' : 'btn-outline-secondary'
          }`}
          onClick={() => setActiveTab('evaluated')}
        >
          <i className="fa-solid fa-circle-check me-1"></i>
          {t.evaluatedTab} ({evaluatedList.length})
        </button>

        <button
          type="button"
          className={`btn btn-sm rounded-pill px-3 transition-all ${
            activeTab === 'all' ? 'btn-primary shadow-sm' : 'btn-outline-secondary'
          }`}
          onClick={() => setActiveTab('all')}
        >
          {t.allTab} ({allList.length})
        </button>
      </div>

      {/* List / Empty State */}
      {loading ? (
        <div className="p-4 text-center text-muted small">
          <span className="spinner-border spinner-border-sm me-2" role="status"></span>
          {isAr ? 'جاري تحديث سجل التقييمات...' : 'Loading cohort assessments...'}
        </div>
      ) : currentList.length === 0 ? (
        <div className="p-4 text-center bg-light rounded-3 border text-muted small">
          <i className="fa-regular fa-folder-open fa-2x mb-2 d-block text-secondary opacity-50"></i>
          <span>{t.noAssessments}</span>
        </div>
      ) : (
        <div className="d-flex flex-column gap-3">
          {currentList.map((item) => (
            <AssessmentCard
              key={item.id || item.assessmentId || item._id}
              assessment={item}
              language={language}
              onView={(a) => setSelectedAssessment(a)}
            />
          ))}
        </div>
      )}

      {/* Dedicated Assessment Details Modal */}
      {selectedAssessment && (
        <AssessmentDetails
          assessmentId={selectedAssessment.id || selectedAssessment.assessmentId || selectedAssessment._id}
          initialAssessment={selectedAssessment}
          language={language}
          onClose={() => setSelectedAssessment(null)}
          onUpdated={() => {
            loadAssessments();
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
