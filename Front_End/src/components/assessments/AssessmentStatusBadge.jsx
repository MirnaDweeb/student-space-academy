import React from 'react';
import styles from './AssessmentComponents.module.css';
import { getAssessmentText } from '../../utils/assessmentTranslations';

export default function AssessmentStatusBadge({
  submissionStatus = 'Not Submitted',
  evaluationStatus = 'Scheduled',
  isLate = false,
  resultLabel = null,
  language = 'en',
}) {
  const t = getAssessmentText(language);
  const isSubmitted = submissionStatus === 'Submitted';
  const isEvaluated = evaluationStatus === 'Evaluated';
  const isPending = evaluationStatus === 'Pending';

  return (
    <div className={styles.badgeStrip}>
      {/* 1. Main Status Badge */}
      {isEvaluated ? (
        <span className={styles.badgeEvaluated}>
          <i className="fa-solid fa-circle-check"></i>
          {t.statusEvaluated}
          {resultLabel ? ` (${resultLabel === 'Passed' ? t.passed : t.failed})` : ''}
        </span>
      ) : isSubmitted || isPending ? (
        <span className={styles.badgeSubmitted}>
          <i className="fa-solid fa-hourglass-half"></i>
          {isPending ? t.statusPending : t.statusSubmitted}
        </span>
      ) : (
        <span className={styles.badgeUpcoming}>
          <i className="fa-solid fa-calendar-day"></i>
          {t.statusNotSubmitted}
        </span>
      )}

      {/* 2. Late Submission Tag */}
      {isLate && (
        <span className={styles.badgeLate}>
          <i className="fa-solid fa-triangle-exclamation me-1"></i>
          {t.lateSubmission}
        </span>
      )}
    </div>
  );
}
