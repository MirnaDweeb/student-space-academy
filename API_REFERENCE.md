# EGSA Academy — API Reference

Base URL: `http://localhost:5000/api`

All endpoints except `/auth/*` and `GET /health` require:
`Authorization: Bearer <jwt>`

Every response follows `{ success: boolean, data?, message?, errors? }`.
Validation failures return `400` with `errors: [{ field, message }]`.

---

## Auth

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/auth/register` | fullName, email, password, confirmPassword, phone, nationalId, status, university, faculty, graduationYear, agreeToTerms | Sends a verification email (logged to console in dev if SMTP is unset) |
| POST | `/auth/login` | email, password | Returns `{ token, user }` |
| POST | `/auth/forgot-password` | email | Always returns success (no user enumeration) |
| POST | `/auth/reset-password` | token, password | |
| GET | `/auth/verify/:token` | — | Marks the account email-verified |

## Student Profile

| Method | Path | Notes |
|---|---|---|
| GET | `/students/me` | Returns `{ user, profile }` |
| PUT | `/students/me` | Updates profile fields (status, university, faculty, department, academicYear, graduationYear, skills[], experience[], previousTraining[]) |
| POST | `/students/me/goal` | Body: `{ goalId }` |

## Goals & Learning Paths

| Method | Path | Notes |
|---|---|---|
| GET | `/goals` | List all learning goals |
| GET | `/learning-paths` | List all learning paths |
| GET | `/learning-paths/recommended` | Path matching the student's current goal |

## Courses

| Method | Path | Query params | Notes |
|---|---|---|---|
| GET | `/courses` | `q, goal, category, level, deliveryMode, minPrice, maxPrice, sort` | Catalog search/filter |
| GET | `/courses/:id` | — | Full course detail |
| GET | `/courses/:id/fit` | — | Returns `{ result, reasons[], requiresReadiness }`. **Mandatory prerequisite missing always forces `Foundation Required`, overriding everything else.** |

## Readiness Assessment

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/readiness/start` | `{ courseId }` | Returns `{ attemptId, questions[] }` (10 random questions, answers withheld) |
| POST | `/readiness/:attemptId/submit` | `{ answers: [{ questionId, selectedIndex }] }` | Backend scores, computes topic breakdown & knowledge gaps, classifies outcome |
| GET | `/readiness/:attemptId/result` | — | Full result incl. `recommendedCourse` when gaps exist |

Outcome values: `READY`, `CONDITIONALLY_READY`, `FOUNDATION_REQUIRED`, `MANUAL_REVIEW`.

## Applications

| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/applications` | `{ courseId, readinessAttemptId? }` | Runs eligibility + readiness rules to pick an initial status; issues an invoice and reserves a cohort seat when `Eligible - Payment Pending` |
| GET | `/applications/my` | — | List, newest first |
| GET | `/applications/:id` | — | Full detail incl. cohort, readiness attempt, fit snapshot |

Status enum: `Draft, Submitted, Needs Information, Readiness Required, Foundation Recommended, Manual Review, Eligible - Payment Pending, Waitlisted, Confirmed, In Progress, Completed, Incomplete, Cancelled, No Show`.

## Payments

| Method | Path | Body | Notes |
|---|---|---|---|
| GET | `/payments/my` | — | List invoices |
| POST | `/payments/:invoiceId/pay` | `{ method? }` | Rejects if `now > invoice.dueDate` (72h-before-start rule); on success marks the invoice `Paid`, the application `Confirmed`, and creates an `Enrollment` |

## Enrollments

| Method | Path |
|---|---|
| GET | `/enrollments/my` |

## Notifications

| Method | Path |
|---|---|
| GET | `/notifications` |
| PATCH | `/notifications/:id/read` |

## Certificates

| Method | Path |
|---|---|
| GET | `/certificates/my` |

## Dashboard

| Method | Path | Notes |
|---|---|---|
| GET | `/dashboard` | Aggregates profile, learning-path progress, current application, upcoming enrollments, pending actions, recommendations, and recent notifications in one call |

## Admin (scaffolding only — requires role `admin`)

| Method | Path |
|---|---|
| GET | `/admin/overview` |
| GET | `/admin/applications/manual-review` |

## Health

| Method | Path |
|---|---|
| GET | `/health` |
