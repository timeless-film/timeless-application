# Testing Setup Summary — TIMELESS

**Date**: 2026-03-09

---

## 1. Current Test Files

### Unit Tests (Vitest + Testing Library)

**Location**: `src/lib/services/__tests__/`

| Service | Test File | Status | Coverage |
|---------|-----------|--------|----------|
| **catalog-service** | `catalog-service.test.ts` | ✅ Exists | `checkFilmAvailability()` |
| **cinema-service** | `cinema-service.test.ts` | ✅ Exists | CRUD operations (list, get, verify, create, update, archive) |
| **exchange-rate-service** | `exchange-rate-service.test.ts` | ✅ Exists | API fetch, caching, currency conversion, fallback |
| **film-import-service** | `film-import-service.test.ts` | ✅ Exists | Validation, duplicate detection |
| **film-service** | `film-service.test.ts` | ✅ Exists | CRUD operations (list, get, verify, create, update, archive) |
| **rights-holder-service** | `rights-holder-service.test.ts` | ✅ Exists | `isStripeConnectComplete()` pure function |
| **room-service** | `room-service.test.ts` | ✅ Exists | CRUD operations (list, get, create, update, archive) |

✅ **All service files have unit tests.**

### E2E Tests (Playwright)

**Location**: `e2e/`

| Test File | Purpose | Setup |
|-----------|---------|-------|
| `auth.spec.ts` | Login, register, forgot password pages | No auth required |
| `account.spec.ts` | Account profile, information, member management | Exhibitor auth required |
| `cinemas.spec.ts` | Cinema/room CRUD, archive workflows | Exhibitor auth required |
| `catalog.spec.ts` | Catalog browsing, filtering, search | Exhibitor auth required |
| `films-crud.spec.ts` | Film creation, update, archive (API) | Rights holder token |
| `films-import.spec.ts` | TMDB import workflow | Rights holder token |
| `films-pricing.spec.ts` | Multi-zone pricing workflows | Rights holder token |
| `api-tokens.spec.ts` | API token generation/revocation | Exhibitor auth required |
| `api-v1.spec.ts` | REST v1 endpoints (general coverage) | Bearer token auth |
| `onboarding-guard.spec.ts` | Onboarding flow protection & redirects | Session-based flow |
| `user-flows.spec.ts` | End-to-end user journeys (register → onboard → catalog) | Multi-step flows |

**Helpers**: `e2e/helpers/`
- `rights-holder.ts` — Setup context for rights holder E2E tests (create user, account, API token)

---

## 2. Existing Test Patterns & Conventions

### Unit Testing Patterns

#### Structure
```typescript
// 1. Mock DB and drizzle-orm BEFORE imports
vi.mock("@/lib/db", () => ({ ... }));
vi.mock("drizzle-orm", () => ({ ... }));

// 2. Import service functions AFTER mocks
import { functionName } from "../service.ts";

// 3. Use describe/it blocks with clear names
describe("service-name", () => {
  describe("functionName", () => {
    it("returns X when input is Y", async () => { ... });
  });
});
```

#### Key Patterns

**DB Mocking**:
- Mock `db.query.table.findMany()`, `findFirst()`
- Mock `db.insert()`, `db.update()`, `db.delete()`
- Mock drizzle operators: `eq`, `and`, `isNull`, `ilike`, etc.

**Setup/Cleanup**:
```typescript
beforeEach(() => {
  vi.clearAllMocks();
});
```

**Assertions**:
```typescript
expect(result).toEqual(expectedValue);
expect(mockFn).toHaveBeenCalledWith(...args);
expect(mockFn).toHaveBeenCalledTimes(1);
```

#### Example Patterns

**Pure function testing** (no DB):
```typescript
// rights-holder-service.test.ts
it("returns true when both conditions are met", () => {
  expect(isStripeConnectComplete({ details_submitted: true, charges_enabled: true })).toBe(true);
});
```

**Service function with mocked DB**:
```typescript
// cinema-service.test.ts
it("returns cinema with rooms when found", async () => {
  mockFindFirst.mockResolvedValue(cinema);
  const result = await getCinemaById("c1", "account-1");
  expect(result).toEqual({ cinema });
});
```

**Error handling**:
```typescript
it("returns NOT_FOUND when cinema does not exist", async () => {
  mockFindFirst.mockResolvedValue(null);
  const result = await getCinemaById("c1", "account-1");
  expect(result).toEqual({ error: "NOT_FOUND" });
});
```

### E2E Testing Patterns

#### Vitest Configuration

**File**: `vitest.config.ts`
- **Environment**: `jsdom` (React components)
- **Globals**: `true` (no `describe`/`it` imports needed)
- **Setup**: `vitest.setup.ts` (imports `@testing-library/jest-dom/vitest`)
- **Coverage**: includes `src/lib/**/*.ts` and `src/components/**/*.{ts,tsx}`, excludes DB schema

#### Playwright Configuration

**File**: `playwright.config.ts`
- **Port**: `3099` (intentionally different from dev server port 3000)
- **Retries**: 2 on CI, 1 locally
- **Timeout**: 30s locally, 120s on CI
- **Workers**: 1 (sequential, not parallel)
- **Trace**: on first retry
- **Screenshots**: only on failure
- **Web server**: `pnpm dev --port 3099` (auto-started, reused if available)

#### E2E Pattern: Registration & Login

```typescript
// Unique email per test run
function uniqueEmail(prefix: string) {
  const suffix = Math.random().toString(36).substring(2, 7);
  return `${prefix}-${TEST_ID}-${suffix}@e2e-test.local`;
}

// Register via API
const signupRes = await request.post("/api/auth/sign-up/email", {
  data: { name, email, password },
});
expect(signupRes.ok()).toBeTruthy();

// Verify email directly in DB (postgres npm package)
const sql = postgres(DB_URL, { max: 1 });
await sql`UPDATE better_auth_users SET email_verified = true WHERE email = ${email}`;
await sql.end();

// Log in via UI
await page.goto("/en/login");
await page.fill("input[type='email']", email);
await page.fill("input[type='password']", password);
await page.getByRole("button", { name: /sign in/i }).click();
await page.waitForURL(/(?!.*\/login)/, { timeout: 15000 });
```

#### E2E Pattern: Onboarding Flow

```typescript
async function completeOnboarding(page: Page, companyName: string) {
  // Step 1: Company info
  await expect(page).toHaveURL(/\/en\/no-account/);
  await page.getByRole("link", { name: /create an account/i }).click();
  await expect(page).toHaveURL(/\/en\/onboarding/);
  
  // Step 2: Add cinema
  await page.locator("#companyName").click();
  await page.locator("#companyName").pressSequentially(companyName, { delay: 30 });
  await page.getByRole("button", { name: /continue/i }).click();
  
  // Step 3: Skip invitations
  await page.getByRole("button", { name: /skip this step/i }).click();
  await expect(page).toHaveURL(/\/en\/catalog/, { timeout: 30000 });
}
```

#### E2E Pattern: API Testing (Bearer Token)

```typescript
// Create rights holder context
const context = await createRightsHolderContext(request, TEST_ID, "prefix");
const bearerToken = context.bearerToken;

// Call API with Bearer token
const createRes = await request.post("/api/v1/films", {
  headers: {
    Authorization: `Bearer ${bearerToken}`,
    "Content-Type": "application/json",
  },
  data: { title, externalId, type, status, prices: [...] },
});

expect(createRes.status()).toBe(201);
const body = await createRes.json();
expect(body.data.id).toBeDefined();
```

#### E2E Pattern: Database Operations

```typescript
// Use postgres npm package for E2E DB setup
const sql = postgres(DB_URL, { max: 1 });

// Query
const users = await sql`SELECT id FROM better_auth_users WHERE email = ${email}`;
const userId = users[0]?.id;

// Insert
const accounts = await sql`
  INSERT INTO accounts (type, company_name, country, onboarding_completed)
  VALUES ('rights_holder', ${name}, 'FR', true)
  RETURNING id
`;

await sql.end();
```

---

## 3. Services Overview

### Existing Services (All with Tests ✅)

#### Core Business Logic
- **`catalog-service.ts`** — Catalog queries, availability checks, filtering
- **`cinema-service.ts`** — Cinema CRUD, ownership verification, archival
- **`film-service.ts`** — Film CRUD, ownership verification, archival
- **`room-service.ts`** — Room CRUD, cinema association, archival
- **`film-import-service.ts`** — TMDB import validation, duplicate detection
- **`exchange-rate-service.ts`** — Currency conversion, Frankfurter API, caching

#### Specialized
- **`rights-holder-service.ts`** — Pure logic for Stripe Connect status (single function)

### Coverage Analysis

| Service | Unit Test | E2E Test | Comments |
|---------|-----------|----------|----------|
| catalog-service | ✅ Limited | ✅ catalog.spec.ts | Could expand unit tests (search, filters, pagination) |
| cinema-service | ✅ Good | ✅ cinemas.spec.ts | Creates, reads, updates, archives cinemas |
| exchange-rate-service | ✅ Good | ❌ None | Pure service, no E2E needed |
| film-import-service | ✅ Exists | ✅ films-import.spec.ts | Validates TMDB imports |
| film-service | ✅ Good | ✅ films-crud.spec.ts | Creates, reads, updates, archives films |
| rights-holder-service | ✅ Good | ✅ films-pricing.spec.ts (indirect) | Single pure function tested thoroughly |
| room-service | ✅ Exists | ✅ cinemas.spec.ts (indirect) | Basic CRUD tested |

---

## 4. Coverage Gaps to Fill

### Unit Testing Gaps

#### High Priority
1. **catalog-service** — Missing tests for:
   - `searchFilms()` with various filters (search term, genres, directors, cast, countries)
   - `getSearchFilterOptions()`
   - Pagination logic (page, limit boundaries)
   - Territory availability logic (intersection with cinema countries)
   - Price selection logic (missing price vs direct vs validation)

2. **film-import-service** — Check coverage of:
   - `validateImportPayload()` — edge cases (invalid countries, oversize, negative prices)
   - `detectDuplicates()` — fuzzy matching, case sensitivity, punctuation

### E2E Testing Gaps

#### Critical Flows Missing

1. **Payment & Checkout**
   - E2E: Complete cart checkout with Stripe payment
   - Validate: Order creation, payment confirmation, invoice generation

2. **Film Delivery (DCP/KDM)**
   - E2E: Upload delivery details, download/preview files
   - Validate: File access controls, expiry dates

3. **Rights Holder Wallet**
   - E2E: View balance, payout history, request payout
   - Validate: Commission calculations, Stripe Connect payouts

4. **Admin Dashboard**
   - E2E: View reports, manage disputes, override permissions
   - Validate: Admin guards, role-based access

5. **Notifications & Emails**
   - E2E: Verify email sent on order confirmation (use Resend webhook mock)
   - Validate: Email content, template rendering

6. **Multi-language (i18n)**
   - E2E: Switch between EN/FR, verify translations
   - Validate: Locale-prefixed URLs, message keys

### Database-Dependent Tests (No Unit Tests Today)

These are typically tested via E2E. Consider integration test suite:

1. **Server actions** (mutations):
   - `createCinemaAction()`
   - `updateFilmPricingAction()`
   - `createOrderAction()`
   - Each action → validate DB state afterward

2. **API routes** (already covered by E2E `api-v1.spec.ts`):
   - Endpoint coverage is good, but edge case validation could expand

---

## 5. Test Infrastructure

### Configuration Files

| File | Purpose | Key Setting |
|------|---------|-------------|
| `vitest.config.ts` | Unit test setup | jsdom environment, coverage thresholds |
| `vitest.setup.ts` | Unit test globals | Testing Library assertions |
| `playwright.config.ts` | E2E test framework | Port 3099, 1 worker, 30s/120s timeout |
| `e2e/global-setup.ts` | E2E warmup (CI only) | Pre-fetch Next.js pages before tests |

### Commands

```bash
pnpm test              # Run unit tests (Vitest)
pnpm test:watch       # Watch mode
pnpm test:coverage    # Generate coverage report
pnpm test:e2e         # Run E2E tests (Playwright)
pnpm test:e2e:ui      # E2E tests with Playwright UI
```

### CI Pipeline (GitHub Actions)

- **Quality job**: typecheck → lint → unit tests (no DB)
- **E2E job**: PostgreSQL service → schema push → Playwright

---

## 6. Test Data & Fixtures

### Patterns Used

**Vitest Unit Tests**:
- Inline mock data in test (simple values, arrays)
- No shared fixtures file (keep tests isolated)

**Playwright E2E Tests**:
- Dynamic user creation per test (`uniqueEmail()`)
- `postgres` npm package for DB setup/cleanup
- Helper functions in `e2e/helpers/` (e.g., `createRightsHolderContext()`)

### Example Fixtures

```typescript
// Unit test fixture
const filmFixture = {
  id: "film-1",
  accountId: "account-1",
  title: "Cléo de 5 à 7",
  status: "active",
  type: "direct",
  prices: [{ id: "p1", countries: ["FR", "BE"], price: 15000, currency: "EUR" }],
};

// E2E test fixture
const user = { 
  name: "Test User", 
  email: uniqueEmail("test"), 
  password: "StrongPass123!" 
};
```

---

## 7. Recommended Improvements

### Short Term (Quick Wins)

1. **Expand catalog-service unit tests** — Add search, filter, pagination tests
2. **Add integration tests** — Test server actions with mocked DB in isolation
3. **Add E2E test for checkout flow** — Register → add cinema → search → checkout
4. **Mock Resend in E2E** — Verify emails are "sent" without real API calls

### Medium Term

1. **Test database fixtures** — Use `factories` pattern for generating test data
2. **Visual regression tests** — Playwright's screenshot comparison for UI changes
3. **API contract tests** — Validate schema correctness independently
4. **Rights holder onboarding E2E** — Cover Stripe Connect flow

### Long Term

1. **Performance benchmarks** — Load testing for catalog search, checkout
2. **Accessibility testing** — axe-core integration in E2E tests
3. **Mobile E2E** — Test on mobile browsers (if needed)
4. **Chaos testing** — Simulate payment failures, network errors

---

## Summary

| Area | Status | Notes |
|------|--------|-------|
| **Unit Tests** | ✅ 7/7 services | All core services covered; gaps in edge cases |
| **E2E Tests** | ✅ 11 test files | Auth, CRUD, API; missing payment/delivery/wallet/admin |
| **Configuration** | ✅ Complete | Vitest + Playwright well-tuned; port 3099 isolation good |
| **Patterns** | ✅ Consistent | DB mocking, service testing, API testing all follow patterns |
| **Test Data** | ⚠️ Basic | Inline fixtures; consider factories for larger test suite |
| **CI Pipeline** | ✅ Working | Quality + E2E jobs, artifacts captured |

