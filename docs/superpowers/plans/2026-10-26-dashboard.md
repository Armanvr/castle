# Dashboard Implementation Plan

**Goal:** Implement the four user-approved dashboard improvements.

**Architecture:** Extend existing GameState with optional player-stat overrides and per-scene additions. Reuse shared player vitals and preserve source campaign data. Keep dice logic in a small pure service and its UI in one component.

**Tech Stack:** Preact, TypeScript, existing CSS, node:test; no new dependencies.

- [x] Add failing state tests in tests/dashboard.test.ts for player persistence, monster isolation and scene additions.
- [x] Implement overrides and validation in src/types.ts, src/services/game.ts and storageService.ts, including undo snapshot compatibility.
- [x] Add dice bounds, mixed-result and formula tests in tests/dice.test.ts; implement src/services/dice.ts and components/DiceRoller.tsx.
- [x] Wire combat editors and visible source-based monster actions in CombatView.tsx.
- [x] Add four source-independent scene editors in Views.tsx; use existing CSS palette and controls.
- [x] Run full tests and build.
- [ ] Independent QA, simplification review and any required regression rerun by the parent agent.

Browser verification is blocked by the environment (Vite listen EPERM and agent-browser socket permissions). No Git repository is present, so no commit is attempted.
