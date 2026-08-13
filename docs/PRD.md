# PRD — Product Requirements Document: WiseBlockForge
Tagline: **Visual Machine Learning Builder**

## 1. One-line pitch
A visual, node-based pipeline builder for machine learning and computer vision — n8n's "connect anything to anything" model, applied to training and understanding ML models, with real GPU execution via Kaggle and every generated pipeline visible as real, exportable Python underneath.

## 2. Problem
- Learning ML today means learning Python, a math-heavy mental model, *and* a training loop's plumbing all at once — most beginners bounce off before they see a model actually learn something.
- The block-based tools that already exist for this (BlocklyML, Milo) are dead or academic-only, and neither is graph-based — they're linear block stacks, not a pipeline you can branch, loop, or rewire.
- Kaggle and Colab assume you can already code. There's no free, GPU-backed, visual middle ground between "drag some blocks" and "here's a blank notebook."

## 3. Goals
- Let someone with **zero coding ability** assemble a working ML/CV pipeline by connecting nodes on a canvas — not by picking from a fixed menu of locked templates.
- Every pipeline compiles to **real, readable, exportable code** — nothing the user builds is trapped inside a proprietary format. (See `Rules.md` — no black boxes.)
- Support **loops and branches** in the pipeline graph, not just a straight line of blocks.
- Let advanced users **drop raw code into the middle of a visual pipeline** and read intermediate output from it.
- Run real training on **free GPU (Kaggle)**, with **live progress**, not just a spinner and a final result.
- Let anyone **save a pipeline as a template** and, optionally, **publish it for others to use, fork, or learn from**.

## 4. Non-goals (v1)
- Not trying to replace Kaggle/Colab for people who already code fluently — this is for the on-ramp.
- Not building our own GPU infrastructure. GPU compute is Kaggle's (via the user's own account) or the browser's (client-side inference/small training), not ours. See `Architecture.md` for why this is a deliberate constraint, not a limitation.
- Not supporting distributed / multi-GPU training in v1.
- Not building a mobile app in v1.
- Not moderating templates at scale in v1 — publish flow ships with basic reporting, not a full trust & safety system.

## 5. Target users
1. **Total beginners** — want to "train a model" and understand what happened, without writing code.
2. **Students learning ML/CV** (this includes builds like your own coursework) — want to see the code a block produces, tweak it, and understand the mechanics.
3. **Hobbyists / freelancers** — want to quickly assemble a working pipeline (e.g. an image classifier) without spinning up a full dev environment.
4. **Template creators** — comfortable users who build a solid pipeline once and publish it so others can load it in one click.

## 6. Core user stories
- As a beginner, I drag nodes onto a canvas and connect them into a pipeline without writing code.
- As a learner, I drop a **custom code node** in between two visual nodes to inject my own logic or print an intermediate value.
- As a user, I attach a **Kaggle dataset by search**, or **upload my own file**, as the input to my pipeline.
- As a user, I run my pipeline on **real GPU** and see **live progress** (loss curve, epoch counter) while it runs — not just at the end.
- As a user, I build a **loop** into my pipeline (e.g. repeat a group of steps until a condition is met) without writing a for-loop by hand.
- As a user, I save my pipeline as **my own reusable template**.
- As a user, I optionally **publish** a template so other users can find, load, and fork it.
- As a beginner who doesn't want to build anything from scratch, I pick a **published template**, attach my own dataset, and hit run.

## 7. Feature list (high-level — sequencing lives in `phases.md`)
- Node-based canvas: add/connect/delete nodes and edges, pan/zoom, minimap.
- Node categories: data input, preprocessing, model architecture, optimizer, loss, training loop, evaluation/metrics, visualization, custom code, loop/group, branch/condition.
- Code generation: graph → real `.ipynb` file, always inspectable.
- Execution backends: client-side (browser, instant, small-scale) and Kaggle (real GPU, queued).
- Dataset flow: search existing Kaggle datasets, attach one, or upload a file (auto-packaged into a private Kaggle dataset).
- Live progress: training nodes report progress out-of-band so the UI updates in real time during a Kaggle run (see `Architecture.md`).
- Template system: save privately, publish publicly, browse/search public templates, fork someone else's.
- Account connection: each user links their own Kaggle account (API key) — their compute, their quota, their liability.

## 8. Success signals (proposed — validate before treating as fixed)
- A first-time user with no coding background can get a trained model and a result on-screen without external help.
- Time from "open the app" to "pipeline is running on Kaggle" is short enough that people don't abandon the flow while waiting on setup.
- A meaningful share of pipelines are built from published templates rather than from scratch — signals the template system is actually useful, not decorative.
- Published templates get forked/reused, not just viewed once.

## 9. Open questions (carried into `memory.md` as they resolve)
- True cyclic edges in the canvas vs. a single "Loop" container node — tradeoff between visual fidelity to what you described and implementation/codegen complexity. Flagged in detail in `Architecture.md` and `design.md`.
- How much of the beginner "no-code" experience is a separate mode vs. just a locked/pre-filled version of the same canvas.
- Template moderation approach once publishing is public.
