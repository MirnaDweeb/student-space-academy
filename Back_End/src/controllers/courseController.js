const Course = require('../models/Course');
const StudentProfile = require('../models/StudentProfile');
const ReadinessQuestion = require('../models/ReadinessQuestion');
const { checkCourseFit } = require('../services/eligibilityService');
const { AppError } = require('../middleware/error');

async function listCourses(req, res, next) {
  try {
    const { q, goal, category, level, levelTier, deliveryMode, minPrice, maxPrice, sort } = req.query;
    const filter = { isActive: true };
    if (q) filter.title = { $regex: q, $options: 'i' };
    if (goal) filter.goals = goal;
    if (category) filter.category = category;
    if (level) filter.level = level;
    if (levelTier) filter.levelTier = Number(levelTier);
    if (deliveryMode) filter.deliveryMode = deliveryMode;
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    let sortSpec = { startDate: 1 };
    if (sort === 'price_asc') sortSpec = { price: 1 };
    if (sort === 'price_desc') sortSpec = { price: -1 };
    if (sort === 'newest') sortSpec = { createdAt: -1 };

    const courses = await Course.find(filter).populate('goals').sort(sortSpec);
    res.json({ success: true, data: courses });
  } catch (err) {
    next(err);
  }
}

async function getCourse(req, res, next) {
  try {
    const course = await Course.findById(req.params.id)
      .populate('goals')
      .populate('mandatoryPrerequisites', 'title slug level')
      .populate('recommendedPreviousCourses', 'title slug level');
    if (!course) throw new AppError('Course not found.', 404);
    let hasCustomReadinessQuestions = false;
    try {
      hasCustomReadinessQuestions = !!(await ReadinessQuestion.exists({ course: course._id, isDefault: { $ne: true } }));
    } catch (_) {
      hasCustomReadinessQuestions = false;
    }
    const courseObj = typeof course.toObject === 'function' ? course.toObject() : { ...course };
    courseObj.hasCustomReadinessQuestions = hasCustomReadinessQuestions;
    courseObj.hasReadinessQuestions = true;
    res.json({ success: true, data: courseObj });
  } catch (err) {
    next(err);
  }
}

async function getCourseFit(req, res, next) {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) throw new AppError('Course not found.', 404);

    const profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) throw new AppError('Complete your profile before checking course fit.', 400);

    const fit = await checkCourseFit(profile, course);
    res.json({ success: true, data: fit });
  } catch (err) {
    next(err);
  }
}

module.exports = { listCourses, getCourse, getCourseFit };
