import React, { useEffect, useState } from 'react';
import { mediaService } from '../../services/studentPortalServices';
import AdminMediaReviewModal from '../../components/media/AdminMediaReviewModal.jsx';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';

export default function AdminMediaPage() {
  const [mediaItems, setMediaItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [isModerationModalOpen, setIsModerationModalOpen] = useState(false);

  const loadMedia = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await mediaService.getAdminMedia({
        status: filterStatus === 'ALL' ? undefined : filterStatus,
      });
      const data = res.items || res.data?.items || (Array.isArray(res) ? res : []);
      setMediaItems(data);
    } catch (err) {
      setError(err.message || 'Failed to load media moderation queue.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, [filterStatus]);

  if (loading) return <LoadingState label="Loading institutional media queue..." />;

  const pendingCount = mediaItems.filter((m) => m.status === 'Pending_Review' || m.status === 'Under_Review').length;
  const approvedCount = mediaItems.filter((m) => m.status === 'Approved' || m.status === 'Selected_For_Publication' || m.status === 'Published').length;

  return (
    <div className="container-fluid py-4 px-md-5">
      <PageHeader
        title="Training Media Moderation"
        subtitle="Review student-submitted training photography, laboratory work, approve for official gallery publication, and curate institutional media."
        breadcrumbs={[
          { label: 'Admin Command', to: '/admin/dashboard' },
          { label: 'Media Moderation' },
        ]}
        actions={
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={loadMedia}>
              <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setIsModerationModalOpen(true)}
            >
              <i className="fa-solid fa-photo-film me-1"></i> Open Moderation Tool
            </button>
          </div>
        }
      />

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="fa-solid fa-triangle-exclamation me-2"></i> {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4 pb-2 border-bottom">
        <ul className="nav nav-pills">
          {['ALL', 'Pending_Review', 'Approved', 'Changes_Requested', 'Rejected', 'Published'].map((st) => (
            <li key={st} className="nav-item">
              <button
                className={`nav-link small py-1 px-3 ${filterStatus === st ? 'active bg-primary-egsa' : 'text-dark'}`}
                onClick={() => setFilterStatus(st)}
              >
                {st === 'ALL' ? 'All Media' : st.replace('_', ' ')}
              </button>
            </li>
          ))}
        </ul>

        <div className="small text-muted">
          Showing <strong>{mediaItems.length}</strong> items ({pendingCount} pending review)
        </div>
      </div>

      {mediaItems.length === 0 ? (
        <EmptyState
          icon="fa-images"
          title="No Media In This Queue"
          message="There are no student training submissions matching the selected status filter."
        />
      ) : (
        <div className="row g-4">
          {mediaItems.map((item) => (
            <div key={item._id} className="col-sm-6 col-md-4 col-xl-3">
              <div className="egsa-card p-2 shadow-sm h-100 d-flex flex-column justify-content-between">
                <div>
                  <div className="position-relative mb-2 rounded overflow-hidden bg-dark text-center" style={{ height: 160 }}>
                    {item.fileUrl ? (
                      <img
                        src={item.fileUrl}
                        alt={item.title || 'Training Media'}
                        className="w-100 h-100 object-fit-cover"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = '/vite.svg';
                        }}
                      />
                    ) : (
                      <div className="d-flex align-items-center justify-content-center h-100 text-muted">
                        <i className="fa-solid fa-image fa-3x"></i>
                      </div>
                    )}
                    <span
                      className={`badge position-absolute top-0 end-0 m-2 ${
                        item.status === 'Approved' || item.status === 'Published'
                          ? 'bg-success'
                          : item.status === 'Rejected'
                          ? 'bg-danger'
                          : 'bg-warning text-dark'
                      }`}
                    >
                      {item.status?.replace('_', ' ')}
                    </span>
                  </div>

                  <div className="d-flex align-items-center gap-1 mb-1">
                    <span className="badge bg-secondary-subtle text-secondary small" style={{ fontSize: '0.7rem' }}>
                      {item.category || 'Project'}
                    </span>
                    <h6 className="fw-bold text-dark text-truncate mb-0 flex-grow-1" title={item.title}>
                      {item.title || 'Untitled Training Photo'}
                    </h6>
                  </div>
                  <p className="text-muted small mb-1 text-truncate" title={item.caption}>
                    {item.caption || item.description || 'No caption provided'}
                  </p>
                  <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                    <div>By: <strong>{item.student?.fullName || 'Student'}</strong></div>
                    <div className="text-truncate">{item.course?.title || 'Course'} · {item.cohort?.name || 'Cohort'}</div>
                  </div>
                </div>

                <div className="pt-2 border-top mt-2">
                  <button
                    className="btn btn-outline-primary btn-sm w-100"
                    onClick={() => setIsModerationModalOpen(true)}
                  >
                    <i className="fa-solid fa-gavel me-1"></i> Moderate
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Embedded Admin Media Review Modal */}
      <AdminMediaReviewModal
        isOpen={isModerationModalOpen}
        onClose={() => setIsModerationModalOpen(false)}
        onRefreshData={loadMedia}
      />
    </div>
  );
}
