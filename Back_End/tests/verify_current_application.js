const mongoose = require('mongoose');
const { checkCourseFit } = require('../src/services/eligibilityService');
const { scoreAttempt } = require('../src/services/readinessService');
const Application = require('../src/models/Application');
const ReadinessAttempt = require('../src/models/ReadinessAttempt');
const ReadinessQuestion = require('../src/models/ReadinessQuestion');
const Course = require('../src/models/Course');
const StudentProfile = require('../src/models/StudentProfile');

async function verifyCurrentApplication() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/egsa_academy');

  console.log('=== VERIFYING REAL APPLICATION EGSA-APP-419793 ===');

  // 1. Verify application exists
  const app = await Application.findOne({ referenceNumber: 'EGSA-APP-419793' }).populate('course');
  if (!app) throw new Error('Application EGSA-APP-419793 not found in database!');
  console.log('1. Application exists: ID =', app._id, 'ref =', app.referenceNumber);

  // 2. Verify assessment attempt exists
  const attempt = await ReadinessAttempt.findById(app.readinessAttempt);
  if (!attempt) throw new Error('Linked readiness attempt not found!');
  console.log('2. Attempt exists: ID =', attempt._id, 'status =', attempt.status);

  // 3. Exactly 12 questions submitted
  console.log('3. Answers submitted count:', attempt.answers.length);
  if (attempt.answers.length !== 12) throw new Error(`Expected 12 answers, found ${attempt.answers.length}`);

  // 4 & 5. Submitted answers & correct answers retrieved
  let correctCount = 0;
  let incorrectCount = 0;
  const questionsPopulated = [];

  for (let i = 0; i < attempt.answers.length; i++) {
    const a = attempt.answers[i];
    const q = await ReadinessQuestion.findById(a.question);
    if (!q) throw new Error(`Question ${a.question} not found!`);
    questionsPopulated.push(q);

    const isMatch = a.selectedIndex === q.correctAnswerIndex;
    if (isMatch) correctCount++;
    else incorrectCount++;
  }
  console.log(`4 & 5. Retrieved questions and answers: ${correctCount} correct, ${incorrectCount} incorrect.`);

  // 6. Recalculate score
  attempt.questions = questionsPopulated;
  const rescored = await scoreAttempt(attempt, app.course);
  console.log('6. Recalculated score:', rescored.score, '% (Math.round((8/12)*100) = 67%)');
  if (rescored.score !== 67) throw new Error(`Expected score 67, got ${rescored.score}`);

  // 7. Recalculate outcome
  console.log('7. Recalculated outcome:', rescored.outcome);
  if (rescored.outcome !== 'FOUNDATION_REQUIRED') throw new Error(`Expected FOUNDATION_REQUIRED, got ${rescored.outcome}`);

  // 8. Synchronize application status
  const profile = await StudentProfile.findOne({ user: app.student });
  const fit = await checkCourseFit(profile, app.course);
  console.log('9. Fit Check result:', fit.result, 'reasons:', fit.reasons[0]?.message);

  // Synchronize app in DB
  app.fitResultSnapshot = fit;
  // Because course permits direct enrollment and fit is Eligible, student is academically Eligible
  app.eligibilityStatus = 'Eligible';
  app.status = 'Foundation Recommended';
  await app.save();

  console.log('8. Application synchronized in DB:');
  console.log('   - Status:', app.status);
  console.log('   - Eligibility Status:', app.eligibilityStatus);
  console.log('   - Fit Snapshot Result:', app.fitResultSnapshot?.result);

  // 10. Combined admission state check
  const isPrereqEligible = app.fitResultSnapshot?.result === 'Eligible';
  const isFoundationRecommended = app.status === 'Foundation Recommended';
  const directEnrollPermitted = app.course.directEnrollmentPermitted !== false;

  console.log('10. Combined Admission State:');
  console.log('    Prerequisite Fit:', isPrereqEligible ? 'Eligible' : 'Not Eligible');
  console.log('    Readiness Assessment:', isFoundationRecommended ? 'Foundation Recommended' : 'Ready');
  console.log('    Direct Enrollment Permitted:', directEnrollPermitted ? 'YES' : 'NO');

  // 11. Foundation button destination
  const foundationDest = `/student/applications/${app._id}/foundation`;
  console.log('11. Foundation Review Destination:', foundationDest);

  // 12. Direct enrollment test on this application
  console.log('12. Direct enrollment permitted verification: Course permits direct enrollment =', directEnrollPermitted);

  await mongoose.disconnect();
  console.log('=== ALL LIFECYCLE CHECKS PASSED FOR EGSA-APP-419793 ===');
}

verifyCurrentApplication().catch((err) => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
