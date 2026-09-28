import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { goalService, studentService } from '../../services/studentService';
import { LoadingState, ErrorState, PageHeader } from '../../components/StateComponents.jsx';

export default function GoalPage() {
  const [goals, setGoals] = useState([]);
  const [currentGoalId, setCurrentGoalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      goalService.list(),
      studentService.getMe().catch(() => ({ data: { profile: {} } })),
    ])
      .then(([goalsRes, profileRes]) => {
        setGoals(goalsRes.data || []);
        const g = profileRes.data?.profile?.learningGoal;
        if (g) setCurrentGoalId(g._id || g);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load learning goals.'))
      .finally(() => setLoading(false));
  }, []);

  const selectGoal = async (goalId) => {
    setSaving(goalId);
    try {
      await studentService.setGoal(goalId);
      navigate('/student/learning-path');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save goal.');
      setSaving(null);
    }
  };

  if (loading) return <LoadingState label="Loading Space Academy specialization tracks…" />;
  if (error && goals.length === 0) return <ErrorState message={error} />;

  return (
    <div>
      <PageHeader
        title="What is your Space Academy specialization goal?"
        subtitle="Your chosen focus shapes your tailored learning path, prerequisite sequence, and course recommendations."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Specialization Goals' },
        ]}
      />

      {error && <div className="alert alert-danger mb-4">{error}</div>}

      <div className="row g-3">
        {goals.map((g) => {
          const isSelected = currentGoalId === g._id;
          return (
            <div className="col-md-6 col-lg-4" key={g._id}>
              <button
                type="button"
                className={`egsa-card w-100 h-100 text-start border p-4 transition ${
                  isSelected ? 'border-primary border-2 bg-light-subtle' : ''
                }`}
                style={{ cursor: 'pointer', transition: 'all 0.15s ease' }}
                onClick={() => selectGoal(g._id)}
                disabled={saving === g._id}
              >
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center bg-light text-primary-egsa"
                    style={{ width: '48px', height: '48px' }}
                  >
                    <i className={`fa-solid ${g.icon || 'fa-rocket'} fa-xl`}></i>
                  </div>
                  {isSelected && (
                    <span className="badge bg-secondary-egsa small">
                      <i className="fa-solid fa-check me-1"></i> Current Goal
                    </span>
                  )}
                </div>

                <h5 className="fw-bold text-dark mb-1">{g.title}</h5>
                <p className="text-muted small mb-0">{g.description}</p>

                {saving === g._id && (
                  <div className="small text-secondary-egsa fw-semibold mt-3">
                    <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                    Configuring Learning Path…
                  </div>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
