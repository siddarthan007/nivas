# Nivas PMS — System Audit (2026-06-13)

This document summarizes the cross-module audit and fixes applied. Use it as a living backlog for remaining work.

## Platform pass (2026-06-13) — Sessions 1–2

### Backend — ERP, notifications, gating


| Area                      | Change                                                                               |
| ------------------------- | ------------------------------------------------------------------------------------ |
| Tenant feature middleware | `enableHotel` / `enableFoodAndBeverage` / `enableBanquets` API gating                |
| Corporate credit          | `checkCreditLimit()` warn on booking create; hard block on checkout when balance due |
| Bookings events           | VIP → HK task on check-in; `BookingCheckedIn` / `BookingCheckedOut` events           |
| Folio                     | `guestContext` (VIP, allergies, preferences, notes) on folio payload                 |
| Guest CRM                 | `GET /crm/guests/:id/timeline`                                                       |
| Loyalty                   | Repeat-guest POS discount in `loyalty.service`                                       |
| Cron jobs                 | No-show hourly; outstanding balance daily 10 AM; check-in reminder daily 6 PM        |
| Notifications             | `applyMessageTemplate()` for DB templates; check-in reminder sender                  |
| Jobs                      | 48h post-stay review handler                                                         |
| Client meta               | `extractClientMeta()` — IP + `x-client-type` (mobile/web) on IAM login               |
| Auth rate limit           | `authRateLimitMiddleware` on `/iam/login`                                            |
| Backup admin              | `DELETE /saas-admin/backups/:filename`, `GET .../url` refresh presigned URL          |


### Web — SaaS admin & settings


| Area                             | Change                                                         |
| -------------------------------- | -------------------------------------------------------------- |
| `useSettings` hook               | Restored — Settings page runtime fix                           |
| `SaaSBillingPage`                | Restored — `/hotel/billing` route                              |
| `BillingConfigSection`           | Super-admin billing config via `GET/PATCH /saas-admin/billing` |
| `PackageEditModal` + `PlansPage` | Edit plan pricing, modules, features, roles                    |
| `LicensesPage`                   | Activate expired license (offline / complimentary)             |
| `TenantsPage`                    | Activate expired license from tenant card                      |
| `BackupSection`                  | Delete backup + refresh download URL                           |
| `FolioPanel`                     | VIP / allergies banner                                         |
| `MarketingSection`               | `OUTSTANDING` audience segment                                 |
| `MessagingProvidersSection`      | Guest message templates (booking, check-in reminder, receipt)  |
| `AuthContext`                    | End-impersonation applies token from response                  |
| Settings                         | `enableBanquets` toggle + `ModuleGuard` blocks `/hotel/events` |


### Mobile


| Area             | Change                                                 |
| ---------------- | ------------------------------------------------------ |
| API client       | `x-client-type: mobile` on all requests (`shared-api`) |
| Dashboard colors | `DASHBOARD_COLORS` tokens (mirror `global.css`)        |
| Scan QR          | Home quick-action for POS-capable personas             |
| `useDeviceType`  | Import restored on home dashboard                      |


### Still open after Sessions 1–2

- Finance regression testing beyond unit tests (full checkout integration)
- TypeScript: pre-existing `tsc` errors outside this pass

### Session 3 (2026-06-13)


| Area                   | Change                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------- |
| Backup                 | Backup-only — no in-app restore API; manual `pg_restore` documented in `BackupSection`               |
| Tenant detail          | `TenantDetailPage` at `/admin/tenants/:id` — license, usage, payments, activate, impersonate         |
| Check-in reminder      | Per-booking `SEND_CHECKIN_REMINDER` job enqueued on create (day-before 18:00); cron remains fallback |
| Corporate credit tests | `corporate-credit.util.test.ts` — limit boundary cases (`bun test` in backend)                       |
| Mobile tablet          | `ScreenBody` wrapper on orders, housekeeping, kitchen, analytics, procurement, manager bookings      |


---

## Fixes applied in this pass

### Critical (data / auth)


| Fix                                                            | File                                        |
| -------------------------------------------------------------- | ------------------------------------------- |
| Guest portal API token (`normalizedEndpoint` before use)       | `apps/web/src/lib/api.ts`                   |
| Tables list permission → `restaurant:view_tables`              | `services/backend/.../tables.controller.ts` |
| Super-admin night audit route permission guard                 | `super-admin.controller.ts`                 |
| Folio customer order query (`and` + `or`, not hotel-wide `or`) | `folio.service.ts`                          |
| Guest profile folio fallback via phone when no `guests` row    | `folio.service.ts`                          |
| Folio F&B totals use `subTotal` (align with billing)           | `folio.service.ts`                          |


### Finance UI


| Fix                                                       | File                                        |
| --------------------------------------------------------- | ------------------------------------------- |
| Ledger list: avoid double-counting live + invoice rows    | `CustomerLedgerPage.tsx`                    |
| Stable ledger keys (`guestId` / `bookingId`, not name)    | `CustomerLedgerPage.tsx`                    |
| Night audit status checks yesterday (audit business date) | `night-audit.controller.ts`                 |
| Skip duplicate room charges on re-run                     | `night-audit.service.ts`                    |
| Corporate GET uses `crm:view_guests`                      | `corporate.controller.ts`                   |
| PUT `/orders/:id/items` for POS sync                      | `orders.controller.ts`                      |
| Order-only payments in folio queries                      | `folio.service.ts`                          |
| Invoice/checkout line-item dedupe (folio order charges)   | `invoice.service.ts`, `checkout.service.ts` |
| Credit notes in customer ledger detail                    | `CustomerLedgerDetailPage.tsx`              |
| Check-in mutation uses PATCH                              | `useBookingsQuery.ts`                       |


### Finance UI (continued)


| Fix                                                 | File                                                       |
| --------------------------------------------------- | ---------------------------------------------------------- |
| Date range on Invoices, Payments, Credit Notes tabs | `InvoicesTab.tsx`, `PaymentsTab.tsx`, `CreditNotesTab.tsx` |
| Customer ledger In-house / Historical tabs          | `CustomerLedgerPage.tsx`                                   |
| Finance sidebar stacks on narrow screens            | `FinancePage.tsx`                                          |


### UX


| Fix                                                     | File                                       |
| ------------------------------------------------------- | ------------------------------------------ |
| Events → guest link (`/hotel/guests/:id`)               | `EventsPage.tsx`                           |
| Procurement nav entry in sidebar                        | `Sidebar.tsx`                              |
| POS full-bleed (no sidebar shell)                       | `App.tsx`                                  |
| Settings responsive 2-col → 1-col                       | `SettingsPage.tsx`                         |
| Events status filter + generate invoice CTA             | `EventsPage.tsx`, `banquets.controller.ts` |
| Finance net payments stats + list hints                 | `FinancePage.tsx`, `finance.ts`            |
| Ledger detail fixed query limit (200)                   | `CustomerLedgerDetailPage.tsx`             |
| Event invoices (`bookingId` nullable)                   | `schema.ts`, `invoice.service.ts`          |
| Sidebar plan module ID mapping (pos→orders, guests→crm) | `Sidebar.tsx`                              |
| License 403 payload parsing + remove dismiss bypass     | `api.ts`, `LicenseGuard.tsx`               |
| Invoice PDF: guest email, room, stay dates, tax rates   | `pdf.service.ts`, `invoice.service.ts`     |
| KOT print: hotel name header                            | `kot-print.service.ts`                     |
| Mobile home: `useDeviceType` import + persona label     | `apps/mobile/app/(app)/index.tsx`          |


---

## Extended audit (2026-06-13) — sections 1–8

### 1) License, plan, package & RBAC enforcement

**What works**

- Backend: global `licenseMiddleware` + `hasPermission` on most mutating routes; AI/CBMS/guest-portal gated by `tenant_features`.
- Web: `ProtectedRoute` (permission), `ModuleGuard` (plan module + hotel/F&B toggle), `LicenseGuard`, sidebar filtering.
- Mobile: persona tabs + `PersonaGate` on module screens; API still enforces license + permissions.

**Gaps (priority)**


| Gap                                                            | Risk | Recommendation                                                       |
| -------------------------------------------------------------- | ---- | -------------------------------------------------------------------- |
| `maxRooms` / `maxUsers` not enforced on create                 | High | **Fixed** — `plan-limits.service` + create guards                    |
| Plan `modules[]` not enforced on backend                       | High | **Fixed** — `plan-module.middleware`                                 |
| Tenants can self-enable paid features via `/settings/features` | High | **Partial** — plan feature + module validation on toggle             |
| `hasModule` fail-open when `modules[]` empty                   | Med  | Treat empty as “legacy unlimited” only for TRIAL; else fetch package |
| `isRoleAllowed` never used                                     | Med  | Wire into Staff → invite / role assignment                           |
| Sidebar ID ≠ plan module ID                                    | Med  | **Fixed** — `NAV_TO_PLAN_MODULE` map                                 |
| License dismiss bypass                                         | Med  | **Fixed** — removed dismiss on block screen                          |
| License event payload                                          | Med  | **Fixed** — read top-level `licenseStatus`                           |
| Mobile: no plan/module UI guards                               | Med  | **Partial** — `LicenseBanner`; API 403 on block                      |
| Duplicate permission constants (web/backend/shared)            | Low  | Import from `@nivas/shared-utils`                                    |


**Fixed this pass:** sidebar module mapping, license parsing, license dismiss removed.

---

### 2) Redis & MinIO

**Redis (ioredis)** — auth cache (30s), settings (60s), hotel usage (10m), rate limits, AI caps, WS fan-out, cron locks. Fail-open when down.

**MinIO** — public uploads (Sharp→WebP), private DB backups. No Bull queue (Postgres jobs + cron).

**Issues**


| Issue                                          | Action                                       |
| ---------------------------------------------- | -------------------------------------------- |
| `cbms:nudge` Redis list never consumed         | **Fixed** — removed LPUSH; cron worker only  |
| `authRateLimitMiddleware` unused               | **Fixed** — wired on `/iam/login`            |
| Multi-replica: `broadcastToRole` local-only    | Route through Redis fan-out                  |
| Orphan MinIO objects on logo/image replace     | **Fixed** — `deleteByUrl` on branding update |
| Dev compose `network_mode: host` vs Docker DNS | Fix env or networking                        |
| Prod `apps/web/Dockerfile` missing             | Add nginx + `/storage` proxy                 |
| SVG allowed in UI but rejected by backend      | Align allowlist                              |
| `uploads_data` volume legacy                   | Remove if unused                             |


**Optimizations:** cache menu/room types; cache `getDatabaseStats`; invalidate `hotel:usage` on upload; distributed lock on job/outbox processors.

---

### 3) Attendance, payroll, KDS, reports, reviews, booking engine, externals


| Module             | Backend     | Web                   | Mobile             | Coverage                    |
| ------------------ | ----------- | --------------------- | ------------------ | --------------------------- |
| Attendance / clock | ✓           | Staff tab             | ✓ clock + approval | Web + mobile                |
| Payroll            | ✓           | Staff tab             | —                  | Web + from-attendance       |
| Kitchen / KOT      | ✓           | `/hotel/kitchen`      | `kitchen/` tab     | Strong; `kds/` removed      |
| Reports            | ops routes  | Operations tab wired  | Analytics only     | Orphans removed; 3 ops live |
| Reviews            | ✓           | Staff + publish reply | —                  | Draft + publish wired       |
| Booking engine     | `/engine/`* | API keys + preview    | —                  | External by design          |
| Fonepay dynamic QR | ✓           | POS wired             | Static label only  | Web POS uses QR + poll      |
| SMS/Email/CBMS/AI  | ✓           | Settings sections     | Partial            | WhatsApp provider UI added  |


**Top actions (remaining):** optional mobile Fonepay QR; expand mobile reports if needed.

---

### 4) KOT & invoicing — party details

**KOT (thermal)** — table + room on every ticket (**already present**). **Added:** hotel name header. Guest + waiter when available. No PDF KOT.

**Invoice PDF — seller (hotel):** name, address, phone, email, PAN, VAT, header note, footer.

**Invoice PDF — buyer (guest):** name, PAN, phone. **Added:** email, room, check-in/out. **Added:** correct SC/VAT % from hotel settings.

**Still missing:** ~~logo on PDF~~ **Fixed** — hotel logo embedded when `logoUrl` is set; ~~`invoiceTerms`~~ **Fixed** — terms block on PDF. Public invoice API exists at `GET /public/invoice/:id` (used by `/invoice?id=` page).

---

### 5) Simplicity principles (recommended)

1. **One front door per job** — Finance hub (not scattered tabs); Staff = people + attendance + payroll; Orders = POS + KDS + menu.
2. **Hide until needed** — GL, night audit, CBMS, booking engine keys under Settings → Advanced.
3. **Defaults over config** — Pre-fill tax rates, KOT printers, roles; reduce empty states with guided first-run.
4. **Mobile = floor ops only** — No duplicate full PMS; persona tabs already right direction.
5. **Reports:** one Reports page with categories (Operations / Sales / Staff) — wire orphans or delete.
6. **Progressive disclosure** — Manager sees ops; Owner sees finance; don’t show both widgets to everyone.

---

### 6) AI features

**Working:** Staff “Ask your hotel” (`AiChatLauncher` + `/ai/ask`), review draft-reply, guest concierge **backend** (`/guest/actions/concierge`), plan + daily cap in `ai.service`.

**Gaps**


| Gap                             | Fix                                   |
| ------------------------------- | ------------------------------------- |
| Guest portal has no AI chat UI  | **Fixed** — concierge on guest portal |
| `AskHotelWidget` orphaned       | **Fixed** — on dashboard              |
| `dailyLimit` not in Settings UI | **Fixed** — `AiSection` + usage       |
| Review draft bypasses usage cap | **Fixed** — `guardUsage` in generate  |
| No mobile AI                    | Optional staff sheet later            |


---

### 7) Mobile app — theming, UX

**Strengths:** Persona-driven tabs, `PersonaGate`, orders/kitchen/POS solid, theme tokens in `global.css`, profile theme toggle.

**Issues fixed:** missing `useDeviceType` import; persona label on home.

**Remaining**


| Item                                            | Priority                                         |
| ----------------------------------------------- | ------------------------------------------------ |
| Hardcoded hex colors vs `notion-`* tokens       | **Fixed** — `DASHBOARD_COLORS`                   |
| Manager tab bar crowded (7 tabs)                | **Fixed** — More tab                             |
| `kds/` duplicate of `kitchen/`                  | **Fixed** — removed                              |
| `PersonaGate` missing on messages/notifications | **Fixed**                                        |
| Dark mode gray wrappers (`ScreenWrapper`)       | **Fixed**                                        |
| Tablet layouts only on home/profile             | **Fixed** — `ScreenBody` on major module screens |
| Scan QR hidden — no home discoverability        | **Fixed** — home quick-action                    |
| Mobile license banner                           | **Fixed** — `LicenseBanner`                      |
| Mobile client detection on backend              | **Fixed** — `x-client-type` header               |


---

### 8) Features safe to remove or defer (complexity reduction)


| Feature / surface                        | Why remove or defer                          | Alternative                          |
| ---------------------------------------- | -------------------------------------------- | ------------------------------------ |
| Mobile `kds/` screen                     | Duplicates `kitchen/`                        | Single kitchen route                 |
| `AskHotelWidget` (unused)                | Dead code                                    | Keep FAB launcher only               |
| `kot.service.ts` stub                    | Never implemented                            | Delete or implement                  |
| 7 unwired report endpoints               | API clutter                                  | Wire 3 ops reports or delete         |
| Fonepay dynamic QR (if static QR enough) | Unused code path                             | Static QR + manual confirm (current) |
| `/ops/rooms` duplicate                   | Confusion                                    | `/rooms` only                        |
| `/hotel/crm` legacy redirect             | Already merged                               | Keep redirect, remove docs           |
| Floor plan + facilities (small hotels)   | Rarely used                                  | Optional module off by default       |
| General ledger UI (non-accountants)      | Intimidating                                 | Hide behind `finance:manage_gl`      |
| Marketing template PATCH                 | No edit UI                                   | Create/delete only                   |
| WhatsApp feature flag (no provider UI)   | **Fixed** — provider + templates in Settings |                                      |
| `cbms:nudge` Redis queue                 | Dead code                                    | Cron-only CBMS                       |
| Booking engine in-app widget             | External by design                           | Settings keys + docs only            |
| Mobile owner hidden routes (`owner/`*)   | Overlap analytics                            | Fold into persona home               |
| Dual CRM routes                          | Already redirecting                          | Single `/hotel/guests`               |
| PlansPage (missing file)                 | Broken lazy route                            | **Fixed** — `PlansPage.tsx`          |


---

## Architecture map (staff flows)

```
Onboarding → SaaS billing → Settings (branding, tax, payments, messaging)
     ↓
Rooms / Tables → Bookings → Check-in → Folio charges + F&B orders
     ↓                              ↓
Events / Banquets              POS / KOT / Orders
     ↓                              ↓
Night audit (room charges)     Payments / Shifts
     ↓                              ↓
Checkout → Invoice → GL → Customer ledger / AR
```

**Guest-facing:** `/guest` portal (PIN login), digital menu `/menu`, public invoice `/invoice`.

**Mobile scope:** Persona-based — Owner (analytics/PO/finance), Manager (ops/bookings/PO), Receptionist (orders/bookings), Waiter (POS/tables), Housekeeping (room tasks), Kitchen (KOT queue). Full PMS on web.

---

## Remaining backlog (prioritized)

### P0 — Do next

- Corporate `GET /crm/companies` permission for booking staff (`crm:view_guests`)
- `useOrders.syncOrderItems` PUT route on backend
- Credit notes in `CustomerLedgerDetailPanel` entry list
- Invoice line items: exclude orders already in folio charges (`invoice.service.ts`)
- Checkout preview itemized list same dedupe (`checkout.service.ts`)
- Order-only payments on customer folio (`folio.service.ts` payments query)

### P1 — Finance clarity

- Date range filters on Invoices, Payments, Credit Notes tabs
- Customer ledger: In-house vs Historical tabs; phone/booking ID search
- Finance stats: net payments (exclude void reversals); “showing last N” hint
- Ledger detail uses `useFinance*Query(200)` directly (no limit race)

### P1 — Permissions

- `GET /settings` redacted DTO for non-admins
- `GET /banquets/venues` + availability + `GET /onboarding/checklist` permissions
- `POST /notifications/push/unregister` ownership check

### Mobile personas (backend-driven)

- `config/mobile-persona.ts` — role → persona, tabs, capabilities
- Profile API returns `mobile` block (`iam.service.ts`)
- Default roles: notifications + mobile-relevant perms (Manager ops analytics, Receptionist orders read, Kitchen without POS create)
- Mobile tabs from `profile.mobile.tabs` + `PersonaGate` on module screens
- Owner analytics: day/week/month/year period filter

### P1 — UX / responsive

- POS full-bleed outside staff shell (or hide sidebar)
- Booking gantt mobile fallback view (list + calendar on `bookings/timeline`)
- Settings 2-column → 1-column under 768px
- Standardize `EmptyState` + `PageContainer` (Reviews, Plans; more as needed)
- Events: generate invoice CTA; status filter

### P2 — Consolidation

- Merge `/crm/guests` with `/guests` (removed dead `CRMPage`; redirects kept)
- Wire `/finance/fonepay/qr` + status into POS/checkout
- Mobile check-in/checkout on manager bookings (payment on web if needed)
- Deprecate `/ops/rooms` → redirect to `/rooms`
- Backend: enforce plan modules + maxRooms/maxUsers
- Wire ops reports; remove orphan endpoints
- Guest portal AI concierge + DND toggle
- Remove mobile `kds/`; More tab + attendance
- AskHotelWidget on dashboard
- WhatsApp provider settings UI
- Reviews publish-reply endpoint + UI
- Payroll from approved attendance
- Booking engine availability preview in Settings
- PersonaGate on messages/notifications
- ScreenWrapper dark mode
- Mobile license banner

### P3 — AI, plans, polish

- AI `dailyLimit` in Settings + usage counter
- `guardUsage` on review draft
- PlansPage
- Invoice PDF logo + `invoiceTerms`
- Public invoice API (`GET /public/invoice/:id`)

### P4 — Infrastructure & guest ops (2026-06-13)

- Remove dead `cbms:nudge` Redis LPUSH (cron worker only)
- Orphan MinIO logo cleanup on branding update
- Logo on invoice PDF via MinIO direct read (not broken localhost fetch)
- Validate `enableHotel` / `enableFoodAndBeverage` against plan modules
- Dual guest flows: **Create Customer** (`/hotel/guests/new`) vs **Check-In** (`/hotel/bookings/checkin`)
- Walk-in check-in: `POST /bookings/walk-in-check-in` + UI tab
- Save & Check In from Create Customer → pre-filled walk-in
- Check In CTA on customer detail page
- Guest profile snippet (VIP, stay count) on reservation check-in review
- Mobile Fonepay dynamic QR polling on POS (PRN + status poll)

### Recommended ERP/PMS UX (next)


| Feature                                | Why                        | Suggested surface            |
| -------------------------------------- | -------------------------- | ---------------------------- |
| Pre-arrival SMS/email with portal link | Reduce front-desk friction | Night-audit / arrivals job   |
| Guest preferences & allergies on folio | Better F&B + housekeeping  | Guest profile → folio header |
| Waitlist / room upgrade offers         | Revenue + service          | Bookings when sold out       |
| Corporate rate & credit limit warnings | AR control                 | Booking create + checkout    |
| Housekeeping “VIP arrival” flag        | Proactive service          | HK task on check-in event    |
| Post-stay review request (48h)         | Reputation                 | Reviews module + SMS         |
| Lost & found + guest messaging log     | Service recovery           | CRM guest timeline           |
| Shift handover notes                   | Ops continuity             | Manager dashboard widget     |
| No-show auto-cancel policy             | Inventory hygiene          | Bookings cron                |
| Loyalty / repeat-guest discount        | Retention                  | Guest profile + POS          |


---

## Endpoint ↔ UI coverage (quick reference)


| Module           | Backend prefix                                      | Web | Mobile                      |
| ---------------- | --------------------------------------------------- | --- | --------------------------- |
| Settings / SaaS  | `/settings`, `/saas-billing`, `/onboarding`         | ✓   | profile only                |
| Rooms / Bookings | `/rooms`, `/bookings`                               | ✓   | read + manager check-in/out |
| Finance          | `/finance`, `/billing`, `/invoices`, `/night-audit` | ✓   | partial                     |
| POS / Orders     | `/orders`, `/operations/tables`, `/menu`            | ✓   | ✓                           |
| Procurement      | `/procurement`, `/inventory`                        | ✓   | approve/receive             |
| Events           | `/banquets`                                         | ✓   | —                           |
| RBAC             | `/iam`, `/users`, `/roles`                          | ✓   | —                           |
| Messaging        | `/messages`, `/notifications`, `/marketing`         | ✓   | messages/notifications      |
| Guest portal     | `/guest`, `/guest/actions`                          | ✓   | —                           |
| AI / Analytics   | `/ai`, `/analytics`                                 | ✓   | analytics events            |


---

## Docker migrations (reminder)

Container entrypoint runs `drizzle-kit push`; boot SQL in `src/db/migrations.ts` runs on every API start. Versioned `drizzle/` SQL is optional via `DB_MIGRATION_MODE=migrate`.