import os
import uuid
import requests
from typing import Optional, List
from fastapi import FastAPI, Header, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import zipfile
import csv

# Setup clean configuration directory to bypass user config caching
base_dir = os.path.dirname(os.path.abspath(__file__))
empty_config_dir = os.path.join(base_dir, "runs", "empty_config")
os.makedirs(empty_config_dir, exist_ok=True)
os.environ["KAGGLE_CONFIG_DIR"] = empty_config_dir

import codegen
import kaggle_orchestrator
import database


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

# Authentication Dependency
def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authentication token missing.")
    
    token = authorization
    if authorization.startswith("Bearer "):
        token = authorization.split("Bearer ")[1]
        
    user = database.get_user_by_session(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired session.")
    return user

# Pydantic Schemas
class RegisterRequest(BaseModel):
    username: str
    password: str

class LoginRequest(BaseModel):
    username: str
    password: str

class GoogleLoginRequest(BaseModel):
    credential: str

class KaggleCredentialsRequest(BaseModel):
    kaggle_username: str
    kaggle_key: str

class WorkflowSaveRequest(BaseModel):
    id: str
    name: str
    nodes: list
    edges: list
    isPinned: Optional[bool] = False
    isPublic: Optional[bool] = False
    lastSaved: Optional[str] = None

class RunRequest(BaseModel):
    graph: dict

def get_kaggle_credentials(
    x_kaggle_username: Optional[str] = None, 
    x_kaggle_key: Optional[str] = None,
    user: Optional[dict] = None
):
    username = x_kaggle_username
    key = x_kaggle_key
    
    # Check header first, then database, then environment fallback
    if not username or not key:
        if user and user.get("kaggle_username") and user.get("kaggle_key"):
            username = user["kaggle_username"]
            key = user["kaggle_key"]
            
    if not username or not key:
        username = os.environ.get("KAGGLE_USERNAME")
        key = os.environ.get("KAGGLE_KEY")
        
    if not username or not key:
        raise HTTPException(
            status_code=401,
            detail="Kaggle credentials missing. Configure them in settings."
        )
    return username, key

# Authentication Endpoints
@app.post("/api/auth/register")
async def register(req: RegisterRequest):
    user = database.register_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=400, detail="Username already exists")
    token = database.create_session(user["id"])
    return {"token": token, "username": user["username"]}

@app.post("/api/auth/login")
async def login(req: LoginRequest):
    user = database.authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = database.create_session(user["id"])
    return {"token": token, "username": user["username"]}

@app.post("/api/auth/google")
async def google_login(req: GoogleLoginRequest):
    # Verify Google credential token via Google API
    url = f"https://oauth2.googleapis.com/tokeninfo?id_token={req.credential}"
    try:
        res = requests.get(url, timeout=10)
        if res.status_code != 200:
            raise HTTPException(status_code=400, detail="Google token verification failed")
        
        payload = res.json()
        if "error_description" in payload:
            raise HTTPException(status_code=400, detail=payload["error_description"])
            
        google_id = payload.get("sub")
        email = payload.get("email")
        name = payload.get("name", "")
        
        if not google_id or not email:
            raise HTTPException(status_code=400, detail="Token payload incomplete")
            
        user_id = database.login_or_create_google_user(google_id, email, name)
        
        # Retrieve full username
        conn = database.get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT username FROM users WHERE id = ?", (user_id,))
        row = cursor.fetchone()
        conn.close()
        username = row["username"] if row else email.split("@")[0]
        
        token = database.create_session(user_id)
        return {"token": token, "username": username}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Google Login error: {str(e)}")

@app.get("/api/auth/google/client-id")
async def get_google_client_id():
    return {"client_id": os.environ.get("GOOGLE_CLIENT_ID", "")}

@app.post("/api/auth/logout")
async def logout(authorization: Optional[str] = Header(None)):
    if authorization:
        token = authorization
        if authorization.startswith("Bearer "):
            token = authorization.split("Bearer ")[1]
        database.logout_session(token)
    return {"status": "success"}

@app.get("/api/auth/profile")
async def get_profile(user: dict = Depends(get_current_user)):
    return {
        "username": user["username"],
        "email": user["email"],
        "kaggle_username": user["kaggle_username"],
        "kaggle_configured": bool(user["kaggle_username"] and user["kaggle_key"])
    }


@app.post("/api/auth/kaggle")
async def update_kaggle(req: KaggleCredentialsRequest, user: dict = Depends(get_current_user)):
    database.save_kaggle_credentials(user["id"], req.kaggle_username, req.kaggle_key)
    
    # Verify new credentials immediately against Kaggle API list datasets
    os.environ["KAGGLE_USERNAME"] = req.kaggle_username
    os.environ["KAGGLE_KEY"] = req.kaggle_key
    from kaggle.api.kaggle_api_extended import KaggleApi
    api = KaggleApi()
    try:
        api.authenticate()
        api.dataset_list(search="test-validation-key")
        verified = True
    except Exception:
        verified = False
        
    return {
        "status": "success",
        "verified": verified
    }

# Dataset Search Endpoint (Kaggle API integration)
@app.get("/api/datasets/search")
async def search_datasets(query: str, user: dict = Depends(get_current_user)):
    username, key = get_kaggle_credentials(user=user)
    os.environ["KAGGLE_USERNAME"] = username
    os.environ["KAGGLE_KEY"] = key
    
    from kaggle.api.kaggle_api_extended import KaggleApi
    api = KaggleApi()
    try:
        api.authenticate()
        datasets = api.dataset_list(search=query)
        result = []
        if datasets:
            for d in datasets[:8]:
                result.append({
                    "ref": d.ref,
                    "title": d.title,
                    "size": d.size,
                    "url": f"https://www.kaggle.com/{d.ref}"
                })
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kaggle API search failure: {str(e)}")

# Local Datasets Directory setup
DATASETS_DIR = os.path.join(base_dir, "datasets")
os.makedirs(DATASETS_DIR, exist_ok=True)

@app.post("/api/datasets/upload")
async def upload_dataset(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    file_path = os.path.join(DATASETS_DIR, file.filename)
    try:
        with open(file_path, "wb") as f:
            f.write(await file.read())
        
        # Get size
        size_bytes = os.path.getsize(file_path)
        if size_bytes >= 1024 * 1024:
            size_str = f"{size_bytes / (1024 * 1024):.2f} MB"
        elif size_bytes >= 1024:
            size_str = f"{size_bytes / 1024:.2f} KB"
        else:
            size_str = f"{size_bytes} B"
            
        return {
            "status": "success",
            "filename": file.filename,
            "size": size_str,
            "path": file_path
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload dataset: {str(e)}")

@app.get("/api/datasets/list")
async def list_datasets(user: dict = Depends(get_current_user)):
    try:
        files = []
        for filename in os.listdir(DATASETS_DIR):
            file_path = os.path.join(DATASETS_DIR, filename)
            if os.path.isfile(file_path):
                stat = os.stat(file_path)
                size_bytes = stat.st_size
                if size_bytes >= 1024 * 1024:
                    size_str = f"{size_bytes / (1024 * 1024):.2f} MB"
                elif size_bytes >= 1024:
                    size_str = f"{size_bytes / 1024:.2f} KB"
                else:
                    size_str = f"{size_bytes} B"
                
                # Try to guess type based on extension
                ext = os.path.splitext(filename)[1].lower()
                files.append({
                    "filename": filename,
                    "size": size_str,
                    "ext": ext,
                    "mtime": stat.st_mtime
                })
        # Sort by modification time desc
        files.sort(key=lambda x: x["mtime"], reverse=True)
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list datasets: {str(e)}")

@app.get("/api/datasets/preview")
async def preview_dataset(dataset_type: str, name: str, user: dict = Depends(get_current_user)):
    try:
        if dataset_type == "presets":
            if name == "Titanic":
                # Titanic dataset download URL
                url = "https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv"
                res = requests.get(url)
                if res.status_code == 200:
                    lines = res.text.split("\n")
                    reader = csv.reader(lines)
                    headers = next(reader)
                    rows = []
                    for i, row in enumerate(reader):
                        if i >= 5:
                            break
                        if row:
                            rows.append(row)
                    return {"format": "csv", "headers": headers, "rows": rows}
                else:
                    raise HTTPException(status_code=400, detail="Failed to fetch Titanic dataset")
            elif name == "Iris":
                url = "https://raw.githubusercontent.com/mwaskom/seaborn-data/master/iris.csv"
                res = requests.get(url)
                if res.status_code == 200:
                    lines = res.text.split("\n")
                    reader = csv.reader(lines)
                    headers = next(reader)
                    rows = []
                    for i, row in enumerate(reader):
                        if i >= 5:
                            break
                        if row:
                            rows.append(row)
                    return {"format": "csv", "headers": headers, "rows": rows}
                else:
                    raise HTTPException(status_code=400, detail="Failed to fetch Iris dataset")
            elif name == "MNIST":
                # Represent MNIST tabular metadata
                return {
                    "format": "mnist",
                    "headers": ["Pixel Index", "Min Value", "Max Value", "Channels", "Classes"],
                    "rows": [
                        ["0 to 783", "0.0 (Black)", "1.0 (White)", "1 (Grayscale)", "10 (Digits 0-9)"],
                        ["Dataset Split", "Train Size", "Test Size", "Resolution", "Framework Target"],
                        ["Official", "60,000", "10,000", "28x28 pixels", "torchvision.datasets.MNIST"]
                    ]
                }
            else:
                return {"format": "other", "detail": f"Preset dataset {name} has no preview available."}

        elif dataset_type == "uploaded":
            file_path = os.path.join(DATASETS_DIR, name)
            if not os.path.exists(file_path):
                raise HTTPException(status_code=404, detail="Uploaded file not found")
            
            ext = os.path.splitext(name)[1].lower()
            if ext == ".csv":
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    reader = csv.reader(f)
                    try:
                        headers = next(reader)
                    except StopIteration:
                        return {"format": "csv", "headers": [], "rows": []}
                    rows = []
                    for i, row in enumerate(reader):
                        if i >= 5:
                            break
                        rows.append(row)
                return {"format": "csv", "headers": headers, "rows": rows}
            elif ext == ".json":
                with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read(1000) # Read first 1000 chars for preview snippet
                return {"format": "json", "content": content}
            elif ext == ".zip":
                # List first 10 archive members using zipfile
                try:
                    with zipfile.ZipFile(file_path, "r") as z:
                        namelist = z.namelist()[:10]
                        total_files = len(z.namelist())
                    return {"format": "zip", "files": namelist, "total_files": total_files}
                except Exception as e:
                    return {"format": "zip", "error": f"Failed to open zip archive: {str(e)}"}
            else:
                # Other format, return file metadata
                stat = os.stat(file_path)
                return {
                    "format": "other",
                    "filename": name,
                    "size_bytes": stat.st_size,
                    "last_modified": stat.st_mtime
                }
        else:
            return {"format": "other", "detail": f"Dataset type {dataset_type} has no preview parser available."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview generator failed: {str(e)}")


# Workflow Management Endpoints
@app.get("/api/workflows")
async def get_workflows(user: dict = Depends(get_current_user)):
    return database.get_user_workflows(user["id"])

@app.post("/api/workflows")
async def save_workflow(req: WorkflowSaveRequest, user: dict = Depends(get_current_user)):
    database.save_workflow(
        user["id"],
        req.id,
        req.name,
        req.nodes,
        req.edges,
        is_pinned=1 if req.isPinned else 0,
        is_public=1 if req.isPublic else 0,
        last_saved=req.lastSaved
    )
    return {"status": "success"}

@app.delete("/api/workflows/{wf_id}")
async def delete_workflow(wf_id: str, user: dict = Depends(get_current_user)):
    database.delete_workflow(user["id"], wf_id)
    return {"status": "success"}

@app.post("/api/workflows/{wf_id}/publish")
async def publish_workflow(wf_id: str, is_public: bool, user: dict = Depends(get_current_user)):
    database.publish_workflow(user["id"], wf_id, is_public)
    return {"status": "success"}

@app.get("/api/workflows/community")
async def get_community():
    return database.get_community_workflows()

# Remote Execution Orchestrator Endpoints (updated for authorization and db profile matching)
@app.post("/api/run")
async def run_pipeline(
    req: RunRequest,
    authorization: Optional[str] = Header(None),
    x_kaggle_username: Optional[str] = Header(None),
    x_kaggle_key: Optional[str] = Header(None)
):
    user = None
    if authorization:
        try:
            user = get_current_user(authorization)
        except Exception:
            pass
            
    username, key = get_kaggle_credentials(x_kaggle_username, x_kaggle_key, user)
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
    authorization: Optional[str] = Header(None),
    x_kaggle_username: Optional[str] = Header(None),
    x_kaggle_key: Optional[str] = Header(None)
):
    user = None
    if authorization:
        try:
            user = get_current_user(authorization)
        except Exception:
            pass
            
    username, key = get_kaggle_credentials(x_kaggle_username, x_kaggle_key, user)
    result = kaggle_orchestrator.get_kernel_status(run_id, username, key)
    return result

@app.get("/api/run/{run_id}/output")
async def get_run_output(
    run_id: str,
    authorization: Optional[str] = Header(None),
    x_kaggle_username: Optional[str] = Header(None),
    x_kaggle_key: Optional[str] = Header(None)
):
    user = None
    if authorization:
        try:
            user = get_current_user(authorization)
        except Exception:
            pass
            
    username, key = get_kaggle_credentials(x_kaggle_username, x_kaggle_key, user)
    result = kaggle_orchestrator.get_kernel_output(run_id, username, key)
    return result

@app.post("/api/run/{run_id}/stop")
async def stop_pipeline(
    run_id: str,
    authorization: Optional[str] = Header(None),
    x_kaggle_username: Optional[str] = Header(None),
    x_kaggle_key: Optional[str] = Header(None)
):
    user = None
    if authorization:
        try:
            user = get_current_user(authorization)
        except Exception:
            pass
            
    username, key = get_kaggle_credentials(x_kaggle_username, x_kaggle_key, user)
    result = kaggle_orchestrator.stop_kernel(run_id, username, key)
    return result

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

