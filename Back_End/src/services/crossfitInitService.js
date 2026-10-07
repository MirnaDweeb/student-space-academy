const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const ReadinessQuestion = require('../models/ReadinessQuestion');
const {
  CROSSFIT_COURSE_SLUG,
  crossfitCourse,
  crossfitCohort,
  crossfitQuestions,
} = require('../seed/data/crossfitCourseData');

/**
 * Idempotently ensures the official CrossFit course record,
 * its active cohort, and its 12-question readiness bank exist in the database.
 * Never creates duplicate records or hardcodes fake IDs.
 */
async function ensureCrossfitCourse() {
  // 1. Find or create Course
  let course = await Course.findOne({
    $or: [{ slug: CROSSFIT_COURSE_SLUG }, { title: new RegExp('^CrossFit', 'i') }],
  });

  if (!course) {
    course = await Course.create({
      ...crossfitCourse,
      slug: CROSSFIT_COURSE_SLUG,
    });
    console.log(`[CROSSFIT INIT] Created CrossFit course record: ${course.title} (ID: ${course._id})`);
  }

  // 2. Find or create Cohort
  let cohort = await Cohort.findOne({ course: course._id, status: 'Scheduled' });
  if (!cohort) {
    cohort = await Cohort.create({
      ...crossfitCohort,
      course: course._id,
    });
    console.log(`[CROSSFIT INIT] Created CrossFit scheduled cohort: ${cohort.name} (ID: ${cohort._id})`);
  }

  // 3. Ensure readiness questions exist for this course
  const existingCount = await ReadinessQuestion.countDocuments({ course: course._id });
  if (existingCount < crossfitQuestions.length) {
    // Upsert or insert missing questions
    for (const q of crossfitQuestions) {
      const exists = await ReadinessQuestion.findOne({
        course: course._id,
        question: q.question,
      });
      if (!exists) {
        await ReadinessQuestion.create({
          ...q,
          course: course._id,
        });
      }
    }
    const finalCount = await ReadinessQuestion.countDocuments({ course: course._id });
    console.log(`[CROSSFIT INIT] Verified ${finalCount} readiness questions for CrossFit course`);
  }

  return { course, cohort };
}

module.exports = {
  ensureCrossfitCourse,
  CROSSFIT_COURSE_SLUG,
};
