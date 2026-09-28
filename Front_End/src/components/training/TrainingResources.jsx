import React from 'react';
import { Link } from 'react-router-dom';

export default function TrainingResources({ course }) {
  if (!course) return null;

  const trainingMaterials = course.courseMaterials?.trainingMaterials || [];
  const digitalResources = course.courseMaterials?.digitalResources || [];
  const softwareTools = course.handsOnTools?.softwareTools || [];

  const hasAnyResources = trainingMaterials.length > 0 || digitalResources.length > 0 || softwareTools.length > 0;

  return (
    <div className="egsa-card p-4 mb-4">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
          <i className="fa-solid fa-photo-film text-primary-egsa"></i>
          Authorized Training Materials & Tools
        </h6>
        <Link to="/student/media" className="small text-decoration-none">
          Full Media Library <i className="fa-solid fa-chevron-right small"></i>
        </Link>
      </div>

      {hasAnyResources ? (
        <div className="d-flex flex-column gap-2 mb-3">
          {trainingMaterials.map((mat, idx) => (
            <div key={`tm-${idx}`} className="p-2 border rounded bg-white small d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2 text-dark">
                <i className="fa-regular fa-file-pdf text-danger fs-6"></i>
                <span className="fw-medium">{mat}</span>
              </div>
              <span className="badge bg-light text-muted border">Authorized</span>
            </div>
          ))}

          {digitalResources.map((res, idx) => (
            <div key={`dr-${idx}`} className="p-2 border rounded bg-white small d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2 text-dark">
                <i className="fa-solid fa-file-code text-primary-egsa fs-6"></i>
                <span className="fw-medium">{res}</span>
              </div>
              <span className="badge bg-light text-muted border">Dataset / Code</span>
            </div>
          ))}

          {softwareTools.map((tool, idx) => (
            <div key={`st-${idx}`} className="p-2 border rounded bg-light-subtle small d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2 text-dark">
                <i className="fa-solid fa-laptop-code text-secondary-egsa fs-6"></i>
                <span>{tool}</span>
              </div>
              <span className="badge bg-secondary-subtle text-secondary small">Lab Platform</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-muted small mb-3">
          Course slides, lecture recordings, and laboratory materials will be activated by the instructor during sessions.
        </p>
      )}

      <div className="d-grid">
        <Link to="/student/media" className="btn btn-outline-secondary btn-sm">
          <i className="fa-solid fa-folder-open me-1"></i> Access Media & Documents
        </Link>
      </div>
    </div>
  );
}
