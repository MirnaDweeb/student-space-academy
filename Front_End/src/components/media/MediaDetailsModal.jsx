import React, { useState } from 'react';
import { mediaService } from '../../services/studentPortalServices';

/**
 * MediaDetailsModal
 * Full institutional media detail view, lightbox, status breakdown,
 * moderation feedback inspection, and resubmission handler.
 */
export default function MediaDetailsModal({ isOpen, onClose, mediaItem, onUpdate, onRefreshData }) {
  const [isResubmitting, setIsResubmitting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCaption, setNewCaption] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newFile, setNewFile] = useState(null);
  const [resubmitNotes, setResubmitNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !mediaItem) return null;

  const isRejected = mediaItem.status === 'Rejected';
  const isChangesRequested = mediaItem.status === 'Changes_Requested';
  const isDraft = mediaItem.status === 'Draft';
  const isPublished = mediaItem.status === 'Published';
  const isApproved = mediaItem.status === 'Approved' || mediaItem.status === 'Selected_For_Publication';

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Published':
        return <span className="badge bg-success"><i className="fa-solid fa-globe me-1"></i> Published</span>;
      case 'Selected_For_Publication':
        return <span className="badge bg-info text-dark"><i className="fa-solid fa-star me-1"></i> Selected for Publication</span>;
      case 'Approved':
        return <span className="badge bg-success-subtle text-success border border-success-subtle"><i className="fa-solid fa-check me-1"></i> Approved</span>;
      case 'Changes_Requested':
        return <span className="badge bg-warning text-dark"><i className="fa-solid fa-triangle-exclamation me-1"></i> Changes Requested</span>;
      case 'Rejected':
        return <span className="badge bg-danger"><i className="fa-solid fa-xmark me-1"></i> Rejected</span>;
      case 'Pending_Review':
      case 'Under_Review':
        return <span className="badge bg-secondary"><i className="fa-solid fa-clock me-1"></i> Pending Review</span>;
      case 'Draft':
      default:
        return <span className="badge bg-light text-dark border"><i className="fa-solid fa-pencil me-1"></i> Draft</span>;
    }
  };

  const handleStartResubmit = () => {
    setNewTitle(mediaItem.title || '');
    setNewCaption(mediaItem.caption || '');
    setNewDescription(mediaItem.description || '');
    setNewFile(null);
    setResubmitNotes('');
    setError('');
    setIsResubmitting(true);
  };

  const handleExecuteResubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      if (newFile) formData.append('file', newFile);
      formData.append('title', newTitle.trim());
      formData.append('caption', newCaption.trim());
      formData.append('description', newDescription.trim());
      formData.append('resubmitNotes', resubmitNotes.trim());

      await mediaService.resubmitMedia(mediaItem._id, formData);
      setIsResubmitting(false);
      if (onUpdate) onUpdate();
      if (onRefreshData) onRefreshData();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to resubmit media.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDraft = async () => {
    setLoading(true);
    setError('');
    try {
      await mediaService.submitDraft(mediaItem._id);
      if (onUpdate) onUpdate();
      if (onRefreshData) onRefreshData();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit draft.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this media item?')) return;
    setLoading(true);
    setError('');
    try {
      await mediaService.deleteMedia(mediaItem._id);
      if (onUpdate) onUpdate();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to delete media.');
    } finally {
      setLoading(false);
    }
  };

  // Resolve media URL (handles relative static backend paths)
  const fullImageUrl = mediaItem.fileUrl?.startsWith('http')
    ? mediaItem.fileUrl
    : `http://localhost:5000${mediaItem.fileUrl}`;

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(5, 15, 30, 0.85)', backdropFilter: 'blur(5px)', zIndex: 1060 }}
    >
      <div className="modal-dialog modal-dialog-centered modal-xl">
        <div className="modal-content shadow-lg border-0" style={{ borderRadius: 'var(--radius-lg, 12px)' }}>
          {/* Header */}
          <div className="modal-header bg-dark text-white border-bottom border-secondary pb-3">
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-primary-egsa p-2">
                <i className="fa-solid fa-photo-film fs-6"></i>
              </span>
              <div>
                <h5 className="modal-title fw-bold mb-0">{mediaItem.title}</h5>
                <small className="text-muted">
                  {mediaItem.course?.title || 'EGSA Course'} · Session #{mediaItem.session?.sessionNumber || '1'}
                </small>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              aria-label="Close"
              onClick={onClose}
              disabled={loading}
            ></button>
          </div>

          {/* Body */}
          <div className="modal-body p-4">
            {error && (
              <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                <i className="fa-solid fa-triangle-exclamation flex-shrink-0"></i>
                <span>{error}</span>
              </div>
            )}

            {isResubmitting ? (
              /* Resubmit Form */
              <form onSubmit={handleExecuteResubmit}>
                <div className="p-3 bg-light rounded border mb-4">
                  <h6 className="fw-bold text-dark mb-1">
                    <i className="fa-solid fa-rotate-right text-primary-egsa me-2"></i>
                    Update & Resubmit Media for Review
                  </h6>
                  <p className="text-muted small mb-0">
                    Address moderator remarks and update your submission. Once resubmitted, the item will return to the review queue.
                  </p>
                </div>

                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-dark">Replace Image (Optional):</label>
                    <input
                      type="file"
                      className="form-control form-control-sm mb-2"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setNewFile(e.target.files?.[0])}
                    />
                    <small className="text-muted d-block">Leave blank to retain current image.</small>
                  </div>

                  <div className="col-md-6">
                    <label className="form-label small fw-semibold text-dark">Updated Title:</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold text-dark">Updated Public Caption:</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      value={newCaption}
                      onChange={(e) => setNewCaption(e.target.value)}
                    />
                  </div>

                  <div className="col-12">
                    <label className="form-label small fw-semibold text-dark">Resubmission Remarks for Reviewer:</label>
                    <textarea
                      className="form-control form-control-sm"
                      rows="2"
                      placeholder="Explain what changes were made..."
                      value={resubmitNotes}
                      onChange={(e) => setResubmitNotes(e.target.value)}
                    ></textarea>
                  </div>
                </div>

                <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => setIsResubmitting(false)}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm px-3 fw-semibold" disabled={loading}>
                    {loading ? 'Resubmitting…' : 'Submit Updates for Review'}
                  </button>
                </div>
              </form>
            ) : (
              /* Normal Inspection View */
              <div className="row g-4">
                {/* Left 7 Columns: Media Preview */}
                <div className="col-lg-7">
                  <div className="bg-black rounded overflow-hidden d-flex align-items-center justify-content-center border" style={{ minHeight: '360px', maxHeight: '520px' }}>
                    <img
                      src={fullImageUrl}
                      alt={mediaItem.title}
                      className="img-fluid"
                      style={{ maxHeight: '500px', objectFit: 'contain' }}
                    />
                  </div>
                  <div className="d-flex justify-content-between align-items-center mt-2 px-1 text-muted small">
                    <span>
                      <i className="fa-solid fa-file-image me-1"></i> {mediaItem.originalName || mediaItem.filename}
                    </span>
                    <span>
                      {mediaItem.fileSize ? `${(mediaItem.fileSize / 1024).toFixed(1)} KB` : ''} · {mediaItem.mimeType}
                    </span>
                  </div>
                </div>

                {/* Right 5 Columns: Metadata, Status & Moderation Audit */}
                <div className="col-lg-5 d-flex flex-column justify-content-between">
                  <div>
                    {/* Status Badge */}
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <div>{getStatusBadge(mediaItem.status)}</div>
                      <small className="text-muted">
                        Uploaded: {new Date(mediaItem.createdAt).toLocaleDateString()}
                      </small>
                    </div>

                    {/* Published Notice */}
                    {isPublished && (
                      <div className="alert alert-success p-3 small mb-3 border-success">
                        <strong className="d-block mb-1">
                          <i className="fa-solid fa-globe me-1"></i> Featured on Official Website
                        </strong>
                        This photo has been approved and published to the Egyptian Space Academy media portal.
                      </div>
                    )}

                    {/* Changes Requested / Rejection Notice */}
                    {isChangesRequested && (
                      <div className="alert alert-warning p-3 small mb-3 border-warning">
                        <strong className="d-block text-warning-emphasis mb-1">
                          <i className="fa-solid fa-triangle-exclamation me-1"></i> Moderator Requested Changes
                        </strong>
                        <p className="mb-2 text-dark">{mediaItem.reviewComment || 'Please revise your media submission.'}</p>
                        <button className="btn btn-warning btn-sm fw-semibold text-dark" onClick={handleStartResubmit}>
                          <i className="fa-solid fa-pen-to-square me-1"></i> Resubmit Updated Photo
                        </button>
                      </div>
                    )}

                    {isRejected && (
                      <div className="alert alert-danger p-3 small mb-3 border-danger">
                        <strong className="d-block text-danger mb-1">
                          <i className="fa-solid fa-circle-xmark me-1"></i> Submission Not Approved
                        </strong>
                        <p className="mb-1 text-dark"><strong>Reason:</strong> {mediaItem.reviewReason || 'Quality standards not satisfied'}</p>
                        {mediaItem.reviewComment && <p className="mb-2 text-muted">{mediaItem.reviewComment}</p>}
                        <button className="btn btn-outline-danger btn-sm" onClick={handleStartResubmit}>
                          <i className="fa-solid fa-rotate-right me-1"></i> Resubmit Replacement
                        </button>
                      </div>
                    )}

                    {/* Metadata Card */}
                    <div className="p-3 bg-light rounded border mb-3">
                      <h6 className="fw-bold text-dark mb-1">{mediaItem.title}</h6>
                      <p className="text-muted small mb-2">{mediaItem.caption || 'No caption provided.'}</p>
                      {mediaItem.description && (
                        <p className="text-secondary small mb-2" style={{ whiteSpace: 'pre-line' }}>
                          {mediaItem.description}
                        </p>
                      )}

                      <hr className="my-2" />

                      <div className="small text-muted">
                        <div>
                          <strong>Course: </strong> {mediaItem.course?.title}
                        </div>
                        <div>
                          <strong>Session: </strong> #{mediaItem.session?.sessionNumber}: {mediaItem.session?.title}
                        </div>
                        {mediaItem.session?.date && (
                          <div>
                            <strong>Session Date: </strong> {new Date(mediaItem.session.date).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Moderation History */}
                    {mediaItem.reviewHistory && mediaItem.reviewHistory.length > 0 && (
                      <div className="mb-3">
                        <span className="small fw-bold text-dark d-block mb-2">Review Audit Trail:</span>
                        <div className="d-flex flex-column gap-2 small">
                          {mediaItem.reviewHistory.map((h, idx) => (
                            <div key={idx} className="p-2 border rounded bg-white">
                              <div className="d-flex justify-content-between">
                                <span className="fw-semibold text-primary-egsa">{h.action}</span>
                                <span className="text-muted" style={{ fontSize: '11px' }}>
                                  {new Date(h.changedAt).toLocaleDateString()}
                                </span>
                              </div>
                              {h.comment && <div className="text-muted mt-1" style={{ fontSize: '11px' }}>{h.comment}</div>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Draft Controls */}
                  {isDraft && (
                    <div className="d-flex gap-2 pt-3 border-top">
                      <button className="btn btn-primary btn-sm flex-grow-1 fw-semibold" onClick={handleSubmitDraft} disabled={loading}>
                        <i className="fa-solid fa-paper-plane me-1"></i> Submit for Review
                      </button>
                      <button className="btn btn-outline-danger btn-sm" onClick={handleDelete} disabled={loading}>
                        <i className="fa-solid fa-trash me-1"></i> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="modal-footer bg-light border-top py-2 px-3 justify-content-between">
            <small className="text-muted">
              <i className="fa-solid fa-shield-halved text-success me-1"></i> Institutional Media Verification
            </small>
            <button type="button" className="btn btn-sm btn-outline-secondary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
