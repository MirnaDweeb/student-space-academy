const mongoose = require('mongoose');

// Official 4-tier taxonomy from the provided program roadmap (Level 1-4).
// Replaces the old placeholder 3-value enum (Foundation/Intermediate/Advanced),
// which was never real business data - see implementation report.
const LEVEL_LABELS = [
  'Awareness / Fundamentals', // Level 1
  'Core Skills', // Level 2
  'Specialization/Integration/Applications', // Level 3
  'Professional/Industry', // Level 4
];

const CourseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true }, // kept as the authoritative display title (English, from the source data)
    titleEn: { type: String }, // MISSING BUSINESS DATA for most: currently mirrors `title`
    titleAr: { type: String }, // MISSING BUSINESS DATA: no Arabic names provided yet
    slug: { type: String, required: true, unique: true },

    // Content fields: extracted from official course PDFs
    tagline: { type: String },
    subtitle: { type: String },
    shortDescription: { type: String },
    overview: { type: String },
    whyThisCourse: { type: String },
    whoIsItFor: { type: String },
    learningObjectives: [{ type: String }],
    learningOutcomes: [{ type: String }],
    careerImpact: [{ type: String }],
    modules: [
      {
        day: { type: Number },
        title: { type: String },
        focus: { type: String },
        activities: [{ type: String }],
      },
    ],
    trainingMethodology: [{ type: String }],
    handsOnTools: {
      softwareTools: [{ type: String }],
      practicalExposure: [{ type: String }],
    },
    courseMaterials: {
      trainingMaterials: [{ type: String }],
      digitalResources: [{ type: String }],
      postTrainingAccess: [{ type: String }],
    },
    certificationDetails: {
      certificateType: { type: String },
      evaluationCriteria: [{ type: String }],
    },
    hoursPerDay: { type: String },
    prerequisitesList: [{ type: String }],
    syllabus: [{ type: String }], // == "topics" in the requested field list; reused, not renamed
    content: { type: mongoose.Schema.Types.Mixed, default: [] }, // structure TBD once per-course content arrives

    level: { type: String, enum: LEVEL_LABELS, required: true },
    levelTier: { type: Number, enum: [1, 2, 3, 4], required: true }, // numeric sort/filter key for `level`
    category: { type: String, required: true }, // the program "track", e.g. "Space Technologies"

    goals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LearningGoal' }],
    deliveryMode: { type: String, enum: ['Onsite', 'Online', 'Hybrid'], default: 'Onsite' },

    // Duration now generic (source data is in days, not weeks). durationWeeks
    // is kept temporarily for backward compatibility with any stale data but
    // is no longer authoritative - see BREAKING CHANGE note in the report.
    duration: { type: Number }, // null = not provided yet (see Cybersecurity track)
    durationUnit: { type: String, enum: ['Hours', 'Days', 'Weeks', 'Months'], default: 'Days' },
    durationWeeks: { type: Number }, // deprecated, derived for legacy display only

    startDate: { type: Date },
    applicationOpenDate: { type: Date }, // MISSING BUSINESS DATA
    applicationCloseDate: { type: Date }, // MISSING BUSINESS DATA
    courseEndDate: { type: Date }, // MISSING BUSINESS DATA
    nextOpeningDate: { type: Date }, // MISSING BUSINESS DATA

    location: { type: String, default: 'EGSA Academy, Cairo' },
    instructor: { type: String, default: 'TBD' },

    capacity: { type: Number }, // MISSING BUSINESS DATA - no capacity given per course yet
    seatsTaken: { type: Number, default: 0 },

    price: { type: Number }, // null = pricing not yet published (see report)
    currency: { type: String, default: 'EGP' },

    // Transportation: mentioned as a possibility in the brief but NO transportation
    // prices/options were present anywhere in the provided catalog. Scaffolding only.
    transportationPrice: { type: Number, default: 500 },
    transportationOptions: [
      {
        label: { type: String },
        price: { type: Number },
      },
    ],

    paymentPolicy: { type: String, default: 'Full payment required at least 72 hours before start date.' },
    refundPolicy: { type: String, default: 'Refunds available up to 7 days before course start.' },

    mandatoryPrerequisites: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    recommendedPreviousCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    relatedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }], // same-track courses, informational only
    requiredExperience: [{ type: String }],
    requiredSkills: [{ type: String }], // MISSING BUSINESS DATA - none specified in the catalog yet
    eligibility: { type: String }, // MISSING BUSINESS DATA
    targetAudience: { type: String }, // MISSING BUSINESS DATA
    purpose: { type: String }, // MISSING BUSINESS DATA

    minReadinessScore: { type: Number, default: 60 },

    // Content lifecycle: real catalog courses have no description/outcomes yet,
    // so they are seeded as Pending/unpublished rather than faked as complete.
    contentStatus: { type: String, enum: ['Pending', 'Published'], default: 'Pending' },
    published: { type: Boolean, default: false },
    active: { type: Boolean, default: true }, // mirrors isActive; kept both during transition, see report
    isActive: { type: Boolean, default: true },
    status: { type: String, enum: ['Draft', 'Open', 'Closed', 'Archived'], default: 'Draft' },
  },
  { timestamps: true }
);

CourseSchema.virtual('availableSeats').get(function () {
  if (this.capacity == null) return null; // capacity unknown -> cannot compute
  return Math.max(this.capacity - this.seatsTaken, 0);
});
CourseSchema.set('toJSON', { virtuals: true });
CourseSchema.set('toObject', { virtuals: true });

CourseSchema.statics.LEVEL_LABELS = LEVEL_LABELS;

module.exports = mongoose.model('Course', CourseSchema);
