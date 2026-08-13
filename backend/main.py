import os
import uuid
from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

import codegen
import kaggle_orchestrator

# Load .env file from project root
base_dir = os.path.dirname(os.path.abspath(__file__))
dotenv_path = os.path.join(base_dir, "..", ".env")
load_dotenv(dotenv_path)

app = FastAPI(title="WiseBlockForge API", description="Visual Machine Learning Builder API")

# Add CORS Middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RunRequest(BaseModel):
    graph: dict

def get_kaggle_credentials(x_kaggle_username: str = None, x_kaggle_key: str = None):
    username = x_kaggle_username or os.environ.get("KAGGLE_USERNAME")
    key = x_kaggle_key or os.environ.get("KAGGLE_KEY")
    
    if not username or not key:
        raise HTTPException(
            status_code=401,
            detail="Kaggle credentials missing. Link your account or configure .env."
        )
    return username, key

@app.post("/api/run")
async def run_pipeline(
    req: RunRequest,
    x_kaggle_username: str = Header(None),
    x_kaggle_key: str = Header(None)
):
    username, key = get_kaggle_credentials(x_kaggle_username, x_kaggle_key)
    run_id = str(uuid.uuid4())[:8]
    
    try:
        notebook_json = codegen.generate_notebook(req.graph)
        result = kaggle_orchestrator.push_kernel(run_id, notebook_json, username, key)
        
        return {
            "run_id": run_id,
            "status": "queued",
            "kernel": result["kernel"],
            "url": result["url"]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/run/{run_id}/status")
async def get_run_status(
    run_id: str,
    x_kaggle_username: str = Header(None),
    x_kaggle_key: str = Header(None)
):
    username, key = get_kaggle_credentials(x_kaggle_username, x_kaggle_key)
    result = kaggle_orchestrator.get_kernel_status(run_id, username, key)
    return result

@app.get("/api/run/{run_id}/output")
async def get_run_output(
    run_id: str,
    x_kaggle_username: str = Header(None),
    x_kaggle_key: str = Header(None)
):
    username, key = get_kaggle_credentials(x_kaggle_username, x_kaggle_key)
    result = kaggle_orchestrator.get_kernel_output(run_id, username, key)
    return result

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}
