require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Course = require('../models/Course');
const { ENRICHED_PDF_COURSES } = require('./data/enrichedPdfCourses');

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[()'’&]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function enrich() {
  await connectDB();
  console.log('[ENRICH] Connecting and updating official EGSA courses from PDFs...');

  let updatedCount = 0;
  let createdCount = 0;

  for (const cData of ENRICHED_PDF_COURSES) {
    // Search by title or category + keyword
    let course = await Course.findOne({
      $or: [
        { title: cData.targetTitle },
        { title: { $in: cData.alternativeTitles } },
        { titleEn: cData.titleEn },
        { category: cData.category, title: new RegExp(cData.targetTitle.replace(' Program', ''), 'i') },
      ],
    });

    const updateFields = {
      title: cData.title,
      titleEn: cData.titleEn,
      titleAr: cData.titleAr,
      tagline: cData.tagline,
      subtitle: cData.subtitle,
      targetAudience: cData.targetAudience,
      whoIsItFor: cData.whoIsItFor,
      overview: cData.overview,
      shortDescription: cData.tagline,
      whyThisCourse: cData.whyThisCourse,
      learningObjectives: cData.learningObjectives,
      learningOutcomes: cData.learningOutcomes,
      duration: cData.duration,
      durationUnit: cData.durationUnit,
      hoursPerDay: cData.hoursPerDay,
      deliveryMode: cData.deliveryMode,
      location: cData.location,
      modules: cData.modules,
      trainingMethodology: cData.trainingMethodology,
      handsOnTools: cData.handsOnTools,
      courseMaterials: cData.courseMaterials,
      prerequisitesList: cData.prerequisitesList,
      certificationDetails: cData.certificationDetails,
      careerImpact: cData.careerImpact,
      contentStatus: 'Published',
      published: true,
      status: 'Open',
      isActive: true,
      active: true,
    };

    if (course) {
      Object.assign(course, updateFields);
      await course.save();
      console.log(`[ENRICH] Updated existing course: "${course.title}" (${course.category}, Tier ${course.levelTier})`);
      updatedCount += 1;
    } else {
      const levelLabels = Course.LEVEL_LABELS || [
        'Awareness / Fundamentals',
        'Core Skills',
        'Specialization/Integration/Applications',
        'Professional/Industry',
      ];
      course = await Course.create({
        ...updateFields,
        slug: slugify(`${cData.category}-${cData.title}`),
        category: cData.category,
        level: levelLabels[cData.levelTier - 1],
        levelTier: cData.levelTier,
        price: cData.price || 1500,
        currency: 'EGP',
      });
      console.log(`[ENRICH] Created new course: "${course.title}" (${course.category}, Tier ${course.levelTier})`);
      createdCount += 1;
    }
  }

  // Second pass: Link prerequisite course ObjectIds where available
  console.log('[ENRICH] Resolving prerequisite references between courses...');
  const prereqLinks = [
    {
      courseTitle: 'Circuit Design Program',
      prereqTitle: 'Electrical Circuits Basics Program',
    },
    {
      courseTitle: 'Measurement & Instrumentation Program',
      prereqTitle: 'Electronics Fundamentals Program',
    },
    {
      courseTitle: 'Embedded Robotics Program',
      prereqTitle: 'Mobile Robotics Program',
    },
    {
      courseTitle: 'Team Management Program',
      prereqTitle: 'Planning & Scheduling Basics Program',
    },
  ];

  for (const link of prereqLinks) {
    const parentCourse = await Course.findOne({
      $or: [
        { title: link.courseTitle },
        { title: new RegExp(link.courseTitle.replace(' Program', ''), 'i') },
      ],
    });
    const prereqCourse = await Course.findOne({
      $or: [
        { title: link.prereqTitle },
        { title: new RegExp(link.prereqTitle.replace(' Program', ''), 'i') },
      ],
    });

    if (parentCourse && prereqCourse) {
      if (!parentCourse.recommendedPreviousCourses.some((id) => id.toString() === prereqCourse._id.toString())) {
        parentCourse.recommendedPreviousCourses.push(prereqCourse._id);
        await parentCourse.save();
        console.log(`[ENRICH] Linked recommended prerequisite: "${prereqCourse.title}" -> "${parentCourse.title}"`);
      }
    }
  }

  console.log('----------------------------------------------------');
  console.log(`[ENRICH COMPLETE] Updated: ${updatedCount}, Created: ${createdCount}`);
  console.log('----------------------------------------------------');
  await mongoose.disconnect();
  process.exit(0);
}

enrich().catch((err) => {
  console.error('[ENRICH ERROR]', err);
  process.exit(1);
});
