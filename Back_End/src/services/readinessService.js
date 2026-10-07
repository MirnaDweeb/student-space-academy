const Course = require('../models/Course');

/**
 * Computes score, per-topic breakdown, knowledge gaps and outcome
 * from a submitted ReadinessAttempt (with populated questions/answers).
 */
async function scoreAttempt(attempt, course) {
  const total = attempt.answers.length || 1;
  const correct = attempt.answers.filter((a) => a.isCorrect).length;
  const score = Math.round((correct / total) * 100);

  // Topic breakdown
  const topicStats = {};
  attempt.answers.forEach((a) => {
    const q = attempt.questions.find((q2) => q2._id.toString() === a.question.toString());
    if (!q) return;
    if (!topicStats[q.topic]) topicStats[q.topic] = { correct: 0, total: 0 };
    topicStats[q.topic].total += 1;
    if (a.isCorrect) topicStats[q.topic].correct += 1;
  });

  const knowledgeGaps = Object.entries(topicStats)
    .filter(([, stat]) => stat.correct / stat.total < 0.6)
    .map(([topic]) => topic);

  const isThreeTier =
    course.scoringPolicy === 'THREE_TIER' ||
    course.slug === 'crossfit-functional-fitness-program' ||
    /crossfit/i.test(course.title || '');

  let outcome;
  if (isThreeTier) {
    if (score >= 80) {
      outcome = 'READY';
    } else if (score >= 50) {
      outcome = 'FOUNDATION_REQUIRED';
    } else {
      outcome = 'MANUAL_REVIEW';
    }
  } else {
    const minScore = course.minReadinessScore || 60;
    const borderline = score >= minScore - 15;

    if (score >= minScore && knowledgeGaps.length === 0) {
      outcome = 'READY';
    } else if (knowledgeGaps.length === 0 && borderline) {
      // No specific topic gap identified, but overall score is a bit under the bar.
      outcome = 'CONDITIONALLY_READY';
    } else if (knowledgeGaps.length === 1 && borderline) {
      // A single identified gap and an otherwise acceptable score: still fixable quickly.
      outcome = 'CONDITIONALLY_READY';
    } else if (knowledgeGaps.length >= 1) {
      // One or more confirmed knowledge gaps outside the borderline case:
      // knowledge gaps take priority over the raw score
      outcome = 'FOUNDATION_REQUIRED';
    } else {
      outcome = 'MANUAL_REVIEW';
    }
  }

  let recommendedCourse = null;
  if ((outcome === 'FOUNDATION_REQUIRED' || outcome === 'CONDITIONALLY_READY') && Array.isArray(course?.recommendedPreviousCourses) && course.recommendedPreviousCourses.length > 0) {
    const candidates = await Course.find({
      _id: { $in: course.recommendedPreviousCourses },
    });
    recommendedCourse = (candidates && candidates[0]) || null;
  }

  return { score, knowledgeGaps, outcome, recommendedCourse, topicStats };
}

module.exports = { scoreAttempt };
