import os
import json
import sys

# Setup clean configuration directory to bypass user config caching
backend_dir = os.path.dirname(os.path.abspath(__file__))
empty_config_dir = os.path.join(backend_dir, "runs", "empty_config")
os.makedirs(empty_config_dir, exist_ok=True)
os.environ["KAGGLE_CONFIG_DIR"] = empty_config_dir

# Set dummy credentials so importing kaggle doesn't crash if no global credentials exist
if "KAGGLE_USERNAME" not in os.environ:
    os.environ["KAGGLE_USERNAME"] = "dummy"
if "KAGGLE_KEY" not in os.environ:
    os.environ["KAGGLE_KEY"] = "dummy"

import kaggle
import kagglesdk.kaggle_client

# Dynamically patch submodules to fix AttributeErrors in the legacy kaggle package client
client = kagglesdk.kaggle_client.KaggleClient()
if not hasattr(kaggle, 'kernels'):
    kaggle.kernels = client.kernels
if not hasattr(kaggle, 'datasets'):
    kaggle.datasets = client.datasets
if not hasattr(kaggle, 'models'):
    kaggle.models = client.models
if not hasattr(kaggle, 'competitions'):
    kaggle.competitions = client.competitions
if not hasattr(kaggle, 'blobs'):
    kaggle.blobs = client.blobs

from kaggle.api.kaggle_api_extended import KaggleApi


def get_run_dir(run_id: str) -> str:
    base_dir = os.path.dirname(os.path.abspath(__file__))
    run_dir = os.path.join(base_dir, "runs", run_id)
    os.makedirs(run_dir, exist_ok=True)
    return run_dir

def push_kernel(run_id: str, notebook_json: str, username: str, api_key: str) -> dict:
    os.environ["KAGGLE_USERNAME"] = username
    os.environ["KAGGLE_KEY"] = api_key
    
    api = KaggleApi()
    api.authenticate()
    
    run_dir = get_run_dir(run_id)
    
    # Save notebook.ipynb
    notebook_path = os.path.join(run_dir, "notebook.ipynb")
    with open(notebook_path, "w", encoding="utf-8") as f:
        f.write(notebook_json)
        
    kernel_slug = f"wiseblockforge-run-{run_id}".lower()
    cleaned_slug = "".join(c if c.isalnum() or c == "-" else "-" for c in kernel_slug)
    
    # Look for dataset references in notebook json to mount them
    dataset_sources = []
    import re
    # Match strings like dataset_ref = 'username/dataset-slug' inside the JSON cells
    matches = re.findall(r"dataset_ref\s*=\s*['\"]([^'\"]+/[^'\"]+)['\"]", notebook_json)
    for m in matches:
        if m not in dataset_sources:
            dataset_sources.append(m)

    metadata = {
        "id": f"{username}/{cleaned_slug}",
        "title": f"WiseBlockForge Run {run_id}",
        "code_file": "notebook.ipynb",
        "language": "python",
        "kernel_type": "notebook",
        "is_private": True,
        "enable_gpu": False,
        "enable_internet": True,
        "dataset_sources": dataset_sources,
        "competition_sources": [],
        "kernel_sources": []
    }
    
    metadata_path = os.path.join(run_dir, "kernel-metadata.json")
    with open(metadata_path, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)
        
    response = api.kernels_push(run_dir)
    
    return {
        "status": "success",
        "kernel": f"{username}/{cleaned_slug}",
        "url": response.url,
        "error": response.error if hasattr(response, "error") else None
    }

def get_kernel_status(run_id: str, username: str, api_key: str) -> dict:
    os.environ["KAGGLE_USERNAME"] = username
    os.environ["KAGGLE_KEY"] = api_key
    
    api = KaggleApi()
    api.authenticate()
    
    kernel_slug = f"wiseblockforge-run-{run_id}".lower()
    cleaned_slug = "".join(c if c.isalnum() or c == "-" else "-" for c in kernel_slug)
    kernel_id = f"{username}/{cleaned_slug}"
    
    try:
        response = api.kernels_status(kernel_id)
        return {
            "status": response.status,
            "failure_message": response.failure_message
        }
    except Exception as e:
        return {
            "status": "error",
            "failure_message": str(e)
        }

def get_kernel_output(run_id: str, username: str, api_key: str) -> dict:
    os.environ["KAGGLE_USERNAME"] = username
    os.environ["KAGGLE_KEY"] = api_key
    
    api = KaggleApi()
    api.authenticate()
    
    kernel_slug = f"wiseblockforge-run-{run_id}".lower()
    cleaned_slug = "".join(c if c.isalnum() or c == "-" else "-" for c in kernel_slug)
    kernel_id = f"{username}/{cleaned_slug}"
    
    run_dir = get_run_dir(run_id)
    output_dir = os.path.join(run_dir, "output")
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        outfiles, token = api.kernels_output(kernel_id, output_dir)
        
        # Robust discovery of any file ending in .log
        logs = ""
        log_file = None
        for filename in os.listdir(output_dir):
            if filename.endswith(".log"):
                log_file = os.path.join(output_dir, filename)
                break
                
        if log_file and os.path.exists(log_file):
            with open(log_file, "r", encoding="utf-8") as f:
                logs = f.read()
                
        files = []
        for root, _, filenames in os.walk(output_dir):
            for filename in filenames:
                if not filename.endswith(".log"):
                    files.append(filename)
                    
        return {
            "status": "success",
            "logs": logs,
            "files": files
        }
    except Exception as e:
        return {
            "status": "error",
            "error_message": str(e)
        }

def stop_kernel(run_id: str, username: str, api_key: str) -> dict:
    os.environ["KAGGLE_USERNAME"] = username
    os.environ["KAGGLE_KEY"] = api_key
    
    api = KaggleApi()
    api.authenticate()
    
    kernel_slug = f"wiseblockforge-run-{run_id}".lower()
    cleaned_slug = "".join(c if c.isalnum() or c == "-" else "-" for c in kernel_slug)
    kernel_id = f"{username}/{cleaned_slug}"
    
    try:
        api.kernels_delete(kernel_id, no_confirm=True)
        return {
            "status": "success",
            "message": f"Successfully cancelled kernel run {run_id} on Kaggle."
        }
    except Exception as e:
        return {
            "status": "error",
            "error_message": str(e)
        }

