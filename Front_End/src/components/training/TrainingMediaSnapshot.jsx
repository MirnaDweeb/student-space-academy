import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { mediaService } from '../../services/studentPortalServices';
import UploadMediaModal from '../media/UploadMediaModal';

export default function TrainingMediaSnapshot({ course, enrollment }) {
  const [courseMedia, setCourseMedia] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);

  const loadMedia = async () => {
    if (!course?._id) return;
    setLoading(true);
    try {
      const res = await mediaService.getMyMedia();
      const all = res?.items || res?.data?.items || (Array.isArray(res) ? res : []);
      // Filter media belonging to this course
      const filtered = all.filter(
        (m) => m.course?._id === course._id || m.course === course._id
      );
      setCourseMedia(filtered);
    } catch (err) {
      console.error('Failed to load training media for course', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMedia();
  }, [course?._id]);

  const submittedCount = courseMedia.length;
  const approvedCount = courseMedia.filter(
    (m) => m.status === 'Approved' || m.status === 'Selected_For_Publication' || m.status === 'Published'
  ).length;
  const publishedCount = courseMedia.filter((m) => m.status === 'Published').length;

  return (
    <div className="egsa-card p-4 mb-4">
      <div className="d-flex align-items-center justify-content-between mb-3 pb-2 border-bottom">
        <div className="d-flex align-items-center gap-2">
          <i className="fa-solid fa-camera-retro text-primary"></i>
          <h6 className="fw-bold text-dark mb-0 text-uppercase" style={{ letterSpacing: '0.5px', fontSize: '0.85rem' }}>
            Training Media Submissions
          </h6>
        </div>
        <Link to="/student/media" className="btn btn-xs btn-outline-primary fw-semibold" style={{ fontSize: '0.75rem' }}>
          Open My Media &rarr;
        </Link>
      </div>

      {/* Metrics Row */}
      <div className="row g-2 mb-3 text-center">
        <div className="col-4">
          <div className="bg-light p-2 rounded-3 border">
            <span className="text-muted d-block small" style={{ fontSize: '0.68rem' }}>SUBMITTED</span>
            <strong className="text-dark fs-6">{submittedCount}</strong>
          </div>
        </div>
        <div className="col-4">
          <div className="bg-light p-2 rounded-3 border">
            <span className="text-muted d-block small" style={{ fontSize: '0.68rem' }}>APPROVED</span>
            <strong className="text-success fs-6">{approvedCount}</strong>
          </div>
        </div>
        <div className="col-4">
          <div className="bg-light p-2 rounded-3 border">
            <span className="text-muted d-block small" style={{ fontSize: '0.68rem' }}>PUBLISHED</span>
            <strong className="text-info fs-6">{publishedCount}</strong>
          </div>
        </div>
      </div>

      {/* Media Thumbnails Preview Strip */}
      {courseMedia.length > 0 ? (
        <div className="mb-3">
          <span className="text-muted small d-block mb-2" style={{ fontSize: '0.72rem' }}>
            Recent Lab & Field Photos:
          </span>
          <div className="d-flex gap-2 overflow-auto pb-1">
            {courseMedia.slice(0, 4).map((m) => (
              <div
                key={m._id}
                className="position-relative rounded overflow-hidden flex-shrink-0 border"
                style={{ width: '64px', height: '64px', backgroundColor: '#0e1a22' }}
              >
                <img
                  src={m.thumbnailUrl || m.fileUrl}
                  alt={m.title}
                  className="w-100 h-100 object-fit-cover"
                />
                {m.status === 'Published' && (
                  <span className="position-absolute bottom-0 end-0 bg-success p-1 rounded-circle m-1" title="Published"></span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-muted small mb-3" style={{ fontSize: '0.78rem' }}>
          Document your cleanroom labs, antenna calibration, and circuit soldering sessions. Submit photos for official review.
        </p>
      )}

      {/* Action CTA */}
      <button
        type="button"
        className="btn btn-outline-primary btn-sm w-100 fw-semibold d-flex align-items-center justify-content-center gap-2"
        onClick={() => setIsUploadOpen(true)}
      >
        <i className="fa-solid fa-cloud-arrow-up"></i>
        <span>Upload Session Photos</span>
      </button>

      {/* Upload Modal */}
      <UploadMediaModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUploadSuccess={() => {
          loadMedia();
        }}
      />
    </div>
  );
}
