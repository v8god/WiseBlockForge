# Rules.md

Standing rules for the project. Anything here overrides ad-hoc decisions made while building a specific feature — if a feature seems to need breaking one of these, that's a sign to revisit the rule deliberately (and log it in `memory.md`), not to quietly ignore it.

## 1. No black boxes
Every pipeline the user builds must be visible and exportable as real code, at every point.
- The "view generated code" toggle is not optional and not a v2 feature — it exists from the first working version of the canvas.
- Generated `.ipynb` files must be readable by a human and openable directly in Kaggle's own UI, independent of our app. A user must be able to leave the platform entirely with a working notebook.
- No node's behavior should be undiscoverable from its generated code. If a node does something "magic" behind the scenes, its generated code has to show what that magic actually is.

## 2. Execution boundary — never run learner code on our infrastructure
This is a safety property of the architecture, not just a cost-saving choice, and it should stay true even as features get added:
- **Kaggle path**: all training/inference code — including anything typed into a custom code node — executes inside the *user's own* Kaggle kernel, under the *user's own* linked account. It never touches our servers.
- **Client-side path**: all training/inference code executes in the *user's own browser*. Same principle.
- Our backend's job is to **orchestrate** (generate code, push it, poll it, relay progress) — never to **execute** arbitrary user-authored code itself. If a future feature seems to require running user code server-side, that's a rule violation and needs an explicit decision logged in `memory.md`, not a quiet exception.

## 3. Credentials
- A user's Kaggle API key is sensitive — store it encrypted at rest, never log it, never include it in error messages or analytics events.
- Never transmit a user's Kaggle key to any client other than the direct request that needs it.
- The relay service (live progress, `Architecture.md` §5) should authenticate incoming progress posts (e.g. a per-run token embedded in the generated code) so one user can't spoof another user's live progress feed.

## 4. Templates
- A published template must not be able to leak a user's Kaggle credentials, private dataset references, or any personal data — strip/validate before anything goes public.
- Publishing is a deliberate action (never default-public), and unpublishing must be possible at any time.
- v1 moderation is "report + manual review," not automated — don't over-build trust & safety before there's a user base to justify it (`PRD.md` §4).

## 5. Code generation
- Generated code should look like code a competent human would write by hand — readable variable names, no unnecessary indirection, no dead code from unused node configs.
- A given node type must always generate the same *shape* of code for the same inputs — no hidden randomness or environment-dependent output, or debugging a pipeline becomes guesswork.
- Custom code nodes are inserted verbatim and are the one place this rule doesn't apply — that's expected and fine, it's the user's own code.

## 6. Node design conventions
- Every node has a clear input/output type (data, model, optimizer, metric, etc.) — connections between incompatible types should be prevented at the canvas level, not caught later at codegen or run time.
- Every node ships with a short human-readable description visible in the UI — part of the "no black boxes" principle, and essential for the no-code beginner path (`PRD.md` §6).
- New node types get added when real pipelines need them (`Architecture.md` §2, "grow the library over time"), not spec'd out exhaustively in advance.

## 7. Loop safety
No loop — `for`, `while`, or any type added later — can run without an explicit, non-empty exit condition. This is a hard validation error that blocks the Run action, not a warning, and it's uniform across loop types (`Architecture.md` §9c). Don't let a future loop type ship without this check just because it's new.

## 8. Decisions and changes
- Any decision that reverses or meaningfully narrows something in `PRD.md` or `Architecture.md` gets a line in `memory.md` when it happens — not batched up later from memory.
- These docs (`PRD.md`, `Architecture.md`, `Rules.md`, `phases.md`, `design.md`) are living documents. Editing them as understanding improves is expected and encouraged — `memory.md` is where the *history* of those edits lives, not these files.
