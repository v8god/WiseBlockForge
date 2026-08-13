# README.md — project kickoff guide

This file is for you (the builder), not end users. It says where everything from this kickoff goes and how to start turning it into a real repo.

## 1. Where these files go
Put this whole `docs/` folder at the **root** of your actual project repo, and this `README.md` at the repo root itself (not inside `docs/`):

```
your-repo/
├── README.md              ← this file, repo root
├── docs/
│   ├── PRD.md
│   ├── Architecture.md
│   ├── Rules.md
│   ├── phases.md
│   ├── design.md
│   └── memory.md
├── frontend/               ← doesn't exist yet, created in Phase 0
├── backend/                ← doesn't exist yet, created in Phase 0
└── relay/                  ← doesn't exist yet, created in Phase 3
```

## 2. How the docs relate to each other
Read in this order when you're picking the project back up after time away, or onboarding anyone else:
1. **PRD.md** — what you're building and why. Start here.
2. **Architecture.md** — how the system is put together, including the correction from Blockly to a node-graph library (React Flow) and the Kaggle execution model. Read this before writing any code.
3. **Rules.md** — standing constraints (no black boxes, never execute user code server-side, credential handling). These don't change per-phase — check them before any feature that touches execution, credentials, or templates.
4. **phases.md** — the build order, plus the seed list of template ideas for Phase 6.
5. **design.md** — UI/UX spec for the canvas, nodes, run panel, dataset picker, template gallery.
6. **memory.md** — the running log. Read the latest entry first to know where things actually stand (docs above are the *plan*; `memory.md` is the *history*, including anywhere reality diverged from the plan).

## 3. Updating memory.md
Add a new entry at the top of `memory.md` after finishing a phase, or after making any decision that changes something in the other five docs — don't wait and try to reconstruct it later. Use the entry template at the bottom of the file.

## 4. Bootstrapping (Phase 0)
Nothing exists yet — this is what Phase 0 in `phases.md` sets up. Proposed commands, based on the stack in `Architecture.md` §9. Adjust once you've actually chosen tooling.

**Frontend** (React + TypeScript + React Flow):
```bash
cd your-repo
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install @xyflow/react
npm run dev
```
What you should see: a Vite dev server, default port shown in the terminal (typically `http://localhost:5173`), blank React app until you add the canvas.

**Backend** (Python + FastAPI):
```bash
cd your-repo
mkdir backend && cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install fastapi uvicorn
uvicorn main:app --reload
```
What you should see: FastAPI's default docs page at `http://localhost:8000/docs` once you've created a minimal `main.py` with a FastAPI app instance.

**Relay service** — hold off until Phase 3 in `phases.md`; don't scaffold it during Phase 0, it has nothing to relay yet.

## 5. What goes where, as features land
- New node types (frontend component + codegen function) → `frontend/src/nodes/` and `backend/codegen/` respectively (exact paths will firm up once Phase 0 is scaffolded — update this section once they do).
- Kaggle integration code (push/poll, dataset attach/create, output pull) → a dedicated module in `backend/`, not scattered across route handlers — keep it isolated since `Rules.md` §2/§3 constraints (execution boundary, credential handling) apply specifically to this code.
- Generated example notebooks (from testing codegen) → keep out of version control, or in a clearly-marked `backend/tmp/` — these are throwaway, not templates.
- Template seed content (the list at the end of `phases.md`) → build these as real pipelines once Phase 6 lands, store them the same way any user-published template is stored, don't special-case them in the data model.

## 6. Keeping this README honest
This file describes the *intended* structure before any code exists. Once Phase 0 is done and the real repo layout is settled, come back and correct anything here that drifted — this file should always describe the repo as it actually is, not as it was originally planned.
"# WiseBlockForge" 
