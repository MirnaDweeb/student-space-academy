import React, { useState } from 'react';
import styles from './AssessmentComponents.module.css';
import { getAssessmentText } from '../../utils/assessmentTranslations';
import AssessmentSubmission from './AssessmentSubmission';

export default function SubmissionStatus({
  assessment,
  submission,
  onResubmitSuccess,
  language = 'en',
}) {
  const t = getAssessmentText(language);
  const isAr = language === 'ar';
  const [isResubmitting, setIsResubmitting] = useState(false);

  if (!submission) return null;

  const allowResubmission = Boolean(assessment.allowResubmission);
  const submittedDate = submission.submittedAt
    ? new Date(submission.submittedAt).toLocaleString(isAr ? 'ar-EG' : 'en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const downloadFileUrl = submission.file?.downloadUrl || (submission.file?.fileUrl ? `${submission.file.fileUrl}?download=true` : '#');
  const viewFileUrl = submission.file?.viewUrl || submission.file?.fileUrl || downloadFileUrl;

  return (
    <div className="d-flex flex-column gap-3">
      {/* Success / Status Banner */}
      <div className="alert alert-success p-3 rounded-3 border-0 shadow-sm d-flex align-items-center gap-3 mb-0">
        <div
          className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
          style={{ width: '42px', height: '42px', backgroundColor: '#dcfce7', color: '#15803d' }}
        >
          <i className="fa-solid fa-circle-check fa-xl"></i>
        </div>
        <div>
          <h6 className="fw-bold text-success mb-0">{t.assessmentSubmittedTitle}</h6>
          <span className="text-secondary small">{t.assessmentSubmittedMsg}</span>
        </div>
      </div>

      {/* Submission Metadata Container */}
      <div className={styles.submittedCard}>
        <div className="d-flex justify-content-between align-items-start gap-2 border-bottom pb-2 mb-3">
          <div>
            <span className="text-uppercase text-muted fw-bold small" style={{ fontSize: '0.72rem' }}>
              {t.mySubmission} &bull; {t.versionLabel} {submission.version || 1}
            </span>
            <div className="d-flex align-items-center gap-2 mt-1">
              <span className="badge bg-warning-subtle text-dark border border-warning-subtle px-2 py-1">
                <i className="fa-solid fa-hourglass-half me-1"></i>
                {t.statusPending}
              </span>
              {submission.isLate && (
                <span className="badge bg-danger text-white px-2 py-1">
                  <i className="fa-solid fa-triangle-exclamation me-1"></i>
                  {t.lateSubmission}
                </span>
              )}
            </div>
          </div>

          <div className="text-end text-muted small">
            <span className="d-block" style={{ fontSize: '0.75rem' }}>{t.submittedDate}:</span>
            <strong className="text-dark">{submittedDate}</strong>
          </div>
        </div>

        {/* Uploaded File Details (if present) */}
        {submission.file?.originalName && (
          <div className="mb-3">
            <span className="text-muted fw-semibold small d-block mb-1">{t.submittedFileLabel}</span>
            <div className="p-2 px-3 bg-light rounded-3 border d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                <i className="fa-solid fa-file-lines text-primary flex-shrink-0"></i>
                <span className="text-dark fw-semibold small text-truncate" title={submission.file.originalName}>
                  {submission.file.originalName}
                </span>
              </div>
              <div className="d-flex align-items-center gap-2 flex-shrink-0">
                {viewFileUrl && (
                  <a
                    href={viewFileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-xs btn-outline-secondary"
                    style={{ fontSize: '0.75rem' }}
                  >
                    <i className="fa-solid fa-eye me-1"></i>
                    {t.viewFile}
                  </a>
                )}
                {downloadFileUrl && (
                  <a
                    href={downloadFileUrl}
                    download={submission.file.originalName}
                    className="btn btn-xs btn-outline-primary"
                    style={{ fontSize: '0.75rem' }}
                  >
                    <i className="fa-solid fa-download me-1"></i>
                    {t.downloadFile}
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Written Response Answer (if present) */}
        {submission.textAnswer && (
          <div className="mb-3">
            <span className="text-muted fw-semibold small d-block mb-1">{t.yourAnswer}</span>
            <div className="p-3 bg-light rounded-3 border text-dark small" style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
              {submission.textAnswer}
            </div>
          </div>
        )}

        {/* Resubmission Controls */}
        <div className="pt-2 border-top d-flex flex-wrap justify-content-between align-items-center gap-2">
          {allowResubmission ? (
            !isResubmitting ? (
              <div className="d-flex justify-content-between align-items-center w-100">
                <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
                  <i className="fa-solid fa-circle-info text-primary me-1"></i>
                  {t.resubmitInfo}
                </span>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary fw-semibold"
                  onClick={() => setIsResubmitting(true)}
                >
                  <i className="fa-solid fa-arrows-rotate me-1"></i>
                  {t.resubmit}
                </button>
              </div>
            ) : (
              <div className="w-100">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                    <i className="fa-solid fa-arrows-rotate text-primary"></i>
                    {t.resubmit}
                  </h6>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() => setIsResubmitting(false)}
                  >
                    {t.cancelResubmit}
                  </button>
                </div>
                <AssessmentSubmission
                  assessment={assessment}
                  language={language}
                  onSuccess={(updatedSub) => {
                    setIsResubmitting(false);
                    if (onResubmitSuccess) onResubmitSuccess(updatedSub);
                  }}
                />
              </div>
            )
          ) : (
            <span className="text-muted small fst-italic" style={{ fontSize: '0.78rem' }}>
              <i className="fa-solid fa-lock text-secondary me-1"></i>
              {t.readonlySubmission}
            </span>
          )}
        </div>
      </div>

      {/* Version History (if any previous versions exist) */}
      {submission.history && submission.history.length > 0 && (
        <div className="bg-light p-3 rounded-3 border">
          <h6 className="fw-semibold text-secondary small mb-2 d-flex align-items-center gap-2">
            <i className="fa-solid fa-timeline text-primary"></i>
            {t.historyTitle} ({submission.history.length})
          </h6>
          <div className="d-flex flex-column gap-2">
            {submission.history.map((h, i) => (
              <div key={i} className="p-2 px-3 bg-white rounded border small d-flex justify-content-between align-items-center">
                <span>
                  <strong>{t.versionLabel} {h.version}</strong>
                  {h.originalName && <span className="ms-2 text-muted">&bull; {h.originalName}</span>}
                  {h.isLate && <span className="badge bg-danger ms-2" style={{ fontSize: '0.65rem' }}>{t.lateSubmission}</span>}
                </span>
                <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                  {new Date(h.submittedAt).toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
