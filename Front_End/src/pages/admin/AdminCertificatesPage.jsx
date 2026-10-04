import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminService } from '../../services/cycleServices';
import { LoadingState, ErrorState, PageHeader } from '../../components/StateComponents.jsx';

export default function AdminCertificatesPage() {
  const [certificates, setCertificates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');

  // Upload & Preparation Modal State
  const [selectedCertForUpload, setSelectedCertForUpload] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  // Preview Modal State
  const [previewCert, setPreviewCert] = useState(null);

  // Quick Issue State
  const [issuingId, setIssuingId] = useState(null);
  const [creatingId, setCreatingId] = useState(null);

  const load = () => {
    setLoading(true);
    setError('');
    adminService
      .certificates()
      .then((res) => setCertificates(res.data || []))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load certificate requests.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const handleCreateCertificate = async (cert) => {
    setCreatingId(cert._id);
    setError('');
    try {
      await adminService.createCertificate(cert._id);
      setActionSuccess(`Certificate for "${cert.certificateName || cert.recipientName}" successfully created by Admin. Student notified.`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create certificate.');
    } finally {
      setCreatingId(null);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.mimetype) && !/\.(pdf|jpg|jpeg|png|webp)$/i.test(file.name)) {
        setUploadError('Invalid file format. Please select a PDF or image file (JPG, PNG).');
        setSelectedFile(null);
        return;
      }
      if (file.size > 15 * 1024 * 1024) {
        setUploadError('File size exceeds the 15MB limit.');
        setSelectedFile(null);
        return;
      }
      setUploadError('');
      setSelectedFile(file);
    }
  };

  const handleUpload = async (issueNow = false) => {
    if (!selectedCertForUpload) return;
    if (!selectedFile && !selectedCertForUpload.fileUrl) {
      setUploadError('Please select an official certificate file to upload.');
      return;
    }

    setIsUploading(true);
    setUploadError('');
    setError('');

    try {
      const formData = new FormData();
      if (selectedFile) {
        formData.append('file', selectedFile);
      }
      formData.append('issueNow', issueNow);
      formData.append('adminNotes', adminNotes);

      await adminService.uploadCertificate(selectedCertForUpload._id, formData);

      setActionSuccess(
        issueNow
          ? `Certificate for ${selectedCertForUpload.certificateName || selectedCertForUpload.recipientName} successfully uploaded, marked as ISSUED, and student notified via email.`
          : `Certificate file for ${selectedCertForUpload.certificateName || selectedCertForUpload.recipientName} uploaded and marked as Under Preparation.`
      );

      setSelectedCertForUpload(null);
      setSelectedFile(null);
      setAdminNotes('');
      load();
    } catch (err) {
      setUploadError(err.response?.data?.message || 'Failed to upload certificate file.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleIssueDirect = async (cert) => {
    setIssuingId(cert._id);
    setError('');
    try {
      await adminService.issueCertificate(cert._id);
      setActionSuccess(`Official certificate for ${cert.certificateName || cert.recipientName} successfully issued. In-app notification and email sent to student.`);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to issue certificate.');
    } finally {
      setIssuingId(null);
    }
  };

  const filtered = certificates.filter((c) => {
    const normStatus = String(c.status).toUpperCase();
    if (activeTab === 'submitted' && normStatus !== 'NAME_SUBMITTED') return false;
    if (activeTab === 'prep' && normStatus !== 'UNDER_PREPARATION') return false;
    if (activeTab === 'issued' && normStatus !== 'ISSUED') return false;
    if (activeTab === 'waiting_feedback' && c.feedbackCompleted) return false;
    if (activeTab === 'feedback_completed' && !c.feedbackCompleted) return false;

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const sName = c.student?.fullName?.toLowerCase() || '';
      const email = c.student?.email?.toLowerCase() || '';
      const rName = (c.certificateName || c.recipientName || '').toLowerCase();
      const cTitle = c.course?.title?.toLowerCase() || '';
      const certId = c.certificateId?.toLowerCase() || '';
      return sName.includes(q) || email.includes(q) || rName.includes(q) || cTitle.includes(q) || certId.includes(q);
    }
    return true;
  });

  const submittedCount = certificates.filter((c) => String(c.status).toUpperCase() === 'NAME_SUBMITTED').length;
  const prepCount = certificates.filter((c) => String(c.status).toUpperCase() === 'UNDER_PREPARATION').length;
  const issuedCount = certificates.filter((c) => String(c.status).toUpperCase() === 'ISSUED').length;
  const pendingFeedbackCount = certificates.filter((c) => !c.feedbackCompleted && String(c.status).toUpperCase() !== 'ISSUED').length;
  const feedbackCompletedCount = certificates.filter((c) => c.feedbackCompleted).length;

  if (loading) return <LoadingState label="Loading certificate requests queue..." />;

  return (
    <div className="container-fluid py-4 px-md-5">
      <PageHeader
        title="Official Certificate Management Queue"
        subtitle="Review student confirmed names, verify academic credentials, check feedback completion, upload official certificates (PDF/Images), and release credentials."
        breadcrumbs={[
          { label: 'Admin Management', to: '/admin/applications' },
          { label: 'Certificate Queue' },
        ]}
        actions={
          <button className="btn btn-outline-secondary btn-sm" onClick={load} title="Refresh records">
            <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh Queue
          </button>
        }
      />

      {/* Statistics Counter Cards */}
      <div className="row g-3 mb-4">
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-primary">
            <span className="text-muted small text-uppercase fw-bold">Total Certificate Requests</span>
            <h3 className="fw-bold text-dark mt-1 mb-0">{certificates.length}</h3>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-warning">
            <span className="text-muted small text-uppercase fw-bold">Pending Feedback</span>
            <h3 className="fw-bold text-warning mt-1 mb-0">{pendingFeedbackCount}</h3>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-info">
            <span className="text-muted small text-uppercase fw-bold">Feedback Completed</span>
            <h3 className="fw-bold text-info mt-1 mb-0">{feedbackCompletedCount}</h3>
          </div>
        </div>
        <div className="col-sm-6 col-xl-3">
          <div className="egsa-card p-3 border-start border-4 border-success">
            <span className="text-muted small text-uppercase fw-bold">Officially Issued</span>
            <h3 className="fw-bold text-success mt-1 mb-0">{issuedCount}</h3>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {actionSuccess && (
        <div className="alert alert-success alert-dismissible fade show d-flex align-items-center mb-4 shadow-sm" role="alert">
          <i className="fa-solid fa-circle-check fs-5 me-2 text-success"></i>
          <div>{actionSuccess}</div>
          <button type="button" className="btn-close" onClick={() => setActionSuccess('')}></button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger alert-dismissible fade show d-flex align-items-center mb-4 shadow-sm" role="alert">
          <i className="fa-solid fa-triangle-exclamation fs-5 me-2 text-danger"></i>
          <div>{error}</div>
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="egsa-card p-3 mb-4">
        <div className="row g-3 align-items-center justify-content-between">
          <div className="col-md-8">
            <div className="btn-group flex-wrap" role="group">
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'all' ? 'btn-primary-egsa text-white' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('all')}
              >
                All ({certificates.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'submitted' ? 'btn-warning text-dark fw-semibold' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('submitted')}
              >
                Name Submitted ({submittedCount})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'waiting_feedback' ? 'btn-danger text-white' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('waiting_feedback')}
              >
                Feedback Pending ({pendingFeedbackCount})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'feedback_completed' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('feedback_completed')}
              >
                Feedback Completed ({feedbackCompletedCount})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'prep' ? 'btn-info text-white' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('prep')}
              >
                Under Prep ({prepCount})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${activeTab === 'issued' ? 'btn-success text-white' : 'btn-outline-secondary'}`}
                onClick={() => setActiveTab('issued')}
              >
                Issued ({issuedCount})
              </button>
            </div>
          </div>
          <div className="col-md-4">
            <div className="input-group input-group-sm">
              <span className="input-group-text bg-light border-end-0">
                <i className="fa-solid fa-magnifying-glass text-muted"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0"
                placeholder="Search student, course, name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button className="btn btn-outline-secondary" onClick={() => setSearch('')}>
                  <i className="fa-solid fa-xmark"></i>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Certificates Queue Table */}
      <div className="egsa-card p-0 overflow-hidden shadow-sm">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="table-light">
              <tr className="small text-uppercase text-muted">
                <th className="ps-4">Student</th>
                <th>Course</th>
                <th>Certificate Name</th>
                <th>Submission Date</th>
                <th>Status</th>
                <th>Feedback Status</th>
                <th>Official Certificate File</th>
                <th className="text-end pe-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" className="text-center py-5 text-muted">
                    <i className="fa-solid fa-folder-open fa-3x mb-3 text-secondary opacity-50 d-block"></i>
                    No certificate requests found matching criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((cert) => {
                  const normStatus = String(cert.status).toUpperCase();
                  const isAdminCreated = Boolean(cert.adminCreated || normStatus === 'UNDER_PREPARATION' || normStatus === 'ISSUED');
                  let statusBadge = (
                    <span className="badge bg-warning-subtle text-dark border border-warning-subtle px-2 py-1">
                      <i className="fa-solid fa-hourglass-start me-1"></i> Name Submitted
                    </span>
                  );
                  if (normStatus === 'ISSUED') {
                    statusBadge = (
                      <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1">
                        <i className="fa-solid fa-check-circle me-1"></i> Issued
                      </span>
                    );
                  } else if (isAdminCreated) {
                    statusBadge = (
                      <span className="badge bg-info-subtle text-info-emphasis border border-info-subtle px-2 py-1">
                        <i className="fa-solid fa-stamp me-1"></i> Admin Created
                      </span>
                    );
                  }

                  const certName = cert.certificateName || cert.recipientName;
                  const isCourseDone = Boolean(cert.courseFeedbackCompleted);
                  const isAgencyDone = Boolean(cert.agencyFeedbackCompleted);
                  const isAllFeedbackDone = Boolean(cert.feedbackCompleted || (isCourseDone && isAgencyDone));

                  return (
                    <tr key={cert._id}>
                      {/* Student Info */}
                      <td className="ps-4">
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="rounded-circle d-flex align-items-center justify-content-center bg-primary-subtle text-primary fw-bold"
                            style={{ width: '38px', height: '38px', flexShrink: 0 }}
                          >
                            {cert.student?.fullName ? cert.student.fullName[0].toUpperCase() : 'S'}
                          </div>
                          <div>
                            <strong className="text-dark d-block">{cert.student?.fullName || 'Cadet Student'}</strong>
                            <span className="text-muted small">{cert.student?.email}</span>
                            {cert.student?.registrationNumber && (
                              <span className="d-block text-muted font-monospace small" style={{ fontSize: '0.75rem' }}>
                                {cert.student.registrationNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Course Info */}
                      <td>
                        <strong className="text-dark d-block">{cert.course?.title || 'Space Program'}</strong>
                        <span className="text-muted small">{cert.cohort?.name || 'Standard Cohort'}</span>
                      </td>

                      {/* Submitted Certificate Name */}
                      <td>
                        <div className="p-2 bg-light rounded border d-inline-block">
                          <small className="text-muted d-block" style={{ fontSize: '0.72rem' }}>Submitted Name:</small>
                          <strong className="text-primary-egsa font-monospace" style={{ fontSize: '0.95rem' }}>
                            "{certName}"
                          </strong>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="text-muted small">
                        {cert.submittedAt ? new Date(cert.submittedAt).toLocaleDateString() : 'Recent'}
                      </td>

                      {/* Status */}
                      <td>{statusBadge}</td>

                      {/* Granular Feedback Status (Course + Agency) */}
                      <td>
                        <div className="d-flex flex-column gap-1 small" style={{ minWidth: '135px' }}>
                          <div className="d-flex align-items-center justify-content-between">
                            <span className="text-muted me-1">Course:</span>
                            {isCourseDone ? (
                              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-0">
                                <i className="fa-solid fa-check me-1"></i> Completed
                              </span>
                            ) : (
                              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-0">
                                <i className="fa-solid fa-clock me-1"></i> Pending
                              </span>
                            )}
                          </div>
                          <div className="d-flex align-items-center justify-content-between">
                            <span className="text-muted me-1">Agency:</span>
                            {isAgencyDone ? (
                              <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-0">
                                <i className="fa-solid fa-check me-1"></i> Completed
                              </span>
                            ) : (
                              <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-0">
                                <i className="fa-solid fa-clock me-1"></i> Pending
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Uploaded File Reference */}
                      <td>
                        {cert.fileUrl ? (
                          <div className="d-flex align-items-center gap-1">
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary py-0 px-2"
                              onClick={() => setPreviewCert(cert)}
                              title="Preview certificate file"
                            >
                              <i className="fa-solid fa-eye me-1"></i>
                              {cert.fileMimeType?.includes('pdf') ? 'PDF' : 'Image'}
                            </button>
                            <a
                              href={`/api/certificates/${cert._id}/download`}
                              download
                              className="btn btn-sm btn-outline-secondary py-0 px-2"
                              title="Download certificate"
                              target="_blank"
                              rel="noreferrer"
                            >
                              <i className="fa-solid fa-download"></i>
                            </a>
                          </div>
                        ) : (
                          <span className="text-muted small fst-italic">No file uploaded</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="text-end pe-4">
                        <div className="d-flex align-items-center justify-content-end gap-1">
                          {/* Create Certificate Button */}
                          {!isAdminCreated && (
                            <button
                              type="button"
                              className="btn btn-sm btn-primary px-3 fw-semibold text-white shadow-sm"
                              onClick={() => handleCreateCertificate(cert)}
                              disabled={creatingId === cert._id}
                              title="Create the official certificate using the student's submitted name"
                            >
                              {creatingId === cert._id ? (
                                <>
                                  <i className="fa-solid fa-spinner fa-spin me-1"></i> Creating…
                                </>
                              ) : (
                                <>
                                  <i className="fa-solid fa-stamp me-1"></i> Create Certificate
                                </>
                              )}
                            </button>
                          )}

                          {/* Prepare / Upload Button */}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary px-2"
                            onClick={() => {
                              setSelectedCertForUpload(cert);
                              setSelectedFile(null);
                              setUploadError('');
                              setAdminNotes(cert.adminNotes || '');
                            }}
                            title="Upload official PDF / Image certificate template"
                          >
                            <i className="fa-solid fa-upload me-1"></i>
                            {cert.fileUrl ? 'Replace File' : 'Upload File'}
                          </button>

                          {/* Quick Issue Button (Enabled only if file is uploaded and both feedback forms are completed) */}
                          {cert.fileUrl && normStatus !== 'ISSUED' && (
                            <button
                              type="button"
                              className={`btn btn-sm ${isAllFeedbackDone ? 'btn-success' : 'btn-secondary opacity-75'} text-white px-2`}
                              onClick={() => handleIssueDirect(cert)}
                              disabled={issuingId === cert._id || !isAllFeedbackDone}
                              title={
                                !isAllFeedbackDone
                                  ? 'Cannot issue: Student must complete both Course and Agency feedback first'
                                  : 'Mark as Issued and send student email'
                              }
                            >
                              {issuingId === cert._id ? (
                                <i className="fa-solid fa-spinner fa-spin"></i>
                              ) : (
                                <>
                                  <i className="fa-solid fa-check me-1"></i> Issue
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: ADMIN PREPARE & UPLOAD CERTIFICATE */}
      {selectedCertForUpload && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1055 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: 'var(--radius-lg, 12px)' }}>
              <div className="modal-header bg-primary-egsa text-white">
                <h5 className="modal-title fw-bold d-flex align-items-center gap-2">
                  <i className="fa-solid fa-certificate"></i>
                  Prepare & Upload Official Certificate
                </h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={() => setSelectedCertForUpload(null)}
                ></button>
              </div>

              <div className="modal-body p-4">
                {/* 1. STUDENT, COURSE & CERTIFICATE NAME DISPLAY */}
                <div
                  className="card p-3 mb-4 bg-light border shadow-sm"
                  style={{ borderRadius: '8px', borderLeft: '4px solid var(--color-primary, #0f2b48)' }}
                >
                  <div className="row g-3">
                    <div className="col-md-3">
                      <span className="text-muted d-block small">Student:</span>
                      <strong className="text-dark fs-6">{selectedCertForUpload.student?.fullName || 'Student'}</strong>
                      <span className="d-block text-muted small">{selectedCertForUpload.student?.email}</span>
                    </div>
                    <div className="col-md-3">
                      <span className="text-muted d-block small">Course:</span>
                      <strong className="text-dark fs-6">{selectedCertForUpload.course?.title || 'Course'}</strong>
                      <span className="d-block text-muted small">{selectedCertForUpload.cohort?.name || 'Cohort'}</span>
                    </div>
                    <div className="col-md-3">
                      <span className="text-muted d-block small">Certificate Name:</span>
                      <strong className="text-primary-egsa fs-5 font-monospace" style={{ wordBreak: 'break-word' }}>
                        {selectedCertForUpload.certificateName || selectedCertForUpload.recipientName}
                      </strong>
                    </div>
                    <div className="col-md-3">
                      <span className="text-muted d-block small">Course Feedback:</span>
                      {selectedCertForUpload.feedbackCompleted ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle px-2 py-1 mt-1">
                          <i className="fa-solid fa-circle-check me-1"></i> Completed
                        </span>
                      ) : (
                        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2 py-1 mt-1">
                          <i className="fa-solid fa-clock me-1"></i> Pending
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-3 pt-2 border-top text-muted small d-flex align-items-center gap-2">
                    <i className="fa-solid fa-circle-info text-primary-egsa"></i>
                    <span>This is the official recipient name submitted by the student for certificate generation.</span>
                  </div>
                </div>

                {/* Feedback Pending Notice */}
                {!selectedCertForUpload.feedbackCompleted && (
                  <div className="alert alert-warning py-2 px-3 mb-4 d-flex align-items-start gap-2 small">
                    <i className="fa-solid fa-triangle-exclamation text-warning fs-5 mt-1"></i>
                    <div>
                      <strong>Mandatory Course Feedback Not Submitted:</strong>
                      <div>
                        The student has not completed their required course feedback. You may upload the certificate and click <strong>Save as Under Preparation</strong>, but <strong>direct issuance is locked</strong> until the student submits their feedback.
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. Existing uploaded file (if replacing) */}
                {selectedCertForUpload.fileUrl && (
                  <div className="alert alert-info py-2 px-3 mb-4 d-flex align-items-center justify-content-between">
                    <div>
                      <i className="fa-solid fa-file-circle-check me-2 text-info"></i>
                      <span>Existing file: <strong>{selectedCertForUpload.fileName || 'Official_Certificate'}</strong></span>
                    </div>
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-info"
                      onClick={() => setPreviewCert(selectedCertForUpload)}
                    >
                      <i className="fa-solid fa-eye me-1"></i> Preview Existing
                    </button>
                  </div>
                )}

                {/* 4. File Upload Input */}
                <div className="mb-4">
                  <label htmlFor="adminCertificateFileInput" className="form-label fw-bold text-dark">
                    Upload Official Certificate File (PDF / Image) <span className="text-danger">*</span>
                  </label>
                  <input
                    type="file"
                    id="adminCertificateFileInput"
                    className="form-control form-control-lg"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
                    onChange={handleFileChange}
                  />
                  <div className="form-text mt-1 text-muted small">
                    <i className="fa-solid fa-info-circle me-1"></i>
                    Supported formats: PDF (Recommended), PNG, JPG. Maximum file size: 15MB.
                  </div>
                  {uploadError && (
                    <div className="text-danger small mt-2">
                      <i className="fa-solid fa-circle-exclamation me-1"></i> {uploadError}
                    </div>
                  )}
                </div>

                {/* 5. Admin Internal Notes */}
                <div className="mb-2">
                  <label htmlFor="adminCertificateNotesInput" className="form-label fw-semibold text-muted small">
                    Internal Administrative Notes (Optional)
                  </label>
                  <textarea
                    id="adminCertificateNotesInput"
                    className="form-control form-control-sm"
                    rows="2"
                    placeholder="e.g. Verified against student Egyptian National ID. Signed by Space Agency Academic Dean."
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                  ></textarea>
                </div>
              </div>

              <div className="modal-footer bg-light border-top d-flex justify-content-between">
                <button
                  type="button"
                  className="btn btn-outline-secondary px-3"
                  onClick={() => setSelectedCertForUpload(null)}
                  disabled={isUploading}
                >
                  Cancel
                </button>

                <div className="d-flex gap-2">
                  {/* Action 1: Upload as Under Preparation */}
                  <button
                    type="button"
                    className="btn btn-outline-primary px-3 fw-semibold"
                    onClick={() => handleUpload(false)}
                    disabled={isUploading || (!selectedFile && !selectedCertForUpload.fileUrl)}
                  >
                    {isUploading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-floppy-disk me-1"></i>}
                    Save as Under Preparation
                  </button>

                  {/* Action 2: Upload & Issue Certificate (Gated by feedbackCompleted) */}
                  <button
                    type="button"
                    className="btn btn-success px-4 fw-semibold text-white shadow-sm"
                    onClick={() => handleUpload(true)}
                    disabled={
                      isUploading ||
                      (!selectedFile && !selectedCertForUpload.fileUrl) ||
                      !selectedCertForUpload.feedbackCompleted
                    }
                    title={
                      !selectedCertForUpload.feedbackCompleted
                        ? 'Cannot issue: Student must complete mandatory course feedback first'
                        : 'Upload file and issue certificate immediately'
                    }
                  >
                    {isUploading ? (
                      <>
                        <i className="fa-solid fa-spinner fa-spin me-2"></i> Uploading & Issuing…
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-certificate me-2"></i> Upload & Issue Certificate
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: PREVIEW CERTIFICATE DOCUMENT */}
      {previewCert && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1060 }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content shadow-lg border-0" style={{ borderRadius: 'var(--radius-lg, 12px)' }}>
              <div className="modal-header bg-light">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="fa-solid fa-eye text-primary-egsa"></i>
                  Certificate Preview — {previewCert.certificateName || previewCert.recipientName}
                </h5>
                <button type="button" className="btn-close" onClick={() => setPreviewCert(null)}></button>
              </div>
              <div className="modal-body p-0 bg-dark text-center" style={{ minHeight: '500px' }}>
                {previewCert.fileMimeType?.includes('pdf') || previewCert.fileUrl?.endsWith('.pdf') ? (
                  <iframe
                    src={previewCert.fileUrl}
                    title="Certificate Document Preview"
                    width="100%"
                    height="650px"
                    style={{ border: 'none' }}
                  />
                ) : (
                  <div className="p-4">
                    <img
                      src={previewCert.fileUrl}
                      alt={`Certificate for ${previewCert.certificateName || previewCert.recipientName}`}
                      className="img-fluid rounded shadow"
                      style={{ maxHeight: '650px', objectFit: 'contain' }}
                    />
                  </div>
                )}
              </div>
              <div className="modal-footer bg-light d-flex justify-content-between">
                <div>
                  <span className="text-muted small">
                    Certificate ID: <strong className="text-dark font-monospace">{previewCert.certificateId || 'Pending'}</strong>
                  </span>
                </div>
                <div className="d-flex gap-2">
                  <a
                    href={`/api/certificates/${previewCert._id}/download`}
                    download
                    className="btn btn-outline-primary btn-sm"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <i className="fa-solid fa-download me-1"></i> Download File
                  </a>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPreviewCert(null)}>
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
