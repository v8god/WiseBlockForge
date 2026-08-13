import React, { useState, useEffect, useCallback } from 'react';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Handle,
  Position
} from '@xyflow/react';
import type { Connection } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// API Base URL (FastAPI backend)
const API_BASE_URL = 'http://localhost:8000';

// ----------------------------------------------------
// Custom Node Components
// ----------------------------------------------------

const DataInputNode = ({ data }: any) => {
  const status = data.nodeStatus;
  return (
    <div className={`custom-node data-input ${status ? `${status}-state` : ''}`}>
      {status && <div className={`node-status-dot ${status}`} />}
      <div className="node-title">📊 Data Input</div>
      <div className="node-desc">Dataset: {data.dataset || 'MNIST'}</div>
      <Handle type="source" position={Position.Right} id="data" />
    </div>
  );
};

const ModelTrainingNode = ({ data, id }: any) => {
  const status = data.nodeStatus;
  const onChangeEpochs = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value) || 1;
    if (data.onConfigChange) {
      data.onConfigChange(id, { epochs: val });
    }
  };

  return (
    <div className={`custom-node model-training ${status ? `${status}-state` : ''}`}>
      {status && <div className={`node-status-dot ${status}`} />}
      <Handle type="target" position={Position.Left} id="data_in" />
      <div className="node-title">⚙️ Model Training</div>
      <div className="node-desc">Train SimpleMLP</div>
      <div className="node-config">
        <label>Epochs:</label>
        <input
          type="number"
          min="1"
          max="10"
          value={data.epochs || 1}
          onChange={onChangeEpochs}
          className="nodrag"
        />
      </div>
      <Handle type="source" position={Position.Right} id="model_out" />
    </div>
  );
};

const EvaluationNode = ({ data }: any) => {
  const status = data.nodeStatus;
  return (
    <div className={`custom-node evaluation ${status ? `${status}-state` : ''}`}>
      {status && <div className={`node-status-dot ${status}`} />}
      <Handle type="target" position={Position.Left} id="model_in" />
      <div className="node-title">📈 Evaluation</div>
      <div className="node-desc">Validate on test data</div>
    </div>
  );
};

const nodeTypes = {
  data_input: DataInputNode,
  model_training: ModelTrainingNode,
  evaluation: EvaluationNode,
};

// ----------------------------------------------------
// Main App Component
// ----------------------------------------------------

export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  // Kaggle credentials
  const [username, setUsername] = useState(() => localStorage.getItem('KAGGLE_USERNAME') || '');
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('KAGGLE_KEY') || '');

  // Execution states
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [isPolling, setIsPolling] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>('');

  // Per-node execution statuses
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, 'running' | 'complete' | 'error' | null>>({});

  // Theme Sync
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Persist credentials
  const saveCredentials = () => {
    localStorage.setItem('KAGGLE_USERNAME', username);
    localStorage.setItem('KAGGLE_KEY', apiKey);
    alert('Credentials saved locally!');
  };

  // Node Change Handler
  const handleConfigChange = useCallback((nodeId: string, newConfig: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              ...newConfig,
            },
          };
        }
        return node;
      })
    );
  }, []);

  // Initial Nodes
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([
    {
      id: 'data_input_1',
      type: 'data_input',
      position: { x: 80, y: 150 },
      data: { dataset: 'MNIST', nodeStatus: null },
    },
    {
      id: 'model_training_1',
      type: 'model_training',
      position: { x: 340, y: 150 },
      data: { epochs: 1, onConfigChange: handleConfigChange, nodeStatus: null },
    },
    {
      id: 'evaluation_1',
      type: 'evaluation',
      position: { x: 600, y: 150 },
      data: { nodeStatus: null },
    },
  ]);

  // Sync nodeStatus from nodeStatuses dictionary into node data
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const currentStatus = nodeStatuses[node.id] || null;
        if (node.data.nodeStatus !== currentStatus) {
          return {
            ...node,
            data: { ...node.data, nodeStatus: currentStatus },
          };
        }
        return node;
      })
    );
  }, [nodeStatuses]);

  // Initial Edges
  const [edges, setEdges, onEdgesChange] = useEdgesState([
    { id: 'e1-2', source: 'data_input_1', target: 'model_training_1', sourceHandle: 'data', targetHandle: 'data_in' },
    { id: 'e2-3', source: 'model_training_1', target: 'evaluation_1', sourceHandle: 'model_out', targetHandle: 'model_in' },
  ]);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Generate a preview of what code is generated
  useEffect(() => {
    // Basic local preview mimicking codegen
    const trainNode = nodes.find((n) => n.type === 'model_training');
    const epochs = trainNode?.data?.epochs || 1;
    const preview = `# Compiled Pipeline code preview
import torch
from torchvision import datasets, transforms

# 1. Data Input Node
transform = transforms.Compose([transforms.ToTensor(), transforms.Normalize((0.1307,), (0.3081,))])
train_dataset = datasets.MNIST('./data', train=True, download=True, transform=transform)

# 2. Model Training Node (epochs = ${epochs})
# training SimpleMLP...

# 3. Evaluation Node
# validating test accuracy...`;
    setGeneratedCode(preview);
  }, [nodes]);

  // Parse Kaggle standard logs for node execution boundaries
  const parseLogsForNodeStatus = (stdout: string) => {
    const statuses: Record<string, 'running' | 'complete' | 'error' | null> = {};
    const lines = stdout.split('\n');
    lines.forEach((line) => {
      if (line.includes('##NODE_START:')) {
        const nodeId = line.split('##NODE_START:')[1].trim();
        statuses[nodeId] = 'running';
      } else if (line.includes('##NODE_COMPLETE:')) {
        const nodeId = line.split('##NODE_COMPLETE:')[1].trim();
        statuses[nodeId] = 'complete';
      } else if (line.includes('##NODE_ERROR:')) {
        const nodeId = line.split('##NODE_ERROR:')[1].trim();
        statuses[nodeId] = 'error';
      }
    });
    setNodeStatuses(statuses);
  };

  // Compile and Trigger Kaggle execution
  const runPipeline = async () => {
    setLogs('Compiling visual graph...\n');
    setRunStatus('queued');
    setNodeStatuses({});
    setRunId(null);

    const graphData = {
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, data: { dataset: n.data.dataset, epochs: n.data.epochs } })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (username) headers['X-Kaggle-Username'] = username;
      if (apiKey) headers['X-Kaggle-Key'] = apiKey;

      const res = await fetch(`${API_BASE_URL}/api/run`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ graph: graphData }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Failed to start execution.');
      }

      const data = await res.json();
      setRunId(data.run_id);
      setRunStatus('queued');
      setLogs((l) => l + `Notebook compiled! Pushed to Kaggle.\nKernel URL: ${data.url}\nKernel status: queued. Waiting for execution to start...\n`);
      setIsPolling(true);
    } catch (e: any) {
      setRunStatus('error');
      setLogs((l) => l + `Error starting execution: ${e.message}\n`);
    }
  };

  // Status/Logs Polling Effect
  useEffect(() => {
    if (!isPolling || !runId) return;

    let pollInterval: any;
    const pollStatus = async () => {
      try {
        const headers: Record<string, string> = {};
        if (username) headers['X-Kaggle-Username'] = username;
        if (apiKey) headers['X-Kaggle-Key'] = apiKey;

        // Fetch execution status
        const statusRes = await fetch(`${API_BASE_URL}/api/run/${runId}/status`, { headers });
        if (!statusRes.ok) return;
        const statusData = await statusRes.json();

        setRunStatus(statusData.status);

        // Fetch outputs/logs
        const outputRes = await fetch(`${API_BASE_URL}/api/run/${runId}/output`, { headers });
        if (outputRes.ok) {
          const outputData = await outputRes.json();
          if (outputData.logs) {
            setLogs(outputData.logs);
            parseLogsForNodeStatus(outputData.logs);
          }
        }

        if (statusData.status === 'complete' || statusData.status === 'error') {
          setIsPolling(false);
          clearInterval(pollInterval);
        }
      } catch (e) {
        console.error('Error polling status:', e);
      }
    };

    // Poll immediately, then every 5 seconds
    pollStatus();
    pollInterval = setInterval(pollStatus, 5000);

    return () => clearInterval(pollInterval);
  }, [isPolling, runId, username, apiKey]);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <span className="logo-icon">⚡</span>
          <span className="logo-text">WiseBlockForge</span>
          <span className="logo-tagline">Visual Machine Learning Builder</span>
        </div>
        <div className="header-actions">
          <button
            className="theme-toggle-btn"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          >
            {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="app-main">
        {/* Canvas */}
        <div className="canvas-wrapper">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            fitView
            minZoom={0.5}
            maxZoom={1.5}
          >
            <Background color={theme === 'dark' ? '#334155' : '#cbd5e1'} gap={16} />
            <Controls />
            <MiniMap style={{ height: 120 }} zoomable pannable />
          </ReactFlow>
        </div>

        {/* Sidebar */}
        <aside className="sidebar">
          {/* Section 1: Kaggle Account Settings */}
          <div className="sidebar-section">
            <h3 className="section-title">🗝️ Kaggle Integration</h3>
            <div className="form-group">
              <label>Kaggle Username</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. kaggleuser"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Kaggle API Key</label>
              <input
                type="password"
                className="form-input"
                placeholder="Paste API Key from kaggle.json"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
            </div>
            <button className="btn-primary" onClick={saveCredentials}>
              Save Credentials
            </button>
          </div>

          {/* Section 2: Run Controls */}
          <div className="sidebar-section">
            <h3 className="section-title">🚀 Execution Controls</h3>
            <div className="run-panel">
              <button
                className="btn-primary"
                disabled={isPolling}
                onClick={runPipeline}
              >
                {isPolling ? 'Executing on Kaggle...' : 'Compile & Run Pipeline'}
              </button>
              {runStatus && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Status:</span>
                  <span className={`status-badge ${runStatus}`}>{runStatus}</span>
                </div>
              )}
            </div>

            {/* Generated Code Toggle */}
            <div className="code-preview-section">
              <div className="code-preview-header" onClick={() => setShowCode(!showCode)}>
                <span>{showCode ? '▼ Hide Generated Code' : '▶ Show Generated Code'}</span>
              </div>
              {showCode && (
                <div className="code-preview-body">{generatedCode}</div>
              )}
            </div>
          </div>

          {/* Section 3: Live Output Logs */}
          <div className="sidebar-section">
            <h3 className="section-title">📊 Execution Logs</h3>
            <div className="console-panel">
              <div className="console-header">stdout log terminal</div>
              <div className="console-body">
                {logs ? logs : <span className="empty-log">No logs active. Start a run to inspect outputs...</span>}
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
