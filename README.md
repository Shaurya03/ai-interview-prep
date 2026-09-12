# AI Interview Prep Kit

A full-stack application that turns a job description and company website into a personalised interview-preparation kit.

The application combines structured job-description extraction, company research, public interview-process research, targeted question generation, deterministic coverage checking, a second repair pass, deterministic study scheduling, persistent editing, and an interactive flashcard practice mode.

The goal is not to generate a giant AI blob and hope for the best. The pipeline deliberately separates model work from deterministic application logic so that requirements, coverage, scheduling, persistence, and regeneration remain predictable.

---

## Features

- Secure registration, login, logout, and session-based authentication
- User-isolated interview kits
- Create a kit from:
  - Job description text
  - Company website URL
  - Number of days available before the interview
- Company research:
  - Company overview / about information
  - Hiring / careers / interview-process pages when discoverable
  - Public discussion of the company's interview process
- Structured interview kit containing:
  - Company brief
  - Role and responsibilities
  - Must-have and nice-to-have requirements
  - Categorised interview questions
  - Answer outlines
  - Flashcards
  - Day-by-day preparation schedule
  - Deterministic coverage report
- Multi-stage research and generation pipeline
- Coverage-driven second pass to close missing requirement gaps
- Builder with:
  - Inline editing
  - Question reordering
  - Moving questions between categories
  - Manual question creation
  - Manual flashcard creation
  - Question/flashcard deletion
  - Section-level regeneration
- Regeneration that preserves user edits and deletions elsewhere in the kit
- Practice Mode:
  - One flashcard at a time
  - Reveal reference answer
  - Confidence tracking
  - Persistent practice responses
  - Retry / reattempt support
  - Confidence-weighted next-session ordering
- Weak Spots view showing requirements that need more preparation
- Batch evaluator for running the same generation pipeline against multiple cases
- Structured validation and error handling
- Rate-limit retries and model fallback handling
- Responsive, keyboard-friendly interface
- Automated tests for important backend and pipeline behaviour

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js + React + TypeScript |
| Styling | Tailwind CSS |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Validation | Zod |
| Authentication | JWT-backed HTTP-only session cookie + bcrypt |
| LLM | Google Gemini |
| LLM primary model | `gemini-3.7-flash` |
| LLM fallback | `gemini-3.6-flash` |
| Package management | npm workspaces |
| Testing | Vitest |
| Runtime / tooling | TypeScript + `tsx` |

### Why this stack?

The stack closely follows the assessment's preferred technologies while keeping the application small enough to reason about.

Next.js provides the frontend and responsive UI, Express keeps the API and generation pipeline independent from the UI, MongoDB gives the kit a flexible persisted structure, and TypeScript provides compile-time guarantees across the application.

The generation pipeline is deliberately implemented as backend services rather than being embedded in frontend components. This makes the same pipeline reusable by both the web application and the mandatory batch evaluator.

---

## Architecture

The repository is organised as a small npm-workspace monorepo:

```text
ai-interview-prep/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── middleware/
│   │       ├── models/
│   │       ├── routes/
│   │       ├── services/
│   │       ├── app.ts
│   │       ├── db.ts
│   │       └── server.ts
│   │
│   └── web/
│       └── src/
│           └── app/
│
├── packages/
│   └── shared/
│       └── src/
│           ├── index.ts
│           └── kit.ts
│
├── .env.example
├── package.json
└── package-lock.json
```

### High-level request flow

```text
User
  │
  ▼
Next.js Web App
  │
  │ REST API
  ▼
Express API
  │
  ├── Authentication
  ├── Kit CRUD / Builder
  ├── Practice persistence
  │
  └── Generation pipeline
        │
        ├── JD extraction
        ├── Company retrieval
        ├── Company crawling / link ranking
        ├── Hiring-process research
        ├── Public interview discussion research
        ├── Company brief generation
        ├── Targeted question generation
        ├── Flashcard generation
        ├── Deterministic coverage check
        ├── Second-pass gap repair
        ├── Deterministic schedule allocation
        └── Final kit validation
              │
              ▼
          MongoDB
```

The frontend never directly calls the LLM or external company websites. External retrieval and model interaction are backend responsibilities.

---

# Generation Pipeline

The central design decision is to use a sequence of focused stages instead of one large prompt.

```text
Job Description
      │
      ▼
1. Requirement Extraction
      │
      ▼
2. Company Research
      ├── Retrieve and clean individual pages
      ├── Crawl and rank company links
      ├── Find about/company information
      └── Find hiring/interview-process information
      │
      ▼
3. Public Interview Research
      │
      ▼
4. Company Brief
      │
      ▼
5. Targeted Question Generation
      │
      ├── Technical
      ├── Behavioural
      ├── System Design
      └── Company Fit
      │
      ▼
6. Flashcard Generation
      │
      ▼
7. Deterministic Coverage Check
      │
      ▼
8. Second Pass
      │
      └── Generate questions for uncovered requirements
      │
      ▼
9. Deterministic Schedule Allocation
      │
      ▼
10. Final Structure Validation
      │
      ▼
Persist Kit
```

## 1. Requirement extraction

The job description is already supplied as text, so it does not need to be retrieved from a job board.

The first model stage extracts:

- Role title
- Seniority
- Responsibilities
- Requirements
- Requirement kind:
  - `technical`
  - `behavioural`
  - `domain`
- Requirement priority:
  - `must`
  - `nice`

Every requirement receives a stable ID such as `r1`, `r2`, etc.

The model is instructed to use evidence from the supplied job description rather than inventing qualifications. This is particularly important for thin job descriptions: a sparse posting should result in a sparse kit instead of fabricated requirements.

---

## 2. Company retrieval and crawling

The company URL is treated as an entry point rather than assuming a fixed path such as `/careers` or `/jobs`.

The retrieval layer:

1. Validates the supplied URL.
2. Fetches the starting page.
3. Cleans the retrieved HTML into usable text.
4. Extracts links from the page.
5. Ranks likely useful links based on their URL/text signals.
6. Follows relevant internal links.
7. Looks for company/about information and hiring/interview-process information.
8. Records the pages actually used by the generated kit.

The crawler follows relative links so it also works with local/company test sites used by the batch evaluator.

A missing hiring page is not treated as a fatal error. The resulting kit records the available research rather than pretending that an interview process was found.

The retrieval layer also applies request throttling/retry behaviour and avoids treating arbitrary page content as instructions to the model.

---

## 3. Public interview research

The system separately looks for public discussion about the company's interview process.

This information is treated as supporting evidence, not as guaranteed fact. The generated kit can therefore use available public discussion to influence question selection without inventing a company-specific process when no reliable discussion is available.

If no public discussion is found, generation continues normally.

---

## 4. Company brief

After retrieval, the company information is passed to a focused generation step to produce:

- `summary`
- `what_they_do`
- source URLs

The source URLs are also retained in the kit so the user can see where the research came from.

---

## 5. Targeted question generation

Questions are generated against specific extracted requirements and categories rather than asking the model for the entire question bank in one call.

For example:

```text
Requirement:
5+ years with React

Category:
technical

→ Generate questions specifically testing this requirement.
```

A behavioural requirement such as mentoring junior engineers can therefore produce behavioural questions rather than being processed using the same instructions as a React requirement.

Each question receives:

- Stable ID
- Requirement IDs it covers
- Category
- Prompt
- Answer outline
- Difficulty from 1–3

A question can cover multiple requirements.

---

## 6. Flashcard generation

Flashcards are generated from the identified preparation material and link back to relevant requirement IDs.

Each flashcard has a stable ID and contains:

- `front`
- `back`
- `requirement_ids`

Flashcards are intentionally separate from interview questions because Practice Mode is designed around active recall rather than simply reading the question bank.

---

# Deterministic Logic

The model is deliberately not responsible for decisions that are better represented as application logic.

Two particularly important decisions are deterministic:

1. Coverage checking
2. Schedule allocation

This prevents the LLM from deciding whether it has covered itself adequately or from producing mathematically inconsistent schedules.

---

## Coverage checking

Coverage is calculated from the relationship:

```text
requirement → question.requirement_ids
```

A requirement is covered when at least one remaining question references its ID.

The application computes:

```text
uncovered_requirement_ids
```

rather than asking the model whether the kit is sufficiently covered.

This makes coverage testable and reproducible.

### Second pass

After the first question-generation pass:

1. Run deterministic coverage checking.
2. Identify uncovered requirements.
3. Generate missing questions specifically for those requirements.
4. Merge them into the draft.
5. Run coverage again.
6. Persist the final coverage result.

The implementation uses a bounded repair strategy rather than an unbounded loop. This prevents a bad model response or repeatedly unresolvable requirement from creating an endless generation cycle.

A kit is not considered successful merely because the first model call returned valid JSON. The coverage stage exists specifically to catch missing must-have requirements.

---

# Schedule Allocation

Scheduling is deterministic application logic.

The user supplies the number of available days, and the scheduler produces exactly that many days.

Each day contains:

```json
{
  "day": 1,
  "focus": "...",
  "question_ids": ["q1", "q2"],
  "minutes": 60
}
```

The scheduler considers:

- Requirement priority
- Question difficulty
- Requirement coverage
- Number of available days

Higher-priority and harder material is placed earlier rather than leaving the most important preparation until the final day.

The allocation also guarantees:

- Exactly the requested number of days
- Integer minute values
- Existing question IDs only
- Must-have requirements represented in the schedule

The scheduler remains deterministic so the LLM cannot produce a schedule with missing days, invalid IDs, floating-point durations, or uncovered must-have requirements.

---

# Kit Structure

Generated kits follow the required Appendix A structure.

The important relationships are:

```text
Requirement
  └── stable id: r1

Question
  ├── stable id: q1
  └── requirement_ids: ["r1"]

Flashcard
  ├── stable id: f1
  └── requirement_ids: ["r1"]

Schedule Day
  └── question_ids: ["q1"]

Coverage
  └── uncovered_requirement_ids: []
```

The final kit is validated before it is saved.

This validation checks the structural contract, including stable IDs, question-to-requirement references, valid difficulty values, integer schedule minutes, and valid schedule question IDs.

---

# Builder and State Preservation

The builder is designed around the most important state-management problem in the assessment: regenerating AI content without destroying work the user has already done.

The persisted kit has generated data plus a separate `builderState`.

Conceptually:

```text
Generated kit
├── generated questions
├── generated flashcards
├── generated company brief
└── generated schedule

builderState
├── editedQuestions
├── editedFlashcards
├── editedCompanyBrief
├── questionOrder
├── deletedQuestionIds
└── deletedFlashcardIds
```

## Generated state

The generated kit remains the canonical AI-produced structure.

## Edited state

User changes are tracked separately in `builderState`.

For example:

```text
editedQuestions[q1] = {
  prompt: "...",
  answer_outline: "...",
  category: "technical"
}
```

This makes user edits distinguishable from the latest generated version.

## Deleted state

Deleted IDs are persisted so a regeneration can avoid bringing intentionally removed content back into the kit.

## Reordering

Question order is persisted separately through `questionOrder`.

The API validates that the order contains every current question exactly once, preventing duplicate or missing IDs.

## Regeneration preservation

When a section is regenerated, the new generated content is merged with the existing builder state.

The important rule is:

```text
regenerate one section
        ≠
replace the entire kit
```

Edits, deletions, and ordering outside the regenerated section remain intact.

Manually edited content is therefore effectively treated as protected/pinned content during regeneration, without requiring a separate pin-toggle UI.

This design was chosen because preserving user-authored state is more important than making the underlying generated JSON look perfectly uniform.

---

# Practice Mode

Practice Mode uses flashcards as the active-recall unit.

The user can:

1. Start a practice session.
2. See one flashcard at a time.
3. Write an answer.
4. Reveal the reference answer.
5. Select confidence:
   - Low
   - Medium
   - High
6. Save the response.
7. Move to the next card.
8. Retry a previous card later.

Practice responses are persisted separately from generated kit content, so reopening the kit does not lose practice history.

A retry starts a fresh attempt for the selected card. A later saved answer replaces the previous response for that card.

## Next-session ordering

The application uses a simple confidence-weighted strategy rather than implementing full spaced repetition.

The intent is straightforward:

```text
low confidence → practise earlier
medium confidence → practise after weak cards
high confidence → practise later
```

This was chosen because the assessment explicitly allows a simple confidence-weighted ordering and the simpler deterministic approach is easier to explain, test, and keep reliable within the project timebox.

---

# Weak Spots

The custom feature is a **Weak Spots** view.

It addresses a real preparation problem: users can have a large kit but still not know which areas deserve another pass.

The feature surfaces requirements that need additional preparation based on the current kit/practice state.

A requirement with no linked flashcard is explicitly shown as:

> No flashcard linked to this requirement

rather than incorrectly treating the requirement as automatically uncovered.

This distinction is important because the assessment's formal coverage rule is question-based: a must-have requirement is covered when at least one question references it.

The Weak Spots feature therefore complements, rather than replaces, the deterministic coverage system.

---

# Authentication and Security

Authentication is intentionally minimal, matching the assessment scope.

Implemented:

- Registration
- Login
- Logout
- Session validation
- Protected API routes
- User ownership checks
- Password hashing with bcrypt
- HTTP-only session cookie
- Secure cookie behaviour in production
- Expired/invalid session handling

Users can only access and modify kits belonging to their authenticated user ID.

Email verification, password reset, roles, and team sharing are intentionally not implemented because they are outside the assessment scope.

---

# External Input Security

The application processes:

- User-supplied job descriptions
- User-supplied company URLs
- Arbitrary content retrieved from company websites
- Public web research
- Model-generated data

These are treated as untrusted inputs.

The backend validates external URLs before retrieval and applies production restrictions around private/loopback targets.

Retrieved pages are treated as content, not instructions. Text appearing on a crawled page is data that may be summarised or analysed, not a command to the model or application.

Retrieval is also constrained to expected content and bounded responses to reduce the risk of unexpectedly large external payloads.

---

# Failure Handling

Generation is an external, slow, and failure-prone workflow, so failures are handled at stage boundaries.

### Invalid company URL

The URL is validated before retrieval. Invalid/unreachable sources are reported rather than silently treated as valid research.

### 404 / timeout

A failed source is skipped and recorded. Partial company research can still produce a valid kit.

### No hiring page

The crawler does not assume `/careers`, `/jobs`, or another fixed path.

If no hiring information is discoverable, the kit remains valid and honestly reports the available research.

### Thin job description

The system does not invent requirements simply to make the output look complete.

A two-line posting can therefore produce a smaller kit.

### No public interview discussion

Generation continues without company-specific interview claims that cannot be supported.

### Invalid/incomplete model output

Model responses are parsed and normalised before being accepted. The generated structure is then validated against the expected kit schema before persistence.

### Rate limiting / temporary model failure

The generation layer retries transient failures and uses a Gemini fallback model when the primary model cannot complete a request.

Current model strategy:

```text
gemini-3.7-flash
      │
      ├── retry transient failure
      │
      └── fallback
            ▼
      gemini-3.6-flash
```

This is particularly important for free-tier token/request limits.

### Duplicate generation

Generation is guarded so a kit cannot start another generation while a generation is already in progress. This prevents concurrent requests from overwriting each other.

### Partial generation

The UI exposes generation/loading/error states, while the backend keeps generated content separate from builder state. This allows a regeneration or failed run to be handled without treating user edits as disposable.

### 1-day / 60-day schedules

The scheduler uses the exact requested number of days rather than assuming a fixed preparation window.

---

# Batch Evaluator

The assessment requires a single command that runs the same pipeline used by the application.

## Command

```bash
npm run evaluate -- --input <cases.json> --output <kits.json>
```

Example:

```bash
npm run evaluate -- --input cases.json --output kits.json
```

### Input

The input file is an array:

```json
[
  {
    "id": "case-01",
    "jd": "Senior Backend Engineer...",
    "company_url": "https://example.com",
    "days": 5
  }
]
```

### Output

The output follows Appendix B:

```json
{
  "version": "1.0",
  "generated_at": "2026-09-01T09:12:44Z",
  "kits": [
    {
      "id": "case-01",
      "status": "ok",
      "kit": {},
      "error": null
    }
  ]
}
```

A case that cannot produce a kit at all is recorded as:

```json
{
  "id": "case-04",
  "status": "failed",
  "kit": null,
  "error": {
    "code": "COMPANY_UNREACHABLE",
    "message": "..."
  }
}
```

A partially researched case is still `ok` when a valid kit can be produced.

The evaluator uses the same generation path as the application rather than maintaining a second implementation.

It also continues processing after individual case failures.

---

# Local Setup

## Prerequisites

- Node.js 20+
- npm
- MongoDB, either:
  - local MongoDB
  - MongoDB Atlas
- Gemini API key

## 1. Clone

```bash
git clone https://github.com/Shaurya03/ai-interview-prep.git
cd ai-interview-prep
```

## 2. Install dependencies

```bash
npm install
```

Because this repository uses npm workspaces, installing from the repository root installs the workspace dependencies.

## 3. Configure environment variables

Create the API environment file from the example:

```bash
cp .env.example apps/api/.env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example apps/api/.env
```

Configure the values described below.

### API environment variables

```env
PORT=4000
WEB_ORIGIN=http://localhost:3000

MONGODB_URI=mongodb://127.0.0.1:27017/ai-interview-prep

SESSION_SECRET=replace-with-a-long-random-secret

GEMINI_API_KEY=your-gemini-api-key
```

Do not commit real credentials.

## 4. Start the API

```bash
npm run dev:api
```

The API runs on:

```text
http://localhost:4000
```

## 5. Start the frontend

In another terminal:

```bash
npm run dev
```

The frontend runs on:

```text
http://localhost:3000
```

The frontend uses the configured API base URL.

---

# Production Deployment

The application is designed to deploy the frontend and backend independently.

## Frontend

Deploy the `apps/web` Next.js application to a platform capable of running Next.js.

Configure the production API URL in the frontend environment.

## Backend

Deploy the `apps/api` Node.js/Express application to a Node-compatible hosting platform.

Configure:

```env
PORT
WEB_ORIGIN
MONGODB_URI
SESSION_SECRET
GEMINI_API_KEY
```

Use the deployed frontend origin for `WEB_ORIGIN`.

## MongoDB

A MongoDB Atlas free-tier cluster can be used for production persistence.

## Security requirements

Production secrets must be stored in the deployment platform's environment-variable system rather than committed to the repository.

The production session cookie uses secure settings, and CORS is restricted to the configured frontend origin.

### Deployment URLs

Fill these values after the final deployment:

```text
Frontend: <FRONTEND_DEPLOYMENT_URL>
Backend:  <BACKEND_DEPLOYMENT_URL>
```

---

# Testing and Verification

The project includes automated tests covering the behaviour most important to protect.

Current test coverage includes:

- Schedule allocation
- Kit structure validation
- Requirement/question coverage
- Question generation/normalisation
- Kit generation
- Role extraction
- Flashcard generation
- API kit routes
- Regeneration behaviour

Run the API test suite with:

```bash
npm test --workspace=api
```

Run backend type checking:

```bash
npx tsc -p apps/api/tsconfig.json --noEmit
```

Run frontend type checking:

```bash
npx tsc -p apps/web/tsconfig.json --noEmit
```

Run the production frontend build:

```bash
npm run build
```

Run the batch evaluator:

```bash
npm run evaluate -- --input cases.json --output kits.json
```

The root package intentionally exposes the mandatory evaluator command directly, while the API owns the automated test suite.

---

# Design Decisions and Trade-offs

## 1. Deterministic coverage instead of asking the LLM

Coverage is a relationship between IDs, so it should not depend on model judgement.

This makes it:

- Testable
- Reproducible
- Cheap
- Easy to debug

The model generates questions; application code decides whether those questions cover the requirements.

## 2. Deterministic scheduling

Scheduling is arithmetic and allocation.

The LLM provides useful content and difficulty signals, but the application decides where material goes across the requested number of days.

This prevents malformed schedules and guarantees the exact day count.

## 3. Multi-stage generation

A single giant prompt would be simpler to implement but harder to debug and less responsive to research results.

Separating stages means:

- Research can influence later generation
- Requirements can drive question categories
- Hiring-process information can influence company-specific questions
- Coverage can trigger targeted repair
- Individual sections can be regenerated

The trade-off is more model calls and therefore more latency/token usage.

## 4. Free-tier-aware model strategy

Free-tier LLM providers can rate-limit requests and tokens.

The application therefore uses retries and a fallback model rather than assuming every request succeeds immediately.

The trade-off is that generation can take longer under rate limiting, but the application degrades more gracefully.

## 5. Separate generated and builder state

Overwriting the generated kit on every edit would make regeneration dangerous.

Persisting edits separately allows the application to distinguish:

```text
AI-generated content
vs.
user-authored state
```

The trade-off is more persistence logic, but it prevents the most damaging UX failure in this assessment: losing user work.

## 6. Simple confidence-based practice ordering

Full spaced repetition would add significant product and state complexity.

A confidence-weighted strategy solves the core problem with much less complexity and remains deterministic.

## 7. No job-board scraping

The assessment explicitly provides the job description directly because automated access to job boards is unreliable.

The application therefore treats the pasted JD as the authoritative role input and uses the company URL for research.

---

# Known Limitations

- Public interview-process discussion can be incomplete, outdated, or unavailable.
- Company sites vary significantly in structure, JavaScript behaviour, and accessibility.
- Some sites may block automated retrieval or expose little useful text.
- LLM output quality can vary between runs.
- Free-tier model limits can increase generation latency.
- The company crawler intentionally favours bounded, relevant retrieval over attempting to mirror an entire website.
- Practice Mode uses confidence-weighted ordering rather than full spaced repetition.
- The application does not attempt to verify every public interview claim independently.
- The application does not include job search, CV parsing, job application, audio/video interview simulation, payments, or team/sharing functionality because those are outside the assessment scope.

---

# API Responsibilities

The Express API is responsible for:

### Authentication

```text
POST /auth/register
POST /auth/login
POST /auth/logout
GET  /auth/me
```

### Kits

The kit routes handle:

- Kit creation
- Kit retrieval
- Kit ownership
- Generation
- Builder updates
- Question ordering
- Question editing
- Flashcard editing
- Company brief editing
- Question/flashcard deletion
- Section regeneration
- Schedule updates
- Practice persistence

Protected routes enforce ownership using the authenticated user ID.

---

# Data Persistence

The application persists enough state for a user to leave and return later.

Persisted kit information includes:

- Original source information
- Generated company research
- Role and requirements
- Questions
- Flashcards
- Schedule
- Coverage result
- Builder edits
- Deletions
- Question order
- Practice responses
- Generation status

Practice responses are kept separate from generated kit data so that practice activity does not mutate the generated content itself.

---

# Scope

## Included

- Authentication
- Personalised interview kit generation
- Company research
- Hiring-process research
- Public interview research
- Requirement extraction
- Targeted question generation
- Flashcards
- Coverage checking
- Second-pass repair
- Deterministic scheduling
- Builder editing/reordering/add/delete
- Regeneration with edit preservation
- Practice Mode
- Weak Spots
- Persistence
- Batch evaluation
- Automated tests
- Deployment

## Intentionally excluded

- Job search / job aggregation
- CV parsing or rewriting
- Applying to jobs
- Audio/video interview simulation
- Payments
- Team/sharing features

These are outside the assessment scope.

---

# Assessment Alignment

The implementation is designed around the assessment's evaluation criteria.

| Assessment area | Implementation |
|---|---|
| Requirement extraction | Structured JD extraction with `must` / `nice` priority and stable requirement IDs |
| Coverage | Deterministic requirement-to-question mapping |
| Schedule | Deterministic exact-day allocation with integer minutes |
| Research | Company crawling, ranked internal links, hiring-process discovery, public interview research |
| Sequencing | Separate retrieval, extraction, generation, coverage, repair, scheduling and validation stages |
| Robustness | Retries, fallback model, structured errors, partial research handling, final validation |
| Builder | Editing, reordering, add/delete, category changes, section regeneration |
| Regeneration safety | Separate builder state for edits, deletions and ordering |
| Practice | Flashcard sessions, confidence tracking, persistence, retry |
| Creative feature | Weak Spots |
| Backend quality | Express service separation, validation, persistence, ownership checks |
| Frontend quality | Next.js/Tailwind, reusable UI, loading/error/empty states, responsive builder |
| Testing | Automated tests for schedule, coverage, structure and API behaviour |
| Batch | `npm run evaluate -- --input <cases.json> --output <kits.json>` |

---

## Walkthrough Video

The recommended walkthrough order mirrors the assessment:

1. Create a kit from a pasted JD and company URL.
2. Show research and generation progress.
3. Show the coverage result and second pass closing a gap.
4. Edit a question and reorder questions.
5. Regenerate a section and demonstrate that the manual edit remains.
6. Open the preparation schedule.
7. Enter Practice Mode, answer a flashcard, reveal the reference answer, and record confidence.
8. Show Weak Spots.
9. Briefly explain one major design decision, such as deterministic coverage/scheduling or the generated-vs-edited state model.

Clarity is more valuable than production polish. The reviewer should be able to see the engineering decisions without having to perform archaeology on the UI.

---

## License

This project was built as a full-stack engineering assessment submission.
