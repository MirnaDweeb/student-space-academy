import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, useLocation, Link } from 'react-router-dom';
import { readinessService, applicationService } from '../../services/cycleServices';
import { courseService } from '../../services/courseService';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, PageHeader } from '../../components/StateComponents.jsx';

export default function ReadinessStartPage() {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [courseId, setCourseId] = useState(params.get('courseId') || location.state?.courseId || '');
  const [course, setCourse] = useState(null);
  const [statusData, setStatusData] = useState(null);
  const [loadingCourse, setLoadingCourse] = useState(false);
  const [starting, setStarting] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [error, setError] = useState('');
  const [availableCourses, setAvailableCourses] = useState([]);

  useEffect(() => {
    const id = params.get('courseId') || location.state?.courseId;
    if (id) {
      setCourseId(id);
      setLoadingCourse(true);
      courseService
        .get(id)
        .then((res) => {
          setCourse(res.data);
          if (isAuthenticated) {
            readinessService.status(id)
              .then((sRes) => setStatusData(sRes.data))
              .catch(() => {});
          }
        })
        .catch(() => {})
        .finally(() => setLoadingCourse(false));
    } else {
      courseService
        .list({ limit: 50 })
        .then((res) => {
          const list = res.data || [];
          setAvailableCourses(list);
          const firstCourse = list[0];
          if (firstCourse) {
            setCourseId(firstCourse._id);
            setCourse(firstCourse);
            if (isAuthenticated) {
              readinessService.status(firstCourse._id)
                .then((sRes) => setStatusData(sRes.data))
                .catch(() => {});
            }
          }
        })
        .catch(() => {});
    }
  }, [params, location.state, isAuthenticated]);

  const handleStart = async (retake = false) => {
    if (!courseId) {
      setError('Please select a course to start the readiness assessment.');
      return;
    }

    if (!isAuthenticated) {
      navigate(`/student/login?redirect=/student/readiness/start?courseId=${courseId}`);
      return;
    }

    setStarting(true);
    setError('');

    try {
      const res = await readinessService.start(courseId, { retake });
      if (res?.data?.attemptId && res?.data?.questions) {
        sessionStorage.setItem(`egsa_attempt_${res.data.attemptId}`, JSON.stringify(res.data.questions));
        navigate(`/student/readiness/${res.data.attemptId}`);
      } else {
        throw new Error('Unexpected assessment response from server.');
      }
    } catch (err) {
      const msg = err.response?.data?.message || err.message || '';
      setError(
        msg ||
          'Could not initiate readiness assessment. Please ensure your session is active.'
      );
    } finally {
      setStarting(false);
    }
  };

  const handleDirectEnroll = async () => {
    const targetId = courseId || course?._id;
    if (!targetId) return;

    if (!isAuthenticated) {
      navigate(`/student/login?redirect=/student/readiness/start?courseId=${targetId}`);
      return;
    }

    try {
      setEnrolling(true);
      setError('');
      const res = await applicationService.create({
        courseId: targetId,
        directEnroll: true,
      });

      const app = res.data;
      const invId = res.invoice?._id || app?.invoice?._id || app?.invoice;

      if (app?.status === 'Waitlisted') {
        navigate('/student/applications');
      } else if (invId) {
        navigate(`/student/payments?invoiceId=${invId}&applicationId=${app._id}`);
      } else {
        navigate('/student/applications');
      }
    } catch (err) {
      console.error('Direct enrollment error:', err);
      setError(err.response?.data?.message || 'Failed to process direct enrollment.');
    } finally {
      setEnrolling(false);
    }
  };

  const isCrossfit = course && (course.slug === 'crossfit-functional-fitness-program' || /crossfit/i.test(course.title));

  return (
    <div>
      <PageHeader
        title={course ? `${course.title} — Readiness Assessment` : 'Course Readiness Assessment'}
        subtitle="Evaluate foundational knowledge, analytical reasoning, and learning readiness standards before admissions processing."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Explore Programs', to: '/student/programs' },
          { label: 'Readiness Assessment' },
        ]}
      />

      {error && (
        <div className="alert alert-danger d-flex align-items-center gap-2 mb-4" role="alert">
          <i className="fa-solid fa-triangle-exclamation"></i>
          <div>{error}</div>
        </div>
      )}

      {loadingCourse ? (
        <LoadingState label="Loading program details…" />
      ) : (
        <div className="row g-4 justify-content-center">
          <div className="col-lg-8">
            {/* Active or Completed Attempt Notifications */}
            {statusData?.inProgressAttemptId && (
              <div className="alert alert-info border-info-subtle d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4 shadow-sm">
                <div className="d-flex align-items-center gap-3">
                  <i className="fa-solid fa-clock-rotate-left fa-xl text-primary-egsa"></i>
                  <div>
                    <strong className="d-block text-dark">Active Assessment In Progress</strong>
                    <span className="small text-muted">
                      You have an unfinished attempt saved for this course. You can resume without losing progress.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm px-3 fw-bold shadow-sm"
                  onClick={() => handleStart(false)}
                  disabled={starting}
                >
                  <i className="fa-solid fa-play me-1"></i> Resume Assessment
                </button>
              </div>
            )}

            {statusData?.latestSubmittedAttemptId && (
              <div className="alert alert-success-subtle border-success-subtle d-flex align-items-center justify-content-between flex-wrap gap-2 mb-4 shadow-sm">
                <div className="d-flex align-items-center gap-3">
                  <i className="fa-solid fa-circle-check fa-xl text-success"></i>
                  <div>
                    <strong className="d-block text-dark">
                      Assessment Completed: Score {statusData.latestScore}%
                    </strong>
                    <span className="small text-muted">
                      Status outcome: <strong>{statusData.latestOutcome?.replace(/_/g, ' ')}</strong>
                    </span>
                  </div>
                </div>
                <div className="d-flex align-items-center gap-2">
                  <Link
                    to={`/student/readiness/${statusData.latestSubmittedAttemptId}/result`}
                    className="btn btn-outline-success btn-sm px-3 fw-semibold"
                  >
                    View Result
                  </Link>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm px-3"
                    onClick={() => handleStart(true)}
                    disabled={starting}
                    title="Retake the readiness assessment"
                  >
                    Retake
                  </button>
                </div>
              </div>
            )}

            {/* Course Selector if none preselected */}
            {!params.get('courseId') && availableCourses.length > 0 && (
              <div className="egsa-card p-4 mb-4 shadow-sm">
                <label className="form-label fw-bold text-dark mb-2">
                  <i className="fa-solid fa-graduation-cap text-primary-egsa me-2"></i>
                  Select Program to Evaluate:
                </label>
                <select
                  className="form-select form-select-lg"
                  value={courseId}
                  onChange={(e) => {
                    const sel = availableCourses.find((c) => c._id === e.target.value);
                    setCourseId(e.target.value);
                    setCourse(sel);
                    if (isAuthenticated && sel) {
                      readinessService.status(sel._id)
                        .then((sRes) => setStatusData(sRes.data))
                        .catch(() => setStatusData(null));
                    }
                  }}
                >
                  {availableCourses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.title} ({c.level || 'All Levels'})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Overview Card */}
            <div className="egsa-card p-4 p-md-5 mb-4 shadow-sm">
              <div className="d-flex align-items-center gap-2 mb-3 flex-wrap">
                <span className="badge bg-primary-egsa px-3 py-2 fs-6">
                  <i className={`fa-solid ${isCrossfit ? 'fa-dumbbell' : 'fa-satellite'} me-1`}></i>
                  {isCrossfit ? 'Physical Conditioning & Spaceflight Fitness' : course?.category || 'EGSA Academy Program'}
                </span>
                <span className="badge bg-light text-dark border px-2 py-2">
                  {course?.level || 'Introductory'}
                </span>
                {course?.hasCustomReadinessQuestions ? (
                  <span className="badge bg-success-subtle text-success border px-2 py-2">
                    <i className="fa-solid fa-check-double me-1"></i> Course-Specific Assessment
                  </span>
                ) : (
                  <span className="badge bg-info-subtle text-info-emphasis border px-2 py-2">
                    <i className="fa-solid fa-certificate me-1"></i> Academy Standard Assessment
                  </span>
                )}
              </div>

              <h3 className="fw-bold text-dark mb-2">
                {course?.title || 'EGSA Program Readiness Assessment'}
              </h3>
              <p className="text-muted mb-4">
                {course?.tagline ||
                  course?.subtitle ||
                  (isCrossfit
                    ? 'Comprehensive physical conditioning readiness evaluation covering functional movement mechanics, injury prevention, progressive overload, and recovery.'
                    : 'Comprehensive foundational readiness evaluation covering logical reasoning, core technical principles, problem solving, and curriculum readiness.')}
              </p>

              {/* Optional Assessment Notice */}
              <div className="alert alert-primary-subtle border-primary-subtle d-flex align-items-center gap-2 mb-4 p-3 small text-dark">
                <i className="fa-solid fa-circle-check text-primary-egsa fa-lg"></i>
                <span>
                  <strong>Assessment is Optional:</strong> You can take this assessment to evaluate your knowledge and readiness standards, or proceed directly to enrollment and payment at any time.
                </span>
              </div>

              {/* Assessment Specs Grid */}
              <div className="row g-3 mb-4">
                <div className="col-sm-4">
                  <div className="p-3 rounded bg-light border text-center h-100">
                    <div className="text-primary-egsa mb-1">
                      <i className="fa-solid fa-list-check fa-xl"></i>
                    </div>
                    <div className="fw-bold text-dark fs-5">12 Questions</div>
                    <div className="text-muted small">Multiple Choice</div>
                  </div>
                </div>
                <div className="col-sm-4">
                  <div className="p-3 rounded bg-light border text-center h-100">
                    <div className="text-primary-egsa mb-1">
                      <i className="fa-regular fa-clock fa-xl"></i>
                    </div>
                    <div className="fw-bold text-dark fs-5">10–15 Mins</div>
                    <div className="text-muted small">Self-Paced</div>
                  </div>
                </div>
                <div className="col-sm-4">
                  <div className="p-3 rounded bg-light border text-center h-100">
                    <div className="text-primary-egsa mb-1">
                      <i className="fa-solid fa-award fa-xl"></i>
                    </div>
                    <div className="fw-bold text-dark fs-5">80% Passing</div>
                    <div className="text-muted small">Direct Eligibility</div>
                  </div>
                </div>
              </div>

              {/* What is covered */}
              <h5 className="fw-bold text-dark mb-3">
                <i className="fa-solid fa-graduation-cap text-primary-egsa me-2"></i>
                What This Assessment Evaluates
              </h5>
              <div className="row g-2 mb-4 text-muted small">
                {isCrossfit ? (
                  <>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Functional fitness and core movement mechanics</span>
                    </div>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Dynamic warm-ups and structured cool-downs</span>
                    </div>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Bodyweight standards: Air squats, push-ups, lunges</span>
                    </div>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Injury prevention and safe technical form</span>
                    </div>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Rest, hydration, and central recovery protocols</span>
                    </div>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Pain vs. discomfort: Knowing when to stop safely</span>
                    </div>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Following coach cues and facility safety rules</span>
                    </div>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Movement scaling for all fitness levels</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Logical thinking, quantitative reasoning, and systems analysis</span>
                    </div>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Technical and scientific measurement fundamentals</span>
                    </div>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Problem-solving, hypothesis testing, and anomaly diagnosis</span>
                    </div>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Data interpretation and telemetry signal analysis</span>
                    </div>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Scientific methodology, reproducibility, and academic integrity</span>
                    </div>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Operational laboratory protocols and equipment safety adherence</span>
                    </div>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Self-regulation, independent study, and critical inquiry</span>
                    </div>
                    <div className="col-md-6 d-flex align-items-center gap-2">
                      <i className="fa-solid fa-circle-check text-success"></i>
                      <span>Interdisciplinary readiness for advanced space curricula</span>
                    </div>
                  </>
                )}
              </div>

              {/* Scoring Policy Tiers */}
              <h5 className="fw-bold text-dark mb-3">
                <i className="fa-solid fa-chart-pie text-primary-egsa me-2"></i>
                Admissions Scoring Tiers
              </h5>
              <div className="d-flex flex-column gap-2 mb-4">
                <div className="p-3 border rounded bg-white d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-success">80% – 100%</span>
                    <strong className="text-dark small">Eligible / Ready</strong>
                  </div>
                  <span className="text-muted small">Direct clearance for admissions processing and seat allocation.</span>
                </div>
                <div className="p-3 border rounded bg-white d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-warning text-dark">50% – 79%</span>
                    <strong className="text-dark small">Foundation Recommended</strong>
                  </div>
                  <span className="text-muted small">Preparatory foundational modules advised for optimal progression.</span>
                </div>
                <div className="p-3 border rounded bg-white d-flex align-items-center justify-content-between">
                  <div className="d-flex align-items-center gap-2">
                    <span className="badge bg-danger">Below 50%</span>
                    <strong className="text-dark small">Manual Review</strong>
                  </div>
                  <span className="text-muted small">Referred to EGSA Academic Committee for individualized evaluation.</span>
                </div>
              </div>

              {/* Context Disclaimer Banner */}
              {isCrossfit ? (
                <div className="alert alert-warning border-warning-subtle d-flex align-items-start gap-3 mb-4">
                  <i className="fa-solid fa-heart-pulse fa-lg text-danger mt-1"></i>
                  <div className="small">
                    <strong className="d-block mb-1 text-dark">Important Health & Safety Disclaimer:</strong>
                    This assessment evaluates introductory training concepts, safety rules, and consistency awareness.
                    It is <strong>not</strong> a medical clearance or proof of clinical fitness. Students are encouraged
                    to consult a certified physician before starting high-intensity physical conditioning.
                  </div>
                </div>
              ) : (
                <div className="alert alert-info border-info-subtle d-flex align-items-start gap-3 mb-4">
                  <i className="fa-solid fa-compass fa-lg text-primary-egsa mt-1"></i>
                  <div className="small">
                    <strong className="d-block mb-1 text-dark">Academic & Foundational Readiness Advisory:</strong>
                    This diagnostic readiness assessment evaluates foundational concepts, analytical problem solving, and
                    learning readiness. It ensures proper program placement and maximizes cadet academic success across
                    EGSA Space Academy tracks.
                  </div>
                </div>
              )}

              {/* Start Button & Actions */}
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 pt-3 border-top">
                <Link to="/student/programs" className="btn btn-outline-secondary">
                  <i className="fa-solid fa-arrow-left me-1"></i> Return to Programs
                </Link>

                <div className="d-flex align-items-center gap-2">
                  {course?.price != null && (
                    <button
                      type="button"
                      className="btn btn-primary px-3 py-2 fw-semibold shadow-sm"
                      onClick={handleDirectEnroll}
                      disabled={enrolling}
                    >
                      {enrolling ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                          Enrolling…
                        </>
                      ) : (
                        <>
                          <i className="fa-solid fa-credit-card me-1"></i> Skip & Enroll Directly ({course.price} {course.currency || 'EGP'})
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    className="btn btn-accent px-4 py-2 fw-semibold"
                    onClick={() => handleStart(false)}
                    disabled={starting || !courseId}
                  >
                    {starting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Preparing Question Bank…
                      </>
                    ) : statusData?.inProgressAttemptId ? (
                      <>
                        <i className="fa-solid fa-play me-2"></i>
                        Resume Readiness Assessment
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-play me-2"></i>
                        Start Readiness Assessment
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
