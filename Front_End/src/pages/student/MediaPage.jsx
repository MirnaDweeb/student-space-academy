import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { mediaService } from '../../services/studentPortalServices';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';
import UploadMediaModal from '../../components/media/UploadMediaModal';
import MediaDetailsModal from '../../components/media/MediaDetailsModal';
import AdminMediaReviewModal from '../../components/media/AdminMediaReviewModal';

const STATUS_MAP = {
  Draft: { label: 'Draft', bg: 'bg-secondary text-white', icon: 'fa-pencil' },
  Pending_Review: { label: 'Pending Review', bg: 'bg-warning text-dark', icon: 'fa-clock' },
  Under_Review: { label: 'Under Review', bg: 'bg-info text-dark', icon: 'fa-magnifying-glass' },
  Approved: { label: 'Approved', bg: 'bg-success text-white', icon: 'fa-circle-check' },
  Changes_Requested: { label: 'Changes Requested', bg: 'bg-amber text-dark', icon: 'fa-triangle-exclamation' },
  Rejected: { label: 'Rejected', bg: 'bg-danger text-white', icon: 'fa-circle-xmark' },
  Selected_For_Publication: { label: 'Selected for Publication', bg: 'bg-primary text-white', icon: 'fa-bookmark' },
  Published: { label: 'Published to Web', bg: 'bg-success text-white', icon: 'fa-globe' },
  Unpublished: { label: 'Unpublished', bg: 'bg-dark text-white', icon: 'fa-eye-slash' },
};

export default function MediaPage() {
  const { user } = useAuth();
  const isAdminOrStaff = user?.role === 'admin' || user?.role === 'instructor' || user?.role === 'superadmin';

  // Navigation Tab: 'my_submissions' | 'public_gallery' | 'technical_library'
  const [activeTab, setActiveTab] = useState('my_submissions');

  // Student Media State
  const [myMedia, setMyMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');

  // Modals
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [selectedDetailItem, setSelectedDetailItem] = useState(null);
  const [isAdminWorkspaceOpen, setIsAdminWorkspaceOpen] = useState(false);

  // Public Gallery State
  const [publicMedia, setPublicMedia] = useState([]);
  const [publicLoading, setPublicLoading] = useState(false);
  const [publicError, setPublicError] = useState('');
  const [publicPlacement, setPublicPlacement] = useState('ALL');

  // Technical Handouts State (Legacy Course Assets)
  const [libraries, setLibraries] = useState([]);
  const [selectedType, setSelectedType] = useState('all');

  const loadMyMedia = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await mediaService.getMyMedia();
      const items = res?.items || res?.data?.items || (Array.isArray(res) ? res : []);
      setMyMedia(items);
    } catch (err) {
      setError(err.message || 'Failed to load your training media submissions.');
    } finally {
      setLoading(false);
    }
  };

  const loadPublicGallery = async () => {
    setPublicLoading(true);
    setPublicError('');
    try {
      const res = await mediaService.getPublicGallery();
      const items = Array.isArray(res) ? res : res?.data || [];
      setPublicMedia(items);
    } catch (err) {
      setPublicError(err.message || 'Failed to load official public gallery.');
    } finally {
      setPublicLoading(false);
    }
  };

  const loadTechnicalLibrary = async () => {
    try {
      const data = await mediaService.getMediaLibrary();
      setLibraries(data || []);
    } catch (err) {
      console.error('Failed to load technical library', err);
    }
  };

  useEffect(() => {
    loadMyMedia();
    loadTechnicalLibrary();
  }, []);

  useEffect(() => {
    if (activeTab === 'public_gallery' && publicMedia.length === 0) {
      loadPublicGallery();
    }
  }, [activeTab]);

  // Derived Metric Counters
  const totalUploads = myMedia.length;
  const pendingCount = myMedia.filter(
    (m) => m.status === 'Pending_Review' || m.status === 'Under_Review'
  ).length;
  const approvedCount = myMedia.filter(
    (m) => m.status === 'Approved' || m.status === 'Selected_For_Publication' || m.status === 'Published'
  ).length;
  const publishedCount = myMedia.filter((m) => m.status === 'Published').length;
  const changesCount = myMedia.filter((m) => m.status === 'Changes_Requested').length;

  // Filtered Student Media
  const filteredMedia = myMedia.filter((item) => {
    if (filterStatus === 'ALL') return true;
    if (filterStatus === 'Pending_Review') {
      return item.status === 'Pending_Review' || item.status === 'Under_Review';
    }
    if (filterStatus === 'Approved') {
      return item.status === 'Approved' || item.status === 'Selected_For_Publication';
    }
    return item.status === filterStatus;
  });

  // Filtered Public Media
  const filteredPublicMedia = publicMedia.filter((item) => {
    if (publicPlacement === 'ALL') return true;
    return item.publicationPlacement === publicPlacement;
  });

  const handleDeleteItem = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this submission?')) return;
    try {
      await mediaService.deleteMedia(id);
      await loadMyMedia();
    } catch (err) {
      alert(err.message || 'Failed to delete submission.');
    }
  };

  const handleDownloadAsset = (resource, isEnrolled) => {
    if (!isEnrolled) {
      alert('Access Restricted: You must be an enrolled student in this cohort to access technical course assets.');
      return;
    }
    alert(`Downloading ${resource.title} (${resource.size})...`);
  };

  return (
    <div>
      {/* Page Header */}
      <PageHeader
        title="My Media & Institutional Archive"
        subtitle="Your training moments, submitted for review and publication on official EGSA Academy channels."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'My Media' },
        ]}
        actions={
          <div className="d-flex flex-wrap gap-2">
            {isAdminOrStaff && (
              <button
                type="button"
                className="btn btn-outline-dark fw-bold d-flex align-items-center gap-2 shadow-sm"
                onClick={() => setIsAdminWorkspaceOpen(true)}
              >
                <i className="fa-solid fa-shield-halved text-warning"></i>
                <span>Admin Moderation Workspace</span>
              </button>
            )}
            <button
              type="button"
              className="btn btn-primary fw-bold d-flex align-items-center gap-2 shadow-sm"
              onClick={() => setIsUploadOpen(true)}
            >
              <i className="fa-solid fa-cloud-arrow-up"></i>
              <span>Upload Training Media</span>
            </button>
          </div>
        }
      />

      {/* Main Tab Navigation */}
      <div className="d-flex flex-wrap align-items-center justify-content-between border-bottom pb-2 mb-4 gap-2">
        <ul className="nav nav-pills gap-2">
          <li className="nav-item">
            <button
              className={`nav-link fw-semibold rounded-pill px-3 py-2 ${
                activeTab === 'my_submissions' ? 'active' : 'text-secondary'
              }`}
              onClick={() => setActiveTab('my_submissions')}
            >
              <i className="fa-solid fa-user-astronaut me-2"></i>
              My Submissions ({myMedia.length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link fw-semibold rounded-pill px-3 py-2 ${
                activeTab === 'public_gallery' ? 'active' : 'text-secondary'
              }`}
              onClick={() => setActiveTab('public_gallery')}
            >
              <i className="fa-solid fa-globe me-2"></i>
              Official Public Gallery
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link fw-semibold rounded-pill px-3 py-2 ${
                activeTab === 'technical_library' ? 'active' : 'text-secondary'
              }`}
              onClick={() => setActiveTab('technical_library')}
            >
              <i className="fa-solid fa-folder-open me-2"></i>
              Technical Handouts & Slide Archives
            </button>
          </li>
        </ul>

        <div className="text-muted small">
          <i className="fa-solid fa-camera-retro me-1"></i> Agency Photo Policy Active
        </div>
      </div>

      {/* =========================================================================
          TAB 1: MY SUBMISSIONS (CADET PERSONAL WORKSPACE)
          ========================================================================= */}
      {activeTab === 'my_submissions' && (
        <>
          {/* Summary Metric Counters */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3">
              <div className="egsa-card p-3 h-100 border-start border-4 border-primary">
                <div className="d-flex align-items-center justify-content-between text-muted small mb-1">
                  <span className="text-uppercase fw-semibold" style={{ fontSize: '0.72rem' }}>Total Uploads</span>
                  <i className="fa-solid fa-images text-primary"></i>
                </div>
                <div className="fs-3 fw-bold text-dark">{totalUploads}</div>
                <div className="text-muted small" style={{ fontSize: '0.75rem' }}>Submissions in archive</div>
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div className="egsa-card p-3 h-100 border-start border-4 border-warning">
                <div className="d-flex align-items-center justify-content-between text-muted small mb-1">
                  <span className="text-uppercase fw-semibold" style={{ fontSize: '0.72rem' }}>Pending Review</span>
                  <i className="fa-solid fa-clock text-warning"></i>
                </div>
                <div className="fs-3 fw-bold text-warning">{pendingCount}</div>
                <div className="text-muted small" style={{ fontSize: '0.75rem' }}>Awaiting Agency moderator</div>
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div className="egsa-card p-3 h-100 border-start border-4 border-success">
                <div className="d-flex align-items-center justify-content-between text-muted small mb-1">
                  <span className="text-uppercase fw-semibold" style={{ fontSize: '0.72rem' }}>Approved Media</span>
                  <i className="fa-solid fa-circle-check text-success"></i>
                </div>
                <div className="fs-3 fw-bold text-success">{approvedCount}</div>
                <div className="text-muted small" style={{ fontSize: '0.75rem' }}>Verified for Academy records</div>
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div className="egsa-card p-3 h-100 border-start border-4 border-info">
                <div className="d-flex align-items-center justify-content-between text-muted small mb-1">
                  <span className="text-uppercase fw-semibold" style={{ fontSize: '0.72rem' }}>Published to Web</span>
                  <i className="fa-solid fa-globe text-info"></i>
                </div>
                <div className="fs-3 fw-bold text-info">{publishedCount}</div>
                <div className="text-muted small" style={{ fontSize: '0.75rem' }}>Live on official website</div>
              </div>
            </div>
          </div>

          {/* Action Reminder Banner if Changes Requested */}
          {changesCount > 0 && (
            <div className="alert alert-warning d-flex align-items-center justify-content-between p-3 mb-4 rounded-3 border-0 shadow-sm">
              <div className="d-flex align-items-center gap-3">
                <i className="fa-solid fa-triangle-exclamation fa-2x text-warning"></i>
                <div>
                  <h6 className="fw-bold mb-1 text-dark">Action Required: Changes Requested on {changesCount} Submission(s)</h6>
                  <p className="mb-0 small text-secondary">
                    Academy moderators have provided specific feedback on your media. Click the submission card to review notes and upload replacement photos.
                  </p>
                </div>
              </div>
              <button
                className="btn btn-sm btn-dark px-3 fw-semibold flex-shrink-0"
                onClick={() => setFilterStatus('Changes_Requested')}
              >
                View Items
              </button>
            </div>
          )}

          {/* Filter Pills */}
          <div className="d-flex flex-wrap gap-2 mb-4 align-items-center">
            <span className="text-muted small fw-bold text-uppercase me-1" style={{ fontSize: '0.75rem' }}>
              Filter:
            </span>
            {[
              { id: 'ALL', label: 'All Submissions', count: myMedia.length },
              { id: 'Pending_Review', label: 'Pending Review', count: pendingCount },
              { id: 'Changes_Requested', label: 'Changes Requested', count: changesCount },
              { id: 'Approved', label: 'Approved', count: approvedCount },
              { id: 'Published', label: 'Published to Web', count: publishedCount },
              { id: 'Draft', label: 'Drafts', count: myMedia.filter((m) => m.status === 'Draft').length },
              { id: 'Rejected', label: 'Rejected', count: myMedia.filter((m) => m.status === 'Rejected').length },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                className={`btn btn-sm rounded-pill px-3 transition-all ${
                  filterStatus === f.id
                    ? 'btn-primary shadow-sm'
                    : 'btn-outline-secondary'
                }`}
                onClick={() => setFilterStatus(f.id)}
              >
                {f.label}{' '}
                <span className={`badge rounded-pill ms-1 ${filterStatus === f.id ? 'bg-light text-primary' : 'bg-secondary text-white'}`}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>

          {/* Loading / Error / Empty States */}
          {loading ? (
            <LoadingState label="Loading your training media submissions…" />
          ) : error ? (
            <ErrorState message={error} onRetry={loadMyMedia} />
          ) : filteredMedia.length === 0 ? (
            <EmptyState
              icon="fa-photo-film"
              title={
                filterStatus === 'ALL'
                  ? "You haven't submitted any training media yet."
                  : filterStatus === 'Approved'
                  ? 'No media has been approved yet.'
                  : filterStatus === 'Published'
                  ? 'None of your media has been published yet.'
                  : `No media found under "${filterStatus.replace('_', ' ')}".`
              }
              message="Upload high-resolution laboratory work, satellite integration moments, and field training photos from your enrolled sessions."
              actionLabel="Upload First Media"
              onAction={() => setIsUploadOpen(true)}
            />
          ) : (
            /* Editorial Media Grid */
            <div className="row g-4">
              {filteredMedia.map((item) => {
                const st = STATUS_MAP[item.status] || {
                  label: item.status,
                  bg: 'bg-secondary text-white',
                  icon: 'fa-circle',
                };

                return (
                  <div key={item._id} className="col-12 col-sm-6 col-lg-4 col-xl-3">
                    <div
                      className="egsa-card h-100 d-flex flex-column overflow-hidden transition-all shadow-sm hover-shadow cursor-pointer"
                      onClick={() => setSelectedDetailItem(item)}
                      style={{ cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease' }}
                    >
                      {/* Image Thumbnail Container */}
                      <div className="position-relative bg-dark" style={{ height: '190px', overflow: 'hidden' }}>
                        <img
                          src={item.thumbnailUrl || item.fileUrl}
                          alt={item.title}
                          className="w-100 h-100 object-fit-cover"
                          loading="lazy"
                        />

                        {/* Top-Right Status Badge */}
                        <div className="position-absolute top-0 end-0 m-2">
                          <span className={`badge ${st.bg} px-2 py-1 shadow-sm d-flex align-items-center gap-1`} style={{ fontSize: '0.72rem' }}>
                            <i className={`fa-solid ${st.icon}`}></i>
                            <span>{st.label}</span>
                          </span>
                        </div>

                        {/* Top-Left Session Date Pill */}
                        {item.session?.sessionDate && (
                          <div className="position-absolute top-0 start-0 m-2">
                            <span className="badge bg-dark bg-opacity-75 text-light px-2 py-1 small" style={{ fontSize: '0.68rem', backdropFilter: 'blur(4px)' }}>
                              <i className="fa-solid fa-calendar me-1"></i>
                              {new Date(item.session.sessionDate).toLocaleDateString()}
                            </span>
                          </div>
                        )}

                        {/* Published Indicator */}
                        {item.status === 'Published' && (
                          <div className="position-absolute bottom-0 start-0 w-100 bg-success text-white py-1 px-2 small text-center fw-bold" style={{ fontSize: '0.72rem', letterSpacing: '0.5px' }}>
                            <i className="fa-solid fa-globe me-1"></i> LIVE ON PUBLIC WEBSITE
                          </div>
                        )}
                      </div>

                      {/* Card Content Body */}
                      <div className="p-3 d-flex flex-column flex-grow-1">
                        {/* Course & Session Info */}
                        <div className="mb-2">
                          <span className="text-primary fw-semibold text-truncate d-block small" style={{ fontSize: '0.75rem' }}>
                            <i className="fa-solid fa-graduation-cap me-1"></i>
                            {item.course?.title || 'Academic Course'}
                          </span>
                          <span className="text-muted text-truncate d-block small" style={{ fontSize: '0.72rem' }}>
                            <i className="fa-solid fa-flask me-1"></i>
                            {item.session?.title || 'Lab Session'}
                          </span>
                        </div>

                        {/* Title & Caption Preview */}
                        <h6 className="fw-bold text-dark mb-1 text-truncate" title={item.title}>
                          {item.title}
                        </h6>

                        {item.caption && (
                          <p className="text-secondary small mb-3 text-truncate-2 flex-grow-1" style={{ fontSize: '0.78rem', lineHeight: '1.4' }}>
                            {item.caption}
                          </p>
                        )}

                        {/* Status Feedback Alerts */}
                        {item.status === 'Changes_Requested' && (
                          <div className="alert alert-warning py-1 px-2 mb-2 small d-flex align-items-center justify-content-between" style={{ fontSize: '0.72rem' }}>
                            <span className="text-truncate">
                              <i className="fa-solid fa-pen me-1"></i> Mod requested
                            </span>
                            <span className="fw-bold text-dark text-decoration-underline">Resubmit &rarr;</span>
                          </div>
                        )}

                        {item.status === 'Rejected' && (
                          <div className="alert alert-danger py-1 px-2 mb-2 small text-truncate" style={{ fontSize: '0.72rem' }}>
                            <i className="fa-solid fa-circle-xmark me-1"></i> {item.reviewReason || 'Rejected'}
                          </div>
                        )}

                        {/* Footer Strip */}
                        <div className="pt-2 border-top d-flex align-items-center justify-content-between text-muted small mt-auto" style={{ fontSize: '0.72rem' }}>
                          <span>
                            <i className="fa-solid fa-clock me-1"></i>
                            {new Date(item.submittedAt || item.createdAt).toLocaleDateString()}
                          </span>

                          <div className="d-flex align-items-center gap-2">
                            {['Draft', 'Rejected'].includes(item.status) && (
                              <button
                                type="button"
                                className="btn btn-link text-danger p-0"
                                title="Delete submission"
                                onClick={(e) => handleDeleteItem(e, item._id)}
                              >
                                <i className="fa-solid fa-trash-can"></i>
                              </button>
                            )}
                            <span className="text-primary fw-semibold">
                              Inspect <i className="fa-solid fa-chevron-right ms-1"></i>
                            </span>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* =========================================================================
          TAB 2: EGSA OFFICIAL PUBLIC GALLERY
          ========================================================================= */}
      {activeTab === 'public_gallery' && (
        <div>
          {/* Institutional Banner */}
          <div className="egsa-card p-4 mb-4 text-white" style={{ background: 'linear-gradient(135deg, #0e1a22 0%, #1e3a4e 100%)' }}>
            <div className="row align-items-center">
              <div className="col-lg-8">
                <span className="badge bg-warning text-dark text-uppercase fw-bold mb-2" style={{ letterSpacing: '1px' }}>
                  Institutional Showcase
                </span>
                <h4 className="fw-bold mb-2">Egyptian Space Agency &bull; Cadet Training Gallery</h4>
                <p className="text-light text-opacity-75 mb-0 small">
                  Curated moments of real aerospace training, satellite manufacturing, cleanroom integration, and antenna communications verified and authorized by Academy leadership for public release.
                </p>
              </div>
              <div className="col-lg-4 text-lg-end mt-3 mt-lg-0">
                <span className="text-warning small d-block">
                  <i className="fa-solid fa-shield-halved me-1"></i> 100% Agency Curated & Verified
                </span>
                <span className="text-secondary small">Private student identities protected</span>
              </div>
            </div>
          </div>

          {/* Placement Filter */}
          <div className="d-flex flex-wrap gap-2 mb-4">
            {[
              { id: 'ALL', label: 'All Public Showcase' },
              { id: 'general_gallery', label: 'Main Agency Gallery' },
              { id: 'homepage', label: 'Portal Homepage Features' },
              { id: 'course_gallery', label: 'Program Highlights' },
              { id: 'training_highlights', label: 'Cleanroom & Lab Highlights' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                className={`btn btn-sm rounded-pill px-3 ${publicPlacement === p.id ? 'btn-primary' : 'btn-outline-secondary'}`}
                onClick={() => setPublicPlacement(p.id)}
              >
                {p.label}
              </button>
            ))}
          </div>

          {publicLoading ? (
            <LoadingState label="Loading official public gallery…" />
          ) : publicError ? (
            <ErrorState message={publicError} onRetry={loadPublicGallery} />
          ) : filteredPublicMedia.length === 0 ? (
            <EmptyState
              icon="fa-globe"
              title="No media in public gallery yet"
              message="Approved cadet training photos that have been selected and published by the Academy will be showcased here."
            />
          ) : (
            <div className="row g-4">
              {filteredPublicMedia.map((item) => (
                <div key={item._id} className="col-12 col-sm-6 col-lg-4">
                  <div className="egsa-card h-100 overflow-hidden shadow-sm d-flex flex-column">
                    <div className="position-relative bg-dark" style={{ height: '220px' }}>
                      <img
                        src={item.fileUrl}
                        alt={item.title}
                        className="w-100 h-100 object-fit-cover"
                        loading="lazy"
                      />
                      <div className="position-absolute top-0 end-0 m-2">
                        <span className="badge bg-success px-2 py-1 small">
                          <i className="fa-solid fa-globe me-1"></i> Published
                        </span>
                      </div>
                      <div className="position-absolute bottom-0 start-0 m-2">
                        <span className="badge bg-dark bg-opacity-75 text-light px-2 py-1 small" style={{ fontSize: '0.72rem' }}>
                          {item.courseTitle || 'EGSA Space Academy'}
                        </span>
                      </div>
                    </div>
                    <div className="p-3 d-flex flex-column flex-grow-1">
                      <h6 className="fw-bold text-dark mb-1">{item.title}</h6>
                      {item.caption && (
                        <p className="text-secondary small mb-3 flex-grow-1" style={{ fontSize: '0.8rem' }}>
                          {item.caption}
                        </p>
                      )}
                      <div className="pt-2 border-top d-flex justify-content-between text-muted small" style={{ fontSize: '0.72rem' }}>
                        <span>
                          <i className="fa-solid fa-calendar me-1"></i>
                          {new Date(item.publishedAt || item.createdAt).toLocaleDateString()}
                        </span>
                        <span className="text-primary">
                          <i className="fa-solid fa-award me-1"></i> Official EGSA Release
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: TECHNICAL HANDOUTS & SLIDE REPOSITORIES (LEGACY ASSETS PRESERVED)
          ========================================================================= */}
      {activeTab === 'technical_library' && (
        <div>
          {/* Filter Chips by File Type */}
          <div className="d-flex flex-wrap gap-2 mb-4">
            <button
              className={`btn btn-sm rounded-pill px-3 ${selectedType === 'all' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setSelectedType('all')}
            >
              All Resources
            </button>
            <button
              className={`btn btn-sm rounded-pill px-3 ${selectedType === 'pdf' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setSelectedType('pdf')}
            >
              <i className="fa-solid fa-file-pdf me-1 text-danger"></i> Lecture Slides & PDF Handouts
            </button>
            <button
              className={`btn btn-sm rounded-pill px-3 ${selectedType === 'video' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setSelectedType('video')}
            >
              <i className="fa-solid fa-file-video me-1 text-primary"></i> Recorded Video Sessions
            </button>
            <button
              className={`btn btn-sm rounded-pill px-3 ${selectedType === 'archive' ? 'btn-primary' : 'btn-outline-secondary'}`}
              onClick={() => setSelectedType('archive')}
            >
              <i className="fa-solid fa-file-zipper me-1 text-warning"></i> Lab Telemetry Datasets
            </button>
          </div>

          {libraries.length === 0 ? (
            <EmptyState
              icon="fa-folder-open"
              title="No technical handouts found"
              message="Course slides, recorded lectures, and lab packages are unlocked upon enrollment in an active course."
            />
          ) : (
            <div className="d-flex flex-column gap-4">
              {libraries.map((courseLib, cIdx) => (
                <div className="egsa-card p-4" key={cIdx}>
                  <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-2 mb-3 pb-3 border-bottom">
                    <div>
                      <span className="badge bg-primary mb-1">{courseLib.track}</span>
                      <h4 className="fw-bold text-dark mb-0">{courseLib.courseTitle}</h4>
                    </div>
                    <div>
                      {courseLib.isEnrolled ? (
                        <span className="badge bg-success px-3 py-2">
                          <i className="fa-solid fa-lock-open me-1"></i> Enrolled — Full Access
                        </span>
                      ) : (
                        <span className="badge bg-secondary px-3 py-2">
                          <i className="fa-solid fa-lock me-1"></i> Locked — Enrolled Students Only
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="row g-3">
                    {courseLib.resources
                      .filter((r) => selectedType === 'all' || r.type === selectedType)
                      .map((res, rIdx) => (
                        <div className="col-12 col-md-6 col-lg-4" key={rIdx}>
                          <div className="border rounded-3 p-3 bg-light d-flex align-items-center justify-content-between gap-3">
                            <div className="d-flex align-items-center gap-3 overflow-hidden">
                              <div
                                className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0"
                                style={{ width: '40px', height: '40px', backgroundColor: 'rgba(58, 105, 133, 0.1)' }}
                              >
                                {res.type === 'pdf' && <i className="fa-solid fa-file-pdf text-danger fa-lg"></i>}
                                {res.type === 'video' && <i className="fa-solid fa-file-video text-primary fa-lg"></i>}
                                {res.type === 'archive' && <i className="fa-solid fa-file-zipper text-warning fa-lg"></i>}
                              </div>
                              <div className="overflow-hidden">
                                <h6 className="fw-bold text-dark mb-0 text-truncate" title={res.title}>
                                  {res.title}
                                </h6>
                                <span className="text-muted small" style={{ fontSize: '0.75rem' }}>
                                  {res.size} &bull; {res.updatedAt}
                                </span>
                              </div>
                            </div>

                            <button
                              type="button"
                              className={`btn btn-sm ${courseLib.isEnrolled ? 'btn-primary' : 'btn-outline-secondary'}`}
                              onClick={() => handleDownloadAsset(res, courseLib.isEnrolled)}
                            >
                              <i className="fa-solid fa-download"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODALS INTEGRATION
          ========================================================================= */}
      
      {/* 1. Student Upload Modal */}
      <UploadMediaModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => {
          loadMyMedia();
          setActiveTab('my_submissions');
        }}
      />

      {/* 2. Media Details & Lightbox Modal */}
      <MediaDetailsModal
        isOpen={Boolean(selectedDetailItem)}
        onClose={() => setSelectedDetailItem(null)}
        mediaItem={selectedDetailItem}
        onRefreshData={() => {
          loadMyMedia();
          setSelectedDetailItem(null);
        }}
      />

      {/* 3. Admin Moderation & Editorial Workspace Modal */}
      {isAdminOrStaff && (
        <AdminMediaReviewModal
          isOpen={isAdminWorkspaceOpen}
          onClose={() => setIsAdminWorkspaceOpen(false)}
          onRefreshData={() => {
            loadMyMedia();
            if (activeTab === 'public_gallery') loadPublicGallery();
          }}
        />
      )}

    </div>
  );
}
