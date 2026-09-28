const Course = require('../src/models/Course');

describe('Course model - official 4-tier taxonomy', () => {
  test('LEVEL_LABELS exposes exactly the 4 official levels in order', () => {
    expect(Course.LEVEL_LABELS).toEqual([
      'Awareness / Fundamentals',
      'Core Skills',
      'Specialization/Integration/Applications',
      'Professional/Industry',
    ]);
  });

  test('rejects a level value outside the official 4 labels', () => {
    const course = new Course({
      title: 'Test',
      slug: 'test-' + Date.now(),
      level: 'Foundation', // old placeholder value, no longer valid
      levelTier: 1,
      category: 'Space Technologies',
      duration: 2,
    });
    const err = course.validateSync();
    expect(err.errors.level).toBeDefined();
  });

  test('accepts a course with price and duration left null (pricing/duration not yet published)', () => {
    const course = new Course({
      title: 'IT & Systems Fundamentals Program',
      slug: 'it-systems-fundamentals-' + Date.now(),
      level: 'Awareness / Fundamentals',
      levelTier: 1,
      category: 'Cybersecurity',
      price: null,
      duration: null,
    });
    const err = course.validateSync();
    expect(err).toBeUndefined();
    expect(course.price).toBeNull();
    expect(course.duration).toBeNull();
  });

  test('availableSeats virtual returns null (not a misleading number) when capacity is unknown', () => {
    const course = new Course({
      title: 'Test',
      slug: 'test-capacity-' + Date.now(),
      level: 'Core Skills',
      levelTier: 2,
      category: 'Robotics & Autonomous Systems',
      duration: 5,
      price: 1800,
      // capacity intentionally omitted - not given in the source data
    });
    expect(course.availableSeats).toBeNull();
  });

  test('rejects levelTier values outside 1-4', () => {
    const course = new Course({
      title: 'Test',
      slug: 'test-tier-' + Date.now(),
      level: 'Core Skills',
      levelTier: 5,
      category: 'Robotics & Autonomous Systems',
      duration: 5,
      price: 1800,
    });
    const err = course.validateSync();
    expect(err.errors.levelTier).toBeDefined();
  });
});
