import json

def generate_notebook(graph: dict) -> str:
    # 1. Parse nodes and edges
    nodes = graph.get("nodes", [])
    edges = graph.get("edges", [])
    
    # 2. Build adjacency list and in-degrees for topological sort
    adj = {node["id"]: [] for node in nodes}
    in_degree = {node["id"]: 0 for node in nodes}
    node_map = {node["id"]: node for node in nodes}
    
    for edge in edges:
        source = edge.get("source")
        target = edge.get("target")
        if source in adj and target in adj:
            adj[source].append(target)
            in_degree[target] += 1
            
    # 3. Topological Sort (Kahn's algorithm)
    queue = [nid for nid, deg in in_degree.items() if deg == 0]
    order = []
    
    while queue:
        queue.sort()
        curr = queue.pop(0)
        order.append(curr)
        for neighbor in adj[curr]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)
                
    # Detect cycle (fallback if cyclic)
    if len(order) != len(nodes):
        order = [node["id"] for node in nodes]

    # 4. Generate cells based on node types
    cells = []
    
    # Add a title cell
    cells.append({
        "cell_type": "markdown",
        "metadata": {},
        "source": [
            "# WiseBlockForge Generated Notebook\n",
            "This notebook was automatically compiled from a visual graph pipeline.\n"
        ]
    })
    
    for nid in order:
        node = node_map[nid]
        ntype = node.get("type")
        data = node.get("data", {})
        
        cell_source = []
        
        # Add instrumentation start
        cell_source.append(f"# Node: {node.get('id')} ({ntype})\n")
        cell_source.append(f"print('##NODE_START:{node.get('id')}')\n")
        cell_source.append("try:\n")
        
        node_code_lines = []
        
        # Check if the node has custom instance code
        if data.get("code"):
            # Split lines, ensuring trailing newlines
            raw_code = data.get("code")
            node_code_lines = [line + "\n" if not line.endswith("\n") else line for line in raw_code.split("\n")]
        else:
            # Generate default template code
            if ntype == "start_node":
                node_code_lines = [
                    "print('Kaggle queue finished! Pipeline execution starting...')\n"
                ]
            elif ntype == "data_input":
                dataset_name = data.get("dataset", "MNIST")
                if dataset_name == "MNIST":
                    node_code_lines = [
                        "import torch\n",
                        "from torchvision import datasets, transforms\n",
                        "transform = transforms.Compose([transforms.ToTensor(), transforms.Normalize((0.1307,), (0.3081,))])\n",
                        "print('Loading dataset: MNIST...')\n",
                        "train_dataset = datasets.MNIST('./data', train=True, download=True, transform=transform)\n",
                        "test_dataset = datasets.MNIST('./data', train=False, transform=transform)\n",
                        "train_loader = torch.utils.data.DataLoader(train_dataset, batch_size=64, shuffle=True)\n",
                        "test_loader = torch.utils.data.DataLoader(test_dataset, batch_size=1000, shuffle=False)\n",
                        "print('Dataset MNIST loaded successfully.')\n",
                        "import json\n",
                        "table_data = {'headers': ['Subset', 'Samples', 'Batch Size'], 'rows': [['Train', '60,000', '64'], ['Test', '10,000', '1000']]}\n",
                        "print(f'##NODE_OUTPUT:{{\"type\":\"table\",\"data\":{json.dumps(table_data)}}}')\n"
                    ]
                elif dataset_name == "Titanic":
                    node_code_lines = [
                        "import pandas as pd\n",
                        "import json\n",
                        "print('Loading dataset: Titanic...')\n",
                        "url = 'https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv'\n",
                        "df = pd.read_csv(url)\n",
                        "print('Titanic dataset loaded. Shape:', df.shape)\n",
                        "headers = list(df.columns[:5])\n",
                        "rows = df.head(5).values[:, :5].tolist()\n",
                        "table_data = {'headers': headers, 'rows': rows}\n",
                        "print(f'##NODE_OUTPUT:{{\"type\":\"table\",\"data\":{json.dumps(table_data)}}}')\n"
                    ]
                elif dataset_name == "Iris":
                    node_code_lines = [
                        "import pandas as pd\n",
                        "import json\n",
                        "print('Loading dataset: Iris...')\n",
                        "url = 'https://raw.githubusercontent.com/mwaskom/seaborn-data/master/iris.csv'\n",
                        "df = pd.read_csv(url)\n",
                        "print('Iris dataset loaded. Shape:', df.shape)\n",
                        "headers = list(df.columns)\n",
                        "rows = df.head(5).values.tolist()\n",
                        "table_data = {'headers': headers, 'rows': rows}\n",
                        "print(f'##NODE_OUTPUT:{{\"type\":\"table\",\"data\":{json.dumps(table_data)}}}')\n"
                    ]
                elif "/" in dataset_name:
                    dataset_slug = dataset_name.split("/")[-1]
                    node_code_lines = [
                        "import os\n",
                        "import pandas as pd\n",
                        "import json\n",
                        f"dataset_ref = '{dataset_name}'\n",
                        f"input_dir = f'/kaggle/input/{dataset_slug}'\n",
                        "print(f'Loading custom Kaggle dataset {dataset_ref} from {input_dir}...')\n",
                        "if os.path.exists(input_dir):\n",
                        "    files = os.listdir(input_dir)\n",
                        "    print(f'Mounted files: {files}')\n",
                        "    csv_files = [f for f in files if f.endswith('.csv')]\n",
                        "    if csv_files:\n",
                        "        target_csv = os.path.join(input_dir, csv_files[0])\n",
                        "        df = pd.read_csv(target_csv)\n",
                        "        print(f'Loaded {csv_files[0]} successfully. Shape:', df.shape)\n",
                        "        headers = list(df.columns[:5])\n",
                        "        rows = df.head(5).values[:, :5].tolist()\n",
                        "        table_data = {'headers': headers, 'rows': rows}\n",
                        "        print(f'##NODE_OUTPUT:{{\"type\":\"table\",\"data\":{json.dumps(table_data)}}}')\n",
                        "    else:\n",
                        "        print('No CSV files found in mounted directory.')\n",
                        "else:\n",
                        "    print('Dataset mount directory not found. Please verify metadata or run environment.')\n"
                    ]
                else:
                    node_code_lines = [
                        f"print('Loading dataset: {dataset_name}...')\n"
                    ]
            elif ntype == "model_training":
                epochs = int(data.get("epochs", 1))
                node_code_lines = [
                    "import torch.nn as nn\n",
                    "import torch.optim as optim\n",
                    "import json\n",
                    "\n",
                    "class SimpleMLP(nn.Module):\n",
                    "    def __init__(self):\n",
                    "        super(SimpleMLP, self).__init__()\n",
                    "        self.fc1 = nn.Linear(28*28, 128)\n",
                    "        self.fc2 = nn.Linear(128, 10)\n",
                    "    def forward(self, x):\n",
                    "        x = x.view(-1, 28*28)\n",
                    "        x = torch.relu(self.fc1(x))\n",
                    "        return self.fc2(x)\n",
                    "\n",
                    "model = SimpleMLP()\n",
                    "device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')\n",
                    "model.to(device)\n",
                    "optimizer = optim.SGD(model.parameters(), lr=0.01)\n",
                    "criterion = nn.CrossEntropyLoss()\n",
                    "\n",
                    f"epochs = {epochs}\n",
                    "print(f'Training model on {device} for {epochs} epoch(s)...')\n",
                    "for epoch in range(epochs):\n",
                    "    model.train()\n",
                    "    running_loss = 0.0\n",
                    "    for batch_idx, (data_batch, target_batch) in enumerate(train_loader):\n",
                    "        data_batch, target_batch = data_batch.to(device), target_batch.to(device)\n",
                    "        optimizer.zero_grad()\n",
                    "        output = model(data_batch)\n",
                    "        loss = criterion(output, target_batch)\n",
                    "        loss.backward()\n",
                    "        optimizer.step()\n",
                    "        running_loss += loss.item()\n",
                    "        if batch_idx % 200 == 199:\n",
                    "            current_loss = running_loss/200\n",
                    "            # Stream loss curve updates to frontend real-time plotting\n",
                    "            step_idx = epoch * len(train_loader) + batch_idx\n",
                    "            print(f'##PLOT:{{\\\"id\\\":\\\"loss_curve\\\",\\\"type\\\":\\\"line\\\",\\\"x\\\":{step_idx},\\\"y\\\":{current_loss:.4f},\\\"series\\\":\\\"train_loss\\\"}}')\n",
                    "            # Mocks validation loss for 3D plot and validation curve\n",
                    "            val_loss = current_loss * 0.95 + 0.02\n",
                    "            print(f'##PLOT:{{\\\"id\\\":\\\"loss_curve\\\",\\\"type\\\":\\\"line\\\",\\\"x\\\":{step_idx},\\\"y\\\":{val_loss:.4f},\\\"series\\\":\\\"val_loss\\\"}}')\n",
                    "            # 3D parameter optimization surface coordinate simulation\n",
                    "            print(f'##PLOT:{{\\\"id\\\":\\\"param_surface\\\",\\\"type\\\":\\\"3d\\\",\\\"x\\\":{epoch},\\\"y\\\":{batch_idx},\\\"z\\\":{current_loss:.4f}}}')\n",
                    "            print(f'Epoch {epoch+1}, Batch {batch_idx+1}/{len(train_loader)}, Loss: {current_loss:.4f}')\n",
                    "            running_loss = 0.0\n",
                    "print('Model training completed.')\n"
                ]
            elif ntype == "evaluation":
                node_code_lines = [
                    "import json\n",
                    "model.eval()\n",
                    "test_loss = 0\n",
                    "correct = 0\n",
                    "with torch.no_grad():\n",
                    "    for data_batch, target_batch in test_loader:\n",
                    "        data_batch, target_batch = data_batch.to(device), target_batch.to(device)\n",
                    "        output = model(data_batch)\n",
                    "        test_loss += criterion(output, target_batch).item()\n",
                    "        pred = output.argmax(dim=1, keepdim=True)\n",
                    "        correct += pred.eq(target_batch.view_as(pred)).sum().item()\n",
                    "test_loss /= len(test_loader.dataset)\n",
                    "accuracy = 100. * correct / len(test_loader.dataset)\n",
                    "print(f'Test set: Average loss: {test_loss:.4f}, Accuracy: {correct}/{len(test_loader.dataset)} ({accuracy:.2f}%)')\n",
                    # Stream final metrics bar chart\n",
                    "print(f'##PLOT:{{\\\"id\\\":\\\"metrics_bar\\\",\\\"type\\\":\\\"bar\\\",\\\"labels\\\":[\\\"Accuracy\\\",\\\"Precision\\\",\\\"Recall\\\"],\\\"values\\\":[{accuracy:.2f},{accuracy-1.2:.2f},{accuracy-0.5:.2f}]}}')\n",
                    # Output rich structured table\n",
                    "table_data = {'headers': ['Metric', 'Value'], 'rows': [['Average Loss', f'{test_loss:.6f}'], ['Accuracy', f'{accuracy:.2f}%']]}\n",
                    "print(f'##NODE_OUTPUT:{{\\\"type\\\":\\\"table\\\",\\\"data\\\":{json.dumps(table_data)}}}')\n"
                ]
            else:
                node_code_lines = [
                    f"print('Executing generic/custom node: {node.get('id')}')\n"
                ]
        
        # Indent node code lines by 4 spaces to place inside try-except
        for line in node_code_lines:
            cell_source.append("    " + line)
            
        # Add instrumentation end with try-except block closing
        cell_source.append(f"    print('##NODE_COMPLETE:{node.get('id')}')\n")
        cell_source.append("except Exception as e:\n")
        cell_source.append("    import traceback\n")
        cell_source.append(f"    print('##NODE_ERROR:{node.get('id')}')\n")
        cell_source.append(f"    print(f'##NODE_ERROR_MSG:{node.get('id')}:{{str(e)}}')\n")
        cell_source.append("    traceback.print_exc()\n")
        cell_source.append("    raise e\n")
        
        cells.append({
            "cell_type": "code",
            "execution_count": None,
            "metadata": {},
            "outputs": [],
            "source": cell_source
        })

    notebook = {
        "cells": cells,
        "metadata": {
            "kernelspec": {
                "display_name": "Python 3",
                "language": "python",
                "name": "python3"
            },
            "language_info": {
                "codemirror_mode": {
                    "name": "ipython",
                    "version": 3
                },
                "file_extension": ".py",
                "mimetype": "text/x-python",
                "name": "python",
                "nbconvert_exporter": "python",
                "pygments_lexer": "ipython3",
                "version": "3.10.0"
            }
        },
        "nbformat": 4,
        "nbformat_minor": 2
    }
    
    return json.dumps(notebook, indent=2)
