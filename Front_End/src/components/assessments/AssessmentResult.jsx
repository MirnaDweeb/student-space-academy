import React from 'react';
import styles from './AssessmentComponents.module.css';
import { getAssessmentText } from '../../utils/assessmentTranslations';

export default function AssessmentResult({
  result,
  language = 'en',
}) {
  if (!result) return null;
  const t = getAssessmentText(language);
  const isAr = language === 'ar';

  const isPassed = result.resultLabel === 'Passed' || result.percentage >= 70;
  const evaluatedDate = result.evaluatedAt
    ? new Date(result.evaluatedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  return (
    <div className={isPassed ? styles.resultBanner : styles.resultBannerFailed}>
      <div>
        <span className="badge bg-light text-dark fw-bold text-uppercase mb-2" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
          {t.assessmentResult} &bull; {t.statusEvaluated}
        </span>
        <div className="d-flex align-items-baseline gap-2">
          <div className={styles.scoreHuge}>
            {result.score}
            <span className="fs-5 opacity-75 fw-normal"> / {result.maxScore}</span>
          </div>
        </div>
        <div className="text-light opacity-75 small mt-1">
          {t.percentage}: <strong>{result.percentage}%</strong>
        </div>
      </div>

      <div className="text-sm-end">
        <div className="fs-5 fw-bold mb-1 d-flex align-items-center justify-content-sm-end gap-2">
          <i className={`fa-solid ${isPassed ? 'fa-award text-warning' : 'fa-circle-exclamation'}`}></i>
          <span>{result.resultLabel ? (result.resultLabel === 'Passed' ? t.passed : t.failed) : (isPassed ? t.passed : t.failed)}</span>
        </div>
        <div className="text-light opacity-75 small">
          <span>{t.instructor}: <strong>{result.instructorName || 'EGSA Faculty'}</strong></span>
        </div>
        <div className="text-light opacity-75 small" style={{ fontSize: '0.75rem' }}>
          <span>{t.evaluatedOn}: {evaluatedDate}</span>
        </div>
      </div>
    </div>
  );
}
