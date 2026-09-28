import React from 'react';
import styles from './AssessmentComponents.module.css';
import { getAssessmentText } from '../../utils/assessmentTranslations';

export default function FeedbackCard({
  result,
  language = 'en',
}) {
  if (!result) return null;
  const t = getAssessmentText(language);

  const hasFeedback = Boolean(result.feedback);
  const hasStrengths = Boolean(result.strengths);
  const hasImprovements = Boolean(result.improvementAreas);

  if (!hasFeedback && !hasStrengths && !hasImprovements) {
    return null;
  }

  return (
    <div className={styles.feedbackBlock}>
      {/* 1. General Instructor Feedback */}
      {hasFeedback && (
        <div>
          <h6 className="fw-bold text-dark small text-uppercase mb-2 d-flex align-items-center gap-2" style={{ letterSpacing: '0.5px' }}>
            <i className="fa-solid fa-comment-dots text-primary"></i>
            {t.instructorFeedback}
          </h6>
          <div className={styles.feedbackSnippet}>
            "{result.feedback}"
          </div>
        </div>
      )}

      {/* 2. Technical Strengths */}
      {hasStrengths && (
        <div>
          <h6 className="fw-bold text-success small text-uppercase mb-2 d-flex align-items-center gap-2" style={{ letterSpacing: '0.5px' }}>
            <i className="fa-solid fa-circle-check"></i>
            {t.strengths}
          </h6>
          <div className={styles.strengthsSnippet}>
            {result.strengths}
          </div>
        </div>
      )}

      {/* 3. Areas for Improvement */}
      {hasImprovements && (
        <div>
          <h6 className="fw-bold text-warning small text-uppercase mb-2 d-flex align-items-center gap-2" style={{ letterSpacing: '0.5px' }}>
            <i className="fa-solid fa-lightbulb"></i>
            {t.areasForImprovement}
          </h6>
          <div className={styles.improvementSnippet}>
            {result.improvementAreas}
          </div>
        </div>
      )}
    </div>
  );
}
