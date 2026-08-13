# Progress Report — Phase 0: Spike / Foundations

**Project Name:** WiseBlockForge
**Tagline:** Visual Machine Learning Builder

---

## 1. What Exactly Was Done

### Project Branding & Core Setup
- Updated all kickoff documentation to reflect the new project name **WiseBlockForge** and the tagline **"Visual Machine Learning Builder"**.
- Created a `.env.example` file template in the root directory to guide credentials configuration.

### Frontend Canvas Implementation (Vite + React + TS + React Flow)
- Scaffolded a Vite React TypeScript application in the `frontend/` directory.
- Configured npm to use a default registry and successfully installed the dependency `@xyflow/react` (React Flow).
- Set up a premium UI theme in `frontend/src/index.css` supporting light and dark modes via theme tokens (CSS variables), complete with custom node styling (Blue for Data Input, Orange for Model Training, Teal for Evaluation/Metrics).
- Implemented node status overlays and glow effects for execution states:
  - **Running**: Pulsing orange background/shadow.
  - **Complete**: Glowing green box-shadow and status indicator dot.
  - **Error**: Glowing red box-shadow and status indicator dot.
- Developed `frontend/src/App.tsx` containing:
  - The React Flow workspace with zoom bounds (0.5 to 1.5) and panning bounds.
  - Controls, MiniMap, and Grid background.
  - Collapsible Kaggle API credential store linked to the browser's localStorage.
  - Compile & Run controls which send compiled graph JSON to the backend.
  - A polling mechanism that calls the backend status API every 5s and updates node execution states dynamically by parsing logs.
  - An interactive stdout console terminal window and code preview panel.

### Backend Orchestration Service (Python + FastAPI)
- Set up a Python virtual environment in `backend/` and installed `fastapi`, `uvicorn`, `kaggle`, `python-dotenv`, and `pydantic`.
- Developed `backend/codegen.py` which:
  - Reconstructs the canvas graph and sorts the nodes topologically.
  - Compiles the nodes into a human-readable Jupyter notebook (`.ipynb`) with PyTorch training loops (MNIST loading, CNN/MLP model compilation, training loops with epoch config, and test evaluation).
  - Instruments every cell block with custom stdout tags (`##NODE_START:<id>`, `##NODE_COMPLETE:<id>`, and `##NODE_ERROR:<id>`) so the frontend can track per-node execution status.
- Developed `backend/kaggle_orchestrator.py` which:
  - Generates the required `kernel-metadata.json` for Kaggle execution.
  - Authenticates dynamically with credentials provided by the request header or loaded from the root `.env` file.
  - Programmatically pushes notebooks to Kaggle as private kernels using the Kaggle Python SDK.
  - Retrieves remote execution status and logs after execution.
- Created the main API server `backend/main.py` with routes:
  - `POST /api/run`: Generates a notebook, packages it, pushes to Kaggle, and returns a unique `run_id`.
  - `GET /api/run/{run_id}/status`: Polls Kaggle API for kernel status (`queued`, `running`, `complete`, `error`).
  - `GET /api/run/{run_id}/output`: Pulls execution stdout logs and downloaded files.

### Integration Testing & Verification
- Created `backend/test_kaggle_push.py`, an end-to-end Python script that loads `.env` credentials, creates a dummy graph, generates the notebook, pushes to Kaggle, polls the status, and retrieves the output.

---

## 2. What Was Left

- **Automated Verification:** The end-to-end verification via `test_kaggle_push.py` and frontend run action requires actual Kaggle credentials to connect and authenticate successfully. Once you configure your credentials, this can be run immediately.

---

## 3. What Is to Be Done Next

- **Phase 1: Core canvas, linear pipelines, client-side only**
  - Integrate TensorFlow.js / ONNX Runtime Web for local client-side execution (instant feedback, no Kaggle account required).
  - Add more functional preprocessing and model nodes (CNN, data augmentations).
  - Build notes and annotations canvas elements.

---

## 4. All Commands Used in the Process

### Project Setup
Create folders:
```powershell
New-Item -ItemType Directory -Force -Path e:\ML-Learning_Platform\frontend
New-Item -ItemType Directory -Force -Path e:\ML-Learning_Platform\backend
```

### Frontend Setup & Installation
```cmd
cd e:\ML-Learning_Platform\frontend
npx -y create-vite@latest ./ --template react-ts --no-interactive
npm config set registry https://registry.npmjs.org
npm install
npm install @xyflow/react
```

### Backend Virtual Environment & Installation
```powershell
cd e:\ML-Learning_Platform\backend
python -m venv .venv
.\.venv\Scripts\pip.exe install fastapi uvicorn kaggle python-dotenv pydantic
```

### Verification Scripts
To test the Vite build compiles successfully:
```cmd
cd e:\ML-Learning_Platform\frontend
npm run build
```

To run the Kaggle push test script (after configuring credentials in `.env`):
```powershell
cd e:\ML-Learning_Platform\backend
.\.venv\Scripts\python.exe test_kaggle_push.py
```

### Commands to Run the Project Local Servers

#### Start Backend API Server
Open a terminal prompt and run:
```powershell
cd e:\ML-Learning_Platform\backend
.\.venv\Scripts\uvicorn.exe main:app --reload --port 8000
```
This starts the backend API on `http://localhost:8000`. You can inspect the interactive docs at `http://localhost:8000/docs`.

#### Start Frontend Web Server
Open another terminal prompt and run:
```cmd
cd e:\ML-Learning_Platform\frontend
npm run dev
```
This runs the frontend dev server, typically available at `http://localhost:5173`.
