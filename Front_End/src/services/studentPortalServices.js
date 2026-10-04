import api from './api';
import { enrollmentService, certificateService, applicationService } from './cycleServices';

// Helper to get current user ID
function getCurrentUserId() {
  try {
    const user = JSON.parse(localStorage.getItem('egsa_user') || '{}');
    return user.id || user._id || 'guest';
  } catch {
    return 'guest';
  }
}

/**
/**
 * ATTENDANCE SERVICE
 * Single source of truth connected to backend /api/attendance endpoints.
 * Integrates real TrainingSession, AttendanceRecord, Warning Engine, and QR Verification.
 */
export const attendanceService = {
  /**
   * Retrieves comprehensive attendance telemetry and graduated warning state for student.
   * @param {string} [enrollmentId] - Optional enrollment ID to scope to a single course
   */
  async getStudentAttendance(enrollmentId) {
    try {
      const res = await api.get('/attendance/summary', {
        params: enrollmentId ? { enrollmentId } : {},
      });
      return res.data?.data || {
        overallPercentage: 100,
        totalSessions: 0,
        presentSessions: 0,
        lateSessions: 0,
        absentSessions: 0,
        excusedSessions: 0,
        upcomingSessions: 0,
        warningState: 'NORMAL',
        warningMessage: 'Attendance is on track.',
        certificateEligibility: 'ON_TRACK',
        isEligibleForCertification: true,
        courses: [],
        policy: {
          minimumAttendancePercentage: 85,
          attentionThreshold: 10,
          warningThreshold: 15,
          finalWarningThreshold: 20,
        },
      };
    } catch (err) {
      console.error('Failed to fetch attendance summary from backend:', err);
      throw err;
    }
  },

  /**
   * Fetches official scheduled training sessions.
   * @param {Object} params - Query params (enrollmentId, cohortId, status)
   */
  async getSessions(params = {}) {
    const res = await api.get('/attendance/sessions', { params });
    return res.data?.data || [];
  },

  /**
   * Submits a secure QR attendance check-in token.
   * Validated server-side against enrollment, attendance window, and duplicate constraints.
   * @param {string} token - Cryptographic session attendance token
   * @param {string} [checkInMethod='QR_Scan'] - 'QR_Scan' | 'QR_Upload' | 'Manual_Code'
   */
  async markAttendanceQR(token, checkInMethod = 'QR_Scan') {
    const res = await api.post('/attendance/check-in/qr', {
      token: (token || '').trim(),
      checkInMethod,
    });
    return res.data;
  },

  /**
   * Submits an attendance dispute or excused absence request for instructor/admin review.
   * @param {Object} payload - { sessionId, enrollmentId, type, reason, evidenceUrl }
   */
  async submitDispute(payload) {
    const res = await api.post('/attendance/disputes', payload);
    return res.data;
  },

  /**
   * Fetches the current student's submitted attendance disputes/excuses.
   */
  async getMyDisputes() {
    const res = await api.get('/attendance/disputes/my');
    return res.data?.data || [];
  },

  /**
   * Fetches the centralized EGSA institutional attendance policy.
   */
  async getPolicy() {
    const res = await api.get('/attendance/policy');
    return res.data?.data || null;
  },
};

/**
 * ASSESSMENTS SERVICE
 * Supports both:
 * 1. Readiness Assessments (entry fit)
 * 2. Course Assessments & Exams (Module Quizzes, Practical Labs, Final Capstone)
 */
export const portalAssessmentService = {
  /**
   * Retrieves the authenticated student's real enrolled assessments and published evaluations.
   */
  async getMyAssessments(params = {}) {
    const res = await api.get('/assessments/my', { params });
    return res.data?.data || { assessments: [], summary: {} };
  },

  /**
   * Universal format adapter for backward compatibility with Progress, Training, and Assessment pages.
   */
  async getAssessments(params = {}) {
    try {
      const data = await this.getMyAssessments(params);
      const items = data.assessments || [];

      const courseAssessments = items.map((a) => {
        let mappedStatus = 'Not Started';
        if (a.status === 'Evaluated') {
          mappedStatus = a.resultLabel === 'Passed' ? 'Completed' : 'Failed';
        } else if (a.status === 'Pending Evaluation') {
          mappedStatus = 'Submitted';
        } else if (a.status === 'Upcoming') {
          mappedStatus = 'In Progress';
        }

        return {
          id: a.id,
          assessmentId: a.id,
          courseId: a.courseId,
          courseTitle: a.courseTitle,
          cohortName: a.cohortName,
          title: a.title,
          description: a.description,
          type: a.type,
          dueDate: a.dueDate || new Date().toISOString(),
          status: mappedStatus,
          rawStatus: a.status,
          score: a.score,
          maxScore: a.maxScore || 100,
          percentage: a.percentage,
          passingScore: a.passingScore || 70,
          weight: a.weight ? `${a.weight}%` : '25%',
          resultLabel: a.resultLabel,
          submittedAt: a.evaluatedAt,
          feedback: a.feedback,
          strengths: a.strengths,
          improvementAreas: a.improvementAreas,
          instructorName: a.instructorName,
          sessionTitle: a.sessionTitle,
          sessionDate: a.sessionDate,
          isMandatory: a.isMandatory !== false,
        };
      });

      return {
        courseAssessments,
        summary: data.summary || {
          totalAssessments: courseAssessments.length,
          completedCount: courseAssessments.filter((c) => c.status === 'Completed').length,
          pendingCount: courseAssessments.filter((c) => c.rawStatus === 'Pending Evaluation').length,
          upcomingCount: courseAssessments.filter((c) => c.rawStatus === 'Upcoming').length,
          averagePercentage: data.summary?.averagePercentage || null,
        },
      };
    } catch (err) {
      console.error('[ASSESSMENT] Failed to load assessments from API:', err);
      return { courseAssessments: [], summary: {} };
    }
  },

  /**
   * Retrieves single assessment details.
   */
  async getAssessmentById(id) {
    const res = await api.get(`/assessments/${id}`);
    return res.data?.data || null;
  },

  /**
   * Submits student assessment work (file, text, or both).
   */
  async submitAssessment(id, formData) {
    const res = await api.post(`/assessments/${id}/submit`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return res.data;
  },

  /**
   * INSTRUCTOR / ADMIN: Lists assessments.
   */
  async listAssessments(params = {}) {
    const res = await api.get('/assessments', { params });
    return res.data?.data || [];
  },

  /**
   * INSTRUCTOR / ADMIN: Creates a new assessment definition.
   */
  async createAssessment(data) {
    const res = await api.post('/assessments', data);
    return res.data;
  },

  /**
   * INSTRUCTOR / ADMIN: Updates an assessment definition.
   */
  async updateAssessment(id, data) {
    const res = await api.patch(`/assessments/${id}`, data);
    return res.data;
  },

  /**
   * INSTRUCTOR / ADMIN: Retrieves cohort students and their evaluation states for an assessment.
   */
  async getCohortStudents(assessmentId) {
    const res = await api.get(`/assessments/${assessmentId}/students`);
    return res.data?.data || { assessment: null, roster: [], summary: {} };
  },

  /**
   * INSTRUCTOR / ADMIN: Records a student's score and evaluation (Draft or Finalized).
   */
  async recordEvaluation(assessmentId, studentId, data) {
    const res = await api.post(`/assessments/${assessmentId}/students/${studentId}/evaluate`, data);
    return res.data;
  },

  /**
   * INSTRUCTOR / ADMIN: Finalizes an evaluation.
   */
  async finalizeEvaluation(resultId) {
    const res = await api.post(`/assessments/results/${resultId}/finalize`);
    return res.data;
  },

  /**
   * INSTRUCTOR / ADMIN: Publishes evaluation to student and triggers notification.
   */
  async publishEvaluation(resultId) {
    const res = await api.post(`/assessments/results/${resultId}/publish`);
    return res.data;
  },

  /**
   * INSTRUCTOR / ADMIN: Returns faculty overview metrics.
   */
  async getFacultyOverviewStats() {
    const res = await api.get('/assessments/stats/overview');
    return res.data?.data || {};
  },
};

/**
 * EVALUATION SERVICE
 * Course & Instructor Evaluation.
 * Prevents duplicate submissions and stores submitted responses per user.
 */
export const evaluationService = {
  getStorageKey(userId, courseId) {
    return `egsa_eval_${userId}_${courseId}`;
  },

  async getEvaluations() {
    const userId = getCurrentUserId();
    const [enrollmentsRes, serverEvalsRes] = await Promise.all([
      enrollmentService.my().catch(() => ({ data: [] })),
      api.get('/evaluations/my').catch(() => ({ data: { data: [] } })),
    ]);

    const enrollments = enrollmentsRes.data || [];
    const serverEvals = serverEvalsRes.data?.data || [];
    const evalMap = new Map();
    serverEvals.forEach((ev) => {
      const cId = String(ev.course?._id || ev.course);
      evalMap.set(cId, ev);
    });

    return Promise.all(
      enrollments.map(async (enr) => {
        const course = enr.course || {};
        const courseIdStr = String(course._id);
        let submission = evalMap.get(courseIdStr) || null;

        // Auto-migration from legacy localStorage if present and not yet on server
        if (!submission && userId && course._id) {
          const storageKey = this.getStorageKey(userId, course._id);
          const savedData = localStorage.getItem(storageKey);
          if (savedData) {
            try {
              const localParsed = JSON.parse(savedData);
              if (localParsed?.ratings) {
                const syncRes = await api.post('/evaluations', {
                  courseId: course._id,
                  ratings: localParsed.ratings,
                  comments: localParsed.comments,
                });
                submission = syncRes.data?.data || localParsed;
                localStorage.removeItem(storageKey);
              }
            } catch (_) {}
          }
        }

          const isCourseCompleted = Boolean(submission?.courseFeedbackCompleted || submission?.ratings?.content);
          const isAgencyCompleted = Boolean(submission?.agencyFeedbackCompleted);
          const isCompleted = isCourseCompleted && isAgencyCompleted;

          return {
            enrollmentId: enr._id,
            courseId: course._id,
            courseTitle: course.title,
            courseCode: course.code,
            cohortName: enr.cohort?.name,
            instructor: course.instructor || 'EGSA Faculty',
            isCourseCompleted,
            isAgencyCompleted,
            isCompleted,
            submission,
            status: isCompleted ? 'Submitted' : (isCourseCompleted ? 'Agency Feedback Required' : 'Course Feedback Required'),
            availableDate: enr.createdAt || new Date().toISOString(),
          };
        })
      );
    },

    async submitEvaluation({ courseId, ratings, comments }) {
      const res = await api.post('/evaluations', {
        courseId,
        ratings,
        comments,
      });

      const userId = getCurrentUserId();
      if (userId && courseId) {
        localStorage.removeItem(this.getStorageKey(userId, courseId));
      }

      return res.data;
    },

    async submitAgencyEvaluation({ courseId, ratings, comments, recommendAgency }) {
      const res = await api.post('/evaluations/agency', {
        courseId,
        agencyRatings: ratings,
        comments,
        recommendAgency,
      });
      return res.data;
    },

    async getEvaluationForCourse(courseId) {
      const res = await api.get(`/evaluations/course/${courseId}`);
      return res.data?.data || null;
    },

    async getEvaluationStatus(courseId) {
      const res = await api.get(`/evaluations/status/${courseId}`);
      return res.data?.data || null;
    },
  };

/**
 * MEDIA / TRAINING MATERIALS SERVICE
 * Resources organized by: Track -> Course -> Module -> Resource item.
 */
export const mediaService = {
  /**
   * Retrieves the authenticated student's uploaded training media and summary counters.
   */
  async getMyMedia(params = {}) {
    const res = await api.get('/media/my', { params });
    return res.data?.data || { items: [], summary: {} };
  },

  /**
   * Uploads an institutional training photo with metadata.
   */
  async uploadMedia(formData) {
    const res = await api.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /**
   * Retrieves details of a specific media submission.
   */
  async getMediaDetails(id) {
    const res = await api.get(`/media/${id}`);
    return res.data?.data || null;
  },

  /**
   * Submits a draft media submission for admin review.
   */
  async submitDraft(id) {
    const res = await api.post(`/media/${id}/submit`);
    return res.data;
  },

  /**
   * Resubmits a rejected or changes-requested media submission.
   */
  async resubmitMedia(id, formData) {
    const res = await api.post(`/media/${id}/resubmit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  /**
   * Deletes a draft, rejected, or changes-requested media item.
   */
  async deleteMedia(id) {
    const res = await api.delete(`/media/${id}`);
    return res.data;
  },

  /**
   * Fetches published institutional media for the official public gallery.
   */
  async getPublicGallery(params = {}) {
    const res = await api.get('/media/public', { params });
    return res.data?.data || [];
  },

  /**
   * ADMIN: Lists all media submissions for editorial queue review.
   */
  async getAdminMedia(params = {}) {
    const res = await api.get('/media/admin/all', { params });
    return res.data?.data || { items: [], stats: {} };
  },

  /**
   * ADMIN: Approves media submission.
   */
  async approveMedia(id, notes) {
    const res = await api.post(`/media/admin/${id}/approve`, { notes });
    return res.data;
  },

  /**
   * ADMIN: Rejects media submission with institutional reason.
   */
  async rejectMedia(id, reason, comment) {
    const res = await api.post(`/media/admin/${id}/reject`, { reason, comment });
    return res.data;
  },

  /**
   * ADMIN: Requests modifications/resubmission from student.
   */
  async requestChanges(id, feedback) {
    const res = await api.post(`/media/admin/${id}/request-changes`, { feedback });
    return res.data;
  },

  /**
   * ADMIN: Curates approved media for official publication placement.
   */
  async selectForPublication(id, placement = 'general_gallery') {
    const res = await api.post(`/media/admin/${id}/select`, { placement });
    return res.data;
  },

  /**
   * ADMIN: Publishes media to official channels.
   */
  async publishMedia(id) {
    const res = await api.post(`/media/admin/${id}/publish`);
    return res.data;
  },

  /**
   * ADMIN: Unpublishes media from public display.
   */
  async unpublishMedia(id, reason) {
    const res = await api.post(`/media/admin/${id}/unpublish`, { reason });
    return res.data;
  },

  async getMediaLibrary() {
    const enrollmentsRes = await enrollmentService.my();
    const enrollments = enrollmentsRes.data || [];
    const enrolledCourseIds = new Set(enrollments.map((e) => String(e.course?._id || e.course)));

    // Standard EGSA resource repository structure
    const sampleLibraries = [
      {
        track: 'Space Technologies',
        courseId: 'sample-sat-fund',
        courseTitle: 'Satellite Systems Fundamentals',
        modules: [
          {
            moduleNumber: 1,
            moduleTitle: 'Introduction to Space Mission Engineering',
            resources: [
              {
                id: 'res-101',
                title: 'EGSA Lecture 01 — Mission Concepts & Space Environment (Slides)',
                type: 'pdf',
                size: '4.8 MB',
                duration: null,
                icon: 'fa-file-pdf',
                downloadUrl: '#',
                addedAt: '2026-09-10',
              },
              {
                id: 'res-102',
                title: 'Recorded Lecture 01: Launch Vehicles & Orbital Mechanics',
                type: 'video',
                size: '340 MB',
                duration: '1h 45m',
                icon: 'fa-file-video',
                downloadUrl: '#',
                addedAt: '2026-09-10',
              },
            ],
          },
          {
            moduleNumber: 2,
            moduleTitle: 'Subsystem Engineering: Power, Thermal, & ADCS',
            resources: [
              {
                id: 'res-103',
                title: 'Electrical Power Systems (EPS) Design Standards Handout',
                type: 'pdf',
                size: '2.1 MB',
                duration: null,
                icon: 'fa-file-pdf',
                downloadUrl: '#',
                addedAt: '2026-09-15',
              },
              {
                id: 'res-104',
                title: 'CubeSat Reaction Wheel CAD Models & Telemetry Sample Dataset',
                type: 'archive',
                size: '18.4 MB',
                duration: null,
                icon: 'fa-file-zipper',
                downloadUrl: '#',
                addedAt: '2026-09-16',
              },
              {
                id: 'res-105',
                title: 'Lab Recording: ADCS Sensor Calibration & Magnetorquer Testing',
                type: 'video',
                size: '420 MB',
                duration: '2h 10m',
                icon: 'fa-file-video',
                downloadUrl: '#',
                addedAt: '2026-09-17',
              },
            ],
          },
          {
            moduleNumber: 3,
            moduleTitle: 'Ground Station Operations & Telemetry Handshake',
            resources: [
              {
                id: 'res-106',
                title: 'EGSA Cairo Ground Station Frequency Coordination Protocol',
                type: 'pdf',
                size: '1.5 MB',
                duration: null,
                icon: 'fa-file-pdf',
                downloadUrl: '#',
                addedAt: '2026-09-20',
              },
            ],
          },
        ],
      },
    ];

    // Align with actual enrolled courses if available
    const result = enrollments.map((enr) => {
      const course = enr.course || {};
      return {
        track: course.category || 'Space Technologies',
        courseId: course._id,
        courseTitle: course.title,
        isEnrolled: true,
        modules: sampleLibraries[0].modules,
      };
    });

    if (result.length === 0) {
      // Show sample catalog with locked status
      return sampleLibraries.map((item) => ({
        ...item,
        isEnrolled: enrolledCourseIds.has(String(item.courseId)),
      }));
    }

    return result;
  },
};

/**
 * CERTIFICATION ELIGIBILITY SERVICE
 * Cross-references attendance, assessment, payment, and evaluation criteria.
 */
export const certificateCriteriaService = {
  async getCertificateStatus() {
    const [certsRes, enrollmentsRes, attendanceData, evaluations, assessData] = await Promise.all([
      certificateService.my().catch(() => ({ data: [] })),
      enrollmentService.my().catch(() => ({ data: [] })),
      attendanceService.getStudentAttendance().catch(() => ({ overallPercentage: 0 })),
      evaluationService.getEvaluations().catch(() => []),
      portalAssessmentService.getAssessments().catch(() => ({ courseAssessments: [], summary: {} })),
    ]);

    const certificates = certsRes.data || [];
    const enrollments = enrollmentsRes.data || [];
    const evaluationSubmitted = evaluations.some((e) => e.isCompleted);

    if (certificates.length > 0) {
      const activeCert = certificates[0];
      const isCourseDone = Boolean(activeCert.courseFeedbackCompleted);
      const isAgencyDone = Boolean(activeCert.agencyFeedbackCompleted);
      const isFeedbackDone = Boolean(activeCert.feedbackCompleted || (isCourseDone && isAgencyDone));

      return {
        isCertified: Boolean(activeCert.isIssued && activeCert.canReceiveCertificate),
        certificates,
        criteria: null,
        defaultStudentName: certsRes.defaultStudentName || null,
        eligibleEnrollments: certsRes.eligibleEnrollments || [],
        eligibleEnrollment: certsRes.eligibleEnrollments?.[0] || null,
        enrollment: enrollments[0] || null,
        feedbackCompleted: isFeedbackDone,
        courseFeedbackCompleted: isCourseDone,
        agencyFeedbackCompleted: isAgencyDone,
        adminCreated: Boolean(activeCert.adminCreated),
        isIssued: Boolean(activeCert.isIssued),
        canReceiveCertificate: Boolean(activeCert.canReceiveCertificate),
        currentState: activeCert.currentState,
        isDeadlinePassed: Boolean(activeCert.isDeadlinePassed),
        feedbackDeadline: activeCert.feedbackDeadline,
      };
    }

    // Build criteria tracker using centralized backend attendance policy
    const hasEnrollment = enrollments.length > 0;
    const hasPaid = enrollments.some((e) => e.status === 'Confirmed' || e.status === 'Active' || e.status === 'Completed');
    
    const minAttendance = attendanceData.policy?.minimumAttendancePercentage || 85;
    const certEligibility = attendanceData.certificateEligibility || 'ON_TRACK';
    const isEligibleByPolicy = attendanceData.isEligibleForCertification !== false && certEligibility !== 'INELIGIBLE' && certEligibility !== 'FAILED';
    const attendancePassed = isEligibleByPolicy && (attendanceData.overallPercentage >= minAttendance);

    let attendanceDesc = `Current attendance: ${attendanceData.overallPercentage}%. Required: ≥${minAttendance}%.`;
    if (certEligibility === 'INELIGIBLE' || certEligibility === 'FAILED') {
      attendanceDesc = `Absence exceeded permitted threshold (Current: ${attendanceData.overallPercentage}%). Certificate currently withheld under attendance policy.`;
    } else if (certEligibility === 'AT_RISK') {
      attendanceDesc = `Current attendance: ${attendanceData.overallPercentage}% (Below target). Attendance is at risk; attending all upcoming sessions is required for recovery.`;
    } else if (attendancePassed) {
      attendanceDesc = `Current attendance: ${attendanceData.overallPercentage}%. Requirement satisfied (≥${minAttendance}%).`;
    }

    // Check real assessments passed
    const courseAssessments = assessData.courseAssessments || [];
    const mandatoryAssessments = courseAssessments.filter((a) => a.isMandatory !== false);

    let assessmentsPassed = false;
    let assessmentsDesc = 'No mandatory course assessments recorded yet.';

    if (mandatoryAssessments.length > 0) {
      const passedList = mandatoryAssessments.filter((a) => a.score != null && a.resultLabel === 'Passed');
      const pendingCount = mandatoryAssessments.filter((a) => a.rawStatus === 'Pending Evaluation').length;
      assessmentsPassed = passedList.length === mandatoryAssessments.length;

      if (assessmentsPassed) {
        assessmentsDesc = `All ${mandatoryAssessments.length} mandatory assessments passed (Average: ${assessData.summary?.averagePercentage || 90}%).`;
      } else if (pendingCount > 0) {
        assessmentsDesc = `${passedList.length} of ${mandatoryAssessments.length} required milestones passed (${pendingCount} pending faculty evaluation).`;
      } else {
        assessmentsDesc = `${passedList.length} of ${mandatoryAssessments.length} required milestones completed and passed.`;
      }
    } else {
      assessmentsPassed = true;
      assessmentsDesc = 'No mandatory assessment barriers configured for this curriculum.';
    }

    const hasBackendEligible = certsRes.eligibleEnrollments && certsRes.eligibleEnrollments.length > 0;
    const academicRequirementsMet = hasPaid && attendancePassed && assessmentsPassed;
    const isEligibleToRequest = hasBackendEligible || academicRequirementsMet;
    const isEligibleForIssuance = (hasBackendEligible || academicRequirementsMet) && evaluationSubmitted;

    const criteriaList = [
      {
        id: 'payment',
        label: 'Course Enrollment & Payment Confirmation',
        met: hasPaid,
        description: hasPaid ? 'Enrollment confirmed with valid payment reference.' : 'No active paid enrollment detected.',
      },
      {
        id: 'attendance',
        label: `Minimum ${minAttendance}% Attendance Requirement`,
        met: attendancePassed,
        warningState: attendanceData.warningState,
        certificateEligibility: certEligibility,
        description: attendanceDesc,
      },
      {
        id: 'assessments',
        label: 'Course & Capstone Assessments Passed',
        met: assessmentsPassed,
        description: assessmentsDesc,
      },
      {
        id: 'evaluation',
        label: 'End-of-Course Student Evaluation Submitted',
        met: evaluationSubmitted,
        description: evaluationSubmitted ? 'Feedback submitted.' : 'Complete course and instructor evaluation.',
      },
      {
        id: 'board_approval',
        label: 'EGSA Academic Board Verification',
        met: isEligibleForIssuance,
        description: isEligibleForIssuance
          ? 'Academic requirements verified. Ready for official certificate issuance.'
          : 'Official clearance issued upon satisfaction of all prior requirements.',
      },
    ];

    const completedCount = criteriaList.filter((c) => c.met).length;
    const progressPercent = Math.round((completedCount / criteriaList.length) * 100);

    const eligibleEnrollment =
      certsRes.eligibleEnrollments?.[0] || (isEligibleToRequest ? enrollments[0] : null);

    return {
      isCertified: false,
      certificates: [],
      isEligibleToRequest,
      isEligibleForIssuance,
      feedbackCompleted: evaluationSubmitted,
      eligibleEnrollment,
      defaultStudentName: certsRes.defaultStudentName || null,
      criteria: {
        items: criteriaList,
        completedCount,
        totalCount: criteriaList.length,
        progressPercent,
        academicRequirementsMet,
        evaluationSubmitted,
      },
      enrollment: enrollments[0] || null,
    };
  },
};
