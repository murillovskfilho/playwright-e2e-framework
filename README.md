# playwright-e2e-framework

[![e2e](https://github.com/murillovskfilho/playwright-e2e-framework/actions/workflows/e2e.yml/badge.svg)](https://github.com/murillovskfilho/playwright-e2e-framework/actions/workflows/e2e.yml)
[![report](https://img.shields.io/badge/latest%20report-GitHub%20Pages-2ea44f)](https://murillovskfilho.github.io/playwright-e2e-framework/)

A Playwright + TypeScript end-to-end framework covering **UI, API, role-based access, multi-tenancy,
network failures and accessibility**, running against **ShipDesk**: a small multi-tenant
shipment portal that ships in this repo so the suite is fully self-contained and deterministic.

**82 test cases, 130 executions** across Chromium, Firefox and a browserless API project. In CI they run in 2 parallel
shards and merge into one HTML report, published to GitHub Pages on every run of `main`.

## What this demonstrates

| Practice | Where |
|---|---|
| Page Object Model with accessible locators (`getByRole`, `getByLabel`), no CSS/XPath in specs | `tests/pages/` |
| Typed fixtures: `persona` option, POMs and API clients injected per test | `tests/fixtures/index.ts` |
| **Login once per role via API**, reuse `storageState`; UI login covered separately | `tests/setup/auth.setup.ts` |
| **Arrange via API, assert via UI**: fast, precise test data | `tests/ui/shipments-list.spec.ts` |
| **RBAC as a data-driven matrix**, checked in the UI *and* enforced in the API | `tests/ui/rbac.spec.ts` |
| **Tenant isolation**: no leaks in search, direct links or API (404, not 403) | `tests/ui/tenant-isolation.spec.ts` |
| **Network control** with `page.route`: 500s, dropped connections, slow APIs, mocked payloads | `tests/ui/resilience.spec.ts` |
| A real **race condition** test: a stale, slow response must not overwrite a newer search | `tests/ui/resilience.spec.ts` |
| Security-minded checks: XSS escaping, open redirect, tampered tokens, user enumeration | `resilience`, `auth`, `auth.api` specs |
| **API contract tests** with strict JSON Schemas (ajv); boundary-value analysis | `tests/api/` |
| **Accessibility**: axe-core WCAG 2.1 AA scans, including error states | `tests/a11y/a11y.spec.ts` |
| Field errors asserted through the **accessibility tree** (`toHaveAccessibleDescription`) | `tests/ui/create-shipment.spec.ts` |
| Parallel-safe data: unique references per test, no DB resets, no ordering dependencies | `tests/data/factories.ts` |
| CI: sharding, retries with traces, merged report deployed to Pages, nightly schedule | `.github/workflows/e2e.yml` |

## Quick start

Requirements: Node.js 22+.

```bash
npm ci
npx playwright install chromium firefox
npm test                 # starts the app automatically and runs everything
npm run report           # opens the HTML report
```

Useful variants:

```bash
npm run test:api                                   # API project only (no browser)
npx playwright test --project=chromium --ui        # Playwright UI mode
npx playwright test tests/ui/rbac.spec.ts --headed # watch one spec run
npm run app                                        # just the app, at http://localhost:3000
```

Demo accounts (all use the password in `app/src/seed.ts`): `admin@acme.test`, `operator@acme.test`,
`viewer@acme.test`, `operator@globex.test`, and `locked@acme.test`.

## The application under test

ShipDesk is intentionally small but realistic: an Express API with HMAC-signed session tokens
(cookie or bearer), three roles, two tenants, server-side validation, and a vanilla-JS UI.

| Capability | admin | operator | viewer |
|---|:-:|:-:|:-:|
| List and view shipments of own tenant | ✅ | ✅ | ✅ |
| Create shipments | ✅ | ✅ | ❌ |
| Cancel shipments (only while `LABEL_CREATED`) | ✅ | ❌ | ❌ |

## Test suites

| Spec | Focus |
|---|---|
| `ui/auth` | Login, return-to-page after login, open-redirect guard, invalid/locked accounts, logout |
| `ui/shipments-list` | Search, status filter, deep links, empty state, pagination, navigation to detail |
| `ui/create-shipment` | Happy path checked in UI and API, 8 validation cases, duplicates, error recovery |
| `ui/cancel-shipment` | Native confirm dialog (accept/dismiss), state rules, concurrent-edit conflict (409) |
| `ui/rbac` | Role × capability matrix, UI and API |
| `ui/tenant-isolation` | Cross-tenant search, direct links and API access |
| `ui/resilience` | Server errors + retry, offline, loading state, stale-response race, mocked data, XSS |
| `a11y/a11y` | axe WCAG 2.1 AA on every page, including error states |
| `api/auth.api` | Token issuance, bearer auth, tampered/forged tokens, failure codes, no user enumeration |
| `api/shipments.api` | JSON Schema contracts, 422 field errors, boundary values, paging, sorting, 409/404 |

## Project layout

```
app/                     ShipDesk, the application under test (Express + static UI)
tests/
  setup/                 one-time API login per persona -> storageState
  fixtures/              test.extend: persona option, POMs, typed API client
  pages/                 page objects
  data/                  personas and test-data factories
  ui/  a11y/  api/       the specs
playwright.config.ts     projects: setup, chromium, firefox, api; webServer starts the app
```

## Design decisions

* **The app lives in the repo.** Public demo sites change, rate-limit and go down; a nightly run
  should only fail when *this* code breaks. The same framework points at any environment with
  `BASE_URL`.
* **Personas over logins.** `test.use({ persona: 'viewer' })` is the whole cost of running a test as
  another role. Sessions come from the setup project, so UI login runs only where it is the subject.
* **Every test owns its data.** References are unique per test, so every test runs in parallel on a
  shared server, in any order, with no cleanup.
* **No sleeps.** Waiting relies on web-first assertions and `expect.poll`. Timing-sensitive cases
  (loading states, races) are made deterministic by holding requests with `page.route`.
* **Hidden is not forbidden.** Every permission hidden in the UI is also tested at the API.
* **Found while writing the suite:** the list page wrote empty filters to the URL
  (`/?q=&status=&page=1`), which broke clean deep links. The auth spec caught it, and the app now
  writes only the filters that are set.

## License

MIT
