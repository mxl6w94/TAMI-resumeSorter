# TAMI v2 — Testing Rules & TDD Mandate

## Philosophy: Plan → Test → Code
Every feature and bug fix follows this strict loop:
1. **Plan**: Write a short Markdown plan describing the change before touching code.
2. **Test**: Write a failing test in `tests/` that captures the expected behavior.
3. **Code**: Implement only enough to make the test pass — no more.
4. **Refactor**: Clean up with tests still green.

**A pull request with no corresponding test will not be merged.**

---

## Testing Stack
| Layer | Tool | Location |
|---|---|---|
| Unit | Vitest | `tests/unit/` |
| Integration | Vitest + Supabase local | `tests/integration/` |
| End-to-End | Playwright | `tests/e2e/` |

---

## Unit Tests (Vitest)
- Test every pure function, utility, and agent logic in isolation.
- Mock all external dependencies (Supabase, OpenAI, Gemini) with `vi.mock`.
- Name files: `<module>.test.ts`.
- Coverage target: **≥ 80%** lines/branches for `src/agents/` and `src/lib/`.

```ts
// Example: tests/unit/agents/orchestrator.test.ts
import { describe, it, expect } from 'vitest'
import { validateCriteriaWeights } from '@/agents/orchestrator'

describe('validateCriteriaWeights', () => {
  it('returns true when weights sum to 100', () => {
    expect(validateCriteriaWeights([40, 35, 25])).toBe(true)
  })
  it('returns false when weights do not sum to 100', () => {
    expect(validateCriteriaWeights([40, 35])).toBe(false)
  })
})
```

---

## Integration Tests (Vitest + Supabase Local)
- Spin up Supabase locally via `supabase start` before running.
- Test database queries, RLS policies, and storage operations end-to-end against the local instance.
- Seed data lives in `tests/fixtures/`.
- Name files: `<module>.integration.test.ts`.

```ts
// Example: tests/integration/resumes.integration.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestClient } from '../fixtures/supabaseTestClient'

describe('Resumes deduplication', () => {
  it('rejects a duplicate file hash', async () => {
    // ...
  })
})
```

---

## End-to-End Tests (Playwright)
- Cover critical user journeys only — do not duplicate unit/integration coverage.
- Tests run against a locally started Next.js dev server (`npm run dev`).
- Use Page Object Model pattern; pages live in `tests/e2e/pages/`.

### Mandatory E2E Journeys
1. Recruiter sign-up → sign-in
2. Create a folder
3. Upload a resume (valid PDF ≤ 5 MB)
4. Reject upload (file > 5 MB or > 50 pages)
5. Add criteria units; validate weight sum = 100%
6. Trigger analysis; verify score card and exact quote are displayed

```ts
// Example: tests/e2e/upload-resume.spec.ts
import { test, expect } from '@playwright/test'
import { FolderPage } from './pages/FolderPage'

test('rejects a PDF larger than 5 MB', async ({ page }) => {
  const folder = new FolderPage(page)
  await folder.goto('folder-id')
  await folder.uploadFile('tests/fixtures/oversized.pdf')
  await expect(page.getByRole('alert')).toContainText('exceeds the 5 MB limit')
})
```

---

## Running Tests

```bash
# Unit + Integration
npx vitest run

# Watch mode
npx vitest

# Coverage report
npx vitest run --coverage

# E2E (requires running dev server)
npx playwright test

# E2E with UI
npx playwright test --ui
```

---

## CI Requirements
- All Vitest tests must pass before merge.
- All Playwright E2E journeys must pass before merge.
- Coverage report is generated as a CI artifact.
- Tests run on every push and pull request (see `.github/workflows/ci.yml`).

---

## Test Fixtures
- Store reusable seed data in `tests/fixtures/`.
- Keep fixture PDFs small (use real minimal PDFs, not lorem ipsum blobs).
- Never commit real candidate PII — use synthetic data only.
