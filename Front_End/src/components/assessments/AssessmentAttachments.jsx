import React from 'react';
import styles from './AssessmentComponents.module.css';
import { getAssessmentText } from '../../utils/assessmentTranslations';

export default function AssessmentAttachments({
  attachments = [],
  language = 'en',
}) {
  const t = getAssessmentText(language);

  if (!attachments || attachments.length === 0) {
    return (
      <div className="p-3 bg-light rounded-3 text-muted small text-center border">
        <i className="fa-regular fa-folder-open me-2"></i>
        {t.noAttachments}
      </div>
    );
  }

  const getFileIcon = (mimeType = '', fileName = '') => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (mimeType.includes('pdf') || ext === 'pdf') return 'fa-file-pdf text-danger';
    if (mimeType.includes('word') || ['doc', 'docx'].includes(ext)) return 'fa-file-word text-primary';
    if (mimeType.includes('excel') || mimeType.includes('sheet') || ['xls', 'xlsx', 'csv'].includes(ext)) return 'fa-file-excel text-success';
    if (mimeType.includes('zip') || ['zip', 'rar', 'tar', 'gz'].includes(ext)) return 'fa-file-zipper text-warning';
    if (mimeType.includes('image') || ['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return 'fa-file-image text-info';
    return 'fa-file-lines text-secondary';
  };

  const formatFileSize = (bytes) => {
    if (!bytes || isNaN(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="d-flex flex-column gap-2">
      {attachments.map((att, idx) => {
        const iconClass = getFileIcon(att.mimeType, att.fileName || att.originalName);
        const name = att.originalName || att.fileName;
        const size = formatFileSize(att.sizeBytes);
        const downloadUrl = att.downloadUrl || (att.fileUrl ? `${att.fileUrl}?download=true` : '#');
        const viewUrl = att.viewUrl || att.fileUrl || downloadUrl;

        return (
          <div key={att.fileName || idx} className={styles.attachmentCard}>
            <div className="d-flex align-items-center gap-3 overflow-hidden me-2">
              <i className={`fa-solid ${iconClass} fa-xl flex-shrink-0`}></i>
              <div className="overflow-hidden">
                <span className="fw-semibold text-dark d-block text-truncate small" title={name}>
                  {name}
                </span>
                {size && <span className="text-muted" style={{ fontSize: '0.72rem' }}>{size}</span>}
              </div>
            </div>

            <div className="d-flex align-items-center gap-2 flex-shrink-0">
              {viewUrl && (
                <a
                  href={viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-xs btn-outline-secondary d-inline-flex align-items-center gap-1"
                  style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                >
                  <i className="fa-solid fa-eye"></i>
                  <span>{t.viewFile}</span>
                </a>
              )}
              {downloadUrl && (
                <a
                  href={downloadUrl}
                  download={name}
                  className="btn btn-xs btn-outline-primary d-inline-flex align-items-center gap-1"
                  style={{ fontSize: '0.78rem', padding: '0.25rem 0.6rem' }}
                >
                  <i className="fa-solid fa-download"></i>
                  <span>{t.downloadFile}</span>
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
