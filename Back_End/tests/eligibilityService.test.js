jest.mock('../src/models/Course');

const Course = require('../src/models/Course');
const { checkCourseFit } = require('../src/services/eligibilityService');

describe('eligibilityService.checkCourseFit', () => {
  afterEach(() => jest.clearAllMocks());

  test('returns Foundation Required when a mandatory prerequisite is missing, even with a high readiness score elsewhere', async () => {
    const prereqId = 'prereq-course-id';
    const course = {
      mandatoryPrerequisites: [prereqId],
      requiredExperience: [],
      level: 'Advanced',
    };
    const studentProfile = {
      completedCourses: [], // prerequisite NOT completed
      experience: [],
      status: 'student',
    };

    Course.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: prereqId, title: 'Satellite Systems Fundamentals' }]),
    });

    const result = await checkCourseFit(studentProfile, course);

    expect(result.result).toBe('Foundation Required');
    expect(result.requiresReadiness).toBe(false);
    expect(result.reasons[0].code).toBe('MISSING_PREREQUISITE');
    expect(result.reasons[0].message).toContain('Satellite Systems Fundamentals');
  });

  test('mandatory prerequisite rule has priority over everything else - the business rule', async () => {
    // Even if the student otherwise looks fully qualified (has experience, etc.),
    // a missing mandatory prerequisite must still force Foundation Required.
    const prereqId = 'prereq-course-id';
    const course = {
      mandatoryPrerequisites: [prereqId],
      requiredExperience: ['satellite subsystems'],
      level: 'Advanced',
    };
    const studentProfile = {
      completedCourses: [],
      experience: ['satellite subsystems', 'RF design'],
      status: 'graduate',
      academicYear: '4th Year',
    };

    Course.find.mockReturnValue({
      select: jest.fn().mockResolvedValue([{ _id: prereqId, title: 'Satellite Systems Fundamentals' }]),
    });

    const result = await checkCourseFit(studentProfile, course);
    expect(result.result).toBe('Foundation Required');
  });

  test('returns Eligible when prerequisites are completed and experience matches', async () => {
    const prereqId = 'prereq-course-id';
    const course = {
      mandatoryPrerequisites: [prereqId],
      requiredExperience: ['satellite subsystems'],
      level: 'Intermediate',
    };
    const studentProfile = {
      completedCourses: [prereqId],
      experience: ['satellite subsystems experience'],
      status: 'student',
      academicYear: '3rd Year',
    };

    const result = await checkCourseFit(studentProfile, course);

    expect(result.result).toBe('Eligible');
    expect(result.requiresReadiness).toBe(true);
    expect(Course.find).not.toHaveBeenCalled(); // no missing prereqs -> no lookup needed
  });

  test('returns Conditionally Eligible when required experience is missing but no prerequisite is missing', async () => {
    const course = {
      mandatoryPrerequisites: [],
      requiredExperience: ['RF communications'],
      level: 'Intermediate',
    };
    const studentProfile = {
      completedCourses: [],
      experience: ['Python'],
      status: 'student',
      academicYear: '2nd Year',
    };

    const result = await checkCourseFit(studentProfile, course);

    expect(result.result).toBe('Conditionally Eligible');
    expect(result.reasons.some((r) => r.code === 'MISSING_EXPERIENCE')).toBe(true);
  });

  test('flags Manual Review for Advanced courses when academic year is unspecified', async () => {
    const course = {
      mandatoryPrerequisites: [],
      requiredExperience: [],
      level: 'Advanced',
    };
    const studentProfile = {
      completedCourses: [],
      experience: [],
      status: 'student',
      academicYear: undefined,
    };

    const result = await checkCourseFit(studentProfile, course);

    expect(result.result).toBe('Manual Review');
    expect(result.reasons.some((r) => r.code === 'ACADEMIC_STATUS_REVIEW')).toBe(true);
  });
});
