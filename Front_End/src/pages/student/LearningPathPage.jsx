import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { learningPathService } from '../../services/studentService';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';

export default function LearningPathPage() {
  const [path, setPath] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    learningPathService
      .recommended()
      .then((res) => setPath(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load learning path.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  if (loading) return <LoadingState label="Loading your recommended Space Academy learning path…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Recommended Learning Path"
        subtitle="Step-by-step curriculum designed to take you from foundational concepts to advanced space engineering."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Learning Path' },
        ]}
        actions={
          <Link to="/student/goal" className="btn btn-outline-primary btn-sm">
            <i className="fa-solid fa-bullseye me-1"></i> Change Goal
          </Link>
        }
      />

      {!path ? (
        <EmptyState
          icon="fa-route"
          title="No learning path mapped yet"
          message="Select a learning goal to have our recommendation engine map out your complete progression roadmap."
          actionLabel="Choose Specialization Goal"
          actionLink="/student/goal"
        />
      ) : (
        <div className="row g-4">
          <div className="col-lg-8">
            <div className="egsa-card p-4 mb-4">
              <span className="badge bg-primary-egsa mb-2">Track Pathway</span>
              <h4 className="fw-bold text-dark mb-1">{path.title}</h4>
              <p className="text-muted small mb-4">{path.description}</p>

              <h6 className="fw-bold text-secondary-egsa mb-3">Recommended Course Progression Sequence:</h6>

              <div className="ps-2">
                {path.courses
                  ?.slice()
                  .sort((a, b) => a.order - b.order)
                  .map((item, idx) => {
                    const isFirst = idx === 0;
                    const course = item.course || {};
                    return (
                      <div key={course._id || idx}>
                        <div className="path-node mb-2 align-items-start">
                          <div className={`dot mt-1 ${isFirst ? 'current' : 'upcoming'}`}>
                            {isFirst ? <i className="fa-solid fa-play small"></i> : idx + 1}
                          </div>
                          <div className="flex-grow-1 p-3 border rounded bg-light-subtle">
                            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-1">
                              <h6 className="fw-bold text-dark mb-0">{course.title}</h6>
                              <span className="badge bg-secondary-egsa small">{course.level}</span>
                            </div>
                            <p className="text-muted small mb-2">{course.shortDescription || 'Core specialization course.'}</p>
                            <div className="d-flex gap-2">
                              <Link to={`/student/courses/${course._id}`} className="btn btn-outline-primary btn-sm">
                                View Course
                              </Link>
                              {course.price != null && (
                                <Link to={`/student/courses/${course._id}/fit`} className="btn btn-primary btn-sm">
                                  Check Fit & Apply
                                </Link>
                              )}
                            </div>
                          </div>
                        </div>
                        {idx < path.courses.length - 1 && <div className="path-connector my-1"></div>}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="col-lg-4">
            <div className="egsa-card p-4">
              <h6 className="fw-bold text-dark mb-2">About Learning Paths</h6>
              <p className="text-muted small mb-3">
                Learning paths ensure prerequisite compliance and avoid registration blocks for advanced level 3 and 4 courses.
              </p>
              {path.recommendedStartingCourse && (
                <div className="p-3 bg-light rounded border mb-3">
                  <small className="text-muted d-block mb-1">Recommended Starting Step:</small>
                  <strong className="text-dark d-block mb-2">{path.recommendedStartingCourse.title}</strong>
                  <Link
                    to={`/student/courses/${path.recommendedStartingCourse._id}`}
                    className="btn btn-primary btn-sm w-100"
                  >
                    Start Program
                  </Link>
                </div>
              )}
              <Link to="/student/programs" className="btn btn-outline-secondary btn-sm w-100">
                Browse Complete Catalog
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
