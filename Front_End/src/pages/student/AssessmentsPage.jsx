import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { assessmentService, enrollmentService, applicationService } from '../../services/cycleServices';
import { LoadingState, ErrorState, EmptyState, PageHeader } from '../../components/StateComponents.jsx';
import AssessmentCard from '../../components/assessments/AssessmentCard';
import AssessmentDetails from '../../components/assessments/AssessmentDetails';
import { getAssessmentText } from '../../utils/assessmentTranslations';

export default function AssessmentsPage() {
  const { user, language = 'en' } = useAuth();
  const t = getAssessmentText(language);
  const isAr = language === 'ar';

  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') || 'upcoming'; // 'upcoming' | 'submitted' | 'evaluated' | 'all' | 'readiness'
  const [activeSection, setActiveSection] = useState(initialTab);

  const [assessmentsData, setAssessmentsData] = useState({
    assessments: [],
    sections: {
      upcoming: [],
      submitted: [],
      evaluated: [],
    },
    summary: {},
  });

  const [enrollments, setEnrollments] = useState([]);
  const [selectedCourseFilter, setSelectedCourseFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [readinessApplications, setReadinessApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Selected assessment for details view
  const [activeAssessment, setActiveAssessment] = useState(null);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [assessRes, enrRes, appRes] = await Promise.all([
        assessmentService.my().catch(() => ({ data: { assessments: [], sections: { upcoming: [], submitted: [], evaluated: [] }, summary: {} } })),
        enrollmentService.my().catch(() => ({ data: [] })),
        applicationService.my().catch(() => ({ data: [] })),
      ]);

      const dataPayload = assessRes.data || assessRes;
      const allItems = dataPayload.assessments || [];
      const sections = dataPayload.sections || {
        upcoming: allItems.filter((a) => a.status === 'Upcoming'),
        submitted: allItems.filter((a) => a.status === 'Submitted' || a.status === 'Pending Evaluation'),
        evaluated: allItems.filter((a) => a.status === 'Evaluated'),
      };

      setAssessmentsData({
        assessments: allItems,
        sections,
        summary: dataPayload.summary || {},
      });

      setEnrollments(enrRes.data || []);

      const apps = (appRes.data || []).filter(
        (a) => a.readinessAttempt || a.status === 'Readiness Required' || a.status === 'Foundation Recommended'
      );
      setReadinessApplications(apps);
    } catch (err) {
      setError(err.response?.data?.message || err.message || (isAr ? 'فشل تحميل بيانات التقييمات.' : 'Failed to load assessments.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update URL param when section changes
  const handleSectionChange = (section) => {
    setActiveSection(section);
    setSearchParams({ tab: section });
  };

  if (loading) return <LoadingState label={isAr ? 'جاري تحميل سجلات التقييمات الأكاديمية…' : 'Loading your Academy assessment records…'} />;
  if (error) return <ErrorState message={error} onRetry={loadData} />;

  // Filter list by selected course and search query
  const filterList = (items = []) => {
    return items.filter((item) => {
      // Course filter
      if (selectedCourseFilter !== 'ALL') {
        const itemCourseId = String(item.courseId || item.course?._id || item.course || '');
        if (itemCourseId !== selectedCourseFilter) return false;
      }
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const titleMatch = item.title?.toLowerCase().includes(q);
        const courseMatch = item.courseTitle?.toLowerCase().includes(q);
        const instructorMatch = item.instructorName?.toLowerCase().includes(q);
        if (!titleMatch && !courseMatch && !instructorMatch) return false;
      }
      return true;
    });
  };

  const upcomingList = filterList(assessmentsData.sections?.upcoming || []);
  const submittedList = filterList(assessmentsData.sections?.submitted || []);
  const evaluatedList = filterList(assessmentsData.sections?.evaluated || []);
  const allList = filterList(assessmentsData.assessments || []);

  const totalUpcoming = assessmentsData.sections?.upcoming?.length || 0;
  const totalSubmitted = assessmentsData.sections?.submitted?.length || 0;
  const totalEvaluated = assessmentsData.sections?.evaluated?.length || 0;

  // Determine current active list
  let currentDisplayList = upcomingList;
  if (activeSection === 'submitted') currentDisplayList = submittedList;
  if (activeSection === 'evaluated') currentDisplayList = evaluatedList;
  if (activeSection === 'all') currentDisplayList = allList;

  // Distinct courses from enrollments for filter dropdown
  const uniqueEnrolledCourses = [];
  const seenCourses = new Set();
  enrollments.forEach((e) => {
    const c = e.course;
    if (c && !seenCourses.has(String(c._id))) {
      seenCourses.add(String(c._id));
      uniqueEnrolledCourses.push(c);
    }
  });

  return (
    <div>
      <PageHeader
        title={t.assessmentsTitle}
        subtitle={t.assessmentsSubtitle}
        breadcrumbs={[
          { label: isAr ? 'لوحة المتابعة' : 'Portal', to: '/student/dashboard' },
          { label: isAr ? 'تدريبي' : 'My Training', to: '/student/training' },
          { label: isAr ? 'التقييمات' : 'Assessments' },
        ]}
        actions={
          <Link to="/student/training" className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1">
            <i className="fa-solid fa-satellite me-1"></i>
            <span>{isAr ? 'العودة لمركز التدريب' : 'My Training Cockpit'}</span>
          </Link>
        }
      />

      {/* Main Navigation Tabs: Course Assessments vs Readiness Diagnostics */}
      <div className="d-flex flex-wrap align-items-center justify-content-between border-bottom pb-2 mb-4 gap-2">
        <ul className="nav nav-pills gap-2">
          <li className="nav-item">
            <button
              className={`nav-link fw-semibold rounded-pill px-4 ${activeSection !== 'readiness' ? 'active' : 'text-secondary'}`}
              onClick={() => handleSectionChange('upcoming')}
            >
              <i className="fa-solid fa-list-check me-2"></i>
              {isAr ? 'تقييمات البرامج التدريبية' : 'Course Assessments'} ({assessmentsData.assessments.length})
            </button>
          </li>
          <li className="nav-item">
            <button
              className={`nav-link fw-semibold rounded-pill px-4 ${activeSection === 'readiness' ? 'active' : 'text-secondary'}`}
              onClick={() => handleSectionChange('readiness')}
            >
              <i className="fa-solid fa-square-poll-vertical me-2"></i>
              {isAr ? 'اختبارات الجاهزية' : 'Readiness Diagnostics'} ({readinessApplications.length})
            </button>
          </li>
        </ul>

        <div className="text-muted small">
          <i className="fa-solid fa-shield-halved text-primary me-1"></i>
          {isAr ? 'وكالة الفضاء المصرية — الشؤون الأكاديمية' : 'Egyptian Space Agency — Academic Affairs'}
        </div>
      </div>

      {/* Tab: Readiness Diagnostics */}
      {activeSection === 'readiness' ? (
        <div>
          {readinessApplications.length === 0 ? (
            <EmptyState
              icon="fa-clipboard-check"
              title={isAr ? 'لا توجد اختبارات جاهزية مطلوبة' : 'No readiness assessments required'}
              message={isAr ? 'تظهر اختبارات الجاهزية عند تقديم طلب لبرنامج تدريبي يتطلب تقييم المعارف الأساسية.' : 'Readiness evaluations appear here when applying for specialized technical programs requiring diagnostic readiness checks.'}
              actionLabel={isAr ? 'استكشاف البرامج' : 'Explore Programs'}
              actionLink="/student/programs"
            />
          ) : (
            <div className="row g-3">
              {readinessApplications.map((app) => (
                <div key={app._id} className="col-12 col-md-6">
                  <div className="egsa-card p-4 h-100 shadow-sm">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="badge bg-info-subtle text-info border px-2 py-1">
                        {isAr ? 'تقييم الجاهزية' : 'Readiness Diagnostic'}
                      </span>
                      <span className="badge bg-light text-dark border">
                        {app.status}
                      </span>
                    </div>
                    <h5 className="fw-bold text-dark mb-1">{app.course?.title || 'EGSA Program'}</h5>
                    <p className="text-secondary small mb-3">
                      {isAr ? 'تقييم المعارف الفنية الأساسية ومتطلبات البرنامج التدريبي.' : 'Assessment of baseline scientific competencies and technical foundation.'}
                    </p>
                    <div className="d-flex justify-content-end">
                      {app.readinessAttempt ? (
                        <Link to={`/student/readiness/${app.readinessAttempt._id || app.readinessAttempt}/result`} className="btn btn-sm btn-outline-primary">
                          <i className="fa-solid fa-square-poll-vertical me-1"></i> {isAr ? 'عرض النتيجة' : 'View Result'}
                        </Link>
                      ) : (
                        <Link to={`/student/readiness/start?courseId=${app.course?._id || app.course}`} state={{ courseId: app.course?._id || app.course }} className="btn btn-sm btn-primary">
                          <i className="fa-solid fa-play me-1"></i> {isAr ? 'بدء التقييم' : 'Start Diagnostic'}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Tab: Course Training Assessments */
        <>
          {/* Section Summary Metrics Cards */}
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3">
              <div
                className={`egsa-card p-3 h-100 border-start border-4 border-secondary cursor-pointer transition-all ${
                  activeSection === 'upcoming' ? 'shadow-sm bg-light' : ''
                }`}
                onClick={() => handleSectionChange('upcoming')}
                style={{ cursor: 'pointer' }}
              >
                <div className="d-flex align-items-center justify-content-between text-muted small mb-1">
                  <span className="text-uppercase fw-semibold" style={{ fontSize: '0.72rem' }}>{t.upcomingTab}</span>
                  <i className="fa-solid fa-calendar-day text-secondary"></i>
                </div>
                <div className="fs-3 fw-bold text-dark">{totalUpcoming}</div>
                <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{t.upcomingSubtitle}</div>
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div
                className={`egsa-card p-3 h-100 border-start border-4 border-warning cursor-pointer transition-all ${
                  activeSection === 'submitted' ? 'shadow-sm bg-light' : ''
                }`}
                onClick={() => handleSectionChange('submitted')}
                style={{ cursor: 'pointer' }}
              >
                <div className="d-flex align-items-center justify-content-between text-muted small mb-1">
                  <span className="text-uppercase fw-semibold" style={{ fontSize: '0.72rem' }}>{t.submittedTab}</span>
                  <i className="fa-solid fa-hourglass-half text-warning"></i>
                </div>
                <div className="fs-3 fw-bold text-warning">{totalSubmitted}</div>
                <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{t.submittedSubtitle}</div>
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div
                className={`egsa-card p-3 h-100 border-start border-4 border-success cursor-pointer transition-all ${
                  activeSection === 'evaluated' ? 'shadow-sm bg-light' : ''
                }`}
                onClick={() => handleSectionChange('evaluated')}
                style={{ cursor: 'pointer' }}
              >
                <div className="d-flex align-items-center justify-content-between text-muted small mb-1">
                  <span className="text-uppercase fw-semibold" style={{ fontSize: '0.72rem' }}>{t.evaluatedTab}</span>
                  <i className="fa-solid fa-circle-check text-success"></i>
                </div>
                <div className="fs-3 fw-bold text-success">{totalEvaluated}</div>
                <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{t.evaluatedSubtitle}</div>
              </div>
            </div>

            <div className="col-6 col-md-3">
              <div
                className={`egsa-card p-3 h-100 border-start border-4 border-primary cursor-pointer transition-all ${
                  activeSection === 'all' ? 'shadow-sm bg-light' : ''
                }`}
                onClick={() => handleSectionChange('all')}
                style={{ cursor: 'pointer' }}
              >
                <div className="d-flex align-items-center justify-content-between text-muted small mb-1">
                  <span className="text-uppercase fw-semibold" style={{ fontSize: '0.72rem' }}>{t.allTab}</span>
                  <i className="fa-solid fa-clipboard-list text-primary"></i>
                </div>
                <div className="fs-3 fw-bold text-primary">{assessmentsData.assessments.length}</div>
                <div className="text-muted small" style={{ fontSize: '0.75rem' }}>
                  {assessmentsData.summary.averagePercentage != null ? `${isAr ? 'المتوسط' : 'Avg'}: ${assessmentsData.summary.averagePercentage}%` : (isAr ? 'إجمالي التقييمات' : 'Enrolled milestones')}
                </div>
              </div>
            </div>
          </div>

          {/* Filtering and Controls Bar */}
          <div className="bg-white p-3 rounded-3 border mb-4 d-flex flex-wrap align-items-center justify-content-between gap-3">
            {/* Section Filter Pills */}
            <div className="d-flex flex-wrap gap-2 align-items-center">
              {[
                { id: 'upcoming', label: t.upcomingTab, count: totalUpcoming, color: 'btn-secondary' },
                { id: 'submitted', label: t.submittedTab, count: totalSubmitted, color: 'btn-warning text-dark' },
                { id: 'evaluated', label: t.evaluatedTab, count: totalEvaluated, color: 'btn-success text-white' },
                { id: 'all', label: t.allTab, count: assessmentsData.assessments.length, color: 'btn-primary' },
              ].map((sec) => (
                <button
                  key={sec.id}
                  type="button"
                  className={`btn btn-sm rounded-pill px-3 transition-all ${
                    activeSection === sec.id ? 'btn-primary shadow-sm' : 'btn-outline-secondary'
                  }`}
                  onClick={() => handleSectionChange(sec.id)}
                >
                  {sec.label}{' '}
                  <span className={`badge rounded-pill ms-1 ${activeSection === sec.id ? 'bg-light text-primary' : 'bg-secondary text-white'}`}>
                    {sec.count}
                  </span>
                </button>
              ))}
            </div>

            {/* Course Filter Dropdown & Search Input */}
            <div className="d-flex flex-wrap align-items-center gap-2">
              {uniqueEnrolledCourses.length > 1 && (
                <select
                  className="form-select form-select-sm"
                  style={{ width: 'auto', minWidth: '180px' }}
                  value={selectedCourseFilter}
                  onChange={(e) => setSelectedCourseFilter(e.target.value)}
                >
                  <option value="ALL">{isAr ? 'جميع البرامج المسجلة' : 'All Enrolled Courses'}</option>
                  {uniqueEnrolledCourses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              )}

              <div className="input-group input-group-sm" style={{ width: '220px' }}>
                <span className="input-group-text bg-light border-end-0">
                  <i className="fa-solid fa-magnifying-glass text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder={isAr ? 'بحث في التقييمات...' : 'Search assessments...'}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Assessment Cards List */}
          {currentDisplayList.length === 0 ? (
            <EmptyState
              icon="fa-folder-open"
              title={t.noAssessments}
              message={
                selectedCourseFilter !== 'ALL' || searchQuery.trim()
                  ? (isAr ? 'لا توجد تقييمات تطابق معايير البحث الحالية.' : 'No assessments match your current search or course filter.')
                  : (isAr ? 'لم يتم العثور على تقييمات في هذا القسم.' : 'No assessments found for this section.')
              }
              actionLabel={selectedCourseFilter !== 'ALL' || searchQuery.trim() ? (isAr ? 'إعادة ضبط التصفية' : 'Reset Filters') : null}
              onAction={() => {
                setSelectedCourseFilter('ALL');
                setSearchQuery('');
              }}
            />
          ) : (
            <div className="d-flex flex-column gap-3">
              {currentDisplayList.map((item) => (
                <AssessmentCard
                  key={item.id || item.assessmentId || item._id}
                  assessment={item}
                  language={language}
                  onView={(a) => setActiveAssessment(a)}
                />
              ))}
            </div>
          )}

          {/* Dedicated Assessment Details Modal */}
          {activeAssessment && (
            <AssessmentDetails
              assessmentId={activeAssessment.id || activeAssessment.assessmentId || activeAssessment._id}
              initialAssessment={activeAssessment}
              language={language}
              onClose={() => setActiveAssessment(null)}
              onUpdated={() => {
                loadData();
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
