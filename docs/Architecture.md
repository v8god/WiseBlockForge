# Architecture.md

## 0. Correction from earlier planning — flagging this up front
Earlier discussion (before you described the n8n-style requirement) assumed **Blockly** — Google's block-stacking library, the engine behind Scratch and Code.org. Blockly is built for *linear stacks of blocks that snap together vertically*. It is **not** built for a free-form canvas where nodes connect to each other in arbitrary directions, branch, or loop back on themselves.

What you're describing now — drag elements anywhere, wire them together, loops formed by an arrow pointing back onto an earlier node — is a **node-graph editor**, a different category of tool entirely. The right building block for that is **React Flow** (npm package `@xyflow/react`), which is exactly what it sounds like: the library n8n-*style* tools are typically built on (n8n itself uses a custom canvas, but React Flow is the standard open building block for this exact pattern — it's used for workflow builders, chatbot builders, and ML/data pipeline tools specifically). It's actively maintained, MIT-licensed, and ships React-component nodes (so any node can contain real form inputs, dropdowns, etc., not just static shapes).

**Correct this if you disagree** — but the rest of this document assumes React Flow (or an equivalent node-graph library), not Blockly.

## 1. System overview
Five things this system needs to do, and who's responsible for each:

| Responsibility | Owner |
|---|---|
| Let the user build a graph of nodes and edges | Frontend canvas (React Flow) |
| Turn that graph into real, runnable code | Codegen service |
| Actually run the code | Kaggle (real GPU) or the browser (client-side, small-scale) |
| Get progress and results back to the user | Execution orchestrator + live-progress relay |
| Store/share pipelines as templates | Template service |

## 2. Frontend
- **Canvas**: React Flow. Nodes = pipeline steps. Edges = data/control flow.
- **Node types** (each a React component + a matching codegen function — see §3):
  - Data input (search Kaggle dataset / upload file)
  - Preprocessing (resize, normalize, augment, split)
  - Model architecture (CNN, Transformer encoder, etc. — swappable, same socket pattern discussed earlier)
  - Optimizer / Loss (swappable)
  - Training loop
  - Evaluation / metrics
  - Visualization (plot, image grid, confusion matrix)
  - **Custom code** — a free-text field whose contents get inserted verbatim into the generated script at that point in the graph
  - **Loop / group** and **branch / condition** — see §5, this is an open design decision, not settled
- **"View generated code" toggle**: always available on every pipeline. This is a hard rule, not a nice-to-have — see `Rules.md` §1 (no black boxes).
- **Run panel**: shows connection status (Kaggle account linked?), dataset status, execution state (queued → running → complete/error — see §4), and a live output pane (logs, loss curve, plots) once a run starts.

## 3. Codegen service
Walks the graph and emits a real `.ipynb`. Key difference from a linear block stack: this has to do an actual **topological traversal** of a directed graph, not just concatenate a list top-to-bottom.
- Each node type owns a small function: `(node, incomingEdges) → code string`.
- The traversal order follows the edges. A node with two inputs (e.g. "Train model" taking both an architecture node and an optimizer node) resolves both branches before emitting its own code — same recursive pattern discussed earlier, just now over a real graph instead of a Blockly socket tree.
- Custom code nodes emit their contents verbatim, in-place — this is *not* a code-generation problem, it's just a node whose "generator" is "return what the user typed."
- Output: a `.ipynb` with `dataset_sources` populated in its kernel metadata (see §6) plus a standard cell structure the user can also open and read directly in Kaggle's own UI if they want to leave your app entirely. That portability is intentional (`Rules.md` §1 again).

## 4. Execution backends
Two paths, deliberately kept separate:

**Client-side (browser)** — TensorFlow.js / ONNX Runtime Web. Instant feedback, zero cost, zero account-linking needed. Good for toy datasets, small CNNs, teaching the mechanics. Cannot scale to real training runs.

**Kaggle (real GPU)** — push/poll, not live, by design of Kaggle's own API:
1. Push the generated notebook (`kernels_push`), with the account's own API key.
2. Poll kernel status: `queued → running → complete / error`. There is no live status push — this is polling, roughly every 10–15s, not a socket.
3. On `complete`, pull output files and logs (`kernels_output`).

This was verified directly against Kaggle's API behavior — it genuinely only exposes output *after* a run finishes, which is why §5 below (live progress) has to work around it rather than through it.

**Per-user Kaggle accounts, not a shared one.** Kaggle's API authenticates as a specific account and burns that account's GPU quota. There's no service-account mode for running arbitrary users' jobs under one key. Every user links their *own* Kaggle account (pastes their own API token) before their first run — this also means their compute, their quota, their Kaggle ToS compliance, not ours. This is a deliberate architectural choice, not just a limitation — see `Rules.md` §2 on execution boundaries.

## 5. Live progress (the workaround for Kaggle's poll-only API)
Since Kaggle won't stream output while a kernel runs, the training-loop node's generated code includes a **progress-report hook**: after each epoch (or a configurable interval), it `POST`s `{epoch, loss, metrics}` to a small relay service you host.

```
[Training loop in kernel] --POST after each epoch--> [Your relay server]
                                                              |
                                                   (stores latest state)
                                                              |
                                                    SSE / WebSocket push
                                                              |
                                                     [Browser UI, live]
```

Requirements this puts on the system:
- The Kaggle kernel needs `enable_internet: true`.
- You need a small always-on service (this can be lightweight — a serverless function plus a pub/sub channel or a Redis-backed relay is enough; doesn't need to be a heavyweight backend).
- The relay only needs to hold the *latest* state per run (not a full history) to drive a live UI — though storing the full history too is cheap and lets you redraw the loss curve on reconnect.
- This is opt-in per training node — a node that doesn't call the hook just won't show live progress, it'll show the plain queued/running/complete states from §4 instead. Custom-code training loops (§2, §3) won't get this for free; document that clearly for users who go fully custom.

## 5a. Per-node execution status (running / complete / error)
Two different signals travel over the live channel from §5, at two different granularities — worth keeping distinct:
- **Node-level status** (`running` → `complete` / `error`) — automatic, applies to *every* node in the graph, including custom code nodes. Codegen wraps each node's emitted code block in a small instrumentation shim: post `running` right before the block executes, `complete` right after it finishes, `error` (with the exception message) if it throws. This is not opt-in and not something a node template author configures — codegen does it uniformly for every node, generated or custom.
- **Node-internal progress** (e.g. per-epoch loss inside a training loop) — opt-in, as described in §5, only present where a node template specifically calls the progress-report hook.
- On the **client-side execution path**, node-level status doesn't need the relay at all — the code runs in the same browser tab as the UI, so status can update directly in app state as each node's generated function runs. The relay in §5 exists specifically to solve the *remote* Kaggle case.
- Frontend visual treatment (the running-border animation, complete/error glow) lives in `design.md` §10.

## 6. Dataset flow
- **Search**: Kaggle's `dataset_list` API (search, tags, license, file-type filters) — surface this as an in-app picker, no need to leave the app.
- **Attach existing dataset**: reference it in the kernel's `dataset_sources` metadata field; Kaggle mounts it at `/kaggle/input/<dataset-slug>/` automatically — this is the fixed, predictable path every "Load dataset" node's generated code reads from.
- **User-uploaded file**: cannot attach a raw file straight to a kernel push. The backend first creates a **private Kaggle dataset** from the upload (via the dataset-creation part of the API, under the user's own linked account), then attaches it the same way as any other dataset. One extra backend step, invisible to the user.
- **Output**: same direction, opposite flow — anything the pipeline writes to disk during the run (plots, saved model file, predictions CSV) is a standard kernel output, pulled after `complete` via `kernels_output`. A "Save output" node category exists purely to make sure the pipeline actually writes something to the output directory.

## 7. Loops and branches — open design decision
You described loops as **an arrow drawn from a node back onto itself (or an earlier node) until a defined exit condition** — a literal cycle in the visual graph. Two ways to build this, with different tradeoffs:

**Option A — literal cyclic edges.** Closest to what you described. Harder to implement: most graph-layout algorithms assume a DAG (directed acyclic graph), so a real cycle needs special-casing for layout, needs a clear visual marker for "this edge is a loop-back, not normal flow," and codegen has to detect the cycle's boundary and the exit condition to emit a real Python `for`/`while` loop instead of infinitely re-walking the graph.

**Option B — a "Loop" container node.** What n8n and most workflow tools actually do under the hood, even when it feels like a loop to the user: a single node that visually contains (or points to) a small sub-pipeline and a repeat/exit condition, without a literal back-edge on the main canvas. Easier to implement, easier to lay out, harder to accidentally build an infinite loop by mis-wiring an edge.

**Recommendation: start with Option B, revisit Option A once the rest of the graph engine is solid.** This is exactly the kind of call you asked to weigh in on — correct it if you'd rather build the literal cyclic version from the start. Whichever is chosen, record the decision in `memory.md` once it's made.

## 8. Template service
- A template is just a serialized graph (nodes + edges + node configs), not a separate format.
- Private by default; a "Publish" action makes it public with a name, description, and preview.
- Browsing public templates = load someone else's serialized graph into your own canvas (a fork, not a live link back to the original).
- No moderation infrastructure in v1 beyond basic reporting — see `PRD.md` §4 non-goals and `Rules.md` §4.

## 9a. Canvas element: notes / annotations
A non-executing canvas element, separate from the node-type list in §2 — it produces no code and has no input/output ports. Stores free text, a position/size, and an optional list of node IDs it's associated with (so it can label "this part of the pipeline does X" for a specific group of nodes, not just float unattached). Included in a template's serialized graph (§8) alongside functional nodes, so published templates can carry documentation along with the pipeline itself. Keep this visually and structurally distinct from the loop container in §7, even though both involve "a thing that groups other nodes" — one affects execution, the other never does. UI treatment: `design.md` §12.

## 9b. Activity log
A GitHub/Kaggle-style activity feed for the user dashboard — a simple, append-only record of the account's own actions:
- Pipeline created/edited
- Run started/completed/failed (cross-referencing the run's final state from §4)
- Template published/forked
Backed by a plain event table (user, action type, target, timestamp) in the same backend as everything else — this doesn't need its own service. Write to it wherever these actions already happen elsewhere in the system, starting once real runs exist (`phases.md` Phase 2); the dashboard feed UI itself is a later, separate step (`phases.md` Phase 8) once there's enough history to make it worth looking at.

## 9c. Loop validation (hard requirement)
Every loop construct — whichever shape §7 lands on, and regardless of loop type (`for`, `while`, or anything added later) — must have an explicit, non-empty exit condition before the pipeline can run. A loop without one is a validation error at the canvas level, blocking the Run action with a message pointing at the offending loop — not a warning, and not something only caught after a run starts. This is uniform across loop types: the rule is "no exit condition, no run," full stop, not something evaluated differently per loop shape.

## 9. Suggested stack
Matches your existing stack rather than introducing something new:
- **Frontend**: React + TypeScript, React Flow for the canvas.
- **Backend**: Python, FastAPI — codegen service, Kaggle orchestration, dataset service, template service.
- **Relay (live progress)**: lightweight — FastAPI with WebSockets, or a small Node.js service, or Cloudflare Workers + Durable Objects if you want it edge-hosted (you've used Cloudflare Workers before).
- **Storage**: Postgres (or SQLite for early phases) for users, templates, run metadata. Redis (or equivalent) for live-run state if the relay needs it.
- **Client-side execution**: TensorFlow.js / ONNX Runtime Web, no backend involvement.

This is a starting proposal, not a locked decision — revise in `memory.md` once Phase 0 (see `phases.md`) is actually spiked out.
