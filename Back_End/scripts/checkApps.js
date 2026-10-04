const mongoose = require('mongoose');

async function checkApps() {
  await mongoose.connect('mongodb://127.0.0.1:27017/egsa_academy');
  const Application = require('../src/models/Application');
  const Course = require('../src/models/Course');
  const User = require('../src/models/User');

  const apps = await Application.find({}).populate('course', 'title code slug').populate('student', 'fullName email');
  console.log('Total Applications in DB:', apps.length);
  for (const a of apps) {
    console.log(`- App ${a.referenceNumber || a._id}: Student=${a.student?.email} | Course=${a.course?.title} (${a.course?._id}) | Status=${a.status}`);
  }

  // Also check published courses
  const publishedCourses = await Course.find({ isPublished: true }).select('title code slug _id');
  console.log('\nPublished Courses count:', publishedCourses.length);
  for (const pc of publishedCourses.slice(0, 5)) {
    console.log(`- [${pc.code || pc.slug}] ${pc.title} (${pc._id})`);
  }

  await mongoose.disconnect();
}

checkApps().catch(console.error);
