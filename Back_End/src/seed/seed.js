require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const { TRACKS, LEVEL_LABELS, CURRENCY } = require('./data/officialCourseCatalog');

const User = require('../models/User');
const StudentProfile = require('../models/StudentProfile');
const LearningGoal = require('../models/LearningGoal');
const LearningPath = require('../models/LearningPath');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const CourseBundle = require('../models/CourseBundle');
const ReadinessQuestion = require('../models/ReadinessQuestion');
const Application = require('../models/Application');
const Enrollment = require('../models/Enrollment');
const Invoice = require('../models/Invoice');
const PaymentTransaction = require('../models/PaymentTransaction');
const Notification = require('../models/Notification');
const TrainingSession = require('../models/TrainingSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const AttendanceDispute = require('../models/AttendanceDispute');
const Media = require('../models/Media');
const Assessment = require('../models/Assessment');
const AssessmentResult = require('../models/AssessmentResult');

function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[()'’&]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function seed() {
  await connectDB();
  console.log('[SEED] Clearing existing collections...');
  await Promise.all([
    User.deleteMany({}),
    StudentProfile.deleteMany({}),
    LearningGoal.deleteMany({}),
    LearningPath.deleteMany({}),
    Course.deleteMany({}),
    Cohort.deleteMany({}),
    CourseBundle.deleteMany({}),
    ReadinessQuestion.deleteMany({}),
    Application.deleteMany({}),
    Enrollment.deleteMany({}),
    Invoice.deleteMany({}),
    PaymentTransaction.deleteMany({}),
    Notification.deleteMany({}),
    TrainingSession.deleteMany({}),
    AttendanceRecord.deleteMany({}),
    AttendanceDispute.deleteMany({}),
    Media.deleteMany({}),
    Assessment.deleteMany({}),
    AssessmentResult.deleteMany({}),
  ]);

  // ---------------------------------------------------------------------
  // Learning goals: kept generic (not tied to specific course titles).
  // Goal <-> track mapping for the recommendation engine is NOT seeded here
  // pending your confirmation - see implementation report ("what I need
  // from you next"). LearningPath is intentionally left empty for now.
  // ---------------------------------------------------------------------
  console.log('[SEED] Creating learning goals...');
  await LearningGoal.insertMany([
    { key: 'space-tech', title: 'Explore Space Technologies', description: 'General introduction to space systems and mission technology.', icon: 'fa-rocket' },
    { key: 'advanced-tech', title: 'Learn Advanced/Embedded Technologies', description: 'Programming, embedded systems, and AI engineering.', icon: 'fa-microchip' },
    { key: 'cybersecurity', title: 'Learn Cybersecurity', description: 'IT security fundamentals through advanced governance.', icon: 'fa-shield-halved' },
    { key: 'remote-sensing', title: 'Learn Remote Sensing & Geospatial Analytics', description: 'Earth observation, GIS, and geospatial data analysis.', icon: 'fa-globe' },
    { key: 'electronics', title: 'Learn Electronics & Technology Manufacturing', description: 'Circuit design, PCB, and hardware production.', icon: 'fa-bolt' },
    { key: 'environment', title: 'Learn Environment & Space Weather', description: 'Environmental science and space-weather resilience.', icon: 'fa-cloud-bolt' },
    { key: 'robotics', title: 'Learn Robotics & Autonomous Systems', description: 'Mechatronics through autonomous mission systems.', icon: 'fa-robot' },
    { key: 'entrepreneurship', title: 'Learn Technology Entrepreneurship', description: 'Turning technology innovation into ventures.', icon: 'fa-lightbulb' },
    { key: 'project-management', title: 'Learn Project & Program Management', description: 'Project, program, and portfolio management.', icon: 'fa-diagram-project' },
    { key: 'unsure', title: "I'm not sure yet", description: 'Explore all tracks before committing.', icon: 'fa-question' },
  ]);

  // ---------------------------------------------------------------------
  // Official course catalog: exact titles/durations/prices from the
  // provided roadmap. null price/duration = not given in the source
  // (Cybersecurity track; 3 Level-4 Project Management courses).
  // ---------------------------------------------------------------------
  console.log('[SEED] Creating official course catalog...');
  let createdCount = 0;
  let missingPriceCount = 0;

  for (const track of TRACKS) {
    for (const level of track.levels) {
      const levelCourseIds = [];

      for (const c of level.courses) {
        const doc = await Course.create({
          title: c.title,
          titleEn: c.title,
          slug: slugify(`${track.category}-${c.title}`),
          category: track.category,
          level: LEVEL_LABELS[level.tier - 1],
          levelTier: level.tier,
          duration: c.days,
          durationUnit: 'Days',
          durationWeeks: c.days != null ? Math.round((c.days / 5) * 10) / 10 : undefined, // legacy display only, derived not authoritative
          price: c.price,
          currency: CURRENCY,
          requiredSkills: [],
          // No description/outcomes/prerequisites provided yet - left empty,
          // not fabricated. contentStatus/published reflect that honestly.
          contentStatus: 'Pending',
          published: false,
          status: 'Draft',
          isActive: true,
          active: true,
        });
        levelCourseIds.push(doc._id);
        createdCount += 1;
        if (c.price == null) missingPriceCount += 1;
      }

      // Relate courses within the same track+level to each other (informational only).
      await Course.updateMany(
        { _id: { $in: levelCourseIds } },
        { $set: { relatedCourses: levelCourseIds } }
      );

      const bundlePrice = track.bundles[level.tier];
      if (bundlePrice) {
        await CourseBundle.create({
          title: `${track.category} — Level ${level.tier} Bundle`,
          category: track.category,
          levelTier: level.tier,
          level: LEVEL_LABELS[level.tier - 1],
          courses: levelCourseIds,
          price: bundlePrice,
          currency: CURRENCY,
        });
      }
    }
  }

  console.log(`[SEED] Created ${createdCount} official courses (${missingPriceCount} with pricing not yet published).`);

  // ---------------------------------------------------------------------
  // Enrich courses with official specifications extracted from EGSA PDFs
  // ---------------------------------------------------------------------
  console.log('[SEED] Enriching official courses from PDF specifications...');
  const { ENRICHED_PDF_COURSES } = require('./data/enrichedPdfCourses');
  for (const cData of ENRICHED_PDF_COURSES) {
    const course = await Course.findOne({
      $or: [
        { title: cData.targetTitle },
        { title: { $in: cData.alternativeTitles } },
        { category: cData.category, title: new RegExp(cData.targetTitle.replace(' Program', ''), 'i') },
      ],
    });
    if (course) {
      Object.assign(course, {
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
      });
      await course.save();
    }
  }

  // Link recommended prerequisites
  const prereqLinks = [
    { courseTitle: 'Circuit Design Program', prereqTitle: 'Electrical Circuits Basics Program' },
    { courseTitle: 'Measurement & Instrumentation Program', prereqTitle: 'Electronics Fundamentals Program' },
    { courseTitle: 'Embedded Robotics Program', prereqTitle: 'Mobile Robotics Program' },
    { courseTitle: 'Team Management Program', prereqTitle: 'Planning & Scheduling Basics Program' },
  ];
  for (const link of prereqLinks) {
    const parentCourse = await Course.findOne({ title: new RegExp(link.courseTitle.replace(' Program', ''), 'i') });
    const prereqCourse = await Course.findOne({ title: new RegExp(link.prereqTitle.replace(' Program', ''), 'i') });
    if (parentCourse && prereqCourse) {
      parentCourse.recommendedPreviousCourses = [prereqCourse._id];
      await parentCourse.save();
    }
  }

  console.log('[SEED] Creating demo student user...');
  const demoUser = await User.create({
    fullName: 'Sara Ahmed',
    email: 'sara.demo@egsa-academy.example',
    password: 'Password123!',
    phone: '+201000000000',
    nationalId: '29901010123456',
    isEmailVerified: true,
    accountStatus: 'active',
    isActive: true,
  });

  await StudentProfile.create({
    user: demoUser._id,
    status: 'student',
    university: 'Cairo University',
    faculty: 'Faculty of Engineering',
    department: 'Communications',
    academicYear: '3rd Year',
    graduationYear: 2027,
    skills: ['Python', 'Basic Electronics'],
    experience: [],
    previousTraining: [],
    completedCourses: [],
    profileCompleted: true,
  });

  console.log('[SEED] Creating demo admin user...');
  await User.create({
    fullName: 'EGSA Admin',
    email: 'admin@egsa-academy.example',
    password: 'AdminPass123!',
    phone: '+201000000001',
    nationalId: '29001010999999',
    role: 'admin',
    isEmailVerified: true,
    accountStatus: 'active',
    isActive: true,
  });

  console.log('[SEED] Creating demo instructor user...');
  const demoInstructor = await User.create({
    fullName: 'Dr. Mohamed El-Sayed',
    email: 'instructor@egsa-academy.example',
    password: 'InstructorPass123!',
    phone: '+201000000002',
    nationalId: '28001010888888',
    role: 'instructor',
    isEmailVerified: true,
    accountStatus: 'active',
    isActive: true,
  });


  // ---------------------------------------------------------------------
  // Seed active and upcoming enrollments for demo student Sara Ahmed
  // ---------------------------------------------------------------------
  console.log('[SEED] Creating demo student training cohorts and enrollments...');
  const circuitCourse = await Course.findOne({ title: 'Circuit Design Program' });
  const roboticsCourse = await Course.findOne({ title: 'Embedded Robotics Program' });

  let circuitCohort, circuitEnrollment, sess1, sess2, sess3, sess4, sess5;

  if (circuitCourse) {
    circuitCohort = await Cohort.create({
      course: circuitCourse._id,
      name: 'Cohort 2026-01: Electronics & Circuit Engineering',
      startDate: new Date(Date.now() - 10 * 86400000),
      endDate: new Date(Date.now() + 18 * 86400000),
      capacity: 25,
      seatsTaken: 18,
      status: 'InProgress',
    });

    const circuitApp = await Application.create({
      student: demoUser._id,
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      status: 'Confirmed',
      statusHistory: [{ status: 'Confirmed', note: 'Application approved and tuition confirmed.' }],
      submittedAt: new Date(Date.now() - 14 * 86400000),
    });

    circuitEnrollment = await Enrollment.create({
      student: demoUser._id,
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      application: circuitApp._id,
      status: 'Active',
      enrollmentDate: new Date(Date.now() - 12 * 86400000),
    });

    // Seed real Training Sessions for Circuit Design Program
    sess1 = await TrainingSession.create({
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      sessionNumber: 1,
      title: 'Day 1: Introduction to Circuit Design',
      focus: 'Design Foundations',
      activities: circuitCourse.modules?.[0]?.activities || ['Circuit design methodology', 'Specifications definition'],
      date: new Date(Date.now() - 6 * 86400000),
      startTime: '10:00 AM',
      endTime: '03:00 PM',
      instructor: circuitCourse.instructor || 'EGSA Faculty',
      location: 'Egyptian Space Academy, Cairo',
      deliveryMode: 'Onsite',
      status: 'Completed',
    });

    sess2 = await TrainingSession.create({
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      sessionNumber: 2,
      title: 'Day 2: Analog Circuit Design',
      focus: 'Core Components',
      activities: circuitCourse.modules?.[1]?.activities || ['Diodes and transistor basics', 'Simple analog design'],
      date: new Date(Date.now() - 4 * 86400000),
      startTime: '10:00 AM',
      endTime: '03:00 PM',
      instructor: circuitCourse.instructor || 'EGSA Faculty',
      location: 'Egyptian Space Academy, Cairo',
      deliveryMode: 'Onsite',
      status: 'Completed',
    });

    sess3 = await TrainingSession.create({
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      sessionNumber: 3,
      title: 'Day 3: Circuit Simulation & Analysis',
      focus: 'Validation',
      activities: circuitCourse.modules?.[2]?.activities || ['LTspice simulation', 'Waveform interpretation'],
      date: new Date(Date.now() - 2 * 86400000),
      startTime: '10:00 AM',
      endTime: '03:00 PM',
      instructor: circuitCourse.instructor || 'EGSA Faculty',
      location: 'Egyptian Space Academy, Cairo',
      deliveryMode: 'Onsite',
      status: 'Completed',
    });

    sess4 = await TrainingSession.create({
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      sessionNumber: 4,
      title: 'Day 4: Design Optimization & Troubleshooting',
      focus: 'Performance Improvement',
      activities: circuitCourse.modules?.[3]?.activities || ['Noise and interference considerations', 'Troubleshooting issues'],
      date: new Date(), // Today! Active session
      startTime: '10:00 AM',
      endTime: '03:00 PM',
      instructor: circuitCourse.instructor || 'EGSA Faculty',
      location: 'Egyptian Space Academy, Cairo',
      deliveryMode: 'Onsite',
      status: 'Active',
      attendanceWindow: {
        opensAt: new Date(Date.now() - 30 * 60000),
        closesAt: new Date(Date.now() + 180 * 60000),
      },
      qrCode: {
        token: 'EGSA-CIRCUIT-SESSION-04-LIVE-TOKEN',
        expiresAt: new Date(Date.now() + 180 * 60000),
        generatedAt: new Date(),
        isActive: true,
      },
    });

    sess5 = await TrainingSession.create({
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      sessionNumber: 5,
      title: 'Day 5: Project & Circuit Implementation',
      focus: 'Application',
      activities: circuitCourse.modules?.[4]?.activities || ['Mini project: Complete circuit design', 'Testing and debugging'],
      date: new Date(Date.now() + 2 * 86400000),
      startTime: '10:00 AM',
      endTime: '03:00 PM',
      instructor: circuitCourse.instructor || 'EGSA Faculty',
      location: 'Egyptian Space Academy, Cairo',
      deliveryMode: 'Onsite',
      status: 'Scheduled',
      attendanceWindow: {
        opensAt: new Date(Date.now() + 2 * 86400000),
        closesAt: new Date(Date.now() + 2 * 86400000 + 4 * 3600000),
      },
      qrCode: {
        token: 'EGSA-CIRCUIT-SESSION-05-SCHEDULED',
        expiresAt: new Date(Date.now() + 2 * 86400000 + 4 * 3600000),
        generatedAt: new Date(),
        isActive: true,
      },
    });

    // Seed Sara's real attendance records for completed sessions
    await AttendanceRecord.create({
      session: sess1._id,
      student: demoUser._id,
      enrollment: circuitEnrollment._id,
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      status: 'Present',
      checkInTime: new Date(Date.now() - 6 * 86400000 + 5 * 60000),
      checkInMethod: 'QR_Scan',
      notes: 'On-time laboratory check-in',
    });

    await AttendanceRecord.create({
      session: sess2._id,
      student: demoUser._id,
      enrollment: circuitEnrollment._id,
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      status: 'Present',
      checkInTime: new Date(Date.now() - 4 * 86400000 + 2 * 60000),
      checkInMethod: 'QR_Scan',
      notes: 'On-time laboratory check-in',
    });

    await AttendanceRecord.create({
      session: sess3._id,
      student: demoUser._id,
      enrollment: circuitEnrollment._id,
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      status: 'Late',
      checkInTime: new Date(Date.now() - 2 * 86400000 + 20 * 60000),
      checkInMethod: 'QR_Upload',
      notes: 'Arrived 20m after simulation kickoff',
    });

    await Notification.create({
      recipient: demoUser._id,
      title: 'Upcoming Training Lab Session',
      message: 'Hands-on Simulation: LTspice Waveform & Signal Analysis is scheduled for this Thursday at EGSA Labs, Cairo.',
      type: 'info',
      relatedCourse: circuitCourse._id,
      isRead: false,
    });

    await Notification.create({
      recipient: demoUser._id,
      title: 'Training Schedule Confirmed',
      message: 'Your enrollment in Circuit Design Program (Cohort 2026-01) is active. Review your daily module syllabus in My Training.',
      type: 'success',
      relatedCourse: circuitCourse._id,
      isRead: false,
    });
  }

  if (roboticsCourse) {
    const roboticsCohort = await Cohort.create({
      course: roboticsCourse._id,
      name: 'Cohort 2026-02: Robotics & Autonomous Systems',
      startDate: new Date(Date.now() + 14 * 86400000),
      endDate: new Date(Date.now() + 35 * 86400000),
      capacity: 20,
      seatsTaken: 12,
      status: 'Scheduled',
    });

    const roboticsApp = await Application.create({
      student: demoUser._id,
      course: roboticsCourse._id,
      cohort: roboticsCohort._id,
      status: 'Confirmed',
      statusHistory: [{ status: 'Confirmed', note: 'Payment received; enrollment confirmed.' }],
      submittedAt: new Date(Date.now() - 4 * 86400000),
    });

    await Enrollment.create({
      student: demoUser._id,
      course: roboticsCourse._id,
      cohort: roboticsCohort._id,
      application: roboticsApp._id,
      status: 'Confirmed',
      enrollmentDate: new Date(),
    });

    // Seed 5 upcoming scheduled sessions for Embedded Robotics Program
    for (let day = 1; day <= 5; day++) {
      const sessDate = new Date(Date.now() + (14 + (day - 1) * 2) * 86400000);
      const mod = roboticsCourse.modules?.[day - 1];
      await TrainingSession.create({
        course: roboticsCourse._id,
        cohort: roboticsCohort._id,
        sessionNumber: day,
        title: mod?.title || `Day ${day}: Embedded Robotics Architecture`,
        focus: mod?.focus || 'Autonomous Systems',
        activities: mod?.activities || ['Hardware interfacing', 'Control logic'],
        date: sessDate,
        startTime: '10:00 AM',
        endTime: '03:00 PM',
        instructor: roboticsCourse.instructor || 'EGSA Faculty',
        location: 'Egyptian Space Academy, Cairo',
        deliveryMode: 'Onsite',
        status: 'Scheduled',
        attendanceWindow: {
          opensAt: new Date(sessDate.getTime() - 15 * 60000),
          closesAt: new Date(sessDate.getTime() + 4 * 3600000),
        },
        qrCode: {
          token: `EGSA-ROBOTICS-SESS-0${day}-TOKEN`,
          expiresAt: new Date(sessDate.getTime() + 4 * 3600000),
          generatedAt: sessDate,
          isActive: true,
        },
      });
    }
  }

  // ---------------------------------------------------------------------
  // Seed Realistic Institutional Student Media Submissions
  // ---------------------------------------------------------------------
  console.log('[SEED] Creating training media submissions...');
  if (circuitCourse && circuitCohort && sess1 && sess2 && sess3 && sess4) {
    await Media.create([
      {
        student: demoUser._id,
        course: circuitCourse._id,
        cohort: circuitCohort._id,
        session: sess1._id,
        title: 'Altium PCB Schematic Layout & Component Routing',
        caption: 'Finalized 4-layer PCB high-speed trace routing for satellite telemetry unit during Day 1 laboratory drill.',
        description: 'Captured high-density differential pairs routing on the training workstation under proctor supervision in Lab 204.',
        fileUrl: '/uploads/media/egsa_sample_pcb_drill.svg',
        thumbnailUrl: '/uploads/media/egsa_sample_pcb_drill.svg',
        filename: 'egsa_sample_pcb_drill.svg',
        originalName: 'PCB_Trace_Routing_Day1.svg',
        mimeType: 'image/svg+xml',
        fileSize: 42560,
        status: 'Published',
        submittedAt: new Date(Date.now() - 3 * 86400000),
        approvedAt: new Date(Date.now() - 2 * 86400000),
        selectedAt: new Date(Date.now() - 2 * 86400000),
        publishedAt: new Date(Date.now() - 1 * 86400000),
        publicationPlacement: 'general_gallery',
        publicVisibility: true,
        consentConfirmed: true,
        reviewHistory: [
          { action: 'Submitted', changedAt: new Date(Date.now() - 3 * 86400000), previousStatus: 'Draft', newStatus: 'Pending_Review', comment: 'Submitted by student.' },
          { action: 'Approved', changedAt: new Date(Date.now() - 2 * 86400000), previousStatus: 'Pending_Review', newStatus: 'Approved', comment: 'Clear schematic documentation.' },
          { action: 'Selected_For_Publication', changedAt: new Date(Date.now() - 2 * 86400000), previousStatus: 'Approved', newStatus: 'Selected_For_Publication', comment: 'Selected for public website.' },
          { action: 'Published', changedAt: new Date(Date.now() - 1 * 86400000), previousStatus: 'Selected_For_Publication', newStatus: 'Published', comment: 'Published to official portal gallery.' },
        ],
      },
      {
        student: demoUser._id,
        course: circuitCourse._id,
        cohort: circuitCohort._id,
        session: sess2._id,
        title: 'Surface Mount Soldering & Oscilloscope Calibration',
        caption: 'Testing FPGA power distribution network impedance at the Cairo cleanroom bench.',
        description: 'Verification of SMD decoupling capacitor placement on the primary power bus.',
        fileUrl: '/uploads/media/egsa_sample_oscilloscope.svg',
        thumbnailUrl: '/uploads/media/egsa_sample_oscilloscope.svg',
        filename: 'egsa_sample_oscilloscope.svg',
        originalName: 'Oscilloscope_Cleanroom_Day2.svg',
        mimeType: 'image/svg+xml',
        fileSize: 38400,
        status: 'Approved',
        submittedAt: new Date(Date.now() - 2 * 86400000),
        approvedAt: new Date(Date.now() - 1 * 86400000),
        consentConfirmed: true,
        reviewHistory: [
          { action: 'Submitted', changedAt: new Date(Date.now() - 2 * 86400000), previousStatus: 'Draft', newStatus: 'Pending_Review', comment: 'Submitted by student.' },
          { action: 'Approved', changedAt: new Date(Date.now() - 1 * 86400000), previousStatus: 'Pending_Review', newStatus: 'Approved', comment: 'Approved for institutional archive.' },
        ],
      },
      {
        student: demoUser._id,
        course: circuitCourse._id,
        cohort: circuitCohort._id,
        session: sess3._id,
        title: '1.25 Gbps High-Speed Differential Signal Eye Diagram',
        caption: 'Signal integrity analysis showing jitter metrics under 15 ps RMS.',
        description: 'Captured using digital phosphor oscilloscope during active serial bus transmission.',
        fileUrl: '/uploads/media/egsa_sample_oscilloscope.svg',
        thumbnailUrl: '/uploads/media/egsa_sample_oscilloscope.svg',
        filename: 'egsa_sample_oscilloscope.svg',
        originalName: 'Signal_Integrity_Day3.svg',
        mimeType: 'image/svg+xml',
        fileSize: 38400,
        status: 'Pending_Review',
        submittedAt: new Date(Date.now() - 12 * 3600000),
        consentConfirmed: true,
        reviewHistory: [
          { action: 'Submitted', changedAt: new Date(Date.now() - 12 * 3600000), previousStatus: 'Draft', newStatus: 'Pending_Review', comment: 'Queued for review.' },
        ],
      },
      {
        student: demoUser._id,
        course: circuitCourse._id,
        cohort: circuitCohort._id,
        session: sess4._id,
        title: 'Thermal Profile of Satellite Power Conditioning Unit',
        caption: 'Infrared thermal imaging capture during continuous 4A stress load testing.',
        description: 'Monitoring LDO regulator heatsink dissipation in the aerospace electronics lab.',
        fileUrl: '/uploads/media/egsa_sample_pcb_drill.svg',
        thumbnailUrl: '/uploads/media/egsa_sample_pcb_drill.svg',
        filename: 'egsa_sample_pcb_drill.svg',
        originalName: 'Thermal_Scan_Day4.svg',
        mimeType: 'image/svg+xml',
        fileSize: 42560,
        status: 'Changes_Requested',
        submittedAt: new Date(Date.now() - 6 * 3600000),
        reviewedAt: new Date(Date.now() - 2 * 3600000),
        reviewComment: 'Please provide a higher-resolution image showing the thermocouple calibration scale.',
        consentConfirmed: true,
        reviewHistory: [
          { action: 'Submitted', changedAt: new Date(Date.now() - 6 * 3600000), previousStatus: 'Draft', newStatus: 'Pending_Review', comment: 'Submitted by student.' },
          { action: 'Changes_Requested', changedAt: new Date(Date.now() - 2 * 3600000), previousStatus: 'Pending_Review', newStatus: 'Changes_Requested', comment: 'Please provide a higher-resolution image showing the thermocouple calibration scale.' },
        ],
      },
    ]);

    console.log('[SEED] Seeding institutional course assessments and evaluations...');
    const assess1 = await Assessment.create({
      title: 'Altium Schematic Capture & Signal Routing Evaluation',
      description: 'Hands-on practical evaluation of aerospace multi-layer PCB design, decoupling capacitor layout, and differential impedance matching according to ECSS standards.',
      type: 'Technical Assessment',
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      session: sess1._id,
      instructor: demoInstructor._id,
      instructorName: demoInstructor.fullName,
      maxScore: 100,
      passingScore: 70,
      weight: 25,
      status: 'Completed',
      assessmentDate: new Date(Date.now() - 8 * 86400000),
      dueDate: new Date(Date.now() - 7 * 86400000),
      rubric: 'Criteria: 1. Schematic clarity (25%), 2. DRC clearance compliance (25%), 3. Signal integrity return paths (25%), 4. Documentation (25%).',
      isMandatory: true,
    });

    const assess2 = await Assessment.create({
      title: 'Surface Mount Soldering & Oscilloscope Telemetry Lab',
      description: 'Cleanroom laboratory practical assessment involving SMD 0603 assembly, reflow inspection under stereo microscope, and serial telemetry clock probing.',
      type: 'Practical Assessment',
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      session: sess2._id,
      instructor: demoInstructor._id,
      instructorName: demoInstructor.fullName,
      maxScore: 100,
      passingScore: 70,
      weight: 25,
      status: 'Completed',
      assessmentDate: new Date(Date.now() - 4 * 86400000),
      dueDate: new Date(Date.now() - 3 * 86400000),
      rubric: 'Criteria: 1. Soldering workmanship (30%), 2. Cleanroom safety (20%), 3. Oscilloscope waveform trigger calibration (30%), 4. Report (20%).',
      isMandatory: true,
    });

    const assess3 = await Assessment.create({
      title: 'High-Speed Differential Signal Integrity Analysis',
      description: 'Lab project measuring eye diagrams, transmission line reflections, and jitter metrics for high-speed serial satellite buses.',
      type: 'Project Evaluation',
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      session: sess3._id,
      instructor: demoInstructor._id,
      instructorName: demoInstructor.fullName,
      maxScore: 100,
      passingScore: 70,
      weight: 25,
      status: 'In_Progress',
      assessmentDate: new Date(Date.now() - 1 * 86400000),
      dueDate: new Date(Date.now() + 2 * 86400000),
      rubric: 'Criteria: 1. Simulation vs measured eye diagram correlation (40%), 2. Jitter quantification (30%), 3. Mitigation recommendations (30%).',
      isMandatory: true,
    });

    const assess4 = await Assessment.create({
      title: 'CubeSat Power Conditioning Capstone Board Defense',
      description: 'Final comprehensive design defense and practical validation of autonomous power regulation module for 3U CubeSat architecture.',
      type: 'Final Assessment',
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      session: sess5._id,
      instructor: demoInstructor._id,
      instructorName: demoInstructor.fullName,
      maxScore: 100,
      passingScore: 70,
      weight: 25,
      status: 'Scheduled',
      assessmentDate: new Date(Date.now() + 6 * 86400000),
      dueDate: new Date(Date.now() + 10 * 86400000),
      rubric: 'Criteria: 1. Engineering rigor (30%), 2. Thermal/Electrical stress testing (30%), 3. Defense presentation & Q&A (40%).',
      isMandatory: true,
    });

    // Seed evaluation results for demo student
    // Assess 1: Published evaluation (Passed, 92%)
    await AssessmentResult.create({
      assessment: assess1._id,
      student: demoUser._id,
      enrollment: circuitEnrollment._id,
      instructor: demoInstructor._id,
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      score: 92,
      maxScore: 100,
      percentage: 92,
      status: 'Published',
      resultLabel: 'Passed',
      feedback: 'Exceptional schematic capture and neat component grouping. Trace routing reflects professional space-grade high-reliability standards adhering to ECSS-Q-ST-70.',
      strengths: 'Rigorous DRC execution, immaculate ground plane stitching, and clear functional hierarchical blocks.',
      improvementAreas: 'Trace spacing near high-voltage regulator section could benefit from an additional 0.2mm isolation barrier.',
      instructorNote: 'Candidate shows strong potential for flight hardware avionics engineering.',
      evaluatedAt: new Date(Date.now() - 6 * 86400000),
      finalizedAt: new Date(Date.now() - 6 * 86400000),
      finalizedBy: demoInstructor._id,
      publishedAt: new Date(Date.now() - 5 * 86400000),
      publishedBy: demoInstructor._id,
      auditTrail: [
        {
          action: 'Finalized',
          previousScore: 92,
          newScore: 92,
          previousStatus: 'Draft',
          newStatus: 'Finalized',
          changedBy: demoInstructor._id,
          changedAt: new Date(Date.now() - 6 * 86400000),
          reason: 'Initial evaluation completed.',
        },
        {
          action: 'Published',
          previousScore: 92,
          newScore: 92,
          previousStatus: 'Finalized',
          newStatus: 'Published',
          changedBy: demoInstructor._id,
          changedAt: new Date(Date.now() - 5 * 86400000),
          reason: 'Official release to student portal.',
        },
      ],
    });

    // Assess 2: Published evaluation (Passed, 88%)
    await AssessmentResult.create({
      assessment: assess2._id,
      student: demoUser._id,
      enrollment: circuitEnrollment._id,
      instructor: demoInstructor._id,
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      score: 88,
      maxScore: 100,
      percentage: 88,
      status: 'Published',
      resultLabel: 'Passed',
      feedback: 'Proficient hand soldering of 0603 surface mount passives and precise oscilloscope triggering on pulse bursts.',
      strengths: 'Solid bench technique, rapid calibration of probes, and comprehensive lab telemetry documentation.',
      improvementAreas: 'Ensure chemical flux residue is thoroughly cleansed with ultrasonic bath before conformal coating application.',
      instructorNote: 'Passed cleanroom laboratory practical on first attempt.',
      evaluatedAt: new Date(Date.now() - 2 * 86400000),
      finalizedAt: new Date(Date.now() - 2 * 86400000),
      finalizedBy: demoInstructor._id,
      publishedAt: new Date(Date.now() - 1 * 86400000),
      publishedBy: demoInstructor._id,
      auditTrail: [
        {
          action: 'Published',
          previousScore: 88,
          newScore: 88,
          previousStatus: 'Draft',
          newStatus: 'Published',
          changedBy: demoInstructor._id,
          changedAt: new Date(Date.now() - 1 * 86400000),
          reason: 'Official release to student portal.',
        },
      ],
    });

    // Assess 3: Draft evaluation by Instructor (Under review - Student sees "Pending Evaluation", score hidden!)
    await AssessmentResult.create({
      assessment: assess3._id,
      student: demoUser._id,
      enrollment: circuitEnrollment._id,
      instructor: demoInstructor._id,
      course: circuitCourse._id,
      cohort: circuitCohort._id,
      score: 85,
      maxScore: 100,
      percentage: 85,
      status: 'Draft',
      resultLabel: 'Passed',
      feedback: 'Preliminary assessment of eye-diagram metrics recorded. Awaiting final session proctor review.',
      strengths: 'Accurate measurement of rise/fall times and signal overshoot.',
      improvementAreas: 'Further verification required on jitter floor measurements under thermal cycling.',
      instructorNote: 'Preliminary scoring 85 pending cross-check with laboratory proctor notes.',
      evaluatedAt: new Date(Date.now() - 12 * 3600000),
      auditTrail: [
        {
          action: 'Created_Draft',
          newScore: 85,
          newStatus: 'Draft',
          changedBy: demoInstructor._id,
          changedAt: new Date(Date.now() - 12 * 3600000),
          reason: 'Initial instructor draft evaluation.',
        },
      ],
    });
  }

  console.log('[SEED] Done.');
  console.log('----------------------------------------------------');
  console.log('Demo student login: sara.demo@egsa-academy.example / Password123!');
  console.log('Demo admin login:   admin@egsa-academy.example / AdminPass123!');
  console.log(`Official courses seeded: ${createdCount} (across ${TRACKS.length} tracks)`);
  console.log('----------------------------------------------------');
  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error('[SEED ERROR]', err);
  process.exit(1);
});
