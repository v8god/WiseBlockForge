# memory.md

Running log of the project. Add a new entry after every phase (or after any decision that changes something in `PRD.md`, `Architecture.md`, `Rules.md`, `phases.md`, or `design.md`). Newest entry at the top. Don't rewrite history — if a decision changes later, add a new entry noting the change, and reference the old one.

Each entry should answer three things: what got done, what's next, what's still open/undecided.

---

## Entry 2 — Completed Phase 0 (Spike / Foundations)
**Date**: 2026-08-13
**Phase**: Phase 0

**What was done:**
- Scaffolded Vite React-TS frontend and successfully installed `@xyflow/react` (React Flow).
- Created a premium CSS theme (light/dark modes) with custom visual cards and glow animations for executing (`running`), `complete`, and `error` node states.
- Implemented `App.tsx` with a React Flow canvas editor, side panel for Kaggle credentials linking, logs console terminal, and code preview.
- Created `backend/codegen.py` to topologically sort and compile visual graphs into an `.ipynb` PyTorch training notebook containing custom cells for data loading, MLP model training, and metrics evaluation, instrumented with node-level tracking tags.
- Created `backend/kaggle_orchestrator.py` to write metadata and programmatically push notebooks to Kaggle and fetch statuses and stdout logs using the Kaggle Python SDK.
- Created `backend/main.py` FastAPI app providing routes for starting runs, polling status, and fetching console logs.
- Wrote verification script `backend/test_kaggle_push.py` for end-to-end local testing.

**What's next:**
- Phase 1: Core canvas, linear pipelines, client-side execution with TF.js/ONNX Runtime.

**Still open / undecided:**
- None. Ready to proceed to Phase 1.

**Changes to earlier docs (if any):**
- Renamed project to WiseBlockForge (tagline "Visual Machine Learning Builder") across all docs.

---

## Entry 1 — UI/UX and execution-feedback decisions
**Date**: fill in when this was actually decided.
**Phase**: Pre-Phase 0 (still planning, no code yet).

**What was done:**
- Added dark mode as a first-class requirement — theme tokens from the start, not retrofitted (`design.md` §9).
- Extended the live-progress design to cover **per-node** status, not just training-loop epoch progress: every node gets an automatic running/complete/error signal from codegen, rendered as a running-border animation and a green/red glow (`Architecture.md` §5a, `design.md` §10).
- Confirmed canvas basics as explicit requirements rather than assumed defaults: nodes freely draggable, canvas pan bounded (not infinite), zoom has min/max limits (`design.md` §11).
- Made loop exit-condition validation a hard rule, not just a design goal: no loop type runs without one, full stop (`Architecture.md` §9c, `Rules.md` §7).
- Added an activity log / dashboard feed, GitHub/Kaggle-style, logging runs, publishes, and forks (`Architecture.md` §9b) — logging starts Phase 2, dashboard UI itself lands Phase 8.
- Added Notes/annotations as a canvas element — non-executing, groupable to specific nodes, travels with published templates (`Architecture.md` §9a, `design.md` §12).
- Re-confirmed (no doc change needed — already the plan) that uploaded datasets become private Kaggle datasets under the user's own account, specifically so dataset storage is never our problem (`Architecture.md` §6).

**What's next:**
- Phase 0 as already planned — nothing above changes what Phase 0 needs to prove.

**Still open / undecided:**
- Exact pan/zoom bounds — deferred to Phase 1 tuning, not a spec to fix now.
- Everything already listed as open in Entry 0 is still open.

---

## Entry 0 — Kickoff / planning
**Date**: fill in when you start.
**Phase**: Pre-Phase 0 (planning, no code yet).

**What was done:**
- Defined the product direction: a node-based (n8n-style) visual pipeline builder for ML/CV, not a locked block-stack (corrected from an earlier Blockly-based direction — see `Architecture.md` §0).
- Worked out the Kaggle integration model: per-user linked accounts, push/poll execution, dataset search/attach/upload via `dataset_sources`, output retrieval after completion.
- Identified that Kaggle's API has no live-output streaming, and designed a workaround (progress-report hook → relay server → SSE/WebSocket to the browser) — `Architecture.md` §5.
- Established the core project principles: no black boxes (generated code always visible/exportable) and never execute user code on our own servers (`Rules.md` §1–2).
- Drafted `PRD.md`, `Architecture.md`, `Rules.md`, `phases.md`, `design.md` as a starting point.
- Seeded a seed list of ~25 template ideas across CV, NLP, tabular, and "understand the mechanics" teaching templates (`phases.md`, end of file).

**What's next:**
- Phase 0: spike the React Flow canvas + prove the codegen → Kaggle push → output pull loop by hand.

**Still open / undecided:**
- Loop implementation: literal cyclic edges vs. a Loop container node (`Architecture.md` §7). Recommendation on file is to start with a container node, but this hasn't been decided for real yet.
- Final project name decided: WiseBlockForge, with tagline "Visual Machine Learning Builder".
- Exact tech choice for the relay service (FastAPI+WebSockets vs. small Node service vs. Cloudflare Workers + Durable Objects) — proposed in `Architecture.md` §9, not committed.
- Template moderation approach beyond "basic reporting" for v1.

---

## Entry template (copy this for each new entry)

```
## Entry N — <short title>
**Date**:
**Phase**:

**What was done:**
-

**What's next:**
-

**Still open / undecided:**
-

**Changes to earlier docs (if any):**
-
```
