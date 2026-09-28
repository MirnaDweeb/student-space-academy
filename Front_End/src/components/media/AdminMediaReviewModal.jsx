import React, { useState, useEffect } from 'react';
import { mediaService } from '../../services/studentPortalServices';

const STATUS_CONFIG = {
  Draft: { label: 'Draft', bg: 'bg-secondary', icon: 'fa-pencil' },
  Pending_Review: { label: 'Pending Review', bg: 'bg-warning text-dark', icon: 'fa-clock' },
  Under_Review: { label: 'Under Review', bg: 'bg-info text-dark', icon: 'fa-magnifying-glass' },
  Approved: { label: 'Approved', bg: 'bg-success', icon: 'fa-circle-check' },
  Changes_Requested: { label: 'Changes Requested', bg: 'bg-amber text-dark', icon: 'fa-triangle-exclamation' },
  Rejected: { label: 'Rejected', bg: 'bg-danger', icon: 'fa-circle-xmark' },
  Selected_For_Publication: { label: 'Selected for Publication', bg: 'bg-primary', icon: 'fa-bookmark' },
  Published: { label: 'Published to Web', bg: 'bg-success text-white', icon: 'fa-globe' },
  Unpublished: { label: 'Unpublished', bg: 'bg-dark text-white', icon: 'fa-eye-slash' },
};

const REJECTION_REASONS = [
  { value: 'poor_quality', label: 'Poor Image Quality / Blur' },
  { value: 'duplicate', label: 'Duplicate Submission' },
  { value: 'not_related_to_training', label: 'Not Related to Academy Training' },
  { value: 'inappropriate_content', label: 'Content Does Not Meet Agency Standards' },
  { value: 'incorrect_session', label: 'Session / Course Mismatch' },
  { value: 'privacy_concern', label: 'Privacy / Unconsented Individuals in Photo' },
  { value: 'technical_issue', label: 'Technical Issue / Corrupt File' },
  { value: 'other', label: 'Other Reason (See Comments)' },
];

export default function AdminMediaReviewModal({ isOpen, onClose, onRefreshData }) {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Action Form States
  const [activeActionModal, setActiveActionModal] = useState(null); // 'reject' | 'changes' | 'select' | 'publish' | 'unpublish'
  const [actionForm, setActionForm] = useState({
    reason: 'poor_quality',
    comment: '',
    placement: 'general_gallery',
    publicCaption: '',
  });

  const loadMedia = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await mediaService.getAdminMedia({
        status: filterStatus === 'ALL' ? undefined : filterStatus,
      });
      const data = res.items || res.data?.items || (Array.isArray(res) ? res : []);
      setItems(data);
      if (data.length > 0) {
        // Keep current selected if still present, or pick first
        if (!selectedId || !data.some((i) => i._id === selectedId)) {
          setSelectedId(data[0]._id);
        }
      } else {
        setSelectedId(null);
      }
    } catch (err) {
      setError(err.message || 'Failed to load submissions for review.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadMedia();
    }
  }, [isOpen, filterStatus]);

  if (!isOpen) return null;

  const currentItem = items.find((i) => i._id === selectedId) || null;

  const handleApprove = async () => {
    if (!currentItem) return;
    setActionLoading(true);
    setError('');
    try {
      await mediaService.approveMedia(currentItem._id, { comment: 'Approved by Agency Media Reviewer.' });
      setSuccessMsg(`Media "${currentItem.title}" approved successfully.`);
      await loadMedia();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setError(err.message || 'Failed to approve media.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleExecuteAction = async () => {
    if (!currentItem) return;
    setActionLoading(true);
    setError('');
    try {
      if (activeActionModal === 'reject') {
        await mediaService.rejectMedia(currentItem._id, {
          reason: actionForm.reason,
          comment: actionForm.comment,
        });
        setSuccessMsg(`Media "${currentItem.title}" rejected with feedback sent to student.`);
      } else if (activeActionModal === 'changes') {
        if (!actionForm.comment.trim()) {
          setError('Please provide instructions on what changes are required.');
          setActionLoading(false);
          return;
        }
        await mediaService.requestChanges(currentItem._id, {
          comment: actionForm.comment,
        });
        setSuccessMsg(`Changes requested for "${currentItem.title}". Student notified.`);
      } else if (activeActionModal === 'select') {
        await mediaService.selectForPublication(currentItem._id, {
          placement: actionForm.placement,
        });
        setSuccessMsg(`Media "${currentItem.title}" selected for publication.`);
      } else if (activeActionModal === 'publish') {
        await mediaService.publishMedia(currentItem._id, {
          publicCaption: actionForm.publicCaption || currentItem.caption,
          placement: actionForm.placement || currentItem.publicationPlacement,
        });
        setSuccessMsg(`Media "${currentItem.title}" published to EGSA Public Gallery!`);
      } else if (activeActionModal === 'unpublish') {
        await mediaService.unpublishMedia(currentItem._id, {
          reason: actionForm.comment || 'Editorial adjustment',
        });
        setSuccessMsg(`Media "${currentItem.title}" removed from public gallery.`);
      }

      setActiveActionModal(null);
      setActionForm({ reason: 'poor_quality', comment: '', placement: 'general_gallery', publicCaption: '' });
      await loadMedia();
      if (onRefreshData) onRefreshData();
    } catch (err) {
      setError(err.message || 'Failed to complete moderation action.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(5, 12, 28, 0.85)', backdropFilter: 'blur(8px)', zIndex: 1060 }}
      tabIndex="-1"
    >
      <div className="modal-dialog modal-fullscreen-xl-down modal-xl modal-dialog-centered" style={{ maxWidth: '96vw', height: '94vh' }}>
        <div className="modal-content border-0 shadow-lg text-dark d-flex flex-column h-100" style={{ borderRadius: '16px', overflow: 'hidden' }}>
          
          {/* Header */}
          <div className="modal-header bg-dark text-white px-4 py-3 d-flex align-items-center justify-content-between border-0">
            <div className="d-flex align-items-center gap-3">
              <div
                className="d-flex align-items-center justify-content-center rounded-3"
                style={{ width: '42px', height: '42px', backgroundColor: 'rgba(212, 175, 55, 0.15)', color: '#d4af37', border: '1px solid rgba(212, 175, 55, 0.3)' }}
              >
                <i className="fa-solid fa-shield-halved fa-lg"></i>
              </div>
              <div>
                <h5 className="modal-title fw-bold text-white mb-0 d-flex align-items-center gap-2">
                  Institutional Media Moderation & Editorial Workspace
                  <span className="badge bg-primary text-uppercase fs-8" style={{ letterSpacing: '0.5px' }}>Admin Bureau</span>
                </h5>
                <p className="text-secondary mb-0 small" style={{ fontSize: '0.78rem' }}>
                  Review student field training media, approve compliance, curate editorial highlights, and manage public publication.
                </p>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-sm btn-outline-light rounded-circle d-flex align-items-center justify-content-center"
              style={{ width: '32px', height: '32px' }}
              onClick={onClose}
              disabled={actionLoading}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          {/* Feedback Alerts */}
          {error && (
            <div className="alert alert-danger mx-4 mt-3 mb-0 py-2 small d-flex align-items-center gap-2">
              <i className="fa-solid fa-circle-exclamation"></i>
              <span>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="alert alert-success mx-4 mt-3 mb-0 py-2 small d-flex align-items-center gap-2">
              <i className="fa-solid fa-circle-check"></i>
              <span>{successMsg}</span>
            </div>
          )}

          {/* Main 3-Column Workspace */}
          <div className="modal-body p-0 d-flex flex-column flex-lg-row flex-grow-1 overflow-hidden">
            
            {/* COLUMN 1: Submissions Queue & Filter */}
            <div
              className="border-end d-flex flex-column bg-light"
              style={{ width: '100%', maxWidth: '340px', minWidth: '280px', height: '100%' }}
            >
              {/* Filter Tabs */}
              <div className="p-3 border-bottom bg-white">
                <label className="form-label text-muted small fw-bold text-uppercase mb-2" style={{ fontSize: '0.7rem' }}>
                  Queue Filter
                </label>
                <select
                  className="form-select form-select-sm"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="ALL">All Statuses ({items.length})</option>
                  <option value="Pending_Review">Pending Review</option>
                  <option value="Changes_Requested">Changes Requested</option>
                  <option value="Approved">Approved (Ready to Curate)</option>
                  <option value="Selected_For_Publication">Selected for Publication</option>
                  <option value="Published">Published Online</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>

              {/* Items List */}
              <div className="flex-grow-1 overflow-auto p-2 d-flex flex-column gap-2">
                {loading ? (
                  <div className="text-center py-5 text-muted small">
                    <i className="fa-solid fa-spinner fa-spin fa-2x mb-2"></i>
                    <div>Loading submissions...</div>
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-5 text-muted small px-3">
                    <i className="fa-solid fa-inbox fa-2x mb-2 opacity-50"></i>
                    <div>No submissions in this filter.</div>
                  </div>
                ) : (
                  items.map((item) => {
                    const isSelected = item._id === selectedId;
                    const st = STATUS_CONFIG[item.status] || { label: item.status, bg: 'bg-secondary', icon: 'fa-circle' };
                    return (
                      <div
                        key={item._id}
                        onClick={() => setSelectedId(item._id)}
                        className={`p-2 rounded-3 border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-white shadow-sm border-primary'
                            : 'bg-white border-light-subtle hover-bg-light'
                        }`}
                        style={{ cursor: 'pointer', transition: 'all 0.15s ease-in-out' }}
                      >
                        <div className="d-flex gap-2">
                          <img
                            src={item.thumbnailUrl || item.fileUrl}
                            alt={item.title}
                            className="rounded object-fit-cover"
                            style={{ width: '56px', height: '56px', flexShrink: 0, backgroundColor: '#0d1b2a' }}
                          />
                          <div className="flex-grow-1 overflow-hidden">
                            <div className="d-flex align-items-center justify-content-between mb-1">
                              <span className={`badge ${st.bg} fs-9 py-1 px-2`}>
                                <i className={`fa-solid ${st.icon} me-1`}></i>
                                {st.label}
                              </span>
                              <span className="text-muted" style={{ fontSize: '0.68rem' }}>
                                {new Date(item.submittedAt || item.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <div className="fw-bold text-dark text-truncate small mb-1">{item.title}</div>
                            <div className="text-muted text-truncate" style={{ fontSize: '0.72rem' }}>
                              <i className="fa-solid fa-user-astronaut me-1"></i>
                              {item.student?.userId?.firstName ? `${item.student.userId.firstName} ${item.student.userId.lastName}` : 'Cadet'}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* COLUMN 2: Large Visual Preview & Technical Spec */}
            <div
              className="flex-grow-1 d-flex flex-column border-end bg-dark p-3 text-white overflow-auto align-items-center justify-content-between"
              style={{ minWidth: '360px', backgroundColor: '#090e17' }}
            >
              {currentItem ? (
                <>
                  <div className="w-100 d-flex justify-content-between align-items-center mb-2 px-2">
                    <span className="text-secondary small">
                      <i className="fa-solid fa-image me-1"></i> Original Resolution Preview
                    </span>
                    <a
                      href={currentItem.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-xs btn-outline-light text-decoration-none"
                      style={{ fontSize: '0.75rem' }}
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square me-1"></i> Full Size
                    </a>
                  </div>

                  {/* Main Preview Container */}
                  <div
                    className="d-flex align-items-center justify-content-center flex-grow-1 w-100 my-2"
                    style={{ minHeight: '320px', maxHeight: '52vh' }}
                  >
                    <img
                      src={currentItem.fileUrl}
                      alt={currentItem.title}
                      className="rounded shadow-lg object-fit-contain"
                      style={{ maxWidth: '100%', maxHeight: '52vh', border: '1px solid rgba(255,255,255,0.1)' }}
                    />
                  </div>

                  {/* Technical Spec Strip */}
                  <div
                    className="w-100 p-2 rounded-3 mt-2 d-flex flex-wrap align-items-center justify-content-around text-center gap-2 small"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)', fontSize: '0.75rem' }}
                  >
                    <div>
                      <span className="text-secondary d-block">Format</span>
                      <strong className="text-light">{currentItem.mimeType || 'image/jpeg'}</strong>
                    </div>
                    <div className="border-start ps-3 border-secondary">
                      <span className="text-secondary d-block">File Size</span>
                      <strong className="text-light">
                        {currentItem.fileSize ? `${(currentItem.fileSize / (1024 * 1024)).toFixed(2)} MB` : 'N/A'}
                      </strong>
                    </div>
                    <div className="border-start ps-3 border-secondary">
                      <span className="text-secondary d-block">Resolution</span>
                      <strong className="text-light">
                        {currentItem.dimensions?.width ? `${currentItem.dimensions.width} × ${currentItem.dimensions.height} px` : 'High-Res'}
                      </strong>
                    </div>
                    <div className="border-start ps-3 border-secondary">
                      <span className="text-secondary d-block">Publication Status</span>
                      <strong className={currentItem.publicVisibility ? 'text-success' : 'text-warning'}>
                        {currentItem.publicVisibility ? 'Visible on Website' : 'Private (Internal)'}
                      </strong>
                    </div>
                  </div>
                </>
              ) : (
                <div className="d-flex flex-column align-items-center justify-content-center h-100 text-secondary">
                  <i className="fa-solid fa-photo-film fa-3x mb-3 opacity-25"></i>
                  <p>Select a submission from the left queue to inspect.</p>
                </div>
              )}
            </div>

            {/* COLUMN 3: Metadata & Moderation Control Panel */}
            <div
              className="d-flex flex-column bg-white overflow-auto p-4"
              style={{ width: '100%', maxWidth: '420px', minWidth: '320px', height: '100%' }}
            >
              {currentItem ? (
                <div className="d-flex flex-column gap-3">
                  
                  {/* Status & Placement Header */}
                  <div>
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <span className="text-muted small fw-bold text-uppercase" style={{ fontSize: '0.7rem' }}>
                        Lifecycle State
                      </span>
                      {(() => {
                        const st = STATUS_CONFIG[currentItem.status] || { label: currentItem.status, bg: 'bg-secondary', icon: 'fa-circle' };
                        return (
                          <span className={`badge ${st.bg} px-3 py-2 fs-7`}>
                            <i className={`fa-solid ${st.icon} me-1`}></i>
                            {st.label}
                          </span>
                        );
                      })()}
                    </div>

                    <h5 className="fw-bold text-dark mb-1">{currentItem.title}</h5>
                    {currentItem.caption && (
                      <p className="text-secondary small fst-italic mb-2 border-start border-2 ps-2 border-primary">
                        "{currentItem.caption}"
                      </p>
                    )}
                    {currentItem.description && (
                      <p className="text-muted small mb-0">{currentItem.description}</p>
                    )}
                  </div>

                  <hr className="my-1" />

                  {/* Cadet & Context Info */}
                  <div className="bg-light p-3 rounded-3 border d-flex flex-column gap-2 small">
                    <div>
                      <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>STUDENT CADET</span>
                      <strong className="text-dark">
                        {currentItem.student?.userId?.firstName ? `${currentItem.student.userId.firstName} ${currentItem.student.userId.lastName}` : 'Cadet'}
                      </strong>{' '}
                      <span className="text-muted">({currentItem.student?.userId?.email || 'N/A'})</span>
                    </div>

                    <div>
                      <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>ACADEMIC PROGRAM</span>
                      <strong className="text-dark">{currentItem.course?.title || 'Course'}</strong>
                      {currentItem.cohort?.cohortCode && (
                        <span className="badge bg-secondary ms-2">{currentItem.cohort.cohortCode}</span>
                      )}
                    </div>

                    <div>
                      <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>TRAINING LAB SESSION</span>
                      <strong className="text-primary">{currentItem.session?.title || 'Session'}</strong>
                      {currentItem.session?.sessionDate && (
                        <div className="text-muted" style={{ fontSize: '0.72rem' }}>
                          <i className="fa-solid fa-calendar me-1"></i>
                          {new Date(currentItem.session.sessionDate).toLocaleDateString('en-US', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      )}
                    </div>

                    <div className="pt-1 border-top">
                      <span className="text-muted d-block" style={{ fontSize: '0.7rem' }}>STUDENT CONSENT</span>
                      <span className="text-success small fw-semibold">
                        <i className="fa-solid fa-circle-check me-1"></i> Authorized for agency publication review
                      </span>
                    </div>
                  </div>

                  {/* MODERATION ACTIONS */}
                  <div className="border rounded-3 p-3 bg-white shadow-sm">
                    <label className="form-label text-muted small fw-bold text-uppercase mb-2" style={{ fontSize: '0.7rem' }}>
                      Moderation Actions
                    </label>

                    {/* Pending Review / Under Review / Changes Requested */}
                    {['Pending_Review', 'Under_Review', 'Changes_Requested', 'Draft'].includes(currentItem.status) && (
                      <div className="d-flex flex-column gap-2">
                        <button
                          type="button"
                          className="btn btn-success btn-sm w-100 fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
                          onClick={handleApprove}
                          disabled={actionLoading}
                        >
                          <i className="fa-solid fa-circle-check"></i>
                          Approve Submission
                        </button>

                        <div className="d-flex gap-2">
                          <button
                            type="button"
                            className="btn btn-outline-warning text-dark btn-sm flex-grow-1 fw-semibold py-2 d-flex align-items-center justify-content-center gap-1"
                            onClick={() => {
                              setActiveActionModal('changes');
                              setActionForm((prev) => ({ ...prev, comment: '' }));
                            }}
                            disabled={actionLoading}
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                            Request Changes
                          </button>

                          <button
                            type="button"
                            className="btn btn-outline-danger btn-sm flex-grow-1 fw-semibold py-2 d-flex align-items-center justify-content-center gap-1"
                            onClick={() => {
                              setActiveActionModal('reject');
                              setActionForm((prev) => ({ ...prev, reason: 'poor_quality', comment: '' }));
                            }}
                            disabled={actionLoading}
                          >
                            <i className="fa-solid fa-ban"></i>
                            Reject
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Approved: Option to Select for Publication or Reject */}
                    {currentItem.status === 'Approved' && (
                      <div className="d-flex flex-column gap-2">
                        <div className="alert alert-success py-2 mb-2 small d-flex align-items-center gap-2">
                          <i className="fa-solid fa-check"></i>
                          <span>Approved by Academy. Ready for editorial curation.</span>
                        </div>

                        <button
                          type="button"
                          className="btn btn-primary btn-sm w-100 fw-bold py-2 d-flex align-items-center justify-content-center gap-2"
                          onClick={() => {
                            setActiveActionModal('select');
                            setActionForm((prev) => ({ ...prev, placement: currentItem.publicationPlacement || 'general_gallery' }));
                          }}
                          disabled={actionLoading}
                        >
                          <i className="fa-solid fa-bookmark"></i>
                          Select for Official Publication
                        </button>

                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm w-100 py-1"
                          onClick={() => {
                            setActiveActionModal('reject');
                            setActionForm((prev) => ({ ...prev, reason: 'other', comment: '' }));
                          }}
                          disabled={actionLoading}
                        >
                          Revoke Approval (Reject)
                        </button>
                      </div>
                    )}

                    {/* Selected For Publication: Publish! */}
                    {currentItem.status === 'Selected_For_Publication' && (
                      <div className="d-flex flex-column gap-2">
                        <div className="alert alert-info py-2 mb-2 small d-flex align-items-center gap-2">
                          <i className="fa-solid fa-star"></i>
                          <span>Curated for placement: <strong>{currentItem.publicationPlacement?.replace('_', ' ').toUpperCase()}</strong></span>
                        </div>

                        <button
                          type="button"
                          className="btn btn-success btn-sm w-100 fw-bold py-2 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                          onClick={() => {
                            setActiveActionModal('publish');
                            setActionForm((prev) => ({
                              ...prev,
                              publicCaption: currentItem.caption || '',
                              placement: currentItem.publicationPlacement || 'general_gallery',
                            }));
                          }}
                          disabled={actionLoading}
                        >
                          <i className="fa-solid fa-globe"></i>
                          Publish to Public Website
                        </button>
                      </div>
                    )}

                    {/* Published: Unpublish option */}
                    {currentItem.status === 'Published' && (
                      <div className="d-flex flex-column gap-2">
                        <div className="alert alert-success py-2 mb-2 small d-flex align-items-center gap-2">
                          <i className="fa-solid fa-circle-check"></i>
                          <span>Publicly live on official website gallery!</span>
                        </div>

                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm w-100 py-2 d-flex align-items-center justify-content-center gap-2"
                          onClick={() => {
                            setActiveActionModal('unpublish');
                            setActionForm((prev) => ({ ...prev, comment: '' }));
                          }}
                          disabled={actionLoading}
                        >
                          <i className="fa-solid fa-eye-slash"></i>
                          Unpublish from Website
                        </button>
                      </div>
                    )}

                    {/* Rejected */}
                    {currentItem.status === 'Rejected' && (
                      <div className="alert alert-danger py-2 mb-0 small">
                        <strong>Rejected:</strong> {currentItem.reviewReason || 'Did not meet criteria.'}
                        {currentItem.reviewComment && <div className="mt-1">{currentItem.reviewComment}</div>}
                      </div>
                    )}
                  </div>

                  {/* AUDIT TRAIL / REVIEW HISTORY */}
                  {currentItem.reviewHistory && currentItem.reviewHistory.length > 0 && (
                    <div className="border rounded-3 p-3 bg-light">
                      <label className="form-label text-muted small fw-bold text-uppercase mb-2" style={{ fontSize: '0.7rem' }}>
                        Institutional Audit Trail ({currentItem.reviewHistory.length})
                      </label>
                      <div className="d-flex flex-column gap-2" style={{ maxHeight: '180px', overflowY: 'auto' }}>
                        {currentItem.reviewHistory.map((h, hIdx) => (
                          <div key={hIdx} className="bg-white p-2 rounded border small" style={{ fontSize: '0.73rem' }}>
                            <div className="d-flex justify-content-between text-muted mb-1">
                              <strong>{h.action}</strong>
                              <span>{new Date(h.changedAt).toLocaleString()}</span>
                            </div>
                            <div className="text-secondary">
                              <span className="badge bg-secondary me-1">{h.previousStatus}</span>
                              <i className="fa-solid fa-arrow-right mx-1"></i>
                              <span className="badge bg-dark">{h.newStatus}</span>
                            </div>
                            {h.comment && <div className="text-dark mt-1 fst-italic">"{h.comment}"</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              ) : null}
            </div>

          </div>

          {/* Footer */}
          <div className="modal-footer bg-light px-4 py-2 border-top d-flex justify-content-between">
            <span className="text-muted small">
              Official Media Moderation Portal &bull; Egyptian Space Agency (EGSA)
            </span>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close Workspace
            </button>
          </div>

        </div>
      </div>

      {/* POPUP SUB-MODAL FOR MODERATION ACTIONS (REJECT / CHANGES / SELECT / PUBLISH / UNPUBLISH) */}
      {activeActionModal && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1070 }}
          tabIndex="-1"
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow-lg border-0 rounded-4 overflow-hidden">
              <div className="modal-header bg-dark text-white">
                <h6 className="modal-title fw-bold">
                  {activeActionModal === 'reject' && 'Reject Submission'}
                  {activeActionModal === 'changes' && 'Request Changes from Cadet'}
                  {activeActionModal === 'select' && 'Select for Official Publication'}
                  {activeActionModal === 'publish' && 'Confirm Public Website Publication'}
                  {activeActionModal === 'unpublish' && 'Unpublish from Public Gallery'}
                </h6>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light rounded-circle"
                  onClick={() => setActiveActionModal(null)}
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
              </div>

              <div className="modal-body p-4">
                {activeActionModal === 'reject' && (
                  <div>
                    <label className="form-label small fw-bold">Reason for Rejection *</label>
                    <select
                      className="form-select mb-3"
                      value={actionForm.reason}
                      onChange={(e) => setActionForm({ ...actionForm, reason: e.target.value })}
                    >
                      {REJECTION_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                      ))}
                    </select>

                    <label className="form-label small fw-bold">Feedback / Note to Student (Optional)</label>
                    <textarea
                      className="form-control"
                      rows="3"
                      placeholder="Explain to the student why this media could not be approved..."
                      value={actionForm.comment}
                      onChange={(e) => setActionForm({ ...actionForm, comment: e.target.value })}
                    ></textarea>
                  </div>
                )}

                {activeActionModal === 'changes' && (
                  <div>
                    <label className="form-label small fw-bold">Required Modifications *</label>
                    <textarea
                      className="form-control mb-2"
                      rows="3"
                      placeholder="e.g. Please crop the extraneous lab equipment or re-upload a sharper high-resolution copy..."
                      value={actionForm.comment}
                      onChange={(e) => setActionForm({ ...actionForm, comment: e.target.value })}
                      required
                    ></textarea>
                    <p className="text-muted small mb-0">
                      The cadet will see this guidance and will be able to resubmit a modified file.
                    </p>
                  </div>
                )}

                {activeActionModal === 'select' && (
                  <div>
                    <label className="form-label small fw-bold">Website Placement Curation</label>
                    <select
                      className="form-select mb-3"
                      value={actionForm.placement}
                      onChange={(e) => setActionForm({ ...actionForm, placement: e.target.value })}
                    >
                      <option value="general_gallery">EGSA Academy Public Gallery</option>
                      <option value="homepage">Agency Portal Homepage Showcase</option>
                      <option value="course_gallery">Course Track Showcase Gallery</option>
                      <option value="training_highlights">Training & Laboratory Highlights</option>
                    </select>
                    <p className="text-muted small mb-0">
                      Selecting this marks the approved media as curated for editorial publication.
                    </p>
                  </div>
                )}

                {activeActionModal === 'publish' && (
                  <div>
                    <div className="alert alert-info py-2 small mb-3">
                      <i className="fa-solid fa-circle-info me-2"></i>
                      This action will make the media publicly viewable on the official EGSA Academy website gallery.
                    </div>

                    <label className="form-label small fw-bold">Public Caption</label>
                    <input
                      type="text"
                      className="form-control mb-3"
                      value={actionForm.publicCaption}
                      onChange={(e) => setActionForm({ ...actionForm, publicCaption: e.target.value })}
                      placeholder="Caption displayed to the public..."
                    />

                    <label className="form-label small fw-bold">Placement Destination</label>
                    <select
                      className="form-select"
                      value={actionForm.placement}
                      onChange={(e) => setActionForm({ ...actionForm, placement: e.target.value })}
                    >
                      <option value="general_gallery">EGSA Academy Public Gallery</option>
                      <option value="homepage">Agency Portal Homepage Showcase</option>
                      <option value="course_gallery">Course Track Showcase Gallery</option>
                      <option value="training_highlights">Training & Laboratory Highlights</option>
                    </select>
                  </div>
                )}

                {activeActionModal === 'unpublish' && (
                  <div>
                    <label className="form-label small fw-bold">Reason for Unpublishing (Optional)</label>
                    <textarea
                      className="form-control mb-2"
                      rows="2"
                      placeholder="e.g. Archiving outdated batch photos..."
                      value={actionForm.comment}
                      onChange={(e) => setActionForm({ ...actionForm, comment: e.target.value })}
                    ></textarea>
                  </div>
                )}
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => setActiveActionModal(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`btn btn-sm fw-bold ${
                    activeActionModal === 'reject'
                      ? 'btn-danger'
                      : activeActionModal === 'publish'
                      ? 'btn-success'
                      : 'btn-primary'
                  }`}
                  onClick={handleExecuteAction}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin me-1"></i> Processing...
                    </>
                  ) : (
                    'Confirm Action'
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

    </div>
  );
}
