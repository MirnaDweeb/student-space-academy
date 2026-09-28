import React, { useState } from 'react';
import { attendanceService } from '../../services/studentPortalServices';

/**
 * DisputeModal
 * Allows students to report attendance discrepancies or request excused absences for official board review.
 */
export default function DisputeModal({ isOpen, onClose, sessions = [], enrollmentId, onSuccess }) {
  const [selectedSessionId, setSelectedSessionId] = useState(sessions[0]?._id || '');
  const [disputeType, setDisputeType] = useState('Missed_Checkin');
  const [reason, setReason] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedSessionId) {
      setError('Please select the affected training session.');
      return;
    }
    if (!reason.trim() || reason.trim().length < 10) {
      setError('Please provide a detailed justification (minimum 10 characters).');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await attendanceService.submitDispute({
        sessionId: selectedSessionId,
        enrollmentId,
        type: disputeType,
        reason: reason.trim(),
        evidenceUrl: evidenceUrl.trim(),
      });
      setSubmitted(true);
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit attendance dispute.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(5, 15, 30, 0.75)', backdropFilter: 'blur(4px)', zIndex: 1060 }}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '540px' }}>
        <div className="modal-content shadow-lg border-0" style={{ borderRadius: 'var(--radius-lg, 12px)' }}>
          {/* Header */}
          <div className="modal-header bg-dark text-white border-bottom border-secondary pb-3">
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-warning text-dark p-2">
                <i className="fa-solid fa-file-circle-question fs-6"></i>
              </span>
              <div>
                <h5 className="modal-title fw-bold mb-0">Attendance Review Request</h5>
                <small className="text-muted">EGSA Academic Affairs · Attendance Dispute & Excuse Form</small>
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
            {submitted ? (
              <div className="text-center py-4">
                <div
                  className="d-inline-flex align-items-center justify-content-center rounded-circle bg-success text-white mb-3 shadow"
                  style={{ width: '64px', height: '64px' }}
                >
                  <i className="fa-solid fa-check fa-2x"></i>
                </div>
                <h5 className="fw-bold text-dark mb-1">Request Submitted Successfully</h5>
                <p className="text-muted small mb-4">
                  Your request has been filed with the course instructor and EGSA Academic Affairs. You will be notified once reviewed.
                </p>
                <button className="btn btn-primary px-4" onClick={onClose}>
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                {error && (
                  <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                    <i className="fa-solid fa-triangle-exclamation flex-shrink-0"></i>
                    <span>{error}</span>
                  </div>
                )}

                {/* Session select */}
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-dark">
                    Select Training Session: <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select form-select-sm"
                    value={selectedSessionId}
                    onChange={(e) => setSelectedSessionId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Training Session --</option>
                    {sessions.map((s) => (
                      <option key={s._id} value={s._id}>
                        Session #{s.sessionNumber}: {s.title} ({new Date(s.date).toLocaleDateString()}) - Current: {s.status || 'Upcoming'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Issue Type */}
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-dark">
                    Request / Dispute Type: <span className="text-danger">*</span>
                  </label>
                  <select
                    className="form-select form-select-sm"
                    value={disputeType}
                    onChange={(e) => setDisputeType(e.target.value)}
                    required
                  >
                    <option value="Missed_Checkin">Missed QR Scan (Attended but unrecorded)</option>
                    <option value="Late_Appeal">Late Arrival Appeal (Excused circumstance)</option>
                    <option value="Medical_Excuse">Medical Excuse / Health Leave</option>
                    <option value="Official_Duty">Official Duty / EGSA Academic Mission</option>
                    <option value="Other">Other Academic Circumstance</option>
                  </select>
                </div>

                {/* Reason */}
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-dark">
                    Detailed Explanation & Justification: <span className="text-danger">*</span>
                  </label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Provide a clear account of the session attendance, instructor present, or reason for absence..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                  ></textarea>
                  <small className="text-muted">Minimum 10 characters.</small>
                </div>

                {/* Evidence Link */}
                <div className="mb-3">
                  <label className="form-label small fw-semibold text-dark">
                    Supporting Document URL / Reference (Optional):
                  </label>
                  <input
                    type="url"
                    className="form-control form-control-sm"
                    placeholder="https://drive.google.com/... or medical report link"
                    value={evidenceUrl}
                    onChange={(e) => setEvidenceUrl(e.target.value)}
                  />
                  <small className="text-muted">Upload medical note or official clearance letter if applicable.</small>
                </div>

                <div className="d-flex justify-content-end gap-2 pt-2 border-top">
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={onClose}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm px-3 fw-semibold"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" />
                        Submitting…
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane me-1"></i> Submit Request
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
