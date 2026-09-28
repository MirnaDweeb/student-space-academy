const CourseBundle = require('../models/CourseBundle');
const { AppError } = require('../middleware/error');

async function listBundles(req, res, next) {
  try {
    const { category } = req.query;
    const filter = { isActive: true };
    if (category) filter.category = category;
    const bundles = await CourseBundle.find(filter).populate('courses', 'title level price duration durationUnit').sort({ category: 1, levelTier: 1 });
    res.json({ success: true, data: bundles });
  } catch (err) {
    next(err);
  }
}

async function getBundle(req, res, next) {
  try {
    const bundle = await CourseBundle.findById(req.params.id).populate('courses');
    if (!bundle) throw new AppError('Bundle not found.', 404);
    res.json({ success: true, data: bundle });
  } catch (err) {
    next(err);
  }
}

module.exports = { listBundles, getBundle };
