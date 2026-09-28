import React, { useEffect, useState } from 'react';
import styles from './AssessmentComponents.module.css';
import { getAssessmentText } from '../../utils/assessmentTranslations';
import { assessmentService } from '../../services/cycleServices';
import AssessmentAttachments from './AssessmentAttachments';
import AssessmentSubmission from './AssessmentSubmission';
import SubmissionStatus from './SubmissionStatus';
import AssessmentResult from './AssessmentResult';
import FeedbackCard from './FeedbackCard';
import AssessmentStatusBadge from './AssessmentStatusBadge';

export default function AssessmentDetails({
  assessmentId,
  initialAssessment = null,
  onClose,
  onUpdated,
  language = 'en',
}) {
  const t = getAssessmentText(language);
  const isAr = language === 'ar';

  const [loading, setLoading] = useState(!initialAssessment);
  const [error, setError] = useState('');
  const [data, setData] = useState({
    assessment: initialAssessment,
    submission: null,
    result: null,
    submissionStatus: 'Not_Submitted',
    evaluationStatus: 'Not_Evaluated',
  });

  const loadDetails = async () => {
    if (!assessmentId && !initialAssessment?.id && !initialAssessment?._id) return;
    const targetId = assessmentId || initialAssessment.id || initialAssessment._id;

    setLoading(true);
    setError('');

    try {
      const res = await assessmentService.getById(targetId);
      setData(res.data || res);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load assessment details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [assessmentId]);

  const assessment = data.assessment || initialAssessment;
  const submission = data.submission;
  const result = data.result;

  if (!assessment && loading) {
    return (
      <div className="modal fade show d-block" style={{ backgroundColor: 'rgba(5, 12, 28, 0.8)', zIndex: 1060 }} tabIndex="-1">
        <div className="modal-dialog modal-dialog-centered modal-lg">
          <div className="modal-content border-0 p-5 text-center">
            <div className="spinner-border text-primary mx-auto mb-3" role="status"></div>
            <p className="text-muted small mb-0">{t.submitting}</p>
          </div>
        </div>
      </div>
    );
  }

  const dueDate = assessment?.dueDate || assessment?.assessmentDate;
  const formattedDeadline = dueDate
    ? new Date(dueDate).toLocaleString(isAr ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const formattedAvailableDate = assessment?.availableDate
    ? new Date(assessment.availableDate).toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : '—';

  const isEvaluated = Boolean(result && result.status === 'Evaluated');
  const isSubmitted = Boolean(submission);

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(5, 12, 28, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1060 }}
      tabIndex="-1"
    >
      <div className="modal-dialog modal-dialog-centered modal-lg modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg text-dark overflow-hidden" style={{ borderRadius: '16px' }}>
          
          {/* 1. Modal Header */}
          <div className={styles.detailsHeader}>
            <div className="d-flex justify-content-between align-items-start gap-3">
              <div className="overflow-hidden">
                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <span className="badge bg-light text-dark fw-bold text-uppercase" style={{ fontSize: '0.72rem' }}>
                    {assessment?.type || 'Assessment'}
                  </span>
                  <AssessmentStatusBadge
                    submissionStatus={data.submissionStatus || (isSubmitted ? 'Submitted' : 'Not Submitted')}
                    evaluationStatus={data.evaluationStatus || (isEvaluated ? 'Evaluated' : 'Scheduled')}
                    isLate={submission?.isLate}
                    resultLabel={result?.resultLabel}
                    language={language}
                  />
                </div>
                <h4 className="fw-bold text-white mb-1">{assessment?.title}</h4>
                <div className="text-light opacity-75 small">
                  <i className="fa-solid fa-graduation-cap me-1"></i>
                  {assessment?.courseTitle || assessment?.course?.title || 'EGSA Space Academy'}
                  {assessment?.cohortName && <span className="ms-2">&bull; {assessment.cohortName}</span>}
                </div>
              </div>

              <button
                type="button"
                className="btn btn-sm btn-outline-light rounded-circle flex-shrink-0 d-flex align-items-center justify-content-center"
                style={{ width: '32px', height: '32px' }}
                onClick={onClose}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          {/* 2. Modal Body */}
          <div className="modal-body p-4 bg-light d-flex flex-column gap-4">
            {error && (
              <div className="alert alert-danger p-3 rounded-3 border-0 small d-flex align-items-center gap-2 mb-0">
                <i className="fa-solid fa-circle-exclamation text-danger"></i>
                <span>{error}</span>
              </div>
            )}

            {/* A. Evaluation Result & Feedback (If Published by Instructor) */}
            {isEvaluated && (
              <div className="d-flex flex-column gap-3">
                <AssessmentResult result={result} language={language} />
                <FeedbackCard result={result} language={language} />
              </div>
            )}

            {/* B. Assessment Metadata Grid */}
            <div className={styles.metaGrid}>
              <div className={styles.metaGridItem}>
                <span className={styles.metaLabel}>{t.instructor}</span>
                <span className={styles.metaValue}>
                  <i className="fa-solid fa-user-tie text-primary me-1"></i>
                  {assessment?.instructorName || 'EGSA Faculty'}
                </span>
              </div>

              <div className={styles.metaGridItem}>
                <span className={styles.metaLabel}>{t.deadline}</span>
                <span className={styles.metaValue}>
                  <i className="fa-regular fa-clock text-warning me-1"></i>
                  {formattedDeadline}
                </span>
              </div>

              <div className={styles.metaGridItem}>
                <span className={styles.metaLabel}>{t.availableDate}</span>
                <span className={styles.metaValue}>
                  <i className="fa-regular fa-calendar-check text-info me-1"></i>
                  {formattedAvailableDate}
                </span>
              </div>

              <div className={styles.metaGridItem}>
                <span className={styles.metaLabel}>{t.maxScore}</span>
                <span className={styles.metaValue}>
                  <i className="fa-solid fa-bullseye text-success me-1"></i>
                  {assessment?.maxScore || 100}
                  {assessment?.passingScore != null && (
                    <span className="text-muted fw-normal ms-1 small">({t.passingScore}: {assessment.passingScore})</span>
                  )}
                </span>
              </div>
            </div>

            {/* C. Description (if any) */}
            {assessment?.description && (
              <div className="bg-white p-3 rounded-3 border">
                <h6 className="fw-bold text-dark small text-uppercase mb-2" style={{ letterSpacing: '0.5px' }}>
                  <i className="fa-solid fa-circle-info text-primary me-2"></i>
                  {t.description}
                </h6>
                <p className="text-secondary small mb-0" style={{ lineHeight: '1.6' }}>
                  {assessment.description}
                </p>
              </div>
            )}

            {/* D. Instructions & Guidelines */}
            <div className={styles.instructionsBox}>
              <h6 className="fw-bold text-dark small text-uppercase mb-2 d-flex align-items-center gap-2" style={{ letterSpacing: '0.5px' }}>
                <i className="fa-solid fa-clipboard-list text-primary"></i>
                {t.instructions}
              </h6>
              <div className={styles.instructionsText}>
                {assessment?.instructions || assessment?.rubric || 'Please complete all requirements outlined in the course syllabus and upload your final deliverables according to the submission policy.'}
              </div>
            </div>

            {/* E. Reference / Attachment Files */}
            <div className="bg-white p-3 rounded-3 border">
              <h6 className="fw-bold text-dark small text-uppercase mb-3 d-flex align-items-center gap-2" style={{ letterSpacing: '0.5px' }}>
                <i className="fa-solid fa-paperclip text-primary"></i>
                {t.referenceAttachments}
                {assessment?.attachments && assessment.attachments.length > 0 && (
                  <span className="badge bg-secondary-subtle text-secondary rounded-pill ms-1">
                    {assessment.attachments.length}
                  </span>
                )}
              </h6>
              <AssessmentAttachments
                attachments={assessment?.attachments}
                language={language}
              />
            </div>

            {/* F. Student Submission Area */}
            <div className="bg-white p-4 rounded-3 border shadow-sm">
              <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                <i className="fa-solid fa-file-arrow-up text-primary"></i>
                {t.mySubmission}
              </h5>

              {isSubmitted ? (
                <SubmissionStatus
                  assessment={assessment}
                  submission={submission}
                  language={language}
                  onResubmitSuccess={() => {
                    loadDetails();
                    if (onUpdated) onUpdated();
                  }}
                />
              ) : (
                <AssessmentSubmission
                  assessment={assessment}
                  language={language}
                  onSuccess={() => {
                    loadDetails();
                    if (onUpdated) onUpdated();
                  }}
                />
              )}
            </div>

          </div>

          {/* 3. Modal Footer */}
          <div className="modal-footer bg-light px-4 py-2 border-top d-flex justify-content-between">
            <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
              Academic Affairs &bull; Egyptian Space Agency (EGSA)
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              {t.close}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
