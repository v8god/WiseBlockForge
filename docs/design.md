# design.md

## 1. Design principles
- **Progressive disclosure, not hidden power.** A beginner should never feel the tool is more complex than what they're looking at; an advanced user should never feel capped by it. Advanced options live behind a collapse/expand, not behind a locked door.
- **Nothing is a black box** (`Rules.md` §1) — the "view generated code" toggle should be visually reachable from anywhere in the run/edit experience, not buried in a menu.
- **The canvas is the product.** Even the no-code/template mode (`phases.md` Phase 7) is a front door to the canvas, not a separate UI language — keep visual consistency between them so "unlocking" a template doesn't feel like switching apps.

## 2. Canvas
- Infinite pan/zoom canvas (React Flow gives this for free), minimap in a corner for larger graphs.
- Nodes are color-coded by category, consistently across the whole app (this list is a starting proposal):
  - Data input / output — blue
  - Preprocessing — cyan
  - Model architecture — purple
  - Optimizer / loss — indigo
  - Training loop — orange
  - Evaluation / metrics — teal
  - Visualization — green
  - Custom code — dark gray (visually distinct on purpose — see below)
  - Loop / branch — amber
- Each node shows: a title, a short one-line description, its config fields (inline for simple ones, in a side panel for anything with more than ~3 fields), and clearly marked input/output ports typed by category (data, model, optimizer, metric, etc.) so an invalid connection is visibly rejected at the canvas level (`Rules.md` §6), not discovered later as an error.
- **Custom code node** is deliberately styled differently from every other node (e.g. monospace font, darker background, a small "your code" badge) — the point is a learner should never mistake generated code for their own, or vice versa, when scanning a graph.

## 3. Loop / branch visual treatment
Depends on the decision in `Architecture.md` §7 (still open):
- **If a Loop container node (recommended default)**: render it as a node with a visibly different border (e.g. dashed) that can be expanded to reveal a small nested canvas inside it — the "inside" of the loop. Repeat condition and exit condition are config fields on the container itself, always visible without expanding.
- **If literal cyclic edges**: the back-edge needs a distinct visual treatment from a normal edge (e.g. dashed, a different color, routed with a visible curve so it doesn't read as a layout accident) plus an explicit exit-condition marker sitting on the edge itself, not buried in a node's config panel.
Whichever is chosen, the loop must be visually unambiguous at a glance — a learner scanning the graph should immediately know "this part repeats," not have to click in to find out.

## 4. Dataset picker
A modal reachable from any data-input node:
- Two tabs: **Search Kaggle** (search box + tag/license filters, results as a scrollable list with dataset name, size, short description) and **Upload your own** (drag-and-drop, with a plain-language note that it'll be turned into a private Kaggle dataset behind the scenes — no need to explain the mechanism, just that it happens).
- Once attached, the data-input node on the canvas shows the chosen dataset's name directly on the node — no need to reopen the modal to confirm what's attached.

## 5. Run panel
Persistent panel (side or bottom) once a run starts:
- **Connection status**: is a Kaggle account linked? (If not, this is where the linking prompt lives — not a separate settings page the user has to go find first.)
- **Execution state**, shown as a simple progression, not just a spinner: `Queued → Running → Complete` (or `Error`, styled distinctly, e.g. red).
- **Live output tabs** once running (`Architecture.md` §5): a live-updating loss/metric chart, a scrolling log/print-output pane, and a plots/artifacts tab that fills in as the run produces them.
- On completion: final metrics front and center, with generated plots/artifacts below, and a clear "download notebook" / "download output" action — reinforcing that nothing is trapped in the app (`Rules.md` §1).

## 6. Template gallery
- Grid or list of published templates: preview image (auto-generated from the graph layout, or the last run's visualization output, is a nice v2 touch — not required for v1), name, short description, category tag, and a "Load" action.
- Search/filter by category (mirrors the seed list in `phases.md`) and by difficulty (beginner/intermediate), so a first-time user isn't scrolling past advanced NLP templates looking for "cats vs dogs."
- A template's detail view should show the same "view generated code" toggle as any pipeline — someone deciding whether to load a template should be able to inspect it first, not just trust a description.

## 7. No-code / beginner mode
- Presented as a simple picker, not a stripped-down canvas — this should feel like choosing an app, not opening a limited version of one.
- Each option: name, one-line description in plain language ("teach a computer to tell cats from dogs"), a dataset-attach step, and a single prominent "Train it" action.
- The "unlock" action (reveal the underlying canvas) should be visible but secondary — present for the curious, not pushed on someone who just wants the result.

## 8. Accessibility and general UI notes
- Node color-coding should not be the *only* signal for category — pair it with icons/labels, since color alone excludes colorblind users.
- Every async state (queued, running, live progress, complete, error) needs a text label, not just a color or icon — this matters doubly for screen readers and for anyone glancing at the screen without full attention.
- Keep the visual language between the full canvas and the beginner picker consistent (same colors, same iconography) so moving between them, in either direction, doesn't feel like a context switch.

## 9. Theming — light and dark mode
- A single, easily reachable toggle (top bar, persists across sessions) switches the whole app between light and dark — canvas background, node colors, run panel, template gallery, everything at once, not per-screen.
- Build this on theme tokens (CSS variables) from the start, not hardcoded colors per component — retrofitting dark mode after the fact means touching every node and panel twice. Decide this convention before Phase 1's canvas work starts (`phases.md` Phase 1).
- Node category colors (§2) are a light/dark pair per category, not one fixed color, so the coding stays legible in both themes.
- Default to the user's OS/browser preference on first load; the manual toggle always overrides it.

## 10. Node execution states — live visual feedback
Tied to the per-node status signal in `Architecture.md` §5a:
- **Running**: an animated line traces around the node's border while it's actively executing — a continuous "this one, right now" signal, distinct from the run panel's overall queued/running state (§5 above), which is about the whole run, not a single node.
- **Complete**: a soft green glow behind the node once it finishes successfully, fading in and staying until the next run starts — not a flash that's easy to miss.
- **Error**: the same glow treatment in red, plus the node's short error message surfacing directly on the node itself, not only in the run panel's log — someone scanning the canvas should be able to spot the failed node without hunting through logs.
- These three states apply to every node type, including custom code nodes and loop containers — the visual language doesn't change based on what's inside the node.
- On the client-side path these update in true real time (same tab, same process). On the Kaggle path they arrive over the relay channel (`Architecture.md` §5a) — same visual result, different plumbing underneath, and that difference should be invisible to the user.

## 11. Canvas interaction
- Nodes: freely draggable anywhere on the canvas.
- Canvas: pannable and zoomable, but **bounded**, not infinite in every direction — a generous but finite pan extent around the graph's actual content, with min/max zoom limits (can't zoom out until the graph is unreadable dots, can't zoom in until a node's text overflows its own border). Exact bounds are a Phase 1 tuning detail, not something to lock down here.
- Pan and zoom come largely free from React Flow — the real work is picking sane limits and making sure the theming (§9) and node glow states (§10) still read clearly at the extremes of zoom.

## 12. Notes and annotations
- A distinct, non-executing canvas element (`Architecture.md` §9a) — visually different from every functional node (no ports, no run status, just a text area) so it's never mistaken for something that affects the pipeline.
- Freely placeable and resizable anywhere on the canvas, like any node.
- Supports grouping: a note can be associated with a specific set of nodes (drawn as a bounding region behind them, or an explicit "attached nodes" list on the note itself) so a learner or template author can label "this part of the pipeline does X" without it being mistaken for a functional loop/group container (`Architecture.md` §7 — keep these visually distinct even though both "group" nodes).
- Notes travel with a template when it's saved or published (§6) — a well-annotated public template is more useful to someone forking it than a bare graph.
