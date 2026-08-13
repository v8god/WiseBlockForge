import os
import time
from dotenv import load_dotenv
import codegen
import kaggle_orchestrator

def main():
    # Load .env file from project root
    base_dir = os.path.dirname(os.path.abspath(__file__))
    dotenv_path = os.path.join(base_dir, "..", ".env")
    load_dotenv(dotenv_path)

    username = os.environ.get("KAGGLE_USERNAME")
    key = os.environ.get("KAGGLE_KEY")

    if not username or not key:
        print("[-] Error: KAGGLE_USERNAME or KAGGLE_KEY not found in .env file.")
        print("Please copy .env.example to .env and configure it with your credentials.")
        return

    print(f"[+] Loaded credentials for user: {username}")

    # Define a simple dummy graph: Data Input -> Model Training -> Evaluation
    graph = {
        "nodes": [
            {
                "id": "data_input_1",
                "type": "data_input",
                "data": {"dataset": "MNIST"}
            },
            {
                "id": "model_training_1",
                "type": "model_training",
                "data": {"epochs": 1}
            },
            {
                "id": "evaluation_1",
                "type": "evaluation",
                "data": {}
            }
        ],
        "edges": [
            {
                "id": "e1",
                "source": "data_input_1",
                "target": "model_training_1"
            },
            {
                "id": "e2",
                "source": "model_training_1",
                "target": "evaluation_1"
            }
        ]
    }

    print("[+] Compiling visual graph to notebook JSON...")
    notebook_json = codegen.generate_notebook(graph)

    run_id = "testrun"
    print(f"[+] Pushing notebook to Kaggle as run_id: {run_id}...")
    try:
        push_res = kaggle_orchestrator.push_kernel(run_id, notebook_json, username, key)
        print(f"[+] Push result: {push_res}")
        
        # Start status polling loop
        print("[+] Polling status from Kaggle...")
        for i in range(10):  # Poll up to 10 times
            time.sleep(15)
            status_res = kaggle_orchestrator.get_kernel_status(run_id, username, key)
            print(f"[{i+1}/10] Status: {status_res['status']}")
            
            if status_res["status"] in ["complete", "error"]:
                break
                
        # Get output
        print("[+] Fetching output files and logs...")
        output_res = kaggle_orchestrator.get_kernel_output(run_id, username, key)
        print(f"[+] Output status: {output_res['status']}")
        if output_res["status"] == "success":
            print(f"[+] Output logs snippet:\n{output_res['logs'][:500]}")
            print(f"[+] Downloaded files: {output_res['files']}")
            
    except Exception as e:
        print(f"[-] Execution error: {e}")

if __name__ == "__main__":
    main()
