const CourseBundle = require('../src/models/CourseBundle');
const mongoose = require('mongoose');

describe('CourseBundle model', () => {
  test('stores the exact given bundle price with no derived/invented calculation', () => {
    const bundle = new CourseBundle({
      title: 'Electronics & Technology Manufacturing — Level 1 Bundle',
      category: 'Electronics & Technology Manufacturing',
      levelTier: 1,
      level: 'Awareness / Fundamentals',
      courses: [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()],
      price: 2000, // exact value from the source PDF, not a computed discount
    });
    const err = bundle.validateSync();
    expect(err).toBeUndefined();
    expect(bundle.price).toBe(2000);
    expect(bundle.currency).toBe('EGP');
  });

  test('requires at least the fields that identify which track/level it belongs to', () => {
    const bundle = new CourseBundle({ price: 2000 });
    const err = bundle.validateSync();
    expect(err.errors.title).toBeDefined();
    expect(err.errors.category).toBeDefined();
    expect(err.errors.levelTier).toBeDefined();
    expect(err.errors.level).toBeDefined();
  });

  test('rejects a levelTier outside 1-4', () => {
    const bundle = new CourseBundle({
      title: 'Bad Bundle',
      category: 'Robotics & Autonomous Systems',
      levelTier: 7,
      level: 'Core Skills',
      courses: [new mongoose.Types.ObjectId()],
      price: 1000,
    });
    const err = bundle.validateSync();
    expect(err.errors.levelTier).toBeDefined();
  });
});
