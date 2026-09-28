import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { studentService } from '../../services/studentService';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, ErrorState, PageHeader } from '../../components/StateComponents.jsx';

export default function ProfilePage() {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('personal'); // 'personal' | 'academic' | 'account'
  const [data, setData] = useState(null);
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');
    studentService
      .getMe()
      .then((res) => {
        const d = res.data;
        setData(d);
        setForm({
          status: d.profile?.status || 'student',
          university: d.profile?.university || '',
          faculty: d.profile?.faculty || '',
          department: d.profile?.department || '',
          academicYear: d.profile?.academicYear || '',
          graduationYear: d.profile?.graduationYear || '',
          skills: (d.profile?.skills || []).join(', '),
          experience: (d.profile?.experience || []).join(', '),
          previousTraining: (d.profile?.previousTraining || []).join(', '),
        });
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load profile.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaved(false);
    setSaving(true);
    setError('');

    try {
      const payload = {
        ...form,
        graduationYear: form.graduationYear ? Number(form.graduationYear) : undefined,
        skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
        experience: form.experience.split(',').map((s) => s.trim()).filter(Boolean),
        previousTraining: form.previousTraining.split(',').map((s) => s.trim()).filter(Boolean),
      };

      await studentService.updateMe(payload);
      setSaved(true);
      load();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (loading) return <LoadingState label="Loading your Academy student profile…" />;
  if (error && !data) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const user = data.user || {};
  const profile = data.profile || {};

  return (
    <div>
      <PageHeader
        title="My Student Profile"
        subtitle="Manage your personal credentials, STEM academic background, and Academy security settings."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'My Profile' },
        ]}
      />

      {/* Tab Switcher */}
      <div className="d-flex flex-wrap gap-2 mb-4">
        <button
          className={`btn btn-sm rounded-pill px-4 ${activeTab === 'personal' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('personal')}
        >
          <i className="fa-regular fa-user me-2"></i> Personal Information
        </button>
        <button
          className={`btn btn-sm rounded-pill px-4 ${activeTab === 'academic' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('academic')}
        >
          <i className="fa-solid fa-graduation-cap me-2"></i> Academic & Skills
        </button>
        <button
          className={`btn btn-sm rounded-pill px-4 ${activeTab === 'account' ? 'btn-primary' : 'btn-outline-secondary'}`}
          onClick={() => setActiveTab('account')}
        >
          <i className="fa-solid fa-shield-halved me-2"></i> Account & Security
        </button>
      </div>

      {saved && (
        <div className="alert alert-success alert-dismissible fade show" role="alert">
          <i className="fa-solid fa-circle-check me-2"></i> Profile details updated successfully.
          <button type="button" className="btn-close" onClick={() => setSaved(false)}></button>
        </div>
      )}

      {error && <div className="alert alert-danger mb-4">{error}</div>}

      <div className="row g-4">
        {/* Left Column: Form Details */}
        <div className="col-lg-8">
          <div className="egsa-card p-4">
            <form onSubmit={handleSubmit}>
              {/* Tab 1: Personal Information */}
              {activeTab === 'personal' && (
                <div>
                  <h5 className="fw-bold text-dark mb-3">Personal Information</h5>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small text-muted">Full Name</label>
                      <input className="form-control" value={user.fullName || ''} disabled />
                      <small className="text-muted">Managed via national identity verification.</small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-muted">Email Address</label>
                      <input className="form-control" value={user.email || ''} disabled />
                      <small className="text-muted">Primary contact for Academy communications.</small>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-muted">Phone Number</label>
                      <input className="form-control" value={user.phone || ''} disabled />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-muted">National ID / Passport</label>
                      <input
                        className="form-control font-monospace"
                        value={user.nationalId ? `${user.nationalId.slice(0, 6)}••••••••` : '29901010••••••'}
                        disabled
                      />
                      <small className="text-muted">Protected under national privacy regulations.</small>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab 2: Academic Background */}
              {activeTab === 'academic' && (
                <div>
                  <h5 className="fw-bold text-dark mb-3">Academic & Engineering Background</h5>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label small text-dark fw-medium">
                        Academic Status <span className="text-danger">*</span>
                      </label>
                      <select className="form-select" value={form.status} onChange={update('status')} required>
                        <option value="student">Undergraduate Student</option>
                        <option value="graduate">STEM Graduate / Engineer</option>
                      </select>
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-dark fw-medium">
                        University / Institution <span className="text-danger">*</span>
                      </label>
                      <input
                        className="form-control"
                        placeholder="e.g., Cairo University"
                        value={form.university}
                        onChange={update('university')}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-dark fw-medium">
                        Faculty <span className="text-danger">*</span>
                      </label>
                      <input
                        className="form-control"
                        placeholder="e.g., Faculty of Engineering"
                        value={form.faculty}
                        onChange={update('faculty')}
                        required
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-dark fw-medium">Department / Specialization</label>
                      <input
                        className="form-control"
                        placeholder="e.g., Aerospace, Communications, Computer Engineering"
                        value={form.department}
                        onChange={update('department')}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-dark fw-medium">Current Academic Year</label>
                      <input
                        className="form-control"
                        placeholder="e.g., 3rd Year / Senior"
                        value={form.academicYear}
                        onChange={update('academicYear')}
                      />
                    </div>

                    <div className="col-md-6">
                      <label className="form-label small text-dark fw-medium">Expected / Graduation Year</label>
                      <input
                        type="number"
                        className="form-control"
                        placeholder="e.g., 2026"
                        value={form.graduationYear}
                        onChange={update('graduationYear')}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label small text-dark fw-medium">
                        Technical Skills (comma-separated)
                      </label>
                      <input
                        className="form-control"
                        placeholder="e.g., MATLAB, Python, Orbit Determination, C++, Circuit Design, CAD"
                        value={form.skills}
                        onChange={update('skills')}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label small text-dark fw-medium">
                        Project / Industry Experience (comma-separated)
                      </label>
                      <textarea
                        className="form-control"
                        rows="2"
                        placeholder="e.g., University CanSat competition team, Robotics lab intern"
                        value={form.experience}
                        onChange={update('experience')}
                      />
                    </div>

                    <div className="col-12">
                      <label className="form-label small text-dark fw-medium">
                        Previous Space / STEM Training Programs
                      </label>
                      <input
                        className="form-control"
                        placeholder="e.g., Space Technology Fundamentals Workshop 2025"
                        value={form.previousTraining}
                        onChange={update('previousTraining')}
                      />
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-top">
                    <button type="submit" className="btn btn-primary btn-sm px-4" disabled={saving}>
                      {saving ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                          Saving…
                        </>
                      ) : (
                        'Save Academic Details'
                      )}
                    </button>
                  </div>
                </div>
              )}

              {/* Tab 3: Account & Security */}
              {activeTab === 'account' && (
                <div>
                  <h5 className="fw-bold text-dark mb-3">Account Security & Credentials</h5>

                  <div className="p-3 bg-light rounded mb-4 border">
                    <div className="d-flex justify-content-between align-items-center">
                      <div>
                        <h6 className="fw-bold text-dark mb-1">Email Verification</h6>
                        <p className="text-muted small mb-0">{user.email}</p>
                      </div>
                      <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2">
                        <i className="fa-solid fa-circle-check me-1"></i> Verified
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-light rounded mb-4 border">
                    <h6 className="fw-bold text-dark mb-1">Password Management</h6>
                    <p className="text-muted small mb-3">
                      Password updates require email confirmation token validation.
                    </p>
                    <Link to="/forgot-password" className="btn btn-outline-primary btn-sm">
                      <i className="fa-solid fa-key me-1"></i> Request Password Reset
                    </Link>
                  </div>

                  <div className="p-3 bg-light-subtle rounded border border-danger-subtle">
                    <h6 className="fw-bold text-danger-egsa mb-1">Sign Out of Session</h6>
                    <p className="text-muted small mb-3">
                      Terminates your current authenticated session on this workstation.
                    </p>
                    <button type="button" className="btn btn-outline-danger btn-sm" onClick={handleLogout}>
                      <i className="fa-solid fa-arrow-right-from-bracket me-1"></i> Logout of Portal
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right Sidebar Profile Card */}
        <div className="col-lg-4">
          <div className="egsa-card p-4 text-center mb-4">
            <div
              className="rounded-circle d-inline-flex align-items-center justify-content-center text-white fw-bold display-6 mb-3 shadow-sm"
              style={{
                width: '90px',
                height: '90px',
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
              }}
            >
              {user.fullName
                ?.split(' ')
                .map((p) => p[0])
                .slice(0, 2)
                .join('')
                .toUpperCase() || 'S'}
            </div>
            <h5 className="fw-bold text-dark mb-1">{user.fullName}</h5>
            <p className="text-muted small mb-2">{user.email}</p>
            <span className="badge bg-secondary-egsa px-3 py-1">
              Space Academy Cadet
            </span>

            <hr className="my-3" />

            <div className="text-start small text-muted d-flex flex-column gap-2">
              <div className="d-flex justify-content-between">
                <span>Profile Status:</span>
                <strong className={profile.profileCompleted ? 'text-success' : 'text-warning'}>
                  {profile.profileCompleted ? 'Complete' : 'Pending Update'}
                </strong>
              </div>
              <div className="d-flex justify-content-between">
                <span>Current Goal:</span>
                <strong className="text-dark">{profile.learningGoal?.title || 'Not Selected'}</strong>
              </div>
              <div className="d-flex justify-content-between">
                <span>Completed Courses:</span>
                <strong className="text-dark">{profile.completedCourses?.length || 0}</strong>
              </div>
            </div>

            <Link to="/student/goal" className="btn btn-outline-primary btn-sm w-100 mt-3">
              <i className="fa-solid fa-bullseye me-1"></i> Update Specialization Goal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
