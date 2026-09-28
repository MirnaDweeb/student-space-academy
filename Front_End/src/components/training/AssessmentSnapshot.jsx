import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import AssessmentDetails from '../assessments/AssessmentDetails';
import { getAssessmentText } from '../../utils/assessmentTranslations';

export default function AssessmentSnapshot({ assessments = [], onRefresh }) {
  const { language = 'en' } = useAuth();
  const t = getAssessmentText(language);
  const isAr = language === 'ar';

  const [selectedAssessment, setSelectedAssessment] = useState(null);

  if (assessments.length === 0) {
    return (
      <div className="egsa-card p-4 mb-4">
        <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
          <i className="fa-solid fa-list-check text-primary"></i>
          {t.assessmentsTitle}
        </h6>
        <p className="text-muted small mb-0">{t.noAssessmentsForCohort}</p>
      </div>
    );
  }

  const evaluated = assessments.filter((a) => a.status === 'Evaluated' || a.rawStatus === 'Evaluated' || a.status === 'Completed');
  const pending = assessments.filter((a) => a.status === 'Submitted' || a.rawStatus === 'Pending Evaluation');
  const upcoming = assessments.filter((a) => a.status === 'Upcoming' || (!evaluated.includes(a) && !pending.includes(a)));

  return (
    <div className="egsa-card p-4 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
        <div className="d-flex align-items-center gap-2">
          <i className="fa-solid fa-list-check text-primary"></i>
          <h6 className="fw-bold text-dark mb-0 text-uppercase" style={{ letterSpacing: '0.5px', fontSize: '0.85rem' }}>
            {t.assessmentsTitle}
          </h6>
        </div>
        <Link to="/student/assessments" className="btn btn-xs btn-outline-primary fw-semibold" style={{ fontSize: '0.75rem' }}>
          {isAr ? 'عرض الكل' : 'All'} ({assessments.length}) &rarr;
        </Link>
      </div>

      {/* Quick Summary Pill Bar */}
      <div className="d-flex justify-content-between align-items-center p-2 rounded-3 bg-light border mb-3 small" style={{ fontSize: '0.75rem' }}>
        <span>
          {t.evaluatedTab}: <strong className="text-success">{evaluated.length}</strong>
        </span>
        <span className="border-start ps-2">
          {t.submittedTab}: <strong className="text-warning">{pending.length}</strong>
        </span>
        <span className="border-start ps-2">
          {t.upcomingTab}: <strong className="text-secondary">{upcoming.length}</strong>
        </span>
      </div>

      {/* Evaluated Recent Records */}
      {evaluated.length > 0 && (
        <div className="mb-3">
          <span className="text-muted fw-bold text-uppercase d-block mb-2" style={{ fontSize: '0.7rem' }}>
            {isAr ? 'نتائج معتمدة' : 'Official Certified Results'}
          </span>
          <div className="d-flex flex-column gap-2">
            {evaluated.slice(0, 2).map((a) => {
              const isPassed = a.resultLabel === 'Passed' || (a.percentage != null && a.percentage >= 70);
              return (
                <div
                  key={a.id || a.assessmentId || a._id}
                  className="p-2 px-3 border rounded-3 bg-white d-flex justify-content-between align-items-center hover-shadow transition-all cursor-pointer"
                  onClick={() => setSelectedAssessment(a)}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="overflow-hidden me-2">
                    <strong className="text-dark d-block text-truncate small" title={a.title}>
                      {a.title}
                    </strong>
                    <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                      {a.type} &bull; {a.weight ? (typeof a.weight === 'string' ? a.weight : `${a.weight}%`) : '25%'}
                    </span>
                  </div>
                  <div className="text-end flex-shrink-0">
                    <span className={`badge ${isPassed ? 'bg-success' : 'bg-danger'} px-2 py-1`}>
                      {a.score} / {a.maxScore || 100} ({a.percentage}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Pending Evaluations */}
      {pending.length > 0 && (
        <div className="mb-3">
          <span className="text-muted fw-bold text-uppercase d-block mb-2" style={{ fontSize: '0.7rem' }}>
            {isAr ? 'قيد مراجعة المُقيّم' : 'Pending Faculty Review'}
          </span>
          <div className="d-flex flex-column gap-2">
            {pending.slice(0, 1).map((a) => (
              <div
                key={a.id || a.assessmentId || a._id}
                className="p-2 px-3 border rounded-3 bg-warning-subtle d-flex justify-content-between align-items-center cursor-pointer"
                onClick={() => setSelectedAssessment(a)}
                style={{ cursor: 'pointer' }}
              >
                <div className="overflow-hidden me-2">
                  <strong className="text-dark d-block text-truncate small">{a.title}</strong>
                  <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                    {isAr ? 'تم التسليم — بانتظار اعتماد التقييم' : 'Submitted — Awaiting evaluation'}
                  </span>
                </div>
                <span className="badge bg-warning text-dark flex-shrink-0">
                  <i className="fa-solid fa-hourglass-half me-1"></i> {t.statusPending}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Milestones */}
      {upcoming.length > 0 && (
        <div className="mb-3">
          <span className="text-muted fw-bold text-uppercase d-block mb-2" style={{ fontSize: '0.7rem' }}>
            {isAr ? 'تقييمات قادمة' : 'Upcoming Milestones'}
          </span>
          <div className="d-flex flex-column gap-2">
            {upcoming.slice(0, 1).map((a) => (
              <div
                key={a.id || a.assessmentId || a._id}
                className="p-2 px-3 border rounded-3 bg-light d-flex justify-content-between align-items-center cursor-pointer"
                onClick={() => setSelectedAssessment(a)}
                style={{ cursor: 'pointer' }}
              >
                <div className="overflow-hidden me-2">
                  <strong className="text-dark d-block text-truncate small">{a.title}</strong>
                  <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                    {t.deadline}: {new Date(a.dueDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                  </span>
                </div>
                <span className="badge bg-secondary flex-shrink-0">{t.statusUpcoming}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="d-grid mt-2">
        <Link to="/student/assessments" className="btn btn-outline-primary btn-sm fw-semibold">
          <i className="fa-solid fa-arrow-up-right-from-square me-1"></i>
          {isAr ? 'فتح سجل التقييمات الكامل' : 'Open Full Assessments Transcript'}
        </Link>
      </div>

      {/* Integrated Assessment Details Modal */}
      {selectedAssessment && (
        <AssessmentDetails
          assessmentId={selectedAssessment.id || selectedAssessment.assessmentId || selectedAssessment._id}
          initialAssessment={selectedAssessment}
          language={language}
          onClose={() => setSelectedAssessment(null)}
          onUpdated={() => {
            if (onRefresh) onRefresh();
          }}
        />
      )}
    </div>
  );
}
