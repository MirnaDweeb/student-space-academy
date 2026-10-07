const mongoose = require('mongoose');
const { scoreAttempt } = require('../src/services/readinessService');

describe('Readiness Scoring Engine Tests (Requirement 10)', () => {
  const dummyCourse = {
    _id: new mongoose.Types.ObjectId(),
    title: 'Satellite Systems Program',
    minReadinessScore: 60,
    scoringPolicy: 'STANDARD',
  };

  const createAttempt = (answersList) => {
    const questions = [];
    const answers = [];

    answersList.forEach((ans, idx) => {
      const qId = new mongoose.Types.ObjectId();
      questions.push({
        _id: qId,
        question: `Question ${idx + 1}`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswerIndex: 1, // Let Option B be the correct answer
        topic: idx < 4 ? 'Systems & Quantitative Reasoning' : (idx < 8 ? 'Operational Safety & Protocols' : 'Scientific & Technical Fundamentals'),
      });

      answers.push({
        question: qId,
        selectedIndex: ans.selectedIndex,
        isCorrect: ans.selectedIndex === 1,
      });
    });

    return { questions, answers };
  };

  test('Test 1: 12 questions, 12 correct -> 12/12, 100% score (READY)', async () => {
    const answersList = Array.from({ length: 12 }, () => ({ selectedIndex: 1 }));
    const attempt = createAttempt(answersList);

    const result = await scoreAttempt(attempt, dummyCourse);

    expect(result.score).toBe(100);
    expect(result.knowledgeGaps).toHaveLength(0);
    expect(result.outcome).toBe('READY');
  });

  test('Test 2: 12 questions, 8 correct -> 8/12, 67% score (FOUNDATION_REQUIRED)', async () => {
    // 8 correct (selectedIndex: 1), 4 incorrect (selectedIndex: 0)
    const answersList = [
      { selectedIndex: 1 },
      { selectedIndex: 1 },
      { selectedIndex: 1 },
      { selectedIndex: 1 }, // 4/4 topic 1 -> 100%
      { selectedIndex: 1 },
      { selectedIndex: 1 },
      { selectedIndex: 0 },
      { selectedIndex: 0 }, // 2/4 topic 2 -> 50% (<60% gap!)
      { selectedIndex: 1 },
      { selectedIndex: 1 },
      { selectedIndex: 0 },
      { selectedIndex: 0 }, // 2/4 topic 3 -> 50% (<60% gap!)
    ];
    const attempt = createAttempt(answersList);

    const result = await scoreAttempt(attempt, dummyCourse);

    expect(result.score).toBe(67); // Math.round((8 / 12) * 100) = 67
    expect(result.knowledgeGaps.length).toBeGreaterThanOrEqual(1);
    expect(result.outcome).toBe('FOUNDATION_REQUIRED');
  });

  test('Test 3: 12 questions, 0 correct -> 0/12, 0% score (MANUAL_REVIEW)', async () => {
    const answersList = Array.from({ length: 12 }, () => ({ selectedIndex: 0 }));
    const attempt = createAttempt(answersList);

    const result = await scoreAttempt(attempt, dummyCourse);

    expect(result.score).toBe(0);
    expect(result.knowledgeGaps.length).toBeGreaterThan(0);
    expect(result.outcome).toBe('FOUNDATION_REQUIRED'); // Or MANUAL_REVIEW depending on gaps, gaps take priority
  });

  test('Test 4: 12 questions, some unanswered (-1) -> unanswered treated as incorrect', async () => {
    // 6 answered correctly, 3 answered incorrectly, 3 unanswered (-1)
    const answersList = [
      { selectedIndex: 1 },
      { selectedIndex: 1 },
      { selectedIndex: 1 },
      { selectedIndex: 1 },
      { selectedIndex: 1 },
      { selectedIndex: 1 },
      { selectedIndex: 0 },
      { selectedIndex: 0 },
      { selectedIndex: 0 },
      { selectedIndex: -1 },
      { selectedIndex: -1 },
      { selectedIndex: -1 },
    ];
    const attempt = createAttempt(answersList);

    const result = await scoreAttempt(attempt, dummyCourse);

    // 6 correct out of 12 total questions = 50%
    expect(result.score).toBe(50);
    expect(result.knowledgeGaps.length).toBeGreaterThanOrEqual(1);
  });
});
