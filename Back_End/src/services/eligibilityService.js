const Course = require('../models/Course');

/**
 * Evaluates whether a student fits a given course.
 * Business rule priority:
 *   1. Mandatory prerequisites ALWAYS override readiness score.
 *   2. Then required experience / academic status.
 *   3. Otherwise eligible, may still require readiness assessment.
 */
async function checkCourseFit(studentProfile, course) {
  const reasons = [];
  let result = 'Eligible';

  const completed = (studentProfile.completedCourses || []).map((c) => c.toString());

  // Rule 1: mandatory prerequisites
  const missingPrereqs = (course.mandatoryPrerequisites || []).filter(
    (p) => !completed.includes(p.toString())
  );

  if (missingPrereqs.length > 0) {
    const prereqCourses = await Course.find({ _id: { $in: missingPrereqs } }).select('title');
    result = 'Foundation Required';
    reasons.push({
      code: 'MISSING_PREREQUISITE',
      message: `Missing mandatory prerequisite(s): ${prereqCourses.map((c) => c.title).join(', ')}`,
      recommendedNextStep: prereqCourses[0]?.title || null,
      recommendedCourseId: prereqCourses[0]?._id || null,
    });
    // Mandatory prerequisite missing -> hard stop regardless of anything else.
    return { result, reasons, requiresReadiness: false };
  }

  // Rule 2: required experience (soft check -> conditionally eligible / manual review)
  const requiredExperience = course.requiredExperience || [];
  const studentExperience = (studentProfile.experience || []).map((e) => e.toLowerCase());
  const missingExperience = requiredExperience.filter(
    (req) => !studentExperience.some((e) => e.includes(req.toLowerCase()))
  );

  if (missingExperience.length > 0) {
    result = 'Conditionally Eligible';
    reasons.push({
      code: 'MISSING_EXPERIENCE',
      message: `Recommended experience not confirmed: ${missingExperience.join(', ')}`,
    });
  }

  // Rule 3: graduate-only advanced courses (example academic rule)
  if (course.level === 'Advanced' && studentProfile.status === 'student' && !studentProfile.academicYear) {
    result = result === 'Eligible' ? 'Manual Review' : result;
    reasons.push({
      code: 'ACADEMIC_STATUS_REVIEW',
      message: 'Academic year not specified for an Advanced-level course. Manual review recommended.',
    });
  }

  if (reasons.length === 0) {
    reasons.push({ code: 'OK', message: 'All prerequisite and experience checks passed.' });
  }

  return { result, reasons, requiresReadiness: true };
}

module.exports = { checkCourseFit };
