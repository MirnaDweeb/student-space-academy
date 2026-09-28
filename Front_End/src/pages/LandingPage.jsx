import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  return (
    <div>
      <div className="egsa-hero mb-5">
        <div className="row align-items-center">
          <div className="col-lg-8">
            <h1 className="fw-bold mb-3">Egyptian Space Academy</h1>
            <p className="lead mb-4">
              Don't guess which course to take. We guide you from your goal to a certified, job-ready skill —
              step by step, backed by a real readiness assessment.
            </p>
            <Link
              to={isAuthenticated ? '/student/dashboard' : '/register'}
              className="btn btn-accent btn-lg"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Start Your Journey'}
            </Link>
          </div>
        </div>
      </div>

      <div className="row g-4">
        {[
          { icon: 'fa-bullseye', title: 'Define Your Goal', text: 'Tell us what you want to achieve in the space sector.' },
          { icon: 'fa-route', title: 'Get a Learning Path', text: 'A recommended sequence of courses tailored to your goal.' },
          { icon: 'fa-clipboard-check', title: 'Check Your Fit', text: 'Eligibility and prerequisite checks before you commit.' },
          { icon: 'fa-chart-line', title: 'Assess Readiness', text: 'A real assessment identifies your knowledge gaps.' },
          { icon: 'fa-certificate', title: 'Apply & Enroll', text: 'Apply, pay, and enroll with full transparency.' },
          { icon: 'fa-award', title: 'Get Certified', text: 'Complete training and receive your certificate.' },
        ].map((f) => (
          <div className="col-md-4" key={f.title}>
            <div className="egsa-card h-100">
              <i className={`fa-solid ${f.icon} fa-lg text-primary-egsa mb-3`}></i>
              <h6>{f.title}</h6>
              <p className="text-muted small mb-0">{f.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
