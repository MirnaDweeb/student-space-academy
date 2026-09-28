# EGSA Academy — Student Cycle

Full-stack MVP implementing the Egyptian Space Agency Academy Student Cycle:
Goal → Learning Path → Course → Fit Check → Eligibility → Readiness Assessment →
Knowledge Gaps → Recommendation → Application → Acceptance/Waitlist → Payment →
Enrollment → Certificate.

See [`API_REFERENCE.md`](./API_REFERENCE.md) for the full endpoint list.
CI (`.github/workflows/ci.yml`) runs backend syntax checks + unit tests and a
frontend production build on every push/PR.

## Stack
- **Back_End**: Node.js, Express, MongoDB, Mongoose, JWT, bcryptjs
- **Front_End**: React (Vite), React Router, Bootstrap 5, Axios, Context API

## Run the Backend

```bash
cd Back_End
cp .env.example .env      # edit MONGO_URI / JWT_SECRET as needed
npm install
npm run seed               # creates demo goals, courses, learning paths, questions, demo user
npm run dev                # starts API on http://localhost:5000
```

Demo logins (created by the seed script):
- Student — Email: `sara.demo@egsa-academy.example` / Password: `Password123!`
- Admin (scaffolding only, see below) — Email: `admin@egsa-academy.example` / Password: `AdminPass123!`

## Run the Frontend

```bash
cd Front_End
npm install
npm run dev                # starts on http://localhost:5173, proxies /api to :5000
```

## Backend Tests

Unit tests cover the three highest-risk business rules with mocked Mongoose
models (no live database needed):

```bash
cd Back_End
npm install
npm test
```

Covers:
- `eligibilityService` — the mandatory-prerequisite-overrides-everything rule
- `readinessService` — scoring, per-topic knowledge gaps, and outcome
  classification (knowledge gaps take priority over the raw aggregate score,
  matching the spec's 58%-with-gaps demo scenario)
- `paymentService` — invoice due-date calculation and the 72-hour payment
  deadline rule (including rejection of late payments and auto-enrollment on
  success)



1. Log in as the demo student (goal is already set to "Satellite Systems").
2. Go to **Courses** → open **Advanced Satellite Systems** → **Check My Fit**.
3. Because the mandatory prerequisite (Satellite Systems Fundamentals) is missing,
   the system returns **Foundation Required** regardless of any readiness score —
   this is the mandatory-prerequisite business rule described in the spec.
4. Apply to the foundation course, then check fit again for
   **Satellite Systems Fundamentals** (no mandatory prerequisite) to continue to
   the **Readiness Assessment**.
5. Answer the questions; the backend computes the score, topic breakdown, and
   knowledge gaps, and classifies the outcome as READY / CONDITIONALLY READY /
   FOUNDATION REQUIRED / MANUAL REVIEW.
6. Continue to **Application** → **Payment** (simulated, T-72h rule enforced in
   `paymentService.js`) → **Enrollment** is created automatically on payment
   confirmation.

## Notes

- No real payment gateway or external AI API is integrated (per spec); both are
  isolated behind `services/paymentService.js` and `services/recommendationService.js`
  so they can be swapped later without touching controllers or routes.
- Only the Student role is fully implemented. A minimal, role-protected
  `Admin` route (`/api/admin/overview`, `/api/admin/applications/manual-review`)
  exists purely as backend scaffolding for future expansion — there is no
  admin UI, per spec.
- Every mutating endpoint (`POST`/`PUT`/`PATCH`) runs through an
  `express-validator` chain in `src/validators/` before touching a
  controller, so malformed requests fail fast with field-level error
  messages instead of reaching business logic.
- Design system (colors, Cairo/Montserrat fonts) lives in
  `Front_End/src/styles/theme.css` and follows the mandatory EGSA brand spec.
