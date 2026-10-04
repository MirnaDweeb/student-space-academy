import React, { useState, useEffect } from 'react';
import { courseService } from '../../services/courseService';
import { readinessService } from '../../services/cycleServices';

export default function AdminReadinessModal({ isOpen, onClose }) {
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // New question form state
  const [newQuestion, setNewQuestion] = useState({
    question: '',
    topic: 'Space Science Fundamentals',
    difficulty: 'Medium',
    options: ['', '', '', ''],
    correctAnswerIndex: 0,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccessMsg('');
      courseService
        .list({ limit: 100 })
        .then((res) => {
          const list = res.data?.courses || res.data || res || [];
          setCourses(list);
          if (list.length > 0 && !selectedCourseId) {
            setSelectedCourseId(list[0]._id);
          }
        })
        .catch(() => setError('Failed to load courses.'));
    }
  }, [isOpen]);

  const loadQuestions = (courseId) => {
    if (!courseId) return;
    setLoading(true);
    setError('');
    readinessService
      .listQuestions(courseId)
      .then((res) => {
        setQuestions(res.data || []);
      })
      .catch((err) => {
        setError(err.response?.data?.message || 'Failed to load readiness questions.');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (selectedCourseId) {
      loadQuestions(selectedCourseId);
    }
  }, [selectedCourseId]);

  if (!isOpen) return null;

  const handleOptionChange = (index, value) => {
    const updated = [...newQuestion.options];
    updated[index] = value;
    setNewQuestion({ ...newQuestion, options: updated });
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    if (!selectedCourseId) {
      setError('Please select a course.');
      return;
    }
    if (!newQuestion.question.trim()) {
      setError('Question text is required.');
      return;
    }
    if (newQuestion.options.some((opt) => !opt.trim())) {
      setError('All 4 options must be filled.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSuccessMsg('');

    try {
      await readinessService.createQuestion({
        courseId: selectedCourseId,
        question: newQuestion.question,
        options: newQuestion.options,
        correctAnswerIndex: Number(newQuestion.correctAnswerIndex),
        topic: newQuestion.topic,
        difficulty: newQuestion.difficulty,
      });

      setSuccessMsg('Readiness question created successfully.');
      setNewQuestion({
        question: '',
        topic: newQuestion.topic,
        difficulty: 'Medium',
        options: ['', '', '', ''],
        correctAnswerIndex: 0,
      });
      loadQuestions(selectedCourseId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create question.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (questionId) => {
    if (!window.confirm('Are you sure you want to delete this readiness question?')) return;
    try {
      await readinessService.deleteQuestion(questionId);
      loadQuestions(selectedCourseId);
      setSuccessMsg('Question deleted.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete question.');
    }
  };

  const handleSeedDevTestSet = async () => {
    if (!selectedCourseId) return;
    setIsSubmitting(true);
    setError('');
    setSuccessMsg('');

    const devSampleQuestions = [
      {
        question: 'Which Keplerian orbital element defines the orientation of the orbital plane with respect to the equatorial plane?',
        options: ['Semi-major axis (a)', 'Eccentricity (e)', 'Inclination (i)', 'True anomaly (ν)'],
        correctAnswerIndex: 2,
        topic: 'Orbital Mechanics',
        difficulty: 'Medium',
      },
      {
        question: 'What is the primary function of the Attitude Determination and Control Subsystem (ADCS) in a satellite?',
        options: [
          'Generating electrical power via photovoltaic arrays',
          'Orienting the satellite toward targeted ground stations or celestial bodies',
          'Downlinking payload imagery data to mission control',
          'Regulating propellant temperature in vacuum',
        ],
        correctAnswerIndex: 1,
        topic: 'Satellite Subsystems',
        difficulty: 'Medium',
      },
      {
        question: 'In low-Earth orbit (LEO), which primary atmospheric constituent causes orbital decay over time due to aerodynamic drag?',
        options: ['Atomic Oxygen (AO)', 'Molecular Nitrogen (N2)', 'Argon (Ar)', 'Carbon Dioxide (CO2)'],
        correctAnswerIndex: 0,
        topic: 'Space Environment',
        difficulty: 'Medium',
      },
      {
        question: 'Which modulation technique is commonly employed for deep-space telemetry links due to its high power efficiency?',
        options: ['Amplitude Modulation (AM)', 'Binary Phase Shift Keying (BPSK)', 'Frequency Shift Keying (FSK)', 'Pulse Width Modulation (PWM)'],
        correctAnswerIndex: 1,
        topic: 'Telecommunications & Telemetry',
        difficulty: 'Hard',
      },
      {
        question: 'What is the standard nominal voltage of a single Triple-Junction Gallium Arsenide (GaAs) space solar cell under AM0 illumination?',
        options: ['0.7 V', '1.2 V', '2.3 V to 2.6 V', '5.0 V'],
        correctAnswerIndex: 2,
        topic: 'Power & Energy Systems',
        difficulty: 'Medium',
      },
    ];

    try {
      await readinessService.bulkCreateQuestions(selectedCourseId, devSampleQuestions);
      setSuccessMsg('Successfully configured 5 test readiness questions for this course (Dev Seed Data).');
      loadQuestions(selectedCourseId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to seed test questions.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(11, 25, 44, 0.75)', zIndex: 1060 }}
    >
      <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content border-0 shadow-lg">
          {/* Header */}
          <div className="modal-header bg-primary text-white border-0 py-3">
            <div className="d-flex align-items-center gap-2">
              <i className="fa-solid fa-list-check fa-lg text-secondary"></i>
              <div>
                <h5 className="modal-title fw-bold mb-0">Readiness Question Bank Cockpit</h5>
                <small className="text-light opacity-75">
                  Configure and curate diagnostic pre-test questions for Egyptian Space Agency courses
                </small>
              </div>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              aria-label="Close"
            ></button>
          </div>

          {/* Body */}
          <div className="modal-body p-4">
            {error && (
              <div className="alert alert-danger py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                <i className="fa-solid fa-circle-exclamation flex-shrink-0"></i>
                <div>{error}</div>
              </div>
            )}

            {successMsg && (
              <div className="alert alert-success py-2 px-3 small d-flex align-items-center gap-2 mb-3">
                <i className="fa-solid fa-circle-check flex-shrink-0"></i>
                <div>{successMsg}</div>
              </div>
            )}

            {/* Course Selector Bar */}
            <div className="bg-light p-3 rounded-3 border mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="flex-grow-1" style={{ minWidth: '280px' }}>
                <label className="form-label small fw-bold text-dark mb-1">
                  Target Space Academy Course:
                </label>
                <select
                  className="form-select form-select-sm fw-semibold"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                >
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.title} ({c.code || c.slug}) — {c.level}
                    </option>
                  ))}
                </select>
              </div>

              <div className="d-flex align-items-center gap-2 pt-md-3">
                <span className="badge bg-primary-subtle text-primary border px-3 py-2 fs-6">
                  {questions.length} Questions Configured
                </span>
                {questions.length === 0 && (
                  <button
                    type="button"
                    className="btn btn-warning btn-sm fw-bold shadow-sm"
                    onClick={handleSeedDevTestSet}
                    disabled={isSubmitting}
                  >
                    <i className="fa-solid fa-wand-magic-sparkles me-1"></i>
                    Seed 5 Test Questions (Dev Data)
                  </button>
                )}
              </div>
            </div>

            <div className="row g-4">
              {/* Left Column: Create Question Form */}
              <div className="col-lg-6">
                <div className="egsa-card p-3 border h-100 shadow-sm">
                  <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                    <i className="fa-solid fa-plus-circle text-primary"></i>
                    Author New Readiness Question
                  </h6>

                  <form onSubmit={handleCreateQuestion}>
                    <div className="mb-3">
                      <label className="form-label small fw-semibold">Question Stem / Prompt</label>
                      <textarea
                        className="form-control form-control-sm"
                        rows="3"
                        placeholder="e.g. Which propulsion type produces the highest specific impulse (Isp)?"
                        value={newQuestion.question}
                        onChange={(e) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                        required
                      />
                    </div>

                    <div className="row g-2 mb-3">
                      <div className="col-sm-6">
                        <label className="form-label small fw-semibold">Knowledge Topic</label>
                        <input
                          type="text"
                          className="form-control form-control-sm"
                          value={newQuestion.topic}
                          onChange={(e) => setNewQuestion({ ...newQuestion, topic: e.target.value })}
                          required
                        />
                      </div>
                      <div className="col-sm-6">
                        <label className="form-label small fw-semibold">Difficulty</label>
                        <select
                          className="form-select form-select-sm"
                          value={newQuestion.difficulty}
                          onChange={(e) => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}
                        >
                          <option value="Easy">Easy</option>
                          <option value="Medium">Medium</option>
                          <option value="Hard">Hard</option>
                        </select>
                      </div>
                    </div>

                    <div className="mb-3">
                      <label className="form-label small fw-semibold d-flex justify-content-between">
                        <span>Answer Choices (Select radio for correct answer)</span>
                      </label>
                      {newQuestion.options.map((opt, idx) => (
                        <div key={idx} className="input-group input-group-sm mb-2">
                          <div className="input-group-text bg-white">
                            <input
                              className="form-check-input mt-0"
                              type="radio"
                              name="correctAnswerIndex"
                              checked={Number(newQuestion.correctAnswerIndex) === idx}
                              onChange={() => setNewQuestion({ ...newQuestion, correctAnswerIndex: idx })}
                              aria-label={`Mark Option ${String.fromCharCode(65 + idx)} as correct`}
                            />
                            <span className="ms-2 fw-bold text-muted small">{String.fromCharCode(65 + idx)}</span>
                          </div>
                          <input
                            type="text"
                            className="form-control"
                            placeholder={`Choice ${String.fromCharCode(65 + idx)}`}
                            value={opt}
                            onChange={(e) => handleOptionChange(idx, e.target.value)}
                            required
                          />
                        </div>
                      ))}
                    </div>

                    <button
                      type="submit"
                      className="btn btn-primary btn-sm w-100 fw-semibold"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                          Saving Question...
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-save me-1"></i> Save to Question Bank
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: Existing Question Bank List */}
              <div className="col-lg-6">
                <div className="egsa-card p-3 border h-100 shadow-sm d-flex flex-column">
                  <div className="d-flex justify-content-between align-items-center mb-3">
                    <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-database text-secondary"></i>
                      Configured Question Bank ({questions.length})
                    </h6>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-0 px-2"
                      onClick={() => loadQuestions(selectedCourseId)}
                      disabled={loading}
                    >
                      <i className="fa-solid fa-arrows-rotate"></i>
                    </button>
                  </div>

                  <div className="flex-grow-1 overflow-auto" style={{ maxHeight: '480px' }}>
                    {loading ? (
                      <div className="text-center py-4 text-muted">
                        <span className="spinner-border spinner-border-sm me-2"></span>
                        Loading questions...
                      </div>
                    ) : questions.length === 0 ? (
                      <div className="text-center py-5 text-muted">
                        <i className="fa-solid fa-clipboard-question fa-3x mb-2 text-warning opacity-75"></i>
                        <p className="small mb-1 fw-bold">No readiness questions configured yet.</p>
                        <p className="small text-secondary mb-3">
                          Author questions using the form or use the Dev Seed button above to test the student pre-assessment flow.
                        </p>
                      </div>
                    ) : (
                      <div className="d-flex flex-column gap-3">
                        {questions.map((q, qIdx) => (
                          <div key={q._id || qIdx} className="p-3 bg-white border rounded-3 position-relative shadow-sm">
                            <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                              <div>
                                <span className="badge bg-secondary-subtle text-secondary me-1">
                                  {q.topic}
                                </span>
                                <span className="badge bg-light text-dark border">
                                  {q.difficulty}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="btn btn-outline-danger btn-sm py-0 px-2"
                                title="Delete question"
                                onClick={() => handleDelete(q._id)}
                              >
                                <i className="fa-solid fa-trash-can small"></i>
                              </button>
                            </div>

                            <p className="fw-semibold text-dark small mb-2">
                              {qIdx + 1}. {q.question}
                            </p>

                            <div className="ps-2 border-start border-2 border-primary-subtle">
                              {q.options?.map((opt, oIdx) => (
                                <div
                                  key={oIdx}
                                  className={`small py-0 px-2 rounded mb-1 ${
                                    oIdx === q.correctAnswerIndex
                                      ? 'bg-success-subtle text-success-emphasis fw-bold'
                                      : 'text-secondary'
                                  }`}
                                >
                                  {String.fromCharCode(65 + oIdx)}. {opt}
                                  {oIdx === q.correctAnswerIndex && (
                                    <i className="fa-solid fa-check ms-2 text-success"></i>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer bg-light border-0 py-2">
            <button type="button" className="btn btn-secondary btn-sm px-4" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
