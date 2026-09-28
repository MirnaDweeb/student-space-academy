import React, { useEffect, useState } from 'react';
import { courseService } from '../../services/courseService';
import CourseCard from '../../components/CourseCard.jsx';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';

export default function CourseCatalogPage() {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: '', level: '', deliveryMode: '', sort: '' });

  const load = () => {
    setLoading(true);
    setError('');
    const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
    courseService
      .list(params)
      .then((res) => setCourses(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load courses.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterSubmit = (e) => {
    e.preventDefault();
    load();
  };

  return (
    <div>
      <PageHeader
        title="Course Catalog"
        subtitle="Search and filter through the Egyptian Space Agency's curriculum."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Explore Programs', to: '/student/programs' },
          { label: 'Course Catalog' },
        ]}
      />
      <form className="row g-2 mb-4" onSubmit={handleFilterSubmit}>
        <div className="col-md-4">
          <input
            className="form-control"
            placeholder="Search courses…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
        <div className="col-md-3">
          <select
            className="form-select"
            value={filters.level}
            onChange={(e) => setFilters((f) => ({ ...f, level: e.target.value }))}
          >
            <option value="">All Levels</option>
            <option value="Awareness / Fundamentals">Level 1 — Awareness / Fundamentals</option>
            <option value="Core Skills">Level 2 — Core Skills</option>
            <option value="Specialization/Integration/Applications">Level 3 — Specialization / Integration</option>
            <option value="Professional/Industry">Level 4 — Professional / Industry</option>
          </select>
        </div>
        <div className="col-md-3">
          <select
            className="form-select"
            value={filters.deliveryMode}
            onChange={(e) => setFilters((f) => ({ ...f, deliveryMode: e.target.value }))}
          >
            <option value="">All Delivery Modes</option>
            <option value="Onsite">Onsite</option>
            <option value="Online">Online</option>
            <option value="Hybrid">Hybrid</option>
          </select>
        </div>
        <div className="col-md-2">
          <button className="btn btn-primary w-100">Filter</button>
        </div>
      </form>

      {loading && <LoadingState label="Loading courses…" />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && courses.length === 0 && (
        <EmptyState title="No courses found" message="Try adjusting your filters." />
      )}
      {!loading && !error && courses.length > 0 && (
        <div className="row g-4">
          {courses.map((c) => (
            <div className="col-md-6 col-lg-4" key={c._id}>
              <CourseCard course={c} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
