import React, { useState, useRef } from 'react';
import styles from './AssessmentComponents.module.css';
import { getAssessmentText } from '../../utils/assessmentTranslations';
import { assessmentService } from '../../services/cycleServices';

export default function AssessmentSubmission({
  assessment,
  onSuccess,
  language = 'en',
}) {
  const t = getAssessmentText(language);
  const fileInputRef = useRef(null);

  const submissionType = assessment.submissionType || 'file'; // 'file' | 'text' | 'both'
  const allowLate = Boolean(assessment.allowLateSubmission);
  const isDeadlinePassed = Boolean(assessment.isDeadlinePassed);

  const [selectedFile, setSelectedFile] = useState(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [clientError, setClientError] = useState('');

  // Determine if student is blocked by deadline
  const isBlockedByDeadline = isDeadlinePassed && !allowLate;

  // Prohibited extensions
  const FORBIDDEN_EXTS = ['.exe', '.bat', '.sh', '.cmd', '.msi', '.bin', '.js', '.vbs', '.php', '.jar'];

  const validateFile = (file) => {
    if (!file) return null;
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    if (FORBIDDEN_EXTS.includes(ext)) {
      return t.invalidFileTypeError;
    }
    if (file.size > 25 * 1024 * 1024) {
      return t.fileTooLargeError;
    }
    return null;
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    setClientError('');
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      setClientError(error);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }
    setSelectedFile(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    setClientError('');
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const error = validateFile(file);
    if (error) {
      setClientError(error);
      setSelectedFile(null);
      return;
    }
    setSelectedFile(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setClientError('');

    if (isBlockedByDeadline) {
      setClientError(t.closedDeadlineNotice);
      return;
    }

    // Input validation based on submissionType
    if (submissionType === 'file' && !selectedFile) {
      setClientError(t.fileRequiredError);
      return;
    }

    if (submissionType === 'text' && !textAnswer.trim()) {
      setClientError(t.textRequiredError);
      return;
    }

    if (submissionType === 'both' && !selectedFile && !textAnswer.trim()) {
      setClientError(t.bothRequiredError);
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      if (textAnswer.trim()) {
        formData.append('textAnswer', textAnswer.trim());
      }

      const res = await assessmentService.submit(assessment.id || assessment._id, formData);
      if (onSuccess) {
        onSuccess(res.data);
      }
    } catch (err) {
      setClientError(
        err.response?.data?.message || err.message || 'Failed to submit assessment.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // If blocked by deadline and late submissions disallowed
  if (isBlockedByDeadline) {
    return (
      <div className="alert alert-danger p-4 rounded-3 border-0 shadow-sm d-flex flex-column gap-2 mb-0">
        <div className="d-flex align-items-center gap-2">
          <i className="fa-solid fa-lock fa-lg text-danger"></i>
          <h6 className="fw-bold text-dark mb-0">{t.deadlinePassed}</h6>
        </div>
        <p className="small text-secondary mb-0">
          {t.closedDeadlineNotice}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
      {/* Late Submission Notice if deadline passed and late allowed */}
      {isDeadlinePassed && allowLate && (
        <div className="alert alert-warning p-3 rounded-3 border-0 d-flex align-items-start gap-2 mb-0">
          <i className="fa-solid fa-triangle-exclamation text-warning mt-1"></i>
          <div>
            <span className="badge bg-danger text-uppercase fw-bold mb-1" style={{ fontSize: '0.7rem' }}>
              {t.lateSubmission}
            </span>
            <p className="small text-dark mb-0">
              {t.lateNotice}
            </p>
          </div>
        </div>
      )}

      {clientError && (
        <div className="alert alert-danger p-3 rounded-3 border-0 small d-flex align-items-center gap-2">
          <i className="fa-solid fa-circle-exclamation text-danger"></i>
          <span>{clientError}</span>
        </div>
      )}

      {/* 1. File Upload Area (if submissionType is 'file' or 'both') */}
      {(submissionType === 'file' || submissionType === 'both') && (
        <div className="d-flex flex-column gap-2">
          <label className="fw-semibold text-dark small d-flex align-items-center justify-content-between mb-0">
            <span>
              <i className="fa-solid fa-cloud-arrow-up text-primary me-2"></i>
              {t.uploadCompleted}
            </span>
            <span className="text-muted fw-normal" style={{ fontSize: '0.75rem' }}>
              {submissionType === 'file' ? t.required : t.optional}
            </span>
          </label>

          {!selectedFile ? (
            <div
              className={`${styles.dropzone} ${dragOver ? styles.dropzoneActive : ''}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="d-none"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.tar,.gz,.csv,.txt,.jpg,.jpeg,.png,.webp"
              />
              <i className="fa-solid fa-cloud-arrow-up fa-2x text-primary mb-2 d-block"></i>
              <strong className="text-dark d-block small mb-1">{t.clickToUpload}</strong>
              <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                {t.allowedFormatsText}
              </span>
            </div>
          ) : (
            <div className={styles.selectedFileInfo}>
              <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                <i className="fa-solid fa-file-circle-check fa-lg text-primary flex-shrink-0"></i>
                <div className="overflow-hidden">
                  <strong className="d-block text-truncate small">{selectedFile.name}</strong>
                  <span className="text-muted" style={{ fontSize: '0.72rem' }}>
                    {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger py-1 px-2 flex-shrink-0"
                style={{ fontSize: '0.75rem' }}
                onClick={() => {
                  setSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
              >
                <i className="fa-solid fa-trash me-1"></i> {t.removeFile}
              </button>
            </div>
          )}
        </div>
      )}

      {/* 2. Text Answer Area (if submissionType is 'text' or 'both') */}
      {(submissionType === 'text' || submissionType === 'both') && (
        <div className="d-flex flex-column gap-2">
          <label className="fw-semibold text-dark small d-flex align-items-center justify-content-between mb-0">
            <span>
              <i className="fa-solid fa-pen-to-square text-primary me-2"></i>
              {t.yourAnswer}
            </span>
            <span className="text-muted fw-normal" style={{ fontSize: '0.75rem' }}>
              {submissionType === 'text' ? t.required : t.optional}
            </span>
          </label>

          <textarea
            className="form-control"
            rows="5"
            placeholder={t.answerPlaceholder}
            value={textAnswer}
            onChange={(e) => setTextAnswer(e.target.value)}
            style={{ fontSize: '0.9rem', lineHeight: '1.55' }}
          ></textarea>
        </div>
      )}

      {/* Submit Action Button */}
      <div className="d-flex justify-content-end mt-2">
        <button
          type="submit"
          disabled={isSubmitting}
          className="btn btn-primary fw-semibold px-4 py-2 d-inline-flex align-items-center gap-2 shadow-sm"
        >
          {isSubmitting ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status"></span>
              <span>{t.submitting}</span>
            </>
          ) : (
            <>
              <i className="fa-solid fa-paper-plane"></i>
              <span>{t.submitAssessment}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
