const mongoose = require('mongoose');

/**
 * A CourseBundle is a discounted package of the courses at one level of one
 * track, sold as a single purchasable unit (e.g. "Electronics & Technology
 * Manufacturing - Level 1 Bundle" = 3 courses for 2000 EGP instead of the
 * sum of their individual prices).
 *
 * This is real business data from the provided roadmap, not an invented
 * concept - but only created where a bundle price was actually given.
 * Tracks/levels with no bundle price in the source data have no CourseBundle.
 *
 * NOTE: the Application/Invoice/Enrollment flow currently operates on a
 * single `course`. Whether a student can apply to/pay for an entire bundle
 * in one transaction (one invoice, N enrollments) is a pending design
 * decision - see implementation report ("MISSING BUSINESS DATA" /
 * "what I need from you next"). For now this model supports course
 * *discovery* and *pricing display* only.
 */
const CourseBundleSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // e.g. "Electronics & Technology Manufacturing — Level 1 Bundle"
    category: { type: String, required: true }, // track name, matches Course.category
    levelTier: { type: Number, enum: [1, 2, 3, 4], required: true },
    level: { type: String, required: true }, // matches Course.level label for that tier
    courses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true }],
    price: { type: Number, required: true },
    currency: { type: String, default: 'EGP' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

CourseBundleSchema.virtual('individualPriceTotal').get(function () {
  if (!this.populated('courses') && !Array.isArray(this.courses)) return null;
  if (this.courses.length && typeof this.courses[0] === 'object' && this.courses[0].price != null) {
    return this.courses.reduce((sum, c) => sum + c.price, 0);
  }
  return null;
});
CourseBundleSchema.set('toJSON', { virtuals: true });
CourseBundleSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('CourseBundle', CourseBundleSchema);
