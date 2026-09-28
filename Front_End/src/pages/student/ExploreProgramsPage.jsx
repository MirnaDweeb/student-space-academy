import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { courseService } from '../../services/courseService';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';

const TRACK_CATEGORIES = [
  'All Tracks',
  'Space Technologies',
  'Advanced Technologies',
  'Cybersecurity',
  'Remote Sensing & Geospatial Analytics',
  'Electronics & Technology Manufacturing',
  'Environment & Space Weather',
  'Robotics & Autonomous Systems',
  'Technology Entrepreneurship',
  'Project & Program Management',
];

export default function ExploreProgramsPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected quick details modal course
  const [selectedCourse, setSelectedCourse] = useState(null);

  // Filters
  const [selectedTrack, setSelectedTrack] = useState('All Tracks');
  const [selectedLevel, setSelectedLevel] = useState('');
  const [selectedMode, setSelectedMode] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('');

  const loadCourses = () => {
    setLoading(true);
    setError('');

    const params = {};
    if (selectedTrack !== 'All Tracks') params.category = selectedTrack;
    if (selectedLevel) params.level = selectedLevel;
    if (selectedMode) params.deliveryMode = selectedMode;
    if (searchQuery.trim()) params.q = searchQuery.trim();
    if (sortBy) params.sort = sortBy;

    courseService
      .list(params)
      .then((res) => setCourses(res.data || []))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load courses.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadCourses();
  }, [selectedTrack, selectedLevel, selectedMode, sortBy]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    loadCourses();
  };

  const handleResetFilters = () => {
    setSelectedTrack('All Tracks');
    setSelectedLevel('');
    setSelectedMode('');
    setSearchQuery('');
    setSortBy('');
  };

  return (
    <div>
      <PageHeader
        title="Explore Space Programs & Courses"
        subtitle="Discover accredited training tracks across Space Systems, Satellite Engineering, AI, and Mission Operations."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Explore Programs' },
        ]}
      />

      {/* Track Selector Pills */}
      <div className="mb-4 overflow-auto pb-2" style={{ whiteSpace: 'nowrap' }}>
        <div className="d-inline-flex gap-2">
          {TRACK_CATEGORIES.map((track) => (
            <button
              key={track}
              type="button"
              className={`btn btn-sm rounded-pill px-3 ${
                selectedTrack === track ? 'btn-primary' : 'btn-outline-secondary'
              }`}
              onClick={() => setSelectedTrack(track)}
            >
              {track}
            </button>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="egsa-card mb-4 p-3">
        <form onSubmit={handleSearchSubmit} className="row g-2 align-items-center">
          <div className="col-md-4">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0 text-muted">
                <i className="fa-solid fa-magnifying-glass"></i>
              </span>
              <input
                type="text"
                className="form-control border-start-0 ps-0"
                placeholder="Search by title, topic or keyword…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          <div className="col-sm-6 col-md-3">
            <select
              className="form-select"
              value={selectedLevel}
              onChange={(e) => setSelectedLevel(e.target.value)}
            >
              <option value="">All Level Tiers</option>
              <option value="Awareness / Fundamentals">Level 1: Awareness & Fundamentals</option>
              <option value="Core Skills">Level 2: Core Engineering Skills</option>
              <option value="Specialization/Integration/Applications">Level 3: Specialization & Integration</option>
              <option value="Professional/Industry">Level 4: Professional & Industry</option>
            </select>
          </div>

          <div className="col-sm-6 col-md-2">
            <select
              className="form-select"
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
            >
              <option value="">All Delivery Modes</option>
              <option value="Onsite">Onsite (EGSA Labs)</option>
              <option value="Online">Online</option>
              <option value="Hybrid">Hybrid</option>
            </select>
          </div>

          <div className="col-sm-6 col-md-2">
            <select
              className="form-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="">Sort By</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="newest">Recently Added</option>
            </select>
          </div>

          <div className="col-sm-6 col-md-1 d-flex gap-1">
            <button type="submit" className="btn btn-primary w-100" title="Search">
              <i className="fa-solid fa-filter"></i>
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={handleResetFilters}
              title="Reset Filters"
            >
              <i className="fa-solid fa-rotate-left"></i>
            </button>
          </div>
        </form>
      </div>

      {/* Results Header */}
      {!loading && !error && (
        <div className="d-flex justify-content-between align-items-center mb-3">
          <p className="text-muted small mb-0">
            Showing <strong className="text-dark">{courses.length}</strong> accredited programs
            {selectedTrack !== 'All Tracks' && ` in ${selectedTrack}`}
          </p>
        </div>
      )}

      {/* State Renderers */}
      {loading && <LoadingState label="Loading Space Academy catalog…" />}
      {!loading && error && <ErrorState message={error} onRetry={loadCourses} />}
      {!loading && !error && courses.length === 0 && (
        <EmptyState
          icon="fa-satellite"
          title="No programs match your filters"
          message="Try selecting another track or broadening your search criteria."
          actionLabel="Clear All Filters"
          onAction={handleResetFilters}
        />
      )}

      {/* Courses Grid */}
      {!loading && !error && courses.length > 0 && (
        <div className="row g-4">
          {courses.map((course) => (
            <div className="col-md-6 col-lg-4" key={course._id}>
              <div className="egsa-card h-100 d-flex flex-column justify-content-between p-3 position-relative">
                {/* Header: Track & Level */}
                <div>
                  <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                    <span className="badge bg-light text-primary-egsa border border-primary-subtle fw-semibold">
                      {course.category}
                    </span>
                    <span className="badge bg-secondary-egsa small">{course.level}</span>
                  </div>

                  <h5 className="fw-bold text-dark mb-1 text-truncate-2" title={course.title}>
                    {course.title}
                  </h5>
                  {course.tagline && (
                    <p className="text-secondary-egsa small fw-semibold mb-2 text-truncate" title={course.tagline}>
                      {course.tagline}
                    </p>
                  )}

                  <p className="text-muted small mb-3 text-truncate-3" style={{ minHeight: '3.6em' }}>
                    {course.shortDescription ||
                      course.overview ||
                      'Comprehensive practical curriculum designed by Egyptian Space Agency engineers.'}
                  </p>

                  {/* Attributes List */}
                  <ul className="list-unstyled small text-muted mb-3 d-flex flex-column gap-1">
                    <li className="d-flex align-items-center gap-2">
                      <i className="fa-regular fa-clock text-primary-egsa" style={{ width: '16px' }}></i>
                      <span>
                        {course.duration != null
                          ? `${course.duration} ${course.durationUnit || 'Days'}`
                          : 'Duration TBA'}
                        {course.hoursPerDay ? ` · ${course.hoursPerDay}` : ''}
                      </span>
                    </li>
                    <li className="d-flex align-items-center gap-2">
                      <i className="fa-solid fa-location-dot text-primary-egsa" style={{ width: '16px' }}></i>
                      <span>{course.deliveryMode} — {course.location || 'EGSA Cairo'}</span>
                    </li>
                    {course.startDate && (
                      <li className="d-flex align-items-center gap-2">
                        <i className="fa-regular fa-calendar text-primary-egsa" style={{ width: '16px' }}></i>
                        <span>Starts {new Date(course.startDate).toLocaleDateString()}</span>
                      </li>
                    )}
                    <li className="d-flex align-items-center gap-2">
                      <i className="fa-solid fa-users text-primary-egsa" style={{ width: '16px' }}></i>
                      <span>
                        {course.capacity != null
                          ? `${course.availableSeats ?? course.capacity} seats available`
                          : 'Capacity: Open'}
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Bottom Actions and Pricing */}
                <div className="pt-3 border-top mt-2">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <span className="text-muted small">Tuition</span>
                    <span className="fw-bold text-accent-egsa fs-5">
                      {course.price != null ? `${course.price} ${course.currency || 'EGP'}` : 'Pricing TBA'}
                    </span>
                  </div>

                  <div className="d-flex gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary btn-sm flex-grow-1"
                      onClick={() => setSelectedCourse(course)}
                    >
                      <i className="fa-solid fa-circle-info me-1"></i> Quick View
                    </button>

                    <Link
                      to={`/student/courses/${course._id}`}
                      className="btn btn-outline-secondary btn-sm"
                      title="Full Course Page"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square"></i>
                    </Link>

                    {course.price != null ? (
                      <Link
                        to={`/student/courses/${course._id}/fit`}
                        className="btn btn-primary btn-sm flex-grow-1"
                      >
                        Check Fit
                      </Link>
                    ) : (
                      <button
                        className="btn btn-secondary btn-sm flex-grow-1"
                        disabled
                        title="Applications open once pricing is officially published."
                      >
                        Coming Soon
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick View Details Modal */}
      {selectedCourse && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content shadow border-0" style={{ borderRadius: 'var(--radius-md)' }}>
              <div className="modal-header bg-light">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="badge bg-primary-egsa">{selectedCourse.category}</span>
                    {selectedCourse.titleAr && (
                      <span className="badge bg-light text-dark border">{selectedCourse.titleAr}</span>
                    )}
                  </div>
                  <h5 className="modal-title fw-bold text-dark">{selectedCourse.title}</h5>
                  {selectedCourse.tagline && (
                    <small className="text-secondary-egsa fw-semibold d-block mt-1">
                      {selectedCourse.tagline}
                    </small>
                  )}
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setSelectedCourse(null)}
                  aria-label="Close"
                ></button>
              </div>

              <div className="modal-body p-4">
                <div className="row g-3 mb-4">
                  <div className="col-sm-6 col-md-3">
                    <div className="p-2 border rounded text-center bg-light">
                      <small className="text-muted d-block">Level Tier</small>
                      <strong className="text-dark small">{selectedCourse.level}</strong>
                    </div>
                  </div>
                  <div className="col-sm-6 col-md-3">
                    <div className="p-2 border rounded text-center bg-light">
                      <small className="text-muted d-block">Duration</small>
                      <strong className="text-dark small">
                        {selectedCourse.duration ? `${selectedCourse.duration} ${selectedCourse.durationUnit}` : 'TBA'}
                        {selectedCourse.hoursPerDay ? ` (${selectedCourse.hoursPerDay})` : ''}
                      </strong>
                    </div>
                  </div>
                  <div className="col-sm-6 col-md-3">
                    <div className="p-2 border rounded text-center bg-light">
                      <small className="text-muted d-block">Delivery Mode</small>
                      <strong className="text-dark small">{selectedCourse.deliveryMode}</strong>
                    </div>
                  </div>
                  <div className="col-sm-6 col-md-3">
                    <div className="p-2 border rounded text-center bg-light">
                      <small className="text-muted d-block">Tuition</small>
                      <strong className="text-accent-egsa small">
                        {selectedCourse.price != null ? `${selectedCourse.price} EGP` : 'Pricing TBA'}
                      </strong>
                    </div>
                  </div>
                </div>

                <h6 className="fw-bold text-secondary-egsa mb-2">Program Overview</h6>
                <p className="text-muted small mb-3">
                  {selectedCourse.overview || selectedCourse.shortDescription || 'No overview provided.'}
                </p>

                {selectedCourse.whyThisCourse && (
                  <>
                    <h6 className="fw-bold text-secondary-egsa mb-2">Purpose & What You Will Achieve</h6>
                    <p className="text-muted small mb-3">{selectedCourse.whyThisCourse}</p>
                  </>
                )}

                {selectedCourse.whoIsItFor && (
                  <>
                    <h6 className="fw-bold text-secondary-egsa mb-2">Target Audience & Prerequisites</h6>
                    <p className="text-muted small mb-3">{selectedCourse.whoIsItFor}</p>
                  </>
                )}

                {selectedCourse.learningObjectives?.length > 0 && (
                  <>
                    <h6 className="fw-bold text-secondary-egsa mb-2">Learning Objectives</h6>
                    <ul className="small text-muted mb-3">
                      {selectedCourse.learningObjectives.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </>
                )}

                {selectedCourse.modules?.length > 0 ? (
                  <>
                    <h6 className="fw-bold text-secondary-egsa mb-2">
                      Course Structure ({selectedCourse.modules.length} Days)
                    </h6>
                    <div className="d-flex flex-column gap-2 mb-3">
                      {selectedCourse.modules.map((m, idx) => (
                        <div key={idx} className="p-2 border rounded bg-light-subtle small">
                          <div className="d-flex justify-content-between align-items-center">
                            <strong className="text-dark">{m.title || `Day ${m.day}`}</strong>
                            {m.focus && <span className="badge bg-secondary-egsa">{m.focus}</span>}
                          </div>
                          {m.activities?.length > 0 && (
                            <div className="text-muted ps-2 mt-1 border-start border-2 border-primary-subtle">
                              {m.activities.join(' · ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </>
                ) : selectedCourse.syllabus?.length > 0 ? (
                  <>
                    <h6 className="fw-bold text-secondary-egsa mb-2">Syllabus & Core Modules</h6>
                    <ul className="small text-muted mb-3">
                      {selectedCourse.syllabus.map((s, idx) => (
                        <li key={idx}>{s}</li>
                      ))}
                    </ul>
                  </>
                ) : null}

                {selectedCourse.handsOnTools?.softwareTools?.length > 0 && (
                  <div className="mb-3">
                    <h6 className="fw-bold text-secondary-egsa mb-2">Software Tools & Platforms</h6>
                    <div className="d-flex flex-wrap gap-1">
                      {selectedCourse.handsOnTools.softwareTools.map((t, idx) => (
                        <span key={idx} className="badge bg-light text-dark border">{t}</span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedCourse.certificationDetails?.certificateType && (
                  <div className="p-2 border rounded bg-success-subtle text-success-emphasis small">
                    <i className="fa-solid fa-certificate me-1"></i>
                    Awarded: <strong>{selectedCourse.certificationDetails.certificateType}</strong> upon completion
                  </div>
                )}
              </div>

              <div className="modal-footer bg-light">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => setSelectedCourse(null)}
                >
                  Close
                </button>
                <Link
                  to={`/student/courses/${selectedCourse._id}`}
                  className="btn btn-outline-primary btn-sm"
                >
                  Full Details Page
                </Link>
                {selectedCourse.price != null && (
                  <Link
                    to={`/student/courses/${selectedCourse._id}/fit`}
                    className="btn btn-primary btn-sm"
                  >
                    Check My Fit & Apply
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
