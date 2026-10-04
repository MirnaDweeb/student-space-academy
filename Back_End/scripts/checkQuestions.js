const mongoose = require('mongoose');

async function check() {
  await mongoose.connect('mongodb://127.0.0.1:27017/egsa_academy');
  const ReadinessQuestion = mongoose.model('ReadinessQuestion', new mongoose.Schema({}, { strict: false }));
  const Course = mongoose.model('Course', new mongoose.Schema({}, { strict: false }));

  const totalQuestions = await ReadinessQuestion.countDocuments();
  console.log('Total Readiness Questions in DB:', totalQuestions);

  const courses = await Course.find({}).select('_id title code slug');
  console.log('Total Courses:', courses.length);
  for (const c of courses) {
    const qCount = await ReadinessQuestion.countDocuments({ course: c._id });
    console.log(`Course [${c.code || c.slug}] ${c.title} (${c._id}): ${qCount} questions`);
  }

  // Also check if any question exists with non-matching course IDs
  const allQ = await ReadinessQuestion.find({}).select('course question');
  console.log('Sample questions in DB (if any):', allQ.slice(0, 5));

  await mongoose.disconnect();
}

check().catch(console.error);
