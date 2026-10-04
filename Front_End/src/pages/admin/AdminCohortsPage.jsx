import React, { useEffect, useState } from 'react';
import { adminService } from '../../services/cycleServices';
import { courseService } from '../../services/courseService';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';

export default function AdminCohortsPage() {
  const [cohorts, setCohorts] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Create Cohort Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    courseId: '',
    name: '',
    startDate: '',
    endDate: '',
    capacity: 30,
  });
  const [creating, setCreating] = useState(false);

  // Edit Capacity Modal State
  const [selectedCohort, setSelectedCohort] = useState(null);
  const [editCapacity, setEditCapacity] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [cohortsRes, coursesRes] = await Promise.all([
        adminService.cohorts(),
        courseService.getCourses().catch(() => ({ data: [] })),
      ]);
      setCohorts(cohortsRes.data || []);
      setCourses(coursesRes.data || coursesRes || []);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load cohorts data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCohort = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    setSuccessMsg('');
    try {
      await adminService.createCohort(createForm);
      setSuccessMsg(`Cohort "${createForm.name}" created successfully.`);
      setShowCreateModal(false);
      setCreateForm({ courseId: '', name: '', startDate: '', endDate: '', capacity: 30 });
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create cohort.');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateCohort = async (e) => {
    e.preventDefault();
    if (!selectedCohort) return;
    setUpdating(true);
    setError('');
    setSuccessMsg('');
    try {
      await adminService.updateCohort(selectedCohort._id, {
        capacity: Number(editCapacity),
        status: editStatus,
      });
      setSuccessMsg(`Cohort "${selectedCohort.name}" updated successfully.`);
      setSelectedCohort(null);
      loadData();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update cohort.');
    } finally {
      setUpdating(false);
    }
  };

  const openEditModal = (cohort) => {
    setSelectedCohort(cohort);
    setEditCapacity(cohort.capacity);
    setEditStatus(cohort.status);
  };

  if (loading) return <LoadingState label="Loading cohorts and seat allocations..." />;

  return (
    <div className="container-fluid py-4 px-md-5">
      <PageHeader
        title="Cohorts & Capacity Management"
        subtitle="Configure academic training intakes, audit real-time seat allocations, and enforce enrollment caps."
        breadcrumbs={[
          { label: 'Admin Command', to: '/admin/dashboard' },
          { label: 'Cohorts & Capacity' },
        ]}
        actions={
          <div className="d-flex gap-2">
            <button className="btn btn-outline-secondary btn-sm" onClick={loadData}>
              <i className="fa-solid fa-arrows-rotate me-1"></i> Refresh
            </button>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreateModal(true)}>
              <i className="fa-solid fa-plus me-1"></i> New Cohort
            </button>
          </div>
        }
      />

      {successMsg && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          <i className="fa-solid fa-circle-check me-2"></i> {successMsg}
          <button type="button" className="btn-close" onClick={() => setSuccessMsg('')}></button>
        </div>
      )}

      {error && (
        <div className="alert alert-danger alert-dismissible fade show" role="alert">
          <i className="fa-solid fa-triangle-exclamation me-2"></i> {error}
          <button type="button" className="btn-close" onClick={() => setError('')}></button>
        </div>
      )}

      {cohorts.length === 0 ? (
        <EmptyState
          icon="fa-layer-group"
          title="No Cohorts Configured"
          message="Create an academic intake cohort to begin accepting student applications and reserving seats."
          actionText="Create First Cohort"
          onAction={() => setShowCreateModal(true)}
        />
      ) : (
        <div className="row g-4">
          {cohorts.map((cohort) => {
            const seatsTaken = cohort.seatsTaken || 0;
            const capacity = cohort.capacity || 1;
            const pct = Math.min(100, Math.round((seatsTaken / capacity) * 100));
            const availableSeats = Math.max(0, capacity - seatsTaken);

            return (
              <div key={cohort._id} className="col-md-6 col-lg-4">
                <div className="egsa-card p-4 shadow-sm h-100 d-flex flex-column justify-content-between">
                  <div>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                        {cohort.course?.code || 'EGSA-COURSE'}
                      </span>
                      <span
                        className={`badge ${
                          cohort.status === 'Scheduled'
                            ? 'bg-info text-dark'
                            : cohort.status === 'InProgress'
                            ? 'bg-warning text-dark'
                            : cohort.status === 'Completed'
                            ? 'bg-success'
                            : 'bg-secondary'
                        }`}
                      >
                        {cohort.status}
                      </span>
                    </div>

                    <h5 className="fw-bold text-dark mb-1">{cohort.name}</h5>
                    <p className="text-muted small mb-3">{cohort.course?.title}</p>

                    {/* Dates */}
                    <div className="p-3 bg-light rounded small mb-3">
                      <div className="d-flex justify-content-between mb-1">
                        <span className="text-muted">Start Date:</span>
                        <strong className="text-dark">
                          {cohort.startDate ? new Date(cohort.startDate).toLocaleDateString() : 'TBA'}
                        </strong>
                      </div>
                      <div className="d-flex justify-content-between">
                        <span className="text-muted">End Date:</span>
                        <strong className="text-dark">
                          {cohort.endDate ? new Date(cohort.endDate).toLocaleDateString() : 'TBA'}
                        </strong>
                      </div>
                    </div>

                    {/* Seat Capacity Progress */}
                    <div className="mb-3">
                      <div className="d-flex justify-content-between small fw-bold mb-1">
                        <span>Seat Allocation</span>
                        <span className={pct >= 100 ? 'text-danger' : pct >= 80 ? 'text-warning' : 'text-success'}>
                          {seatsTaken} / {capacity} Seats ({pct}%)
                        </span>
                      </div>
                      <div className="progress" style={{ height: 8 }}>
                        <div
                          className={`progress-bar ${pct >= 100 ? 'bg-danger' : pct >= 80 ? 'bg-warning' : 'bg-success'}`}
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                      <div className="text-muted small mt-1 text-end">
                        {availableSeats > 0 ? `${availableSeats} seats remaining` : 'Cohort Full (Waitlist Active)'}
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-outline-primary btn-sm w-100"
                    onClick={() => openEditModal(cohort)}
                  >
                    <i className="fa-solid fa-sliders me-1"></i> Edit Capacity & Status
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Cohort Modal */}
      {showCreateModal && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  <i className="fa-solid fa-plus-circle text-primary me-2"></i> Create Training Cohort
                </h5>
                <button type="button" className="btn-close" onClick={() => setShowCreateModal(false)}></button>
              </div>
              <form onSubmit={handleCreateCohort}>
                <div className="modal-body py-3">
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Select Training Program *</label>
                    <select
                      className="form-select form-select-sm"
                      value={createForm.courseId}
                      onChange={(e) => setCreateForm({ ...createForm, courseId: e.target.value })}
                      required
                    >
                      <option value="">-- Choose Course --</option>
                      {courses.map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.title} ({c.code || c.level})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Cohort Name / Intake Code *</label>
                    <input
                      type="text"
                      className="form-control form-control-sm"
                      placeholder="e.g. Summer 2026 - Cohort A"
                      value={createForm.name}
                      onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-bold">Start Date *</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={createForm.startDate}
                        onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-bold">End Date</label>
                      <input
                        type="date"
                        className="form-control form-control-sm"
                        value={createForm.endDate}
                        onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Maximum Capacity (Seats) *</label>
                    <input
                      type="number"
                      min="1"
                      className="form-control form-control-sm"
                      value={createForm.capacity}
                      onChange={(e) => setCreateForm({ ...createForm, capacity: e.target.value })}
                      required
                    />
                    <small className="text-muted">Applications beyond this limit will be placed on the waitlist.</small>
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={creating}>
                    {creating ? 'Creating...' : 'Create Cohort'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Edit Capacity Modal */}
      {selectedCohort && (
        <div className="modal show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content border-0 shadow">
              <div className="modal-header border-bottom">
                <h5 className="modal-title fw-bold">
                  <i className="fa-solid fa-sliders text-primary me-2"></i> Update Cohort Settings
                </h5>
                <button type="button" className="btn-close" onClick={() => setSelectedCohort(null)}></button>
              </div>
              <form onSubmit={handleUpdateCohort}>
                <div className="modal-body py-3">
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Cohort Name</label>
                    <input type="text" className="form-control form-control-sm" value={selectedCohort.name} disabled />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Current Seats Taken</label>
                    <input type="text" className="form-control form-control-sm bg-light" value={`${selectedCohort.seatsTaken || 0} active reservation(s)`} disabled />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Capacity Cap *</label>
                    <input
                      type="number"
                      min={selectedCohort.seatsTaken || 1}
                      className="form-control form-control-sm"
                      value={editCapacity}
                      onChange={(e) => setEditCapacity(e.target.value)}
                      required
                    />
                    <small className="text-muted">Must be greater than or equal to current seats taken ({selectedCohort.seatsTaken || 0}).</small>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-bold">Status *</label>
                    <select
                      className="form-select form-select-sm"
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                    >
                      <option value="Scheduled">Scheduled</option>
                      <option value="InProgress">InProgress</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-outline-secondary btn-sm" onClick={() => setSelectedCohort(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={updating}>
                    {updating ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
