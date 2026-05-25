# Development Guide: What’s Left To Do

This document translates the current prototype into a prioritized execution plan.

## Current State Snapshot

The repository currently contains:
- A canonical protocol spec in `WHITEPAPER.md`.
- A single-screen React/Vite frontend in `src/App.jsx`.
- Client-only wallet interaction via `@tonconnect/ui`.
- Mocked round lifecycle and chart rendering in the browser.
- No backend services, no smart-contract source, no automated tests, and no CI/CD pipeline.

---

## Top Priorities (Critical Path)

## 1) Implement the on-chain settlement contract

### Why
The UI sends transactions to a fixed contract address, but this repo does not include the contract code or ABI/cell schema. Without source-of-truth contract artifacts, the protocol is unverifiable and cannot be iterated safely.

### What to do
- Add a `contracts/` workspace with:
  - Contract source (FunC/Tact or chosen TON language).
  - Build scripts and compiler config.
  - Deterministic serialization for bet payloads.
- Define and document external messages:
  - Place bet
  - Round open/lock/settle
  - Refund and emergency halt
- Add invariant checks matching whitepaper:
  - Single-settlement invariant
  - Atomic balance invariant
  - Deterministic replay invariant
- Publish ABI/opcode documentation for frontend + backend integration.

### Definition of done
- Reproducible local build.
- Testnet deployment scripts.
- Contract audit checklist complete.
- Message schema versioned and committed.

---

## 2) Build authoritative round engine (backend)

### Why
Round timing and settlement currently happen in browser state (`timeLeft`, `round`, `startPrice`). This is non-authoritative and easy to manipulate.

### What to do
- Implement backend round coordinator (Cloudflare Workers + Durable Objects per whitepaper, or equivalent).
- Move round state off client:
  - `OPEN` (0–45s)
  - `LOCKED` (45–60s)
  - `SETTLING`
  - `CLOSED`
- Enforce one-way state transitions and idempotent settlement.
- Add signed/public round snapshots exposed via API/websocket.

### Definition of done
- Clients can only read round state, not compute it.
- Settlement is executed once and only once.
- Restart/replay behavior is deterministic.

---

## 3) Integrate robust oracle pipeline

### Why
Frontend currently reads CoinGecko price every 5s. That is insufficient for settlement-grade consensus and differs from whitepaper’s multi-source oracle approach.

### What to do
- Build oracle adapter service with at least two primary exchanges (e.g., Binance + OKX) and fallback source(s).
- Implement timestamp alignment and median/consensus logic.
- Add fail-safe policy:
  - Retry window
  - Round void/refund on unresolved consensus
- Persist oracle observations for post-round audit.

### Definition of done
- Oracle consensus result is reproducible from stored inputs.
- Failed consensus cleanly voids/refunds round.
- Observable metrics and alerting in place.

---

## 4) Formalize bet encoding and frontend transaction builder

### Why
Current payload generation uses a 9-byte ad hoc format in `App.jsx` and base64 via `btoa`; there is no documented schema contract.

### What to do
- Replace ad hoc encoding with shared codec package (`packages/protocol-codec`).
- Version payload schema (e.g., `v1`).
- Include fields needed for replay protection and reconciliation:
  - round id
  - side
  - amount
  - nonce / client order id
  - timestamp or validity slot
- Validate inputs client-side and server-side.

### Definition of done
- Frontend, backend, and contract use one canonical schema.
- Serialization/deserialization tests pass across all layers.

---

## 5) Replace localStorage “history” with real user ledger

### Why
Current `bl_history` in localStorage is only local UX state and not a reliable account history.

### What to do
- Build authenticated user ledger API keyed by wallet address.
- Store:
  - Bet submissions
  - Acceptance/rejection reasons
  - Round outcomes
  - Payout/refund records
- Add profile view powered by backend data.

### Definition of done
- User sees canonical history across devices.
- History entries map to round + transaction IDs.

---

## Secondary Priorities

## 6) Security hardening
- Threat model (frontend spoofing, replay, oracle manipulation, griefing).
- Rate limiting and anti-spam policy by wallet/IP/device heuristics.
- Emergency circuit breaker and operational runbook.
- Secrets handling and key management strategy.

## 7) Testing strategy
- Unit tests for payout math and threshold conditions.
- Property tests for zero-sum behavior.
- Integration tests for full round lifecycle.
- End-to-end tests: wallet connect → bet → settle → history.

## 8) Observability & ops
- Structured logs with round IDs and correlation IDs.
- Metrics dashboards (round latency, oracle divergence, settlement success).
- Alerts for double-settlement attempt, consensus failure rate, and payout mismatches.

## 9) Compliance & risk UX
- Region gating and legal review path.
- Clear user-facing risk disclosures and consent flows.
- Responsible gaming controls (limits, cool-offs, self-exclusion).

## 10) Product polish
- Reconcile HELP text with final protocol behavior.
- Improve accessibility (keyboard semantics, ARIA, color contrast).
- Add responsive QA for low-end mobile Telegram webviews.

---

## Suggested Repository Structure

```text
contracts/
  tontation/
packages/
  protocol-codec/
  math-core/
services/
  round-engine/
  oracle-aggregator/
  api/
apps/
  web/
infra/
  cloudflare/
  ci/
docs/
  architecture/
  operations/
  security/
```

---

## 30/60/90 Day Execution Plan

## Days 0–30
- Stand up contract repo + message schema.
- Build backend round state machine skeleton.
- Replace frontend local timer with backend-fed timer.
- Add base unit tests and CI lint/build.

## Days 31–60
- Complete oracle consensus + failure policy.
- Integrate end-to-end testnet settlement flow.
- Implement canonical ledger + profile API.
- Add observability and runbook draft.

## Days 61–90
- Security review and pre-audit fixes.
- Load testing + chaos scenarios.
- Finalize legal/risk UX.
- Mainnet readiness checklist.

---

## Mainnet Readiness Checklist

- [ ] Contract source, tests, and reproducible builds committed
- [ ] Backend settlement idempotency proven under retry/restart
- [ ] Oracle consensus failure policy tested in production-like staging
- [ ] Full accounting reconciliation (wallet reserves vs user ledger)
- [ ] Incident response and rollback procedures documented
- [ ] Independent security review completed
- [ ] Frontend/backend/contract schema versions locked and tagged

