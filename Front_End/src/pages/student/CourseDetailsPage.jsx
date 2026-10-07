import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { courseService } from '../../services/courseService';
import { applicationService } from '../../services/cycleServices';
import { useAuth } from '../../context/AuthContext.jsx';
import { LoadingState, ErrorState, PageHeader } from '../../components/StateComponents.jsx';

export default function CourseDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [course, setCourse] = useState(null);
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEnrolling, setIsEnrolling] = useState(false);

  const load = () => {
    setLoading(true);
    setError('');

    const coursePromise = courseService.get(id);
    const appPromise = isAuthenticated
      ? applicationService.my().catch(() => ({ data: [] }))
      : Promise.resolve({ data: [] });

    Promise.all([coursePromise, appPromise])
      .then(([courseRes, appRes]) => {
        setCourse(courseRes.data);
        const apps = appRes.data || [];
        const matched = apps.find((a) => (a.course?._id || a.course)?.toString() === id);
        setApplication(matched || null);
      })
      .catch((err) => setError(err.response?.data?.message || 'Failed to load course details.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  const handleDirectEnroll = async () => {
    if (!isAuthenticated) {
      navigate(`/student/login?redirect=/student/courses/${id}`);
      return;
    }

    try {
      setIsEnrolling(true);
      const res = await applicationService.create({
        courseId: id,
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
      console.error('Direct enrollment failed:', err);
      alert(err.response?.data?.message || 'Failed to initialize direct enrollment.');
    } finally {
      setIsEnrolling(false);
    }
  };

  if (loading) return <LoadingState label="Loading space academy curriculum…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!course) return null;

  const renderAction = (isHeader = false) => {
    const btnSize = isHeader ? 'btn-sm px-3' : 'py-2';
    if (application) {
      if (application.enrollment || application.status === 'Confirmed') {
        return (
          <Link to="/student/dashboard" className={`btn btn-success ${btnSize}`}>
            <i className="fa-solid fa-circle-check me-1"></i> Enrolled
          </Link>
        );
      }
      if (application.status === 'Waitlisted') {
        return (
          <Link to={`/student/applications/${application._id}`} className={`btn btn-secondary ${btnSize}`}>
            <i className="fa-solid fa-clock me-1"></i> Waitlisted (#{application.waitlistPosition || 1})
          </Link>
        );
      }
      if (['Accepted', 'Eligible - Payment Pending'].includes(application.status)) {
        const inv = application.invoice;
        const invId = inv?._id || (typeof inv === 'string' ? inv : '');
        if (inv?.status === 'Payment Initiated') {
          return (
            <Link
              to={`/student/payments?invoiceId=${invId}&applicationId=${application._id}`}
              className={`btn btn-accent ${btnSize} fw-bold`}
            >
              <i className="fa-solid fa-spinner fa-spin me-1"></i> Continue Payment
            </Link>
          );
        }
        return (
          <Link
            to={`/student/payments?invoiceId=${invId}&applicationId=${application._id}`}
            className={`btn btn-accent ${btnSize} fw-bold`}
          >
            <i className="fa-solid fa-credit-card me-1"></i> Pay Now
          </Link>
        );
      }
      if (application.status === 'Manual Review') {
        return (
          <Link to={`/student/applications/${application._id}`} className={`btn btn-outline-info text-dark ${btnSize}`}>
            <i className="fa-solid fa-clipboard-user me-1"></i> Manual Review Required
          </Link>
        );
      }
      if (application.status === 'Under Review') {
        return (
          <Link to={`/student/applications/${application._id}`} className={`btn btn-outline-info text-dark ${btnSize}`}>
            <i className="fa-solid fa-clipboard-user me-1"></i> Under Review
          </Link>
        );
      }
      if (application.status === 'Foundation Recommended') {
        return (
          <Link to={`/student/applications/${application._id}/foundation`} className={`btn btn-outline-warning text-dark ${btnSize}`}>
            <i className="fa-solid fa-graduation-cap me-1"></i> Review Foundation Request
          </Link>
        );
      }
    }

    if (course.price == null) {
      return (
        <button className={`btn btn-secondary ${btnSize}`} disabled>
          Pricing TBA
        </button>
      );
    }

    // Path A (Enroll & Pay Now) + Path B (Check My Readiness)
    if (isHeader) {
      return (
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className="btn btn-primary btn-sm fw-bold shadow-sm"
            onClick={handleDirectEnroll}
            disabled={isEnrolling}
          >
            {isEnrolling ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status"></span>
                Processing…
              </>
            ) : (
              <>
                <i className="fa-solid fa-credit-card me-1"></i> Enroll & Pay Now
              </>
            )}
          </button>
          <Link
            to={`/student/readiness/start?courseId=${course._id}`}
            className="btn btn-outline-primary btn-sm fw-semibold"
            title="Evaluate readiness before enrolling"
          >
            <i className="fa-solid fa-clipboard-check me-1"></i> Check Readiness
          </Link>
        </div>
      );
    }

    return (
      <div className="d-flex flex-column gap-2 w-100">
        <button
          type="button"
          className="btn btn-primary py-2 fw-bold w-100 shadow-sm"
          onClick={handleDirectEnroll}
          disabled={isEnrolling}
        >
          {isEnrolling ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status"></span>
              Processing Direct Enrollment…
            </>
          ) : (
            <>
              <i className="fa-solid fa-credit-card me-2"></i> Enroll & Pay Now
            </>
          )}
        </button>
        <Link
          to={`/student/readiness/start?courseId=${course._id}`}
          className="btn btn-outline-primary py-2 w-100 fw-semibold"
        >
          <i className="fa-solid fa-clipboard-check me-2"></i> Check My Readiness (Optional)
        </Link>
        <div className="text-center pt-1">
          <small className="text-muted" style={{ fontSize: '0.75rem' }}>
            <i className="fa-regular fa-circle-check text-success me-1"></i>
            Assessment optional · Direct pay available
          </small>
        </div>
      </div>
    );
  };

  const hasModules = Array.isArray(course.modules) && course.modules.length > 0;
  const hasObjectives = Array.isArray(course.learningObjectives) && course.learningObjectives.length > 0;
  const hasOutcomes = Array.isArray(course.learningOutcomes) && course.learningOutcomes.length > 0;
  const hasPrereqList = Array.isArray(course.prerequisitesList) && course.prerequisitesList.length > 0;
  const hasRecommendedCourses = Array.isArray(course.recommendedPreviousCourses) && course.recommendedPreviousCourses.length > 0;
  const hasMandatoryPrereqs = Array.isArray(course.mandatoryPrerequisites) && course.mandatoryPrerequisites.length > 0;
  const hasHandsOnTools = course.handsOnTools && (
    (course.handsOnTools.softwareTools && course.handsOnTools.softwareTools.length > 0) ||
    (course.handsOnTools.practicalExposure && course.handsOnTools.practicalExposure.length > 0)
  );
  const hasMaterials = course.courseMaterials && (
    (course.courseMaterials.trainingMaterials && course.courseMaterials.trainingMaterials.length > 0) ||
    (course.courseMaterials.digitalResources && course.courseMaterials.digitalResources.length > 0) ||
    (course.courseMaterials.postTrainingAccess && course.courseMaterials.postTrainingAccess.length > 0)
  );
  const hasCareerImpact = Array.isArray(course.careerImpact) && course.careerImpact.length > 0;
  const hasCertification = course.certificationDetails && course.certificationDetails.certificateType;

  return (
    <div>
      <PageHeader
        title={course.title}
        subtitle={`${course.category} · ${course.level}`}
        breadcrumbs={[
          { label: 'Portal', to: '/student/dashboard' },
          { label: 'Explore Programs', to: '/student/programs' },
          { label: course.title },
        ]}
        actions={renderAction(true)}
      />

      {/* Official Academy Header Banner */}
      <div className="egsa-card p-4 mb-4 border-start border-4 border-primary-egsa bg-gradient-light">
        <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
          <div>
            <div className="d-flex align-items-center gap-2 mb-2">
              <span className="badge bg-primary-egsa px-2 py-1">
                <i className="fa-solid fa-satellite me-1"></i> Egyptian Space Agency (EgSA)
              </span>
              <span className="badge bg-light text-dark border">
                أكاديمية الفضاء المصرية
              </span>
              {course.titleAr && (
                <span className="badge bg-secondary-egsa text-white">
                  {course.titleAr}
                </span>
              )}
            </div>
            <h3 className="fw-bold text-dark mb-1">{course.title}</h3>
            {course.subtitle && (
              <p className="text-secondary-egsa fw-semibold mb-1 fs-6">
                <i className="fa-solid fa-bookmark me-1 text-primary-egsa"></i> {course.subtitle}
              </p>
            )}
            {course.tagline && (
              <p className="text-muted fst-italic mb-0 small">
                &ldquo;{course.tagline}&rdquo;
              </p>
            )}
          </div>
          <div className="d-flex flex-wrap gap-2 align-items-center">
            <span className="badge bg-light text-primary-egsa border border-primary-subtle p-2">
              <i className="fa-regular fa-clock me-1"></i>
              {course.duration != null ? `${course.duration} ${course.durationUnit || 'Days'}` : 'Duration TBA'}
              {course.hoursPerDay ? ` (${course.hoursPerDay})` : ''}
            </span>
            <span className="badge bg-light text-dark border p-2">
              <i className="fa-solid fa-location-dot me-1 text-danger"></i>
              {course.deliveryMode} · {course.location || 'EGSA Academy'}
            </span>
            <span className="badge bg-success-subtle text-success border border-success-subtle p-2">
              <i className="fa-solid fa-circle-check me-1"></i> Accredited Program
            </span>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {/* Left Main Content */}
        <div className="col-lg-8">
          {/* Admissions Status Alert Banner */}
          {application && (
            <div
              className={`alert ${
                application.enrollment || application.status === 'Confirmed'
                  ? 'alert-success border-success'
                  : ['Accepted', 'Eligible - Payment Pending'].includes(application.status)
                  ? 'alert-primary border-primary'
                  : application.status === 'Waitlisted'
                  ? 'alert-secondary'
                  : ['Under Review', 'Manual Review'].includes(application.status)
                  ? 'alert-info border-info'
                  : 'alert-warning border-warning'
              } d-flex justify-content-between align-items-center mb-4 p-3 shadow-sm flex-wrap gap-2`}
            >
              <div>
                <span className="badge bg-dark me-2">Admissions: {application.status}</span>
                <span className="small text-dark fw-semibold">
                  {['Accepted', 'Eligible - Payment Pending'].includes(application.status)
                    ? 'Your application is accepted! Complete tuition payment below to finalize your seat reservation.'
                    : application.status === 'Under Review' || application.status === 'Manual Review'
                    ? 'Your application and readiness attempt are currently being reviewed by the Admissions Committee.'
                    : application.status === 'Foundation Recommended'
                    ? 'Preparatory conditioning recommended prior to full cohort enrollment.'
                    : application.status === 'Waitlisted'
                    ? `Placed on waitlist at position #${application.waitlistPosition || 1}.`
                    : 'Application reference: ' + (application.referenceNumber || application._id)}
                </span>
              </div>
              <div>{renderAction(true)}</div>
            </div>
          )}

          {/* Program Overview */}
          <div className="egsa-card p-4 mb-4">
            <h5 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <i className="fa-solid fa-circle-info text-primary-egsa"></i>
              Program Overview
            </h5>
            <p className="text-muted leading-relaxed mb-0">
              {course.overview || course.shortDescription || 'Comprehensive curriculum developed by Egyptian Space Agency engineers.'}
            </p>
          </div>

          {/* Purpose & Why This Program Exists */}
          {course.whyThisCourse && (
            <div className="egsa-card p-4 mb-4">
              <h6 className="fw-bold text-secondary-egsa mb-2 d-flex align-items-center gap-2">
                <i className="fa-solid fa-bullseye text-primary-egsa"></i>
                Why Take This Program?
              </h6>
              <p className="text-muted mb-0">{course.whyThisCourse}</p>
            </div>
          )}

          {/* Target Audience & Eligibility */}
          <div className="egsa-card p-4 mb-4">
            <h6 className="fw-bold text-secondary-egsa mb-2 d-flex align-items-center gap-2">
              <i className="fa-solid fa-user-group text-primary-egsa"></i>
              Target Audience & Eligibility
            </h6>
            <p className="text-muted mb-0">
              {course.whoIsItFor || course.targetAudience || 'Undergraduate engineering students, STEM learners, and professionals seeking specialized technical skills.'}
            </p>
          </div>

          {/* Learning Objectives */}
          {hasObjectives && (
            <div className="egsa-card p-4 mb-4">
              <h6 className="fw-bold text-secondary-egsa mb-3 d-flex align-items-center gap-2">
                <i className="fa-solid fa-crosshairs text-primary-egsa"></i>
                Learning Objectives
              </h6>
              <div className="row g-2">
                {course.learningObjectives.map((obj, idx) => (
                  <div key={idx} className="col-md-6">
                    <div className="p-3 border rounded bg-light-subtle h-100 d-flex align-items-start gap-2">
                      <span className="badge bg-primary-egsa rounded-circle mt-1" style={{ minWidth: '22px', height: '22px', lineHeight: '14px' }}>
                        {idx + 1}
                      </span>
                      <span className="small text-dark fw-medium">{obj}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Learning Outcomes */}
          {hasOutcomes && (
            <div className="egsa-card p-4 mb-4">
              <h6 className="fw-bold text-secondary-egsa mb-3 d-flex align-items-center gap-2">
                <i className="fa-solid fa-graduation-cap text-primary-egsa"></i>
                Expected Competencies & Learning Outcomes
              </h6>
              <ul className="mb-0 text-muted list-unstyled d-flex flex-column gap-2">
                {course.learningOutcomes.map((outcome, idx) => (
                  <li key={idx} className="d-flex align-items-start gap-2 small">
                    <i className="fa-solid fa-circle-check text-success mt-1"></i>
                    <span>{outcome}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Course Structure / Day-by-Day Curriculum */}
          {hasModules ? (
            <div className="egsa-card p-4 mb-4">
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="fw-bold text-secondary-egsa mb-0 d-flex align-items-center gap-2">
                  <i className="fa-solid fa-layer-group text-primary-egsa"></i>
                  Course Structure ({course.duration || course.modules.length} Days Program)
                </h6>
                <span className="badge bg-light text-muted border">
                  {course.modules.length} Modules
                </span>
              </div>
              <div className="d-flex flex-column gap-3">
                {course.modules.map((mod, idx) => (
                  <div key={idx} className="border rounded p-3 bg-white shadow-sm">
                    <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
                      <h6 className="fw-bold text-dark mb-0">
                        {mod.title || `Day ${mod.day || idx + 1}`}
                      </h6>
                      {mod.focus && (
                        <span className="badge bg-primary-subtle text-primary border border-primary-subtle">
                          Focus: {mod.focus}
                        </span>
                      )}
                    </div>
                    {mod.activities && mod.activities.length > 0 && (
                      <div className="ps-2 border-start border-2 border-primary-subtle ms-1">
                        <small className="text-muted fw-semibold d-block mb-1">Activities & Sessions:</small>
                        <ul className="list-unstyled small text-muted mb-0 d-flex flex-column gap-1">
                          {mod.activities.map((act, actIdx) => (
                            <li key={actIdx} className="d-flex align-items-start gap-2">
                              <span className="text-primary-egsa">•</span>
                              <span>{act}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : course.syllabus?.length > 0 ? (
            <div className="egsa-card p-4 mb-4">
              <h6 className="fw-bold text-secondary-egsa mb-3 d-flex align-items-center gap-2">
                <i className="fa-solid fa-list-ol text-primary-egsa"></i>
                Syllabus & Core Topics
              </h6>
              <div className="row g-2">
                {course.syllabus.map((topic, idx) => (
                  <div key={idx} className="col-md-6">
                    <div className="p-2 border rounded bg-light-subtle small d-flex align-items-center gap-2">
                      <span className="badge bg-secondary-egsa">{idx + 1}</span>
                      <span className="text-dark fw-medium">{topic}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Hands-On Tools & Platforms */}
          {hasHandsOnTools && (
            <div className="egsa-card p-4 mb-4">
              <h6 className="fw-bold text-secondary-egsa mb-3 d-flex align-items-center gap-2">
                <i className="fa-solid fa-microchip text-primary-egsa"></i>
                Hands-On Tools & Platforms
              </h6>
              <div className="row g-3">
                {course.handsOnTools.softwareTools?.length > 0 && (
                  <div className="col-md-6">
                    <div className="p-3 border rounded bg-light h-100">
                      <strong className="d-block small text-dark mb-2">
                        <i className="fa-solid fa-laptop-code me-1 text-primary-egsa"></i> Software Tools:
                      </strong>
                      <div className="d-flex flex-wrap gap-1">
                        {course.handsOnTools.softwareTools.map((tool, idx) => (
                          <span key={idx} className="badge bg-white text-dark border">
                            {tool}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {course.handsOnTools.practicalExposure?.length > 0 && (
                  <div className="col-md-6">
                    <div className="p-3 border rounded bg-light h-100">
                      <strong className="d-block small text-dark mb-2">
                        <i className="fa-solid fa-screwdriver-wrench me-1 text-secondary-egsa"></i> Practical Exposure:
                      </strong>
                      <ul className="list-unstyled small text-muted mb-0 d-flex flex-column gap-1">
                        {course.handsOnTools.practicalExposure.map((item, idx) => (
                          <li key={idx} className="d-flex align-items-center gap-2">
                            <i className="fa-solid fa-check text-success small"></i>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Training Methodology */}
          {Array.isArray(course.trainingMethodology) && course.trainingMethodology.length > 0 && (
            <div className="egsa-card p-4 mb-4">
              <h6 className="fw-bold text-secondary-egsa mb-3 d-flex align-items-center gap-2">
                <i className="fa-solid fa-chalkboard-user text-primary-egsa"></i>
                Training Methodology
              </h6>
              <div className="d-flex flex-wrap gap-2">
                {course.trainingMethodology.map((m, idx) => (
                  <span key={idx} className="badge bg-light text-dark border p-2 small">
                    <i className="fa-solid fa-award text-accent-egsa me-1"></i> {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Course Materials & Digital Resources */}
          {hasMaterials && (
            <div className="egsa-card p-4 mb-4">
              <h6 className="fw-bold text-secondary-egsa mb-3 d-flex align-items-center gap-2">
                <i className="fa-solid fa-folder-open text-primary-egsa"></i>
                Course Materials & Access
              </h6>
              <div className="row g-3">
                {course.courseMaterials.trainingMaterials?.length > 0 && (
                  <div className="col-md-4">
                    <div className="p-3 border rounded bg-light-subtle h-100">
                      <strong className="small text-dark d-block mb-2">
                        <i className="fa-solid fa-book me-1 text-primary-egsa"></i> Training Materials
                      </strong>
                      <ul className="list-unstyled small text-muted mb-0 d-flex flex-column gap-1">
                        {course.courseMaterials.trainingMaterials.map((mat, idx) => (
                          <li key={idx}>• {mat}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {course.courseMaterials.digitalResources?.length > 0 && (
                  <div className="col-md-4">
                    <div className="p-3 border rounded bg-light-subtle h-100">
                      <strong className="small text-dark d-block mb-2">
                        <i className="fa-solid fa-file-code me-1 text-secondary-egsa"></i> Digital Resources
                      </strong>
                      <ul className="list-unstyled small text-muted mb-0 d-flex flex-column gap-1">
                        {course.courseMaterials.digitalResources.map((res, idx) => (
                          <li key={idx}>• {res}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {course.courseMaterials.postTrainingAccess?.length > 0 && (
                  <div className="col-md-4">
                    <div className="p-3 border rounded bg-light-subtle h-100">
                      <strong className="small text-dark d-block mb-2">
                        <i className="fa-solid fa-arrow-trend-up me-1 text-success"></i> Post-Training Access
                      </strong>
                      <ul className="list-unstyled small text-muted mb-0 d-flex flex-column gap-1">
                        {course.courseMaterials.postTrainingAccess.map((post, idx) => (
                          <li key={idx}>• {post}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prerequisites & Recommended Courses */}
          <div className="egsa-card p-4 mb-4">
            <h6 className="fw-bold text-secondary-egsa mb-3 d-flex align-items-center gap-2">
              <i className="fa-solid fa-clipboard-list text-primary-egsa"></i>
              Prerequisites & Academic Preparation
            </h6>

            {hasMandatoryPrereqs && (
              <div className="p-3 border border-danger-subtle rounded bg-danger-subtle mb-3">
                <strong className="text-danger small d-block mb-1">
                  <i className="fa-solid fa-triangle-exclamation me-1"></i> Mandatory Prerequisites:
                </strong>
                <ul className="mb-0 small text-danger fw-semibold">
                  {course.mandatoryPrerequisites.map((p) => (
                    <li key={p._id}>
                      <Link to={`/student/courses/${p._id}`} className="text-danger text-decoration-underline">
                        {p.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {hasPrereqList ? (
              <ul className="list-unstyled small text-muted mb-3 d-flex flex-column gap-1">
                {course.prerequisitesList.map((prereq, idx) => (
                  <li key={idx} className="d-flex align-items-center gap-2">
                    <i className="fa-solid fa-circle-info text-primary-egsa"></i>
                    <span>{prereq}</span>
                  </li>
                ))}
              </ul>
            ) : !hasMandatoryPrereqs && (
              <p className="small text-muted mb-3">
                <i className="fa-solid fa-circle-check text-success me-1"></i>
                No formal prerequisites required. Suitable for beginners and university students.
              </p>
            )}

            {hasRecommendedCourses && (
              <div className="pt-2 border-top">
                <small className="text-muted fw-semibold d-block mb-2">Recommended Preparatory Courses in this Track:</small>
                <div className="d-flex flex-wrap gap-2">
                  {course.recommendedPreviousCourses.map((rec) => (
                    <Link
                      key={rec._id}
                      to={`/student/courses/${rec._id}`}
                      className="btn btn-sm btn-outline-secondary"
                    >
                      <i className="fa-solid fa-arrow-right me-1"></i> {rec.title}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Career Impact */}
          {hasCareerImpact && (
            <div className="egsa-card p-4 mb-4">
              <h6 className="fw-bold text-secondary-egsa mb-3 d-flex align-items-center gap-2">
                <i className="fa-solid fa-briefcase text-primary-egsa"></i>
                Career Impact & Pathways
              </h6>
              <div className="row g-2">
                {course.careerImpact.map((item, idx) => (
                  <div key={idx} className="col-md-6">
                    <div className="p-3 border rounded bg-white shadow-sm h-100 d-flex align-items-start gap-2">
                      <i className="fa-solid fa-rocket text-primary-egsa mt-1"></i>
                      <span className="small text-dark">{item}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Certification & Evaluation */}
          {hasCertification && (
            <div className="egsa-card p-4 mb-4">
              <h6 className="fw-bold text-secondary-egsa mb-2 d-flex align-items-center gap-2">
                <i className="fa-solid fa-certificate text-primary-egsa"></i>
                Certification & Evaluation
              </h6>
              <p className="small text-muted mb-2">
                Participants successfully completing this program receive an official{' '}
                <strong className="text-dark">{course.certificationDetails.certificateType}</strong> issued by the Egyptian Space Agency (EgSA).
              </p>
              {course.certificationDetails.evaluationCriteria?.length > 0 && (
                <div>
                  <small className="text-muted fw-semibold d-block mb-1">Evaluation is based on:</small>
                  <div className="d-flex flex-wrap gap-2">
                    {course.certificationDetails.evaluationCriteria.map((crit, idx) => (
                      <span key={idx} className="badge bg-light text-primary-egsa border border-primary-subtle p-2">
                        <i className="fa-solid fa-check me-1"></i> {crit}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Academy Policies */}
          <div className="egsa-card p-4">
            <h6 className="fw-bold text-dark mb-2 d-flex align-items-center gap-2">
              <i className="fa-solid fa-shield-halved text-primary-egsa"></i>
              Space Academy Policies
            </h6>
            <div className="small text-muted mb-2">
              <strong>Payment Policy:</strong> {course.paymentPolicy || 'Full payment must be confirmed at least 72 hours before start date.'}
            </div>
            <div className="small text-muted">
              <strong>Cancellation & Refund:</strong> {course.refundPolicy || 'Refunds available up to 7 days before course start.'}
            </div>
          </div>
        </div>

        {/* Right Sidebar Summary */}
        <div className="col-lg-4">
          <div className="egsa-card p-4 sticky-top" style={{ top: '85px' }}>
            <div className="mb-3">
              <span className="badge bg-primary-egsa mb-2">{course.category}</span>
              <div className="text-muted small">Tuition Fee</div>
              <h3 className="fw-bold text-accent-egsa mb-0">
                {course.price != null ? `${course.price} ${course.currency || 'EGP'}` : 'Pricing TBA'}
              </h3>
            </div>

            <hr className="my-3" />

            <ul className="list-unstyled small d-flex flex-column gap-2 mb-4">
              <li className="d-flex justify-content-between">
                <span className="text-muted"><i className="fa-regular fa-clock me-2"></i>Duration:</span>
                <strong className="text-dark">
                  {course.duration != null ? `${course.duration} ${course.durationUnit || 'Days'}` : 'TBA'}
                </strong>
              </li>
              {course.hoursPerDay && (
                <li className="d-flex justify-content-between">
                  <span className="text-muted"><i className="fa-solid fa-business-time me-2"></i>Daily Schedule:</span>
                  <strong className="text-dark">{course.hoursPerDay}</strong>
                </li>
              )}
              <li className="d-flex justify-content-between">
                <span className="text-muted"><i className="fa-solid fa-location-dot me-2"></i>Delivery Mode:</span>
                <strong className="text-dark">{course.deliveryMode}</strong>
              </li>
              <li className="d-flex justify-content-between">
                <span className="text-muted"><i className="fa-solid fa-building me-2"></i>Location:</span>
                <strong className="text-dark">{course.location || 'EGSA Academy'}</strong>
              </li>
              <li className="d-flex justify-content-between">
                <span className="text-muted"><i className="fa-solid fa-layer-group me-2"></i>Level Tier:</span>
                <strong className="text-dark">{course.level}</strong>
              </li>
              <li className="d-flex justify-content-between">
                <span className="text-muted"><i className="fa-solid fa-chalkboard-user me-2"></i>Instructor:</span>
                <strong className="text-dark">{course.instructor || 'EGSA Faculty'}</strong>
              </li>
              {course.startDate && (
                <li className="d-flex justify-content-between">
                  <span className="text-muted"><i className="fa-regular fa-calendar me-2"></i>Start Date:</span>
                  <strong className="text-dark">{new Date(course.startDate).toLocaleDateString()}</strong>
                </li>
              )}
              {course.capacity != null && (
                <li className="d-flex justify-content-between">
                  <span className="text-muted"><i className="fa-solid fa-chair me-2"></i>Available Seats:</span>
                  <strong className="text-secondary-egsa">{course.availableSeats ?? course.capacity} seats</strong>
                </li>
              )}
            </ul>

            <div className="d-grid gap-2">
              {renderAction(false)}
              <Link to="/student/programs" className="btn btn-outline-secondary">
                <i className="fa-solid fa-arrow-left me-1"></i> Back to Catalog
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
