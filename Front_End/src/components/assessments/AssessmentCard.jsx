import React from 'react';
import styles from './AssessmentComponents.module.css';
import AssessmentStatusBadge from './AssessmentStatusBadge';
import { getAssessmentText } from '../../utils/assessmentTranslations';

export default function AssessmentCard({
  assessment,
  onView,
  language = 'en',
}) {
  if (!assessment) return null;
  const t = getAssessmentText(language);
  const isAr = language === 'ar';

  const dueDate = assessment.dueDate || assessment.assessmentDate;
  const formattedDeadline = dueDate
    ? new Date(dueDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  return (
    <div className={styles.assessmentCard}>
      <div className={styles.assessmentCardHeader}>
        <div className="flex-grow-1 overflow-hidden">
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <span className="badge bg-primary-subtle text-primary border border-primary-subtle fw-medium" style={{ fontSize: '0.75rem' }}>
              {assessment.type || 'Technical Assessment'}
            </span>
            {assessment.weight != null && (
              <span className="badge bg-light text-muted border" style={{ fontSize: '0.72rem' }}>
                {t.weight}: {assessment.weight}%
              </span>
            )}
            <AssessmentStatusBadge
              submissionStatus={assessment.submissionStatus || (assessment.isSubmitted ? 'Submitted' : 'Not Submitted')}
              evaluationStatus={assessment.evaluationStatus || (assessment.status === 'Evaluated' ? 'Evaluated' : 'Scheduled')}
              isLate={assessment.isLate}
              resultLabel={assessment.resultLabel}
              language={language}
            />
          </div>

          <h5 className="fw-bold text-dark mb-1 text-truncate" title={assessment.title}>
            {assessment.title}
          </h5>

          <div className="text-secondary small d-flex flex-wrap align-items-center gap-2">
            <span>
              <i className="fa-solid fa-graduation-cap me-1 text-primary"></i>
              <strong>{t.course}:</strong> {assessment.courseTitle || 'EGSA Course'}
            </span>
            {assessment.cohortName && (
              <span className="border-start ps-2">
                <i className="fa-solid fa-users me-1 text-secondary"></i>
                <strong>{t.cohort}:</strong> {assessment.cohortName}
              </span>
            )}
          </div>
        </div>

        {/* View Action CTA */}
        <div className="flex-shrink-0 text-end">
          <button
            type="button"
            className="btn btn-sm btn-primary fw-semibold d-inline-flex align-items-center gap-1 shadow-sm px-3"
            onClick={() => onView(assessment)}
          >
            <span>{t.viewAssessment}</span>
            <i className={`fa-solid ${isAr ? 'fa-arrow-left' : 'fa-arrow-right'} fs-8 ms-1`}></i>
          </button>
        </div>
      </div>

      {/* Meta Row: Instructor, Deadline, Max Score */}
      <div className={styles.cardMetaRow}>
        <span className={styles.cardMetaItem}>
          <i className="fa-solid fa-user-tie text-primary"></i>
          <span>{t.instructor}: <strong>{assessment.instructorName || 'EGSA Faculty'}</strong></span>
        </span>

        <span className={styles.cardMetaItem}>
          <i className="fa-regular fa-clock text-warning"></i>
          <span>{t.deadline}: <strong>{formattedDeadline}</strong></span>
        </span>

        {assessment.maxScore != null && (
          <span className={styles.cardMetaItem}>
            <i className="fa-solid fa-bullseye text-info"></i>
            <span>{t.maxScore}: <strong>{assessment.maxScore}</strong></span>
          </span>
        )}

        {assessment.status === 'Evaluated' && assessment.score != null && (
          <span className={styles.cardMetaItem}>
            <i className="fa-solid fa-award text-success"></i>
            <span className="text-success fw-bold">
              {t.score}: {assessment.score} / {assessment.maxScore} ({assessment.percentage}%)
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
