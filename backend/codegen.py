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
        
        # Node-specific code
        if ntype == "data_input":
            dataset_name = data.get("dataset", "MNIST")
            cell_source.extend([
                "import torch\n",
                "from torchvision import datasets, transforms\n",
                "transform = transforms.Compose([transforms.ToTensor(), transforms.Normalize((0.1307,), (0.3081,))])\n",
                f"print('Loading dataset: {dataset_name}...')\n",
                "train_dataset = datasets.MNIST('./data', train=True, download=True, transform=transform)\n",
                "test_dataset = datasets.MNIST('./data', train=False, transform=transform)\n",
                "train_loader = torch.utils.data.DataLoader(train_dataset, batch_size=64, shuffle=True)\n",
                "test_loader = torch.utils.data.DataLoader(test_dataset, batch_size=1000, shuffle=False)\n",
                f"print('Dataset {dataset_name} loaded successfully.')\n"
            ])
        elif ntype == "model_training":
            epochs = int(data.get("epochs", 1))
            cell_source.extend([
                "import torch.nn as nn\n",
                "import torch.optim as optim\n",
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
                "            print(f'Epoch {epoch+1}, Batch {batch_idx+1}/{len(train_loader)}, Loss: {running_loss/200:.4f}')\n",
                "            running_loss = 0.0\n",
                "print('Model training completed.')\n"
            ])
        elif ntype == "evaluation":
            cell_source.extend([
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
                "print(f'Test set: Average loss: {test_loss:.4f}, Accuracy: {correct}/{len(test_loader.dataset)} ({accuracy:.2f}%)')\n"
            ])
        else:
            cell_source.append(f"print('Executing generic node: {node.get('id')}')\n")

        # Add instrumentation end
        cell_source.append(f"print('##NODE_COMPLETE:{node.get('id')}')\n")
        
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
