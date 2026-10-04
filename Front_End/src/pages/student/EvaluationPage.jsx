import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { evaluationService } from '../../services/studentPortalServices';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';

export default function EvaluationPage() {
  const [searchParams] = useSearchParams();
  const targetCourseId = searchParams.get('courseId');

  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Active evaluation modal state
  const [activeEval, setActiveEval] = useState(null); // course item
  const [evalType, setEvalType] = useState('course'); // 'course' | 'agency'
  const [isReviewing, setIsReviewing] = useState(false); // viewing past submission

  // Form ratings (1-5) for Course Feedback
  const [courseRatings, setCourseRatings] = useState({
    content: 5,
    instructor: 5,
    labs: 5,
    organization: 5,
  });
  const [courseComments, setCourseComments] = useState({
    highlights: '',
    improvements: '',
  });

  // Form ratings (1-5) for Agency Feedback
  const [agencyRatings, setAgencyRatings] = useState({
    trainingEnvironment: 5,
    facilitiesAndLabs: 5,
    organizationAndStaff: 5,
    platformExperience: 5,
    overallSatisfaction: 5,
  });
  const [recommendAgency, setRecommendAgency] = useState(true);
  const [agencyComments, setAgencyComments] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    evaluationService
      .getEvaluations()
      .then((data) => {
        const evalsList = data || [];
        setEvaluations(evalsList);

        // Auto-open target course if provided via ?courseId=
        if (targetCourseId) {
          const match = evalsList.find((ev) => String(ev.courseId) === String(targetCourseId));
          if (match) {
            if (!match.isCourseCompleted) {
              openCourseForm(match);
            } else if (!match.isAgencyCompleted) {
              openAgencyForm(match);
            }
          }
        }
      })
      .catch((err) => setError(err.message || 'Failed to load evaluations.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [targetCourseId]);

  const openCourseForm = (item, reviewOnly = false) => {
    setActiveEval(item);
    setEvalType('course');
    setIsReviewing(reviewOnly);
    setSuccessMsg('');
    setError('');

    if (reviewOnly && item.submission?.ratings) {
      setCourseRatings(item.submission.ratings);
      setCourseComments(item.submission.comments || { highlights: '', improvements: '' });
    } else {
      setCourseRatings({ content: 5, instructor: 5, labs: 5, organization: 5 });
      setCourseComments({ highlights: '', improvements: '' });
    }
  };

  const openAgencyForm = (item, reviewOnly = false) => {
    setActiveEval(item);
    setEvalType('agency');
    setIsReviewing(reviewOnly);
    setSuccessMsg('');
    setError('');

    const agencyData = item.submission?.agencyFeedback;
    if (reviewOnly && agencyData) {
      setAgencyRatings({
        trainingEnvironment: agencyData.trainingEnvironment || 5,
        facilitiesAndLabs: agencyData.facilitiesAndLabs || 5,
        organizationAndStaff: agencyData.organizationAndStaff || 5,
        platformExperience: agencyData.platformExperience || 5,
        overallSatisfaction: agencyData.overallSatisfaction || 5,
      });
      setRecommendAgency(agencyData.recommendAgency !== false);
      setAgencyComments(agencyData.comments || '');
    } else {
      setAgencyRatings({
        trainingEnvironment: 5,
        facilitiesAndLabs: 5,
        organizationAndStaff: 5,
        platformExperience: 5,
        overallSatisfaction: 5,
      });
      setRecommendAgency(true);
      setAgencyComments('');
    }
  };

  const handleSubmitCourse = async (e) => {
    e.preventDefault();
    if (!activeEval) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await evaluationService.submitEvaluation({
        courseId: activeEval.courseId,
        ratings: courseRatings,
        comments: courseComments,
      });
      setSuccessMsg(
        res?.message ||
          'Course feedback submitted successfully. Please complete the Egyptian Space Agency feedback to finish all certificate requirements.'
      );
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit course feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitAgency = async (e) => {
    e.preventDefault();
    if (!activeEval) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await evaluationService.submitAgencyEvaluation({
        courseId: activeEval.courseId,
        ratings: agencyRatings,
        comments: agencyComments,
        recommendAgency,
      });
      setSuccessMsg(
        res?.message ||
          'Egyptian Space Agency feedback submitted successfully. All required feedback forms are now complete!'
      );
      load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to submit agency feedback.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingState label="Loading training evaluations…" />;
  if (error && evaluations.length === 0) return <ErrorState message={error} onRetry={load} />;

  return (
    <div>
      <PageHeader
        title="Mandatory Training & Agency Evaluation"
        subtitle="Provide anonymous, constructive feedback on curriculum, instructors, and Egyptian Space Agency facilities to complete graduation requirements."
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Feedback & Evaluation' },
        ]}
      />

      <div className="alert alert-info border-0 mb-4 bg-light text-primary-egsa shadow-sm">
        <div className="d-flex align-items-center gap-2">
          <i className="fa-solid fa-shield-halved fs-5 text-primary-egsa"></i>
          <div>
            <strong>Mandatory Certificate Prerequisite:</strong> To receive and download your official Space Academy certificate, you must complete both <strong>Course Feedback</strong> and <strong>Egyptian Space Agency Feedback</strong> before the feedback deadline.
          </div>
        </div>
      </div>

      {evaluations.length === 0 ? (
        <EmptyState
          icon="fa-star-half-stroke"
          title="No evaluations required at this time"
          message="Course evaluations open during your enrolled training cohort. Check back once your classes begin."
          actionLabel="Explore Programs"
          actionLink="/student/programs"
        />
      ) : (
        <div className="d-flex flex-column gap-4">
          {evaluations.map((item) => {
            const isAllDone = item.isCourseCompleted && item.isAgencyCompleted;

            return (
              <div className="egsa-card p-4 shadow-sm border" key={item.enrollmentId}>
                {/* Course Header */}
                <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3 border-bottom pb-3 mb-3">
                  <div>
                    <div className="d-flex align-items-center gap-2 mb-1">
                      <span className="badge bg-primary-egsa">Space Academy Training</span>
                      {isAllDone ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle">
                          <i className="fa-solid fa-circle-check me-1"></i> All Feedback Completed
                        </span>
                      ) : (
                        <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle">
                          <i className="fa-solid fa-hourglass-half me-1"></i> Feedback Pending
                        </span>
                      )}
                    </div>
                    <h4 className="fw-bold text-dark mb-1">
                      {item.courseTitle} {item.courseCode ? `(${item.courseCode})` : ''}
                    </h4>
                    <div className="text-muted small">
                      {item.cohortName && <span className="me-2"><strong>Cohort / Cycle:</strong> {item.cohortName} · </span>}
                      Instructor: <strong className="text-dark">{item.instructor}</strong>
                    </div>
                  </div>

                  {isAllDone && (
                    <Link to="/student/certificate" className="btn btn-outline-success btn-sm px-3 fw-semibold">
                      <i className="fa-solid fa-award me-1"></i> View Certificate Status
                    </Link>
                  )}
                </div>

                {/* Dual Feedback Cards */}
                <div className="row g-3">
                  {/* Form 1: Course & Instructor Feedback */}
                  <div className="col-md-6">
                    <div className={`p-3 rounded border h-100 d-flex flex-column justify-content-between ${item.isCourseCompleted ? 'bg-light border-success-subtle' : 'bg-white border-warning-subtle'}`}>
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                            <i className="fa-solid fa-chalkboard-user text-primary-egsa"></i>
                            1. Course & Instructor Feedback
                          </h6>
                          {item.isCourseCompleted ? (
                            <span className="badge bg-success text-white small">
                              <i className="fa-solid fa-check me-1"></i> Completed
                            </span>
                          ) : (
                            <span className="badge bg-warning text-dark small">
                              <i className="fa-solid fa-triangle-exclamation me-1"></i> Not Completed
                            </span>
                          )}
                        </div>
                        <p className="text-muted small mb-3">
                          Evaluate syllabus depth, technical relevance, lecturer mentorship, and laboratory simulation tools.
                        </p>
                      </div>

                      <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                        <small className="text-muted">
                          {item.isCourseCompleted && item.submission?.courseFeedbackSubmittedAt ? (
                            <span>Submitted: {new Date(item.submission.courseFeedbackSubmittedAt).toLocaleDateString()}</span>
                          ) : (
                            <span className="text-warning-emphasis">Required for Certificate</span>
                          )}
                        </small>
                        {item.isCourseCompleted ? (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => openCourseForm(item, true)}
                          >
                            <i className="fa-solid fa-eye me-1"></i> View Submitted
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm px-3 fw-semibold"
                            onClick={() => openCourseForm(item, false)}
                          >
                            <i className="fa-solid fa-pen-to-square me-1"></i> Complete Course Feedback
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Form 2: Egyptian Space Agency Feedback */}
                  <div className="col-md-6">
                    <div className={`p-3 rounded border h-100 d-flex flex-column justify-content-between ${item.isAgencyCompleted ? 'bg-light border-success-subtle' : 'bg-white border-warning-subtle'}`}>
                      <div>
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <h6 className="fw-bold text-dark mb-0 d-flex align-items-center gap-2">
                            <i className="fa-solid fa-satellite text-secondary-egsa"></i>
                            2. Egyptian Space Agency Feedback
                          </h6>
                          {item.isAgencyCompleted ? (
                            <span className="badge bg-success text-white small">
                              <i className="fa-solid fa-check me-1"></i> Completed
                            </span>
                          ) : (
                            <span className="badge bg-warning text-dark small">
                              <i className="fa-solid fa-triangle-exclamation me-1"></i> Not Completed
                            </span>
                          )}
                        </div>
                        <p className="text-muted small mb-3">
                          Evaluate EGSA facilities, clean rooms & satellite labs, administrative organization, and digital platform experience.
                        </p>
                      </div>

                      <div className="d-flex justify-content-between align-items-center pt-2 border-top">
                        <small className="text-muted">
                          {item.isAgencyCompleted && item.submission?.agencyFeedback?.submittedAt ? (
                            <span>Submitted: {new Date(item.submission.agencyFeedback.submittedAt).toLocaleDateString()}</span>
                          ) : (
                            <span className="text-warning-emphasis">Required for Certificate</span>
                          )}
                        </small>
                        {item.isAgencyCompleted ? (
                          <button
                            type="button"
                            className="btn btn-outline-secondary btn-sm"
                            onClick={() => openAgencyForm(item, true)}
                          >
                            <i className="fa-solid fa-eye me-1"></i> View Submitted
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm px-3 fw-semibold"
                            onClick={() => openAgencyForm(item, false)}
                          >
                            <i className="fa-solid fa-pen-to-square me-1"></i> Complete Agency Feedback
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FEEDBACK MODAL (Course Feedback OR Agency Feedback) */}
      {activeEval && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1060 }}
          role="dialog"
        >
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content shadow border-0" style={{ borderRadius: 'var(--radius-md)' }}>
              <div className="modal-header bg-light">
                <div>
                  <h5 className="modal-title fw-bold text-dark mb-0">
                    {evalType === 'course'
                      ? (isReviewing ? 'Submitted Course Feedback' : '1. Course & Instructor Feedback')
                      : (isReviewing ? 'Submitted Egyptian Space Agency Feedback' : '2. Egyptian Space Agency Feedback')}
                  </h5>
                  <div className="text-muted small mt-1">
                    <strong>Course:</strong> {activeEval.courseTitle} {activeEval.courseCode ? `(${activeEval.courseCode})` : ''}
                    {activeEval.cohortName && <> · <strong>Cycle:</strong> {activeEval.cohortName}</>}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => {
                    setActiveEval(null);
                    setSuccessMsg('');
                    setError('');
                  }}
                  aria-label="Close"
                ></button>
              </div>

              <div className="modal-body p-4">
                {error && (
                  <div className="alert alert-danger d-flex align-items-center mb-3">
                    <i className="fa-solid fa-circle-exclamation me-2"></i>
                    <div>{error}</div>
                  </div>
                )}

                {successMsg ? (
                  <div className="text-center py-4">
                    <div
                      className="d-inline-flex align-items-center justify-content-center rounded-circle mb-3 p-3 bg-success-subtle text-success"
                      style={{ width: '64px', height: '64px' }}
                    >
                      <i className="fa-solid fa-circle-check fa-2x"></i>
                    </div>
                    <h5 className="fw-bold text-dark mb-2">Feedback Submitted Successfully</h5>
                    <p className="text-muted mx-auto mb-4" style={{ maxWidth: '540px' }}>
                      {successMsg}
                    </p>
                    <div className="d-flex flex-wrap justify-content-center gap-2">
                      <Link to="/student/certificate" className="btn btn-primary px-4 py-2 fw-semibold">
                        <i className="fa-solid fa-award me-2 ms-2"></i>
                        Check Certificate Progress
                      </Link>
                      <button
                        type="button"
                        className="btn btn-outline-secondary px-3 py-2"
                        onClick={() => {
                          setActiveEval(null);
                          setSuccessMsg('');
                        }}
                      >
                        Close Window
                      </button>
                    </div>
                  </div>
                ) : evalType === 'course' ? (
                  /* COURSE FEEDBACK FORM */
                  <form onSubmit={handleSubmitCourse}>
                    {/* Rating 1: Curriculum */}
                    <div className="mb-4">
                      <label className="fw-semibold text-dark small d-block mb-1">
                        1. Course Curriculum, Content Relevance & Syllabus Depth
                      </label>
                      <div className="d-flex gap-2 align-items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            disabled={isReviewing}
                            className="btn btn-link p-1 text-decoration-none"
                            onClick={() => setCourseRatings((r) => ({ ...r, content: star }))}
                          >
                            <i className={`fa-star ${star <= courseRatings.content ? 'fa-solid text-warning' : 'fa-regular text-muted'} fs-4`}></i>
                          </button>
                        ))}
                        <span className="small text-muted ms-2">{courseRatings.content}/5</span>
                      </div>
                    </div>

                    {/* Rating 2: Instructor */}
                    <div className="mb-4">
                      <label className="fw-semibold text-dark small d-block mb-1">
                        2. Instructor Technical Expertise, Mentorship & Clarity
                      </label>
                      <div className="d-flex gap-2 align-items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            disabled={isReviewing}
                            className="btn btn-link p-1 text-decoration-none"
                            onClick={() => setCourseRatings((r) => ({ ...r, instructor: star }))}
                          >
                            <i className={`fa-star ${star <= courseRatings.instructor ? 'fa-solid text-warning' : 'fa-regular text-muted'} fs-4`}></i>
                          </button>
                        ))}
                        <span className="small text-muted ms-2">{courseRatings.instructor}/5</span>
                      </div>
                    </div>

                    {/* Rating 3: Labs */}
                    <div className="mb-4">
                      <label className="fw-semibold text-dark small d-block mb-1">
                        3. Engineering Labs, Telemetry Tools & Practical Simulations
                      </label>
                      <div className="d-flex gap-2 align-items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            disabled={isReviewing}
                            className="btn btn-link p-1 text-decoration-none"
                            onClick={() => setCourseRatings((r) => ({ ...r, labs: star }))}
                          >
                            <i className={`fa-star ${star <= courseRatings.labs ? 'fa-solid text-warning' : 'fa-regular text-muted'} fs-4`}></i>
                          </button>
                        ))}
                        <span className="small text-muted ms-2">{courseRatings.labs}/5</span>
                      </div>
                    </div>

                    {/* Rating 4: Organization */}
                    <div className="mb-4">
                      <label className="fw-semibold text-dark small d-block mb-1">
                        4. Academy Scheduling, Course Materials & Academic Support
                      </label>
                      <div className="d-flex gap-2 align-items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            disabled={isReviewing}
                            className="btn btn-link p-1 text-decoration-none"
                            onClick={() => setCourseRatings((r) => ({ ...r, organization: star }))}
                          >
                            <i className={`fa-star ${star <= courseRatings.organization ? 'fa-solid text-warning' : 'fa-regular text-muted'} fs-4`}></i>
                          </button>
                        ))}
                        <span className="small text-muted ms-2">{courseRatings.organization}/5</span>
                      </div>
                    </div>

                    {/* Comments */}
                    <div className="mb-3">
                      <label className="fw-semibold text-dark small mb-1">
                        What was the strongest aspect of this training curriculum?
                      </label>
                      {isReviewing ? (
                        <p className="p-2 bg-light rounded text-muted small mb-0">
                          {courseComments.highlights || 'No highlights entered.'}
                        </p>
                      ) : (
                        <textarea
                          className="form-control"
                          rows="3"
                          placeholder="e.g., The hands-on satellite telemetry simulation and orbital mechanics workshop..."
                          value={courseComments.highlights}
                          onChange={(e) => setCourseComments((c) => ({ ...c, highlights: e.target.value }))}
                        />
                      )}
                    </div>

                    <div className="mb-3">
                      <label className="fw-semibold text-dark small mb-1">
                        Recommendations for future course iterations:
                      </label>
                      {isReviewing ? (
                        <p className="p-2 bg-light rounded text-muted small mb-0">
                          {courseComments.improvements || 'No recommendations entered.'}
                        </p>
                      ) : (
                        <textarea
                          className="form-control"
                          rows="3"
                          placeholder="e.g., Dedicate more lab hours for CubeSat ADCS sensor testing..."
                          value={courseComments.improvements}
                          onChange={(e) => setCourseComments((c) => ({ ...c, improvements: e.target.value }))}
                        />
                      )}
                    </div>

                    {!isReviewing && (
                      <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => setActiveEval(null)}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary btn-sm px-4" disabled={submitting}>
                          {submitting ? 'Submitting…' : 'Submit Course Feedback'}
                        </button>
                      </div>
                    )}
                  </form>
                ) : (
                  /* AGENCY FEEDBACK FORM */
                  <form onSubmit={handleSubmitAgency}>
                    {/* Rating 1: Training Environment */}
                    <div className="mb-4">
                      <label className="fw-semibold text-dark small d-block mb-1">
                        1. Egyptian Space Agency Training Environment & Space City Atmosphere
                      </label>
                      <div className="d-flex gap-2 align-items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            disabled={isReviewing}
                            className="btn btn-link p-1 text-decoration-none"
                            onClick={() => setAgencyRatings((r) => ({ ...r, trainingEnvironment: star }))}
                          >
                            <i className={`fa-star ${star <= agencyRatings.trainingEnvironment ? 'fa-solid text-warning' : 'fa-regular text-muted'} fs-4`}></i>
                          </button>
                        ))}
                        <span className="small text-muted ms-2">{agencyRatings.trainingEnvironment}/5</span>
                      </div>
                    </div>

                    {/* Rating 2: Facilities & Labs */}
                    <div className="mb-4">
                      <label className="fw-semibold text-dark small d-block mb-1">
                        2. Agency Clean Rooms, Laboratories & Satellite Testing Infrastructure
                      </label>
                      <div className="d-flex gap-2 align-items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            disabled={isReviewing}
                            className="btn btn-link p-1 text-decoration-none"
                            onClick={() => setAgencyRatings((r) => ({ ...r, facilitiesAndLabs: star }))}
                          >
                            <i className={`fa-star ${star <= agencyRatings.facilitiesAndLabs ? 'fa-solid text-warning' : 'fa-regular text-muted'} fs-4`}></i>
                          </button>
                        ))}
                        <span className="small text-muted ms-2">{agencyRatings.facilitiesAndLabs}/5</span>
                      </div>
                    </div>

                    {/* Rating 3: Organization & Staff */}
                    <div className="mb-4">
                      <label className="fw-semibold text-dark small d-block mb-1">
                        3. Agency Administrative Organization & Support Staff
                      </label>
                      <div className="d-flex gap-2 align-items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            disabled={isReviewing}
                            className="btn btn-link p-1 text-decoration-none"
                            onClick={() => setAgencyRatings((r) => ({ ...r, organizationAndStaff: star }))}
                          >
                            <i className={`fa-star ${star <= agencyRatings.organizationAndStaff ? 'fa-solid text-warning' : 'fa-regular text-muted'} fs-4`}></i>
                          </button>
                        ))}
                        <span className="small text-muted ms-2">{agencyRatings.organizationAndStaff}/5</span>
                      </div>
                    </div>

                    {/* Rating 4: Platform Experience */}
                    <div className="mb-4">
                      <label className="fw-semibold text-dark small d-block mb-1">
                        4. Space Academy Digital Platform & Student Portal Experience
                      </label>
                      <div className="d-flex gap-2 align-items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            disabled={isReviewing}
                            className="btn btn-link p-1 text-decoration-none"
                            onClick={() => setAgencyRatings((r) => ({ ...r, platformExperience: star }))}
                          >
                            <i className={`fa-star ${star <= agencyRatings.platformExperience ? 'fa-solid text-warning' : 'fa-regular text-muted'} fs-4`}></i>
                          </button>
                        ))}
                        <span className="small text-muted ms-2">{agencyRatings.platformExperience}/5</span>
                      </div>
                    </div>

                    {/* Rating 5: Overall Satisfaction */}
                    <div className="mb-4">
                      <label className="fw-semibold text-dark small d-block mb-1">
                        5. Overall Satisfaction with the Egyptian Space Agency Training Program
                      </label>
                      <div className="d-flex gap-2 align-items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            disabled={isReviewing}
                            className="btn btn-link p-1 text-decoration-none"
                            onClick={() => setAgencyRatings((r) => ({ ...r, overallSatisfaction: star }))}
                          >
                            <i className={`fa-star ${star <= agencyRatings.overallSatisfaction ? 'fa-solid text-warning' : 'fa-regular text-muted'} fs-4`}></i>
                          </button>
                        ))}
                        <span className="small text-muted ms-2">{agencyRatings.overallSatisfaction}/5</span>
                      </div>
                    </div>

                    {/* Recommend Agency */}
                    <div className="mb-4 p-3 bg-light rounded border">
                      <label className="fw-semibold text-dark small d-block mb-2">
                        Would you recommend Egyptian Space Agency programs to other students / engineers?
                      </label>
                      <div className="d-flex gap-4">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="recommendRadio"
                            id="recYes"
                            disabled={isReviewing}
                            checked={recommendAgency === true}
                            onChange={() => setRecommendAgency(true)}
                          />
                          <label className="form-check-label text-dark small" htmlFor="recYes">
                            Yes, highly recommend
                          </label>
                        </div>
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="radio"
                            name="recommendRadio"
                            id="recNo"
                            disabled={isReviewing}
                            checked={recommendAgency === false}
                            onChange={() => setRecommendAgency(false)}
                          />
                          <label className="form-check-label text-dark small" htmlFor="recNo">
                            No
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Agency Comments */}
                    <div className="mb-3">
                      <label className="fw-semibold text-dark small mb-1">
                        Additional feedback or suggestions for the Egyptian Space Agency:
                      </label>
                      {isReviewing ? (
                        <p className="p-2 bg-light rounded text-muted small mb-0">
                          {agencyComments || 'No additional comments provided.'}
                        </p>
                      ) : (
                        <textarea
                          className="form-control"
                          rows="3"
                          placeholder="e.g., Provide extended access to clean room testing chambers for university students..."
                          value={agencyComments}
                          onChange={(e) => setAgencyComments(e.target.value)}
                        />
                      )}
                    </div>

                    {!isReviewing && (
                      <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm"
                          onClick={() => setActiveEval(null)}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="btn btn-primary btn-sm px-4" disabled={submitting}>
                          {submitting ? 'Submitting…' : 'Submit Agency Feedback'}
                        </button>
                      </div>
                    )}
                  </form>
                )}
              </div>

              {isReviewing && (
                <div className="modal-footer bg-light">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveEval(null)}
                  >
                    Close
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
