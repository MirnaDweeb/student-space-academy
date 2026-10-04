import React, { useState, useEffect } from 'react';
import { enrollmentService } from '../../services/cycleServices';
import { attendanceService, mediaService } from '../../services/studentPortalServices';

/**
 * UploadMediaModal
 * 5-Step institutional media submission wizard:
 * Step 1: Select Session
 * Step 2: Upload Photos
 * Step 3: Add Metadata
 * Step 4: Preview
 * Step 5: Consent & Submit
 */
export default function UploadMediaModal({ isOpen, onClose, onSuccess, onUploadSuccess, initialSession = null }) {
  const [step, setStep] = useState(1);
  const [enrollments, setEnrollments] = useState([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');

  // Media files & form data
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Project');
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  // States
  const [loading, setLoading] = useState(false);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [error, setError] = useState('');

  // Fetch enrollments on open
  useEffect(() => {
    if (isOpen) {
      setError('');
      setStep(1);
      setFile(null);
      setFilePreview('');
      setTitle('');
      setCaption('');
      setDescription('');
      setConsentConfirmed(false);

      enrollmentService.my().then((res) => {
        const list = res.data || [];
        setEnrollments(list);
        if (list.length > 0) {
          const firstEnr = list[0];
          setSelectedEnrollmentId(firstEnr._id);
        }
      }).catch((err) => {
        setError(err.message || 'Failed to load enrolled courses.');
      });
    }
  }, [isOpen]);

  // When selected enrollment changes, fetch its sessions
  useEffect(() => {
    if (!selectedEnrollmentId) return;
    const currentEnr = enrollments.find((e) => e._id === selectedEnrollmentId);
    const cohortId = currentEnr?.cohort?._id || currentEnr?.cohort;

    if (cohortId) {
      setSessionsLoading(true);
      attendanceService.getSessions({ cohortId }).then((sessList) => {
        setSessions(sessList || []);
        if (initialSession && sessList.some((s) => s._id === initialSession._id)) {
          setSelectedSessionId(initialSession._id);
        } else if (sessList.length > 0) {
          setSelectedSessionId(sessList[0]._id);
        } else {
          setSelectedSessionId('');
        }
      }).catch(() => {
        setSessions([]);
      }).finally(() => {
        setSessionsLoading(false);
      });
    }
  }, [selectedEnrollmentId, enrollments, initialSession]);

  if (!isOpen) return null;

  const currentEnrollment = enrollments.find((e) => e._id === selectedEnrollmentId);
  const currentSession = sessions.find((s) => s._id === selectedSessionId);

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(selected.type)) {
      setError('Unsupported file type. Please choose a JPG, PNG, or WEBP image.');
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      setError('File size exceeds the 10MB institutional limit. Please upload an optimized image.');
      return;
    }

    setError('');
    setFile(selected);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFilePreview(ev.target.result);
      if (!title) {
        // Derive clean title from filename
        const cleanName = selected.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
        setTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
      }
    };
    reader.readAsDataURL(selected);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFilePreview('');
  };

  const handleSubmit = async (submitImmediately = true) => {
    if (!file) {
      setError('Please select an image file to upload.');
      return;
    }
    if (!selectedEnrollmentId) {
      setError('Please select an enrolled course.');
      return;
    }
    if (!title.trim()) {
      setError('Please provide a title for the media.');
      return;
    }
    if (submitImmediately && !consentConfirmed) {
      setError('Please confirm that you understand the media will be reviewed prior to publication.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('courseId', currentEnrollment.course?._id || currentEnrollment.course);
      formData.append('cohortId', currentEnrollment.cohort?._id || currentEnrollment.cohort);
      if (selectedSessionId) {
        formData.append('sessionId', selectedSessionId);
      }
      formData.append('category', category || 'Project');
      formData.append('title', title.trim());
      formData.append('caption', caption.trim());
      formData.append('description', description.trim());
      formData.append('consentConfirmed', consentConfirmed);
      formData.append('submitImmediately', submitImmediately);

      await mediaService.uploadMedia(formData);
      if (onSuccess) onSuccess();
      if (onUploadSuccess) onUploadSuccess();
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to upload training media.');
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
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content shadow-lg border-0" style={{ borderRadius: 'var(--radius-lg, 12px)' }}>
          {/* Header */}
          <div className="modal-header bg-dark text-white border-bottom border-secondary pb-3">
            <div className="d-flex align-items-center gap-2">
              <span className="badge bg-primary-egsa p-2">
                <i className="fa-solid fa-cloud-arrow-up fs-6"></i>
              </span>
              <div>
                <h5 className="modal-title fw-bold mb-0">Upload Training Media</h5>
                <small className="text-muted">EGSA Space Academy · Institutional Media Submission</small>
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

          {/* Stepper Progress Header */}
          <div className="bg-light px-4 py-2 border-bottom">
            <div className="d-flex justify-content-between align-items-center small">
              <span className={`fw-bold ${step === 1 ? 'text-primary-egsa' : 'text-muted'}`}>
                1. Select Session
              </span>
              <i className="fa-solid fa-angle-right text-muted small"></i>
              <span className={`fw-bold ${step === 2 ? 'text-primary-egsa' : 'text-muted'}`}>
                2. Upload Photos
              </span>
              <i className="fa-solid fa-angle-right text-muted small"></i>
              <span className={`fw-bold ${step === 3 ? 'text-primary-egsa' : 'text-muted'}`}>
                3. Add Metadata
              </span>
              <i className="fa-solid fa-angle-right text-muted small"></i>
              <span className={`fw-bold ${step === 4 ? 'text-primary-egsa' : 'text-muted'}`}>
                4. Review & Consent
              </span>
            </div>
          </div>

          {/* Body */}
          <div className="modal-body p-4">
            {error && (
              <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                <i className="fa-solid fa-triangle-exclamation flex-shrink-0"></i>
                <span>{error}</span>
              </div>
            )}

            {/* STEP 1: Select Session */}
            {step === 1 && (
              <div>
                <h6 className="fw-bold text-dark mb-1">Associate with Training Session</h6>
                <p className="text-muted small mb-3">
                  All submitted media must be associated with an active cohort session in which you are enrolled.
                </p>

                {enrollments.length === 0 ? (
                  <div className="alert alert-warning small">
                    You do not currently have any active course enrollments to associate media with.
                  </div>
                ) : (
                  <>
                    <div className="mb-3">
                      <label className="form-label small fw-semibold text-dark">Select Enrolled Course:</label>
                      <select
                        className="form-select form-select-sm"
                        value={selectedEnrollmentId}
                        onChange={(e) => setSelectedEnrollmentId(e.target.value)}
                      >
                        {enrollments.map((enr) => (
                          <option key={enr._id} value={enr._id}>
                            {enr.course?.title} ({enr.cohort?.name || 'Cohort'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold text-dark">Media Category:</label>
                      <select
                        className="form-select form-select-sm"
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                      >
                        <option value="Project">Project / Capstone Documentation</option>
                        <option value="Activity">Workshop / Practical Activity</option>
                        <option value="Student Photo">Student in Action / Laboratory Portrait</option>
                        <option value="Workshop">Technical Drill / Cleanroom Work</option>
                        <option value="Other">Other Institutional Media</option>
                      </select>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold text-dark">
                        Training Session (Optional): {sessionsLoading && <span className="spinner-border spinner-border-sm ms-2" />}
                      </label>
                      <select
                        className="form-select form-select-sm"
                        value={selectedSessionId}
                        onChange={(e) => setSelectedSessionId(e.target.value)}
                        disabled={sessionsLoading}
                      >
                        <option value="">General Course Project / Activity (No specific session)</option>
                        {sessions.map((sess) => (
                          <option key={sess._id} value={sess._id}>
                            Session #{sess.sessionNumber}: {sess.title} ({new Date(sess.date).toLocaleDateString()})
                          </option>
                        ))}
                      </select>
                    </div>

                    {currentSession && (
                      <div className="p-3 bg-light rounded border">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <strong className="text-dark">{currentSession.title}</strong>
                          <span className="badge bg-light text-dark border small">{currentSession.deliveryMode || 'Onsite'}</span>
                        </div>
                        <div className="small text-muted">
                          <i className="fa-solid fa-location-dot me-1 text-primary-egsa"></i>
                          {currentSession.location || 'EGSA Academy Cairo'} · Instructor: {currentSession.instructor || 'EGSA Faculty'}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* STEP 2: Upload Photos */}
            {step === 2 && (
              <div>
                <h6 className="fw-bold text-dark mb-1">Select Training Photos</h6>
                <p className="text-muted small mb-3">
                  Upload crisp photos captured during your laboratory drill or lecture session (JPG, PNG, WEBP · Max 10MB).
                </p>

                {!filePreview ? (
                  <label
                    className="border border-2 border-dashed rounded p-5 text-center d-block bg-light"
                    style={{ cursor: 'pointer' }}
                  >
                    <i className="fa-solid fa-images fa-3x text-primary-egsa mb-3 d-block"></i>
                    <h6 className="fw-bold text-dark mb-1">Choose an image or drag & drop here</h6>
                    <small className="text-muted d-block mb-3">Supported formats: JPG, PNG, WEBP up to 10MB</small>
                    <span className="btn btn-outline-primary btn-sm px-3">
                      <i className="fa-solid fa-folder-open me-1"></i> Browse Files
                    </span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                    />
                  </label>
                ) : (
                  <div className="card p-3 bg-light border">
                    <div className="row g-3 align-items-center">
                      <div className="col-sm-4 text-center">
                        <img
                          src={filePreview}
                          alt="Upload preview"
                          className="img-fluid rounded border shadow-sm"
                          style={{ maxHeight: '180px', objectFit: 'contain' }}
                        />
                      </div>
                      <div className="col-sm-8">
                        <h6 className="fw-bold text-dark mb-1">{file?.name}</h6>
                        <small className="text-muted d-block mb-2">
                          Size: {(file.size / 1024).toFixed(1)} KB · Format: {file.type}
                        </small>
                        <span className="badge bg-success-subtle text-success border border-success-subtle mb-3">
                          <i className="fa-solid fa-circle-check me-1"></i> File Verified
                        </span>
                        <div>
                          <button className="btn btn-outline-danger btn-sm" onClick={handleRemoveFile}>
                            <i className="fa-solid fa-trash me-1"></i> Remove & Choose Another
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: Add Metadata */}
            {step === 3 && (
              <div>
                <h6 className="fw-bold text-dark mb-1">Media Title & Context</h6>
                <p className="text-muted small mb-3">
                  Provide descriptive context for the Academy curation team.
                </p>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-dark">
                    Media Title <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Cleanroom SMT Soldering Bench Calibration"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={150}
                    required
                  />
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-dark">
                    Caption (Public display caption)
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Short summary highlighting the activity or experiment..."
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    maxLength={300}
                  />
                  <small className="text-muted">Displayed under the image in the official media gallery.</small>
                </div>

                <div className="mb-3">
                  <label className="form-label small fw-semibold text-dark">
                    Technical Description (Optional details for moderation)
                  </label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Provide additional details regarding instruments used, procedures tested, or team members present..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    maxLength={2000}
                  ></textarea>
                </div>
              </div>
            )}

            {/* STEP 4: Preview & Consent */}
            {step === 4 && (
              <div>
                <h6 className="fw-bold text-dark mb-1">Review & Student Consent</h6>
                <p className="text-muted small mb-3">
                  Confirm your submission details before dispatching for review.
                </p>

                {/* Preview Card */}
                <div className="card border mb-3 overflow-hidden shadow-sm">
                  <div className="row g-0">
                    <div className="col-md-5 bg-black d-flex align-items-center justify-content-center">
                      <img
                        src={filePreview}
                        alt={title}
                        className="img-fluid"
                        style={{ maxHeight: '220px', objectFit: 'contain' }}
                      />
                    </div>
                    <div className="col-md-7 p-3 d-flex flex-column justify-content-between">
                      <div>
                        <span className="badge bg-primary-egsa mb-1">
                          {currentEnrollment?.course?.title || 'Course'}
                        </span>
                        <h6 className="fw-bold text-dark mb-1">{title}</h6>
                        <small className="text-muted d-block mb-2">
                          Session #{currentSession?.sessionNumber}: {currentSession?.title}
                        </small>
                        <p className="small text-muted mb-0">{caption || 'No caption provided.'}</p>
                      </div>
                      <small className="text-muted pt-2 border-top mt-2">
                        Status upon submission: <span className="badge bg-warning text-dark">Pending Review</span>
                      </small>
                    </div>
                  </div>
                </div>

                {/* Institutional Consent Notice */}
                <div className="p-3 bg-light rounded border mb-3">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="consentCheck"
                      checked={consentConfirmed}
                      onChange={(e) => setConsentConfirmed(e.target.checked)}
                    />
                    <label className="form-check-label small text-dark" htmlFor="consentCheck">
                      <strong>Institutional Publication Consent:</strong> I confirm that this media was taken during an authorized EGSA Space Academy training activity and may be reviewed and curated for publication on official Egyptian Space Agency media channels. Submission does not guarantee public display.
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="modal-footer bg-light border-top justify-content-between py-2 px-3">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setStep(step - 1)}
                  disabled={loading}
                >
                  <i className="fa-solid fa-arrow-left me-1"></i> Back
                </button>
              )}
            </div>

            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-sm btn-link text-muted"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>

              {step < 4 ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm px-3 fw-semibold"
                  onClick={() => {
                    if (step === 1 && !selectedEnrollmentId) {
                      setError('Please select an enrolled course.');
                      return;
                    }
                    if (step === 2 && !file) {
                      setError('Please select an image file to proceed.');
                      return;
                    }
                    if (step === 3 && !title.trim()) {
                      setError('Please provide a title for your media.');
                      return;
                    }
                    setError('');
                    setStep(step + 1);
                  }}
                >
                  Next <i className="fa-solid fa-arrow-right ms-1"></i>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm"
                    onClick={() => handleSubmit(false)}
                    disabled={loading}
                  >
                    Save as Draft
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm px-3 fw-semibold"
                    onClick={() => handleSubmit(true)}
                    disabled={loading || !consentConfirmed}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" />
                        Submitting…
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-paper-plane me-1"></i> Submit for Review
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
