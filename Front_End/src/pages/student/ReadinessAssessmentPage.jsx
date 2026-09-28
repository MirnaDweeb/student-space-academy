import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { readinessService } from '../../services/cycleServices';
import { ErrorState, ProgressBar } from '../../components/StateComponents.jsx';

export default function ReadinessAssessmentPage() {
  const { attemptId } = useParams();
  const [questions, setQuestions] = useState([]);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const stored = sessionStorage.getItem(`egsa_attempt_${attemptId}`);
    if (stored) {
      setQuestions(JSON.parse(stored));
    } else {
      setError('Assessment session expired. Please start again from the course fit page.');
    }
  }, [attemptId]);

  if (error) return <ErrorState message={error} />;
  if (questions.length === 0) return null;

  const q = questions[current];
  const progress = ((current) / questions.length) * 100;

  const selectAnswer = (optionIndex) => {
    setAnswers((a) => ({ ...a, [q.id]: optionIndex }));
  };

  const goNext = async () => {
    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
      return;
    }
    setSubmitting(true);
    const payload = Object.entries(answers).map(([questionId, selectedIndex]) => ({ questionId, selectedIndex }));
    const res = await readinessService.submit(attemptId, payload);
    sessionStorage.removeItem(`egsa_attempt_${attemptId}`);
    navigate(`/student/readiness/${res.data.attemptId}/result`);
  };

  return (
    <div className="row justify-content-center">
      <div className="col-lg-7">
        <div className="d-flex justify-content-between small text-muted mb-2">
          <span>Question {current + 1} of {questions.length}</span>
          <span>{q.topic}</span>
        </div>
        <ProgressBar percent={progress} />
        <div className="egsa-card p-4 p-md-5 mt-4">
          <h5 className="mb-4">{q.question}</h5>
          <div className="d-grid gap-2">
            {q.options.map((opt, idx) => (
              <button
                key={idx}
                className={`btn text-start ${answers[q.id] === idx ? 'btn-primary' : 'btn-outline-primary'}`}
                onClick={() => selectAnswer(idx)}
              >
                {opt}
              </button>
            ))}
          </div>
          <button
            className="btn btn-accent mt-4 w-100"
            disabled={answers[q.id] === undefined || submitting}
            onClick={goNext}
          >
            {current < questions.length - 1 ? 'Next Question' : (submitting ? 'Submitting…' : 'Submit Assessment')}
          </button>
        </div>
      </div>
    </div>
  );
}
