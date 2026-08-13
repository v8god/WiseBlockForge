# phases.md

Proposed build order. Each phase should end with something demoable, not just internal progress. Update `memory.md` at the end of every phase — what got done, what changed from the plan, what's next.

## Phase 0 — Spike / foundations
Goal: prove the riskiest assumptions before investing in the full build.
- Stand up a minimal React Flow canvas with 2–3 dummy node types, wired and draggable.
- Prove codegen end-to-end: a tiny graph → real `.ipynb` → manually pushed to Kaggle → output pulled back manually. Doesn't need to be automated yet, just proven possible by hand.
- Confirm the per-user Kaggle account-linking flow works (paste API token, push a kernel under that account).
- **Exit condition**: a hand-run pipeline, built from 2–3 nodes, actually trains something small on Kaggle and you can see the result.

## Phase 1 — Core canvas, linear pipelines, client-side only
Goal: the teaching/instant-feedback path works end to end, no Kaggle yet.
- Node types: data input (small built-in/toy datasets), 1–2 preprocessing nodes, 1–2 model types, training loop, evaluation, visualization.
- Notes/annotations canvas element (`Architecture.md` §11, `design.md` §12) — simple enough to build alongside the first real node types.
- Canvas basics: draggable nodes, bounded pan, min/max zoom (`design.md` §11) — mostly free from React Flow, but pick the actual bounds now rather than leaving them as an afterthought.
- Theme tokens (light/dark) built in from the start, even if only light mode ships visually this phase (`design.md` §9) — retrofitting this later means touching every node twice.
- Client-side execution only (TensorFlow.js / ONNX Runtime Web) — no account linking needed yet.
- "View generated code" toggle live from day one (`Rules.md` §1).
- **Exit condition**: someone with no coding background can build a small pipeline, run it in-browser, and see a trained toy model's result. Canvas pans/zooms within its set bounds, nodes drag freely, and a dark-mode toggle actually switches the whole UI.

## Phase 2 — Kaggle integration
Goal: real GPU training, no live progress yet (that's Phase 3).
- Account-linking flow (store the API key per `Rules.md` §3).
- Dataset search + attach (`dataset_list`, `dataset_sources`).
- Dataset upload → private-dataset creation → attach, same path as search.
- Push/poll execution: queued → running → complete/error states in the UI.
- Output retrieval after completion.
- Start writing to the activity log (`Architecture.md` §12) as soon as real runs exist: run started/completed/failed, with a timestamp. No dashboard UI for it yet — that's Phase 8 — just make sure the events are being recorded from here on.
- **Exit condition**: a pipeline built in the canvas trains for real on Kaggle GPU and the learner sees the finished result (not live yet — that's next).

## Phase 3 — Live progress
Goal: the queued/running spinner becomes an actual live loss curve — and the graph itself comes alive while a run is in progress.
- Relay service (`Architecture.md` §5): receives progress posts, holds latest state, pushes to the browser over SSE/WebSocket.
- Training-loop node template gets the progress-report hook baked in (per-epoch loss/metrics).
- Codegen wraps every node with the running/complete/error status shim (`Architecture.md` §10) — this is automatic for all nodes, not opt-in like the epoch hook above.
- Frontend renders the running-border animation, complete glow, and error glow per node (`design.md` §10) as those status events arrive.
- Per-run auth token so one user can't see or spoof another's progress feed (`Rules.md` §3).
- **Exit condition**: a Kaggle-backed run shows epoch-by-epoch progress in the UI while it's still running, and the canvas itself visibly shows which node is currently executing, which finished, and which failed.

## Phase 4 — Loops and branching
Goal: pipelines stop being a straight line.
- Resolve the open design decision in `Architecture.md` §7 (loop container node vs. literal cyclic edges) before starting this phase — don't build both.
- Branch/condition node type.
- Codegen updated to handle whichever loop model was chosen, safely.
- Hard validation rule (`Architecture.md` §13): any loop — for, while, or anything added later — without an explicit exit condition blocks the Run action with a clear error. No loop type is exempt.
- **Exit condition**: a pipeline with a loop (e.g. "repeat this block until X") runs correctly end to end, and a loop built without an exit condition is rejected with a clear error instead of running.

## Phase 5 — Custom code node
Goal: the escape hatch.
- Editable free-text node, inserted verbatim into the generated script at its position in the graph (`Architecture.md` §3).
- Clear UI treatment marking it as user-owned code — distinct visually from generated nodes, per `Rules.md` §5's carve-out.
- Document clearly that custom code inside a training loop won't automatically get the Phase 3 live-progress hook unless the user adds the call themselves — give them a copy-pasteable snippet for it.
- **Exit condition**: a learner can drop a code node between two visual nodes, print something custom, and see it in the run output.

## Phase 6 — Templates
Goal: pipelines become shareable, reusable objects.
- Save current graph as a personal template.
- Publish flow (private → public), with the stripping/validation from `Rules.md` §4.
- Browse/search public templates; load one = fork it into your own canvas.
- Seed the public library with a first batch of your own templates (list below) so it isn't empty on day one.
- **Exit condition**: someone can find a published template, load it, attach their own dataset, and run it — without building anything from scratch.

## Phase 7 — Beginner / no-code mode
Goal: the "I don't want to see the graph at all" path.
- A curated set of the Phase 6 templates presented as a simple picker (name, description, preview image) rather than a canvas.
- Locked graph underneath — attach dataset, hit run, see result.
- "Unlock" action reveals the underlying canvas for anyone curious — this mode is a front door to the full editor, not a separate product.
- **Exit condition**: someone who has never seen a node-based tool before can pick a template, attach data, and get a trained model with zero canvas interaction.

## Phase 8 — Polish and scale
Goal: breadth and durability, not new core mechanics.
- Expand the node library based on what real pipelines and published templates actually need (`Rules.md` §6).
- Build the actual activity feed UI on the user dashboard (`Architecture.md` §12) from the log entries that have been accumulating since Phase 2 — a GitHub/Kaggle-style history of runs, publishes, and forks.
- Performance pass on the canvas and codegen for larger graphs.
- Basic reporting/moderation tooling for public templates.
- Usage-facing polish: better error messages on failed Kaggle runs, clearer dataset-mismatch errors, etc.

---

## Seed list — template ideas for Phase 6
A starter set to build (and test the platform against) once templates ship. Rough spread across difficulty and domain so the public library isn't all one kind of thing on day one.

**Computer vision — beginner**
- Cats vs. dogs image classifier (the classic first-CV-project)
- Handwritten digit recognizer (MNIST-style)
- Rock/paper/scissors hand-gesture classifier
- Simple image colorizer (grayscale → color)

**Computer vision — intermediate**
- Multi-class object classifier on a custom dataset (attach-your-own-images template)
- Face mask / PPE detector
- Image similarity / "find visually similar images" pipeline
- Style-transfer demo (apply an artistic style to an uploaded photo)
- Basic image segmentation (foreground/background split)

**Text / NLP — beginner**
- Movie/product review sentiment classifier
- Spam vs. not-spam email classifier
- Simple text summarizer
- Language detector

**Text / NLP — intermediate**
- Named-entity recognizer (pull names/places/dates out of text)
- Fine-tune a small transformer for custom text classification (attach-your-own-labeled-text template)
- Simple chatbot intent classifier

**Tabular / structured data**
- House price predictor (regression, classic teaching dataset)
- Customer churn predictor
- Titanic-survival-style classifier (another classic teaching dataset, good "first template" candidate)
- Credit risk / loan approval classifier
- Time-series forecasting starter (sales, weather, stock-style data)

**Audio (later, once audio node types exist)**
- Simple speech command recognizer (yes/no/stop-style)
- Music genre classifier

**"Understand the mechanics" teaching templates** — smaller in scope, meant to demonstrate one concept clearly rather than solve a real problem:
- "Watch a loss curve" — the smallest possible model, all default settings, just to see training happen live
- "Overfitting demo" — same model trained with and without regularization, side by side
- "Optimizer comparison" — identical model, swap only the optimizer node, compare results
- "Data augmentation before/after" — same classifier, with and without an augmentation node, to show the effect on accuracy

Building a handful of these yourself (per your note) both seeds the public library and stress-tests the node library and codegen against real, varied pipelines before any outside user touches it.
