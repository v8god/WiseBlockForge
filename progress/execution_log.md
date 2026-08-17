# WiseBlockForge Execution Log

This log records every modification, addition, and resolved error during the implementation of the authentication, datasets, and canvas UI integration phases.

---

## [2026-08-16 02:15] Phase 1 Integration Start
- **Added**: [progress/google_auth_instructions.md](file:///e:/ML-Learning_Platform/progress/google_auth_instructions.md) - Exact instructions on how to get Google Client Credentials.
- **Added**: [progress/execution_log.md](file:///e:/ML-Learning_Platform/progress/execution_log.md) - This log file to record development progress.

## [2026-08-16 02:20] Backend Auth and Datasets Integration Complete
- **Created**: `backend/database.py` with SQLite schema for `users`, `workflows`, and `sessions`. Added SHA256-PBKDF2 password verification and profile methods.
- **Modified**: `backend/main.py` with endpoints for registration, password login, Google Sign-in tokeninfo verification, profile lookup, Kaggle credentials linking, workflow CRUD operations, and Kaggle datasets search API.
- **Modified**: `backend/codegen.py` to support dynamic templates for MNIST, Titanic, Iris, and custom Kaggle reference paths, and compile `start_node` circular blocks.
- **Modified**: `backend/kaggle_orchestrator.py` to parse `dataset_ref = '...'` from notebooks and auto-mount them in the Kaggle run runtime.

## [2026-08-16 02:30] Frontend Compilation, Types Fixes, and Server Verification
- **Modified**: `frontend/src/App.tsx`
  - Fixed TypeScript compiler errors where `window.google` was missing typing by casting it to `(window as any).google`.
  - Typed the `useEdgesState` Hook with `<any>` to prevent compilation issues with `never[]` array inferences.
  - Correctly registered the `edgeTypes` property on the `<ReactFlow />` component mapping `'interactive'` to our custom interactive hover edge `InteractiveEdge`.
  - Removed unused variable declarations (destructured arguments from components like `id` in `StartNode`) to prevent compiling issues under strict lint rules.
  - Cast `newNode.data` to `any` to prevent index access issues on React Flow's node `unknown` data type.
  - Cleaned up duplicate code blocks in `App.tsx` to maintain file health and structure.
- **Verified**:
  - Run `npm.cmd run build` on the frontend directory, compiling all packages successfully with Vite and producing distribution chunks.
  - Run syntax and module import checks on the backend directory via Python virtual environment, resolving all import and initialization assertions.

## [2026-08-16 04:05] Phase 2 Custom Features, Layout Overhaul, and Verification
- **Modified**: `backend/main.py`
  - Fixed Kaggle validation failure by removing invalid `page_size` parameter from `api.dataset_list()`.
  - Fixed dataset search results parsing.
  - Added a backend configuration route `/api/auth/google/client-id` that serves `GOOGLE_CLIENT_ID` from the environment.
- **Modified**: `frontend/src/App.tsx`
  - Fetched the Google Client ID on startup from the backend, removing key inputs from login screens.
  - Added `autoComplete="off"` and `autoComplete="new-password"` to settings fields to prevent browser auto-fill issues.
  - Exposed the `'in'` input handle on the `data_input` block so it physically connects to the `start_node` trigger.
  - Added a small click-to-delete "✕" button directly onto visual blocks, and a matching delete node action inside the sidebar properties.
  - Placed a query search filter input at the top of the presets palette, and styled it with a `max-h-56` scroll container.
  - Overhauled File & Run menus to be persistent on click, automatically closing only on action triggers or canvas clicks.
  - Added a consecutive error check to the remote execution status poller, resetting the run button if a connection fails.
  - Redesigned the Double-click Inspector popup modal into a premium three-column layout (Left: parameters, Center: script, Right: logs / specific node outputs).
  - Swapped the header generic emoji with the brand logo `logo.png` served from public directory.
- **Added**:
  - `logo.png` under `frontend/public/logo.png` copied from brand asset file.
  - `.env` in the root workspace to specify `GOOGLE_CLIENT_ID` and Kaggle API variables.


