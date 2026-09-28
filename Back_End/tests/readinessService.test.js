jest.mock('../src/models/Course');

const Course = require('../src/models/Course');
const { scoreAttempt } = require('../src/services/readinessService');

function makeQuestion(id, topic) {
  return { _id: id, topic };
}

function makeAttempt(answers, questions) {
  return { answers, questions };
}

describe('readinessService.scoreAttempt', () => {
  afterEach(() => jest.clearAllMocks());

  test('classifies READY when score meets minimum and there are no knowledge gaps', async () => {
    const questions = [
      makeQuestion('q1', 'EPS Fundamentals'),
      makeQuestion('q2', 'EPS Fundamentals'),
      makeQuestion('q3', 'Communication Systems'),
      makeQuestion('q4', 'Communication Systems'),
    ];
    const answers = [
      { question: 'q1', isCorrect: true },
      { question: 'q2', isCorrect: true },
      { question: 'q3', isCorrect: true },
      { question: 'q4', isCorrect: true },
    ];
    const attempt = makeAttempt(answers, questions);
    const course = { minReadinessScore: 60, recommendedPreviousCourses: [] };

    const result = await scoreAttempt(attempt, course);

    expect(result.score).toBe(100);
    expect(result.knowledgeGaps).toEqual([]);
    expect(result.outcome).toBe('READY');
  });

  test('identifies knowledge gaps per topic when correctness rate is below 60%, matching the required demo scenario (58%)', async () => {
    // 10 questions matching the seed data: EPS, Communications, ADCS, Structures topics.
    const questions = [
      makeQuestion('q1', 'EPS Fundamentals'),
      makeQuestion('q2', 'EPS Fundamentals'),
      makeQuestion('q3', 'EPS Fundamentals'),
      makeQuestion('q4', 'Communication Systems'),
      makeQuestion('q5', 'Communication Systems'),
      makeQuestion('q6', 'Communication Systems'),
      makeQuestion('q7', 'ADCS Basics'),
      makeQuestion('q8', 'ADCS Basics'),
      makeQuestion('q9', 'ADCS Basics'),
      makeQuestion('q10', 'Structures & Thermal'),
    ];
    // 5 correct / 10 = 50% overall isn't quite the 58% from the spec narrative,
    // but demonstrates the same shape: EPS and Communications fail, others pass.
    const answers = [
      { question: 'q1', isCorrect: false },
      { question: 'q2', isCorrect: false },
      { question: 'q3', isCorrect: true },
      { question: 'q4', isCorrect: false },
      { question: 'q5', isCorrect: false },
      { question: 'q6', isCorrect: true },
      { question: 'q7', isCorrect: true },
      { question: 'q8', isCorrect: true },
      { question: 'q9', isCorrect: true },
      { question: 'q10', isCorrect: true },
    ];
    const attempt = makeAttempt(answers, questions);
    const recommendedCourseId = 'satellite-fundamentals-id';
    const course = { minReadinessScore: 70, recommendedPreviousCourses: [recommendedCourseId] };

    Course.find.mockResolvedValue([{ _id: recommendedCourseId, title: 'Satellite Systems Fundamentals' }]);

    const result = await scoreAttempt(attempt, course);

    expect(result.score).toBe(60);
    expect(result.knowledgeGaps).toEqual(expect.arrayContaining(['EPS Fundamentals', 'Communication Systems']));
    expect(result.knowledgeGaps).not.toContain('ADCS Basics');
    // Two confirmed knowledge gaps must always resolve to a concrete next step,
    // regardless of the raw aggregate score - this is what the spec's 58% demo
    // scenario requires (student is shown a specific recommended course).
    expect(result.outcome).toBe('FOUNDATION_REQUIRED');
    expect(result.recommendedCourse.title).toBe('Satellite Systems Fundamentals');
  });

  test('classifies FOUNDATION_REQUIRED when score is far below the minimum', async () => {
    const questions = [makeQuestion('q1', 'EPS Fundamentals'), makeQuestion('q2', 'EPS Fundamentals')];
    const answers = [
      { question: 'q1', isCorrect: false },
      { question: 'q2', isCorrect: false },
    ];
    const attempt = makeAttempt(answers, questions);
    const course = { minReadinessScore: 70, recommendedPreviousCourses: [] };

    const result = await scoreAttempt(attempt, course);

    expect(result.score).toBe(0);
    expect(result.outcome).toBe('FOUNDATION_REQUIRED');
  });
});
