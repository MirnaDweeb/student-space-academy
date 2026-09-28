import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { courseService } from '../../services/courseService';
import { LoadingState, ErrorState, PageHeader } from '../../components/StateComponents.jsx';

export default function CourseDetailsPage() {
  const { id } = useParams();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    courseService
      .get(id)
      .then((res) => setCourse(res.data))
      .catch((err) => setError(err.response?.data?.message || 'Failed to load course details.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [id]);

  if (loading) return <LoadingState label="Loading space academy curriculum…" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!course) return null;

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
        actions={
          course.price != null ? (
            <Link to={`/student/courses/${course._id}/fit`} className="btn btn-primary btn-sm px-3">
              <i className="fa-solid fa-clipboard-check me-1"></i> Check My Fit & Apply
            </Link>
          ) : (
            <button className="btn btn-secondary btn-sm" disabled>
              Applications Opening Soon
            </button>
          )
        }
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
              {course.price != null ? (
                <Link to={`/student/courses/${course._id}/fit`} className="btn btn-primary">
                  <i className="fa-solid fa-clipboard-check me-1"></i> Check My Fit & Apply
                </Link>
              ) : (
                <button className="btn btn-secondary" disabled>
                  Applications Open Once Pricing Published
                </button>
              )}
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
