/**
 * CrossFit & Functional Fitness Program Specification and Readiness Question Bank.
 * Designed for beginner cadets and students at the Egyptian Space Agency (EGSA) Academy.
 * Covers 12 essential areas of functional movement, safety, and physical conditioning.
 */

const CROSSFIT_COURSE_SLUG = 'crossfit-functional-fitness-program';

const crossfitCourse = {
  title: 'CrossFit & Functional Fitness Program',
  titleEn: 'CrossFit & Functional Fitness Program',
  titleAr: 'برنامج الكروس فيت واللياقة البدنية الوظيفية',
  slug: CROSSFIT_COURSE_SLUG,
  category: 'Physical Conditioning & Human Spaceflight',
  level: 'Awareness / Fundamentals',
  levelTier: 1,
  tagline: 'Foundational functional fitness, movement mechanics, and conditioning for spaceflight physical readiness.',
  subtitle: 'Beginner-Level Functional Movement & Physical Readiness Training',
  shortDescription: 'Foundational functional fitness, movement mechanics, and conditioning for spaceflight physical readiness.',
  overview: 'A structured beginner training course introducing functional fitness, bodyweight movement mechanics, metabolic conditioning, and athletic injury-prevention protocols. Designed to build baseline physical stamina, joint mobility, core stabilization, and cardiovascular endurance required for high-stress simulation environments and astronaut physical readiness.',
  whyThisCourse: 'Develops full-body coordination, cardiovascular capacity, and musculoskeletal resilience essential for human spaceflight simulations and physically demanding mission operations.',
  whoIsItFor: 'Beginner cadets, STEM students, and aspiring astronauts seeking safe, scalable introduction to functional conditioning and athletic readiness.',
  learningObjectives: [
    'Understand fundamental CrossFit terminology and movement patterns',
    'Execute safe warm-up and cool-down protocols',
    'Demonstrate proper air squat, hinge, and press mechanics',
    'Identify personal physical thresholds and stop safely upon warning signs',
    'Understand scaling options for any fitness level',
    'Develop consistent recovery, hydration, and nutritional habits',
  ],
  learningOutcomes: [
    'Competency in foundational bodyweight and functional movement mechanics',
    'Ability to modify workouts safely according to individual capacity',
    'Knowledge of injury prevention, recovery, and hydration protocols',
    'Preparedness for advanced physical endurance and space simulation programs',
  ],
  careerImpact: [
    'Qualifies cadet for advanced physical simulation and analog astronaut missions',
    'Builds sustainable athletic discipline and high-performance lifestyle habits',
  ],
  duration: 5,
  durationUnit: 'Days',
  hoursPerDay: '3 hours/day',
  deliveryMode: 'Onsite',
  location: 'EGSA Space Academy Sports & Conditioning Facility, Cairo',
  instructor: 'EGSA Human Performance & Physical Conditioning Staff',
  capacity: 20,
  seatsTaken: 0,
  price: 1500,
  currency: 'EGP',
  transportationPrice: 500,
  minReadinessScore: 60,
  paymentPolicy: 'Full payment required at least 72 hours before start date.',
  refundPolicy: 'Refunds available up to 7 days before course start.',
  contentStatus: 'Published',
  published: true,
  active: true,
  isActive: true,
  status: 'Open',
  modules: [
    {
      day: 1,
      title: 'Day 1: Foundations of Functional Fitness & Movement Standards',
      focus: 'Movement Mechanics',
      activities: ['Introduction to functional movements', 'Air squat and hip-hinge mechanics', 'Dynamic warm-up protocols'],
    },
    {
      day: 2,
      title: 'Day 2: Upper Body Mechanics, Core Stabilization & Pressing',
      focus: 'Core & Upper Body',
      activities: ['Strict press and push-up scaling', 'Plank and hollow-body stabilization', 'Pacing and breathing rhythm'],
    },
    {
      day: 3,
      title: 'Day 3: Cardiovascular Conditioning & Metabolic Pacing',
      focus: 'Cardiorespiratory Endurance',
      activities: ['Aerobic vs anaerobic intervals', 'Rowing and jump rope mechanics', 'Recognizing fatigue signals'],
    },
    {
      day: 4,
      title: 'Day 4: Movement Scaling, Mobility & Active Recovery',
      focus: 'Injury Prevention',
      activities: ['Scaling loads and repetitions', 'Joint mobility and foam rolling', 'Hydration and sleep science'],
    },
    {
      day: 5,
      title: 'Day 5: Team Workout Simulation & Performance Review',
      focus: 'Integration',
      activities: ['Partner conditioning workout', 'Cool-down routines', 'Personal fitness goal setting'],
    },
  ],
  certificationDetails: {
    certificateType: 'Certificate of Physical Readiness & Functional Conditioning',
    evaluationCriteria: ['Attendance & active participation', 'Movement safety adherence', 'Assessment completion'],
  },
};

const crossfitCohort = {
  name: 'Cohort 2026-01: Foundations of Functional Fitness',
  startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  endDate: new Date(Date.now() + 28 * 24 * 60 * 60 * 1000),
  capacity: 20,
  seatsTaken: 0,
  status: 'Scheduled',
};

/**
 * 12 Multiple-Choice Questions covering all required topics:
 * 1. Basic understanding of CrossFit and functional fitness.
 * 2. Safe warm-up and cool-down practices.
 * 3. Basic bodyweight movements and movement technique.
 * 4. Exercise safety and correct form.
 * 5. Rest, recovery, and hydration.
 * 6. Basic training consistency and readiness.
 * 7. Recognizing pain or warning signs and stopping safely.
 * 8. Following a coach's instructions.
 * 9. Basic strength and conditioning concepts.
 * 10. Safe progression for beginners.
 * 11. Understanding that movements can be scaled to different ability levels.
 * 12. Appropriate responses to unsafe exercise situations.
 */
const crossfitQuestions = [
  {
    question: 'What is the foundational definition of functional fitness and CrossFit?',
    options: [
      'Isolating single muscles using fixed machines without moving joints',
      'Performing constantly varied functional movements executed at relative intensity',
      'Exercising exclusively at maximum heart rate until exhaustion without breaks',
      'Lifting heavy barbells only without performing any cardio or bodyweight movements',
    ],
    correctAnswerIndex: 1,
    topic: 'Functional Fitness Concepts',
    difficulty: 'Easy',
  },
  {
    question: 'Why are dynamic warm-ups and structured cool-downs critical components of every training session?',
    options: [
      'They are optional routines meant only for competitive elite athletes',
      'They elevate body temperature, mobilize joints, and facilitate safe post-exercise recovery',
      'They eliminate the need to drink water or rest between heavy workouts',
      'They reduce workout effectiveness by fatiguing muscles before training starts',
    ],
    correctAnswerIndex: 1,
    topic: 'Warm-up & Cool-down',
    difficulty: 'Easy',
  },
  {
    question: 'When performing a standard bodyweight air squat, which movement cue represents correct mechanics?',
    options: [
      'Allowing knees to cave inward and lifting your heels completely off the floor',
      'Keeping feet flat, hips descending below the knee crease, and maintaining an upright chest',
      'Rounding the lumbar spine and keeping eyes pointed straight at the ground',
      'Bending forward at the waist without flexing knees or engaging the hips',
    ],
    correctAnswerIndex: 1,
    topic: 'Bodyweight Movement Mechanics',
    difficulty: 'Medium',
  },
  {
    question: 'What principle should a beginner prioritize before increasing workout speed or weight load?',
    options: [
      'Maximum load and speed from the first repetition regardless of form',
      'Consistent movement mechanics and safe technique before adding intensity or load',
      'Skipping coach demonstrations to finish the workout before other participants',
      'Increasing weights whenever someone else in the class lifts heavier',
    ],
    correctAnswerIndex: 1,
    topic: 'Exercise Safety & Form',
    difficulty: 'Easy',
  },
  {
    question: 'How do adequate hydration, balanced nutrition, and quality sleep support physical training?',
    options: [
      'Rest days cause rapid muscle loss and should always be avoided',
      'Hydration is only necessary when a student feels completely exhausted',
      'Sleep and hydration restore cellular energy, repair muscle tissue, and prevent injury',
      'Drinking water during training impairs cardiovascular endurance',
    ],
    correctAnswerIndex: 2,
    topic: 'Rest, Recovery & Hydration',
    difficulty: 'Easy',
  },
  {
    question: 'What is the most effective training consistency strategy for a beginner entering physical conditioning?',
    options: [
      'Working out once a month for four consecutive exhausting hours',
      'Training 7 days every week with zero rest days until burnout occurs',
      'Maintaining a structured schedule of 3 to 4 balanced sessions weekly with recovery days',
      'Only training when feeling completely energized without adhering to any schedule',
    ],
    correctAnswerIndex: 2,
    topic: 'Training Consistency',
    difficulty: 'Easy',
  },
  {
    question: 'What should you do immediately if you experience sharp joint pain, sudden dizziness, or chest tightness during exercise?',
    options: [
      'Push through the discomfort and attempt to finish the remaining repetitions',
      'Immediately stop exercising, step away safely, and inform your coach or trainer',
      'Increase your exercise tempo to force blood circulation to the affected area',
      'Hide your symptoms so you do not appear behind the rest of the class',
    ],
    correctAnswerIndex: 1,
    topic: 'Pain Recognition & Safety',
    difficulty: 'Easy',
  },
  {
    question: 'Why is active listening and following a certified coach\'s instructions crucial in group training?',
    options: [
      'Coaches only provide advice during sanctioned competitions and tests',
      'To ensure safety, master proper mechanics, and adapt workouts to your individual capacity',
      'Following coach directions is only required for students who fail the pre-test',
      'It ensures you never need to learn how to scale or modify movements on your own',
    ],
    correctAnswerIndex: 1,
    topic: 'Coach Instructions & Protocols',
    difficulty: 'Easy',
  },
  {
    question: 'What does the training principle of "progressive overload" describe?',
    options: [
      'Suddenly tripling your weights every week to shock the nervous system',
      'Gradually and systematically increasing training stimulus over time as the body adapts',
      'Exercising exclusively to failure on every single set and movement',
      'Changing movement patterns randomly without tracking loads or repetitions',
    ],
    correctAnswerIndex: 1,
    topic: 'Strength & Conditioning Concepts',
    difficulty: 'Medium',
  },
  {
    question: 'Which sequence reflects the safest progression hierarchy for a beginner learning functional movements?',
    options: [
      'Intensity first, load second, and mechanics only if fatigue permits',
      'Mechanics first, consistency second, and intensity only once mechanics are solid',
      'Heavy weights first, speed second, and warm-up only at the end of class',
      'Maximum speed first, load second, and bodyweight basics skipped entirely',
    ],
    correctAnswerIndex: 1,
    topic: 'Safe Progression',
    difficulty: 'Easy',
  },
  {
    question: 'In functional fitness and CrossFit, what does "scaling" a movement mean?',
    options: [
      'Failing a test and being penalized in the final academy evaluation',
      'Adjusting movement complexity, load, or volume to match individual ability while preserving the intended stimulus',
      'Leaving the gym early before the final conditioning segment is finished',
      'Performing exercises in reverse order without coach permission',
    ],
    correctAnswerIndex: 1,
    topic: 'Movement Scaling & Adaptation',
    difficulty: 'Easy',
  },
  {
    question: 'What is the appropriate action if you notice wet flooring near barbells or loose equipment in the workout area?',
    options: [
      'Continue training as planned and hope nobody trips or slips',
      'Immediately notify the coach or facility staff and clear or mark the hazard before lifting',
      'Attempt a heavy jump or lift over the wet surface to test your balance',
      'Ignore the situation because facility maintenance is not an athlete\'s concern',
    ],
    correctAnswerIndex: 1,
    topic: 'Unsafe Situation Response',
    difficulty: 'Easy',
  },
];

module.exports = {
  CROSSFIT_COURSE_SLUG,
  crossfitCourse,
  crossfitCohort,
  crossfitQuestions,
};
