const ReadinessQuestion = require('../models/ReadinessQuestion');
const defaultReadinessQuestions = require('../seed/data/defaultReadinessQuestions');

/**
 * Idempotently ensures the shared/default readiness assessment questions exist in the database.
 * Stored with course: null and isDefault: true.
 * Never creates duplicate questions.
 */
async function ensureDefaultReadinessQuestions() {
  try {
    const existingCount = await ReadinessQuestion.countDocuments({ isDefault: true });
    if (existingCount < defaultReadinessQuestions.length) {
      for (const q of defaultReadinessQuestions) {
        const exists = await ReadinessQuestion.findOne({
          question: q.question,
          isDefault: true,
        });
        if (!exists) {
          await ReadinessQuestion.create({
            ...q,
            course: null,
            isDefault: true,
          });
        }
      }
      const finalCount = await ReadinessQuestion.countDocuments({ isDefault: true });
      console.log(`[DEFAULT READINESS INIT] Verified ${finalCount} shared default readiness questions`);
    }
  } catch (err) {
    console.error('[DEFAULT READINESS INIT ERROR]', err.message);
  }
}

module.exports = {
  ensureDefaultReadinessQuestions,
};
