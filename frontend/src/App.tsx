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
  Position,
  MarkerType
} from '@xyflow/react';
import type { Connection, Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';

// Reusable custom widgets
import ChartRenderer from './components/ChartRenderer';
import ConsolePopup from './components/ConsolePopup';
import CustomNodeCreator from './components/CustomNodeCreator';
import type { CustomNodeTemplate } from './components/CustomNodeCreator';
import Dashboard from './components/Dashboard';
import type { WorkflowFile } from './components/Dashboard';
import InteractiveEdge from './components/InteractiveEdge';

const API_BASE_URL = 'http://localhost:8000';

// ----------------------------------------------------
// Circular Start Node Component
// ----------------------------------------------------
const StartNode = ({ data }: any) => {
  const status = data.nodeStatus;
  const isSelected = data.isSelected;
  return (
    <div
      className={`w-16 h-16 rounded-full bg-gradient-to-br from-emerald-600 to-green-500 border-3 flex flex-col items-center justify-center shadow-lg relative text-white font-bold text-[10px] select-none transition-all duration-300 ${
        status ? `${status}-state` : (isSelected ? 'border-blue-400 scale-105 shadow-blue-500/50' : 'border-white hover:scale-105')
      }`}
      title="Double click to configure"
    >
      {status && <div className={`node-status-dot ${status}`} />}
      <span>START</span>
      <Handle
        type="source"
        position={Position.Right}
        id="start_out"
        style={{ background: '#fff', width: 8, height: 8 }}
        title="Start Trigger Output"
      />
    </div>
  );
};

// ----------------------------------------------------
// Generic Dynamic Handle Node Component
// ----------------------------------------------------
const GenericNode = ({ data, id, type }: any) => {
  const status = data.nodeStatus;
  const errorMsg = data.nodeError;
  const isSelected = data.isSelected;
  const borderStyle = data.color ? { borderColor: data.color } : {};
  const titleStyle = data.color ? { color: data.color } : {};

  return (
    <div
      className={`custom-node ${type} relative bg-bg-card border-2 rounded-xl p-4 min-w-[200px] shadow-lg transition-all duration-300 ${
        status ? `${status}-state` : (isSelected ? 'border-blue-400 scale-102 shadow-blue-500/30' : 'border-border hover:border-text-muted')
      }`}
      style={status ? {} : borderStyle}
      title="Double click to open popup inspector"
    >
      {status && <div className={`node-status-dot ${status}`} />}
      
      {/* Delete node button */}
      {type !== 'start_node' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onDeleteNode?.(id);
          }}
          className="absolute top-2 right-2 text-text-muted hover:text-red-400 text-xs border-none bg-transparent cursor-pointer p-0.5 focus:outline-none transition-colors"
          title="Delete Block"
        >
          ✕
        </button>
      )}

      {/* Render Dynamic Inputs Left Handles */}
      {data.inputs && data.inputs.map((inp: any, idx: number) => {
        const topRatio = data.inputs.length > 1 
          ? 20 + (idx * (60 / (data.inputs.length - 1))) 
          : 50;
        return (
          <Handle
            key={inp.name}
            type="target"
            position={Position.Left}
            id={inp.name}
            style={{ top: `${topRatio}%` }}
            title={`Input: ${inp.name} (${inp.type})`}
          />
        );
      })}

      <div className="flex items-center justify-between gap-2 mb-1 pr-4">
        <span className="font-bold text-xs flex items-center gap-1.5" style={titleStyle}>
          {data.icon || '📦'} {data.label}
        </span>
        {errorMsg && (
          <span 
            className="text-red-500 text-xs cursor-pointer animate-bounce" 
            title="Execution failed. Double click to inspect traceback."
          >
            ⚠️
          </span>
        )}
      </div>
      <div className="text-[10px] text-text-secondary line-clamp-2">{data.desc}</div>

      {/* Epochs hyperparameters slider block for training node */}
      {type === 'model_training' && (
        <div className="mt-3 pt-2 border-t border-dashed border-border flex items-center justify-between gap-2">
          <label className="text-[10px] font-semibold text-text-muted">Epochs:</label>
          <input
            type="number"
            min="1"
            max="20"
            value={data.epochs || 1}
            onChange={(e) => {
              const val = parseInt(e.target.value) || 1;
              data.onConfigChange?.(id, { epochs: val });
            }}
            className="nodrag w-12 text-center bg-bg-panel border border-border text-text-primary text-[10px] rounded focus:outline-none"
          />
        </div>
      )}

      {/* Render Dynamic Outputs Right Handles */}
      {data.outputs && data.outputs.map((out: any, idx: number) => {
        const topRatio = data.outputs.length > 1 
          ? 20 + (idx * (60 / (data.outputs.length - 1))) 
          : 50;
        return (
          <Handle
            key={out.name}
            type="source"
            position={Position.Right}
            id={out.name}
            style={{ top: `${topRatio}%` }}
            title={`Output: ${out.name} (${out.type})`}
          />
        );
      })}
    </div>
  );
};

const nodeTypes = {
  start_node: StartNode,
  data_input: GenericNode,
  model_training: GenericNode,
  evaluation: GenericNode,
  custom_node: GenericNode,
};

const edgeTypes = {
  interactive: InteractiveEdge,
};

// ----------------------------------------------------
// Default Templates Registry
// ----------------------------------------------------
const DEFAULT_PRESETS = [
  {
    type: 'start_node',
    label: 'Start Node',
    desc: 'Trigger pipeline execution sequence',
    icon: '🏁',
    color: '#10b981',
    inputs: [],
    outputs: [{ name: 'start_out', type: 'trigger' }]
  },
  {
    type: 'data_input',
    label: 'Data Input',
    desc: 'Load MNIST Handwritten digits dataset',
    icon: '📊',
    color: '#3b82f6',
    inputs: [{ name: 'in', type: 'flow' }],
    outputs: [{ name: 'data', type: 'data' }],
    dataset: 'MNIST',
  },
  {
    type: 'model_training',
    label: 'Model Training',
    desc: 'Train custom PyTorch SimpleMLP network',
    icon: '⚙️',
    color: '#f97316',
    inputs: [{ name: 'data_in', type: 'data' }],
    outputs: [{ name: 'model_out', type: 'model' }],
    epochs: 1,
  },
  {
    type: 'evaluation',
    label: 'Evaluation',
    desc: 'Evaluate model accuracy and average test loss',
    icon: '📈',
    color: '#14b8a6',
    inputs: [{ name: 'model_in', type: 'model' }],
    outputs: [],
  }
];

// ----------------------------------------------------
// Datasets Manager Page Component
// ----------------------------------------------------
const DatasetsManager = ({
  token,
  onDeployDataset,
  showToast
}: {
  token: string | null;
  onDeployDataset: (name: string, type: 'presets' | 'uploaded' | 'kaggle', title?: string) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}) => {
  const [localDatasets, setLocalDatasets] = useState<any[]>([]);
  const [kaggleQuery, setKaggleQuery] = useState('');
  const [kaggleResults, setKaggleResults] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const loadLocalDatasets = () => {
    fetch(`${API_BASE_URL}/api/datasets/list`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setLocalDatasets(data))
      .catch(err => console.error(err));
  };

  useEffect(() => {
    loadLocalDatasets();
  }, [token]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_BASE_URL}/api/datasets/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (res.ok) {
        showToast(`File "${file.name}" uploaded successfully!`, 'success');
        loadLocalDatasets();
      } else {
        showToast("Upload failed.", 'error');
      }
    } catch (e) {
      console.error(e);
      showToast("Upload error.", 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleKaggleSearch = async () => {
    if (!kaggleQuery) return;
    setSearchLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/datasets/search?query=${encodeURIComponent(kaggleQuery)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setKaggleResults(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="w-full h-full p-8 bg-bg-app overflow-y-auto custom-scrollbar flex flex-col font-sans text-left">
      <div className="mb-6 shrink-0">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-500 to-indigo-400 bg-clip-text text-transparent">📂 Datasets Manager</h1>
        <p className="text-xs text-text-secondary mt-1">Upload files of any format (CSV, JSON, ZIP, etc.) or search Kaggle to deploy visual data input blocks.</p>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8 items-start min-h-0">
        {/* Left Column: Local Uploads */}
        <div className="bg-bg-panel/40 border border-border rounded-2xl p-6 flex flex-col h-[70vh] overflow-hidden">
          <h2 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
            💻 My Local Datasets
          </h2>

          {/* Upload Zone */}
          <div className="border-2 border-dashed border-border/80 hover:border-blue-500/50 rounded-xl p-6 text-center bg-bg-card/20 hover:bg-bg-card/50 transition cursor-pointer relative mb-4">
            <input
              type="file"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
              disabled={isUploading}
            />
            <span className="text-2xl mb-1 block">📤</span>
            <span className="text-xs font-semibold text-text-primary block">
              {isUploading ? 'Uploading file...' : 'Drag & drop or click to upload'}
            </span>
            <span className="text-[10px] text-text-muted mt-1 block">Supports CSV, JSON, ZIP, and other data structures</span>
          </div>

          {/* Local Datasets list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
            {localDatasets.length === 0 ? (
              <p className="text-xs text-text-muted italic text-center py-8">No uploaded datasets found.</p>
            ) : (
              localDatasets.map(d => (
                <div key={d.filename} className="p-3 bg-bg-card border border-border rounded-xl flex items-center justify-between gap-3 shadow hover:border-blue-500/20 transition">
                  <div className="truncate flex-1">
                    <span className="font-bold text-xs text-text-primary block truncate">{d.filename}</span>
                    <span className="text-[10px] text-text-secondary mt-0.5">{d.size} • format: {d.ext || 'unknown'}</span>
                  </div>
                  <button
                    onClick={() => onDeployDataset(d.filename, 'uploaded')}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg transition border-none cursor-pointer"
                  >
                    Deploy Node
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Kaggle Hub */}
        <div className="bg-bg-panel/40 border border-border rounded-2xl p-6 flex flex-col h-[70vh] overflow-hidden">
          <h2 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2">
            🌍 Kaggle Datasets Hub
          </h2>

          <div className="flex gap-2 mb-4 shrink-0">
            <input
              type="text"
              placeholder="Search Kaggle (e.g. wine, house prices...)"
              value={kaggleQuery}
              onChange={(e) => setKaggleQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleKaggleSearch()}
              className="flex-1 bg-bg-card border border-border rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={handleKaggleSearch}
              disabled={searchLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white font-semibold text-xs rounded-lg transition border-none cursor-pointer"
            >
              {searchLoading ? 'Searching...' : 'Search'}
            </button>
          </div>

          {/* Kaggle list */}
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1">
            {kaggleResults.length === 0 ? (
              <p className="text-xs text-text-muted italic text-center py-8">Search Kaggle to discover and deploy remote datasets.</p>
            ) : (
              kaggleResults.map(d => (
                <div key={d.ref} className="p-3 bg-bg-card border border-border rounded-xl flex items-center justify-between gap-3 shadow hover:border-blue-500/20 transition">
                  <div className="truncate flex-1">
                    <span className="font-bold text-xs text-text-primary block truncate">{d.title}</span>
                    <span className="text-[9px] text-text-muted block truncate mt-0.5">{d.ref}</span>
                    <span className="text-[10px] text-text-secondary mt-0.5 block">{d.size}</span>
                  </div>
                  <button
                    onClick={() => onDeployDataset(d.ref, 'kaggle', d.title)}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white font-semibold text-xs rounded-lg transition border-none cursor-pointer shrink-0"
                  >
                    Deploy Node
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ----------------------------------------------------
// Main App Component
// ----------------------------------------------------
export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved as 'light' | 'dark') || 'dark';
  });

  // Auth States
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('WBF_AUTH_TOKEN'));
  const [authUsername, setAuthUsername] = useState<string | null>(() => localStorage.getItem('WBF_AUTH_USER'));
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [authError, setAuthError] = useState<string | null>(null);
  
  // Login form inputs
  const [inputUsername, setInputUsername] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [googleClientId, setGoogleClientId] = useState(() => localStorage.getItem('GOOGLE_CLIENT_ID') || '');

  // Pages navigation
  const [currentPage, setCurrentPage] = useState<'canvas' | 'dashboard' | 'datasets'>('canvas');
  
  // Modals status
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [showCode, setShowCode] = useState(false);
  
  // Unsaved dialog state
  const [unsavedDialog, setUnsavedDialog] = useState<{ isOpen: boolean; nextAction: () => void } | null>(null);

  // Workflows state
  const [workflows, setWorkflows] = useState<WorkflowFile[]>([]);
  const [activeWorkflowId, setActiveWorkflowId] = useState<string>('default');
  const [communityWorkflows, setCommunityWorkflows] = useState<WorkflowFile[]>([]);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowFile | null>(null);

  const [hasChanges, setHasChanges] = useState(false);

  // Custom registered Node Templates Palette
  const [customNodeTemplates, setCustomNodeTemplates] = useState<CustomNodeTemplate[]>(() => {
    const saved = localStorage.getItem('WBF_CUSTOM_TEMPLATES');
    return saved ? JSON.parse(saved) : [];
  });

  // Sidebar search filter preset nodes
  const [presetSearch, setPresetSearch] = useState('');

  // Canvas elements state (Strict typings to prevent never[])
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  
  // Selected visual node detail drawer/modal state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Kaggle credentials & validation status
  const [username, setUsername] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isKaggleVerified, setIsKaggleVerified] = useState(false);
  const [isKaggleCredentialsOpen, setIsKaggleCredentialsOpen] = useState(false);
  const [kaggleSearchResults, setKaggleSearchResults] = useState<any[]>([]);

  // File / Run / Terminal dropdown menus state
  const [activeMenu, setActiveMenu] = useState<'file' | 'run' | 'terminal' | null>(null);

  // Sidebar Toggles
  const [isLeftSidebarOpen, setIsLeftSidebarOpen] = useState(true);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(true);

  // Closeable Footer Panels
  const [showConsoleTerminal, setShowConsoleTerminal] = useState(true);
  const [showLossCurves, setShowLossCurves] = useState(true);

  // Custom Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Live polling execution state
  const [runId, setRunId] = useState<string | null>(null);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [isPolling, setIsPolling] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string>('');

  // Node glowing trace statuses
  const [nodeStatuses, setNodeStatuses] = useState<Record<string, 'running' | 'complete' | 'error' | null>>({});
  const [nodeErrors, setNodeErrors] = useState<Record<string, string>>({});
  const [nodeOutputs, setNodeOutputs] = useState<Record<string, any[]>>({});
  const [plots, setPlots] = useState<Record<string, any>>({});

  // Dataset Previews Modal state
  const [datasetPreview, setDatasetPreview] = useState<any>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Theme Sync
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);


  // Load Google Identity Services SDK Script
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  // Fetch Google Client ID from Backend on Mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/auth/google/client-id`)
      .then(res => res.json())
      .then(data => {
        if (data.client_id) {
          setGoogleClientId(data.client_id);
          localStorage.setItem('GOOGLE_CLIENT_ID', data.client_id);
        }
      })
      .catch(err => console.error("Error fetching Google Client ID:", err));
  }, []);

  // Initialize Google Sign-In Button
  useEffect(() => {
    if (token) return;
    const clientKey = googleClientId;
    if (!clientKey) return;
    if ((window as any).google && document.getElementById('google-signin-btn')) {
      try {
        (window as any).google.accounts.id.initialize({
          client_id: clientKey,
          callback: (response: any) => {
            handleGoogleLogin(response.credential);
          }
        });
        (window as any).google.accounts.id.renderButton(
          document.getElementById('google-signin-btn'),
          { theme: 'outline', size: 'large', width: 280 }
        );
      } catch (err) {
        console.error('Google Auth Init failure: ', err);
      }
    }
  }, [token, googleClientId, authTab]);

  // Close menus on click outside
  useEffect(() => {
    const closeMenus = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.relative')) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('click', closeMenus);
    return () => document.removeEventListener('click', closeMenus);
  }, []);

  // Delete Node Handler
  const handleDeleteNode = useCallback((nodeId: string) => {
    if (window.confirm("Are you sure you want to delete this block?")) {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setHasChanges(true);
      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    }
  }, [selectedNodeId, setNodes, setEdges]);

  // Sync saved workflows and profile from backend SQLite on login
  useEffect(() => {
    if (!token) return;

    const loadData = async () => {
      try {
        // Fetch Workflows
        const wfRes = await fetch(`${API_BASE_URL}/api/workflows`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (wfRes.ok) {
          const wfs = await wfRes.json();
          setWorkflows(wfs);
          if (wfs.length > 0) {
            const lastActive = localStorage.getItem('WBF_ACTIVE_ID') || wfs[0].id;
            const validActive = wfs.some((w: any) => w.id === lastActive) ? lastActive : wfs[0].id;
            setActiveWorkflowId(validActive);
          } else {
            // Seed a default workflow for new users in database
            const defaultId = 'default_' + Date.now();
            const seedNodes = [
              { id: 'start_node_1', type: 'start_node', position: { x: 50, y: 150 }, data: { label: 'Start Node', desc: 'Trigger run sequence', inputs: [], outputs: [{ name: 'start_out', type: 'trigger' }] } },
              { id: 'data_input_1', type: 'data_input', position: { x: 190, y: 150 }, data: { label: 'Data Input', desc: 'Dataset: MNIST', inputs: [{ name: 'in', type: 'flow' }], outputs: [{ name: 'data', type: 'data' }], dataset: 'MNIST' } },
              { id: 'model_training_1', type: 'model_training', position: { x: 450, y: 150 }, data: { label: 'Model Training', desc: 'Train SimpleMLP', inputs: [{ name: 'data_in', type: 'data' }], outputs: [{ name: 'model_out', type: 'model' }], epochs: 1 } },
              { id: 'evaluation_1', type: 'evaluation', position: { x: 710, y: 150 }, data: { label: 'Evaluation', desc: 'Validate test accuracy', inputs: [{ name: 'model_in', type: 'model' }], outputs: [] } }
            ];
            const seedEdges = [
              { id: 'e0-1', source: 'start_node_1', target: 'data_input_1', sourceHandle: 'start_out', targetHandle: 'in', type: 'interactive' },
              { id: 'e1-2', source: 'data_input_1', target: 'model_training_1', sourceHandle: 'data', targetHandle: 'data_in', type: 'interactive' },
              { id: 'e2-3', source: 'model_training_1', target: 'evaluation_1', sourceHandle: 'model_out', targetHandle: 'model_in', type: 'interactive' }
            ];
            const newWf = {
              id: defaultId,
              name: 'WBF-Workflow1',
              nodes: seedNodes,
              edges: seedEdges,
              isPinned: false,
              lastSaved: new Date().toLocaleString()
            };
            await fetch(`${API_BASE_URL}/api/workflows`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              },
              body: JSON.stringify(newWf)
            });
            setWorkflows([newWf]);
            setActiveWorkflowId(defaultId);
          }
        }

        // Fetch Community Gallery
        const commRes = await fetch(`${API_BASE_URL}/api/workflows/community`);
        if (commRes.ok) {
          const comm = await commRes.json();
          setCommunityWorkflows(comm);
        }

        // Fetch User Profile (Kaggle credentials setup)
        const profRes = await fetch(`${API_BASE_URL}/api/auth/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (profRes.ok) {
          const prof = await profRes.json();
          setUsername(prof.kaggle_username || '');
          setApiKey(prof.kaggle_configured ? '••••••••' : '');
          setIsKaggleVerified(prof.kaggle_configured);
        }
      } catch (err) {
        console.error('Error fetching backend user profile/workflows data:', err);
      }
    };
    
    loadData();
  }, [token]);

  // Sync active workflow changes & force include target handle inside data_input
  useEffect(() => {
    if (workflows.length === 0) return;
    const current = workflows.find(w => w.id === activeWorkflowId) || workflows[0];
    setActiveWorkflow(current);
    
    setNodes(current.nodes.map(n => {
      let inputs = n.data.inputs || [];
      if (n.type === 'data_input') {
        const hasIn = inputs.some((i: any) => i.name === 'in');
        if (!hasIn) {
          inputs = [{ name: 'in', type: 'flow' }, ...inputs.filter((i: any) => i.name !== 'in')];
        }
      }
      return {
        ...n,
        data: {
          ...n.data,
          inputs,
          onConfigChange: handleConfigChange,
          onDeleteNode: handleDeleteNode,
          nodeStatus: nodeStatuses[n.id] || null,
          nodeError: nodeErrors[n.id] || null
        }
      };
    }));
    
    setEdges(current.edges.map(e => ({
      ...e,
      type: 'interactive',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
        color: theme === 'dark' ? '#3b82f6' : '#2563eb'
      }
    })) as any);
    
    localStorage.setItem('WBF_ACTIVE_ID', current.id);
    setHasChanges(false);
    setSelectedNodeId(null);
  }, [activeWorkflowId, workflows]);

  // Reset Kaggle Search on Node Selection Changes
  useEffect(() => {
    setKaggleSearchResults([]);
  }, [selectedNodeId]);

  // Load interactive preview data inside Node Inspector modal
  useEffect(() => {
    if (!isInspectorOpen || !selectedNodeId) {
      setDatasetPreview(null);
      return;
    }
    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node || node.type !== 'data_input') {
      setDatasetPreview(null);
      return;
    }
    
    const datasetName = node.data.dataset || 'MNIST';
    let datasetType = 'presets';
    if (['MNIST', 'Titanic', 'Iris'].includes(datasetName)) {
      datasetType = 'presets';
    } else if (datasetName.includes('/')) {
      datasetType = 'kaggle';
    } else {
      datasetType = 'uploaded';
    }
    
    setLoadingPreview(true);
    fetch(`${API_BASE_URL}/api/datasets/preview?dataset_type=${datasetType}&name=${encodeURIComponent(datasetName)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => {
        if (!res.ok) throw new Error("Preview not found");
        return res.json();
      })
      .then(data => {
        setDatasetPreview(data);
      })
      .catch(err => {
        console.error("Failed to load dataset preview:", err);
        setDatasetPreview({ format: 'other', filename: datasetName, size_bytes: 0 });
      })
      .finally(() => setLoadingPreview(false));
  }, [isInspectorOpen, selectedNodeId, nodes, token]);

  // Map glowing trace elements dynamically to nodes
  useEffect(() => {
    setNodes((nds) =>
      nds.map((node) => {
        const currentStatus = nodeStatuses[node.id] || null;
        const currentError = nodeErrors[node.id] || null;
        const isSelected = selectedNodeId === node.id;
        if (
          node.data.nodeStatus !== currentStatus || 
          node.data.nodeError !== currentError ||
          node.data.isSelected !== isSelected
        ) {
          return {
            ...node,
            data: { 
              ...node.data, 
              nodeStatus: currentStatus, 
              nodeError: currentError,
              isSelected: isSelected,
              onDeleteNode: handleDeleteNode
            },
          };
        }
        return node;
      })
    );
  }, [nodeStatuses, nodeErrors, selectedNodeId, setNodes, handleDeleteNode]);

  // Authentication Handlers
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!regUsername || !regPassword) {
      setAuthError('Please fill in all inputs.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: regUsername, password: regPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Registration failed');
      
      localStorage.setItem('WBF_AUTH_TOKEN', data.token);
      localStorage.setItem('WBF_AUTH_USER', data.username);
      setToken(data.token);
      setAuthUsername(data.username);
      setRegUsername('');
      setRegPassword('');
      setRegConfirmPassword('');
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: inputUsername, password: inputPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Sign-In failed');

      localStorage.setItem('WBF_AUTH_TOKEN', data.token);
      localStorage.setItem('WBF_AUTH_USER', data.username);
      setToken(data.token);
      setAuthUsername(data.username);
      setInputUsername('');
      setInputPassword('');
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleGoogleLogin = async (credential: string) => {
    setAuthError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Google Login failed');

      localStorage.setItem('WBF_AUTH_TOKEN', data.token);
      localStorage.setItem('WBF_AUTH_USER', data.username);
      setToken(data.token);
      setAuthUsername(data.username);
    } catch (err: any) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      console.error(e);
    }
    localStorage.removeItem('WBF_AUTH_TOKEN');
    localStorage.removeItem('WBF_AUTH_USER');
    setToken(null);
    setAuthUsername(null);
    setWorkflows([]);
    setNodes([]);
    setEdges([]);
    setCurrentPage('canvas');
  };

  const handleSaveKaggle = async () => {
    if (!username || !apiKey) {
      showToast('Please fill both Kaggle username and API key fields.', 'info');
      return;
    }
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/kaggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ kaggle_username: username, kaggle_key: apiKey })
      });
      const data = await res.json();
      if (data.verified) {
        setIsKaggleVerified(true);
        showToast('Kaggle API Credentials Verified successfully!', 'success');
      } else {
        setIsKaggleVerified(false);
        showToast('Credentials saved, but verification failed. Check credentials/Internet.', 'error');
      }
    } catch (err: any) {
      showToast('Error updating credentials: ' + err.message, 'error');
    }
  };

  const handleConfigChange = useCallback((nodeId: string, newConfig: any) => {
    setHasChanges(true);
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
  }, [setNodes]);

  const onConnect = useCallback(
    (params: Connection) => {
      setHasChanges(true);
      setEdges((eds) => addEdge({
        ...params,
        type: 'interactive',
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 15,
          height: 15,
          color: theme === 'dark' ? '#3b82f6' : '#2563eb'
        }
      }, eds));
    },
    [setEdges, theme]
  );

  const handleNodesChangeWrapped = (changes: any) => {
    setHasChanges(true);
    onNodesChange(changes);
  };
  const handleEdgesChangeWrapped = (changes: any) => {
    setHasChanges(true);
    onEdgesChange(changes);
  };

  const handleDeleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter(e => e.id !== edgeId));
    setHasChanges(true);
  }, [setEdges]);

  const handleInsertNodeOnEdge = useCallback((
    edgeId: string,
    nodeType: string,
    x: number,
    y: number,
    customIdx?: number
  ) => {
    const targetEdge = edges.find(e => e.id === edgeId);
    if (!targetEdge) return;

    const newNodeId = `${nodeType}_${Date.now()}`;
    let nodeData: any = {};

    if (nodeType === 'custom_node' && customIdx !== undefined) {
      const template = customNodeTemplates[customIdx];
      if (template) {
        nodeData = {
          label: template.label,
          desc: template.desc,
          icon: '🔨',
          color: template.color,
          inputs: template.inputs,
          outputs: template.outputs,
          code: template.defaultCode,
        };
      }
    } else {
      const preset = DEFAULT_PRESETS.find(p => p.type === nodeType);
      if (preset) {
        nodeData = {
          label: preset.label,
          desc: preset.desc,
          icon: preset.icon,
          color: preset.color,
          inputs: preset.inputs,
          outputs: preset.outputs,
          dataset: preset.dataset,
          epochs: preset.epochs,
        };
      }
    }

    const newNode: Node = {
      id: newNodeId,
      type: nodeType,
      position: { x: x - 100, y: y - 30 },
      data: {
        ...nodeData,
        onConfigChange: handleConfigChange,
        onDeleteNode: handleDeleteNode,
        nodeStatus: null,
        nodeError: null
      },
    };

    const newEdge1 = {
      id: `edge_${targetEdge.source}_${newNodeId}`,
      source: targetEdge.source,
      target: newNodeId,
      sourceHandle: targetEdge.sourceHandle,
      targetHandle: (newNode.data as any).inputs[0]?.name || 'in',
      type: 'interactive',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
        color: theme === 'dark' ? '#3b82f6' : '#2563eb'
      }
    };

    const newEdge2 = {
      id: `edge_${newNodeId}_${targetEdge.target}`,
      source: newNodeId,
      target: targetEdge.target,
      sourceHandle: (newNode.data as any).outputs[0]?.name || 'out',
      targetHandle: targetEdge.targetHandle,
      type: 'interactive',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 15,
        height: 15,
        color: theme === 'dark' ? '#3b82f6' : '#2563eb'
      }
    };

    setNodes(nds => nds.concat(newNode));
    setEdges(eds => eds.filter(e => e.id !== edgeId).concat(newEdge1, newEdge2));
    setHasChanges(true);
  }, [edges, customNodeTemplates, handleConfigChange, handleDeleteNode, theme, setNodes, setEdges]);

  const handleImportIpynb = (fileContent: string) => {
    try {
      const ipynb = JSON.parse(fileContent);
      const cells = ipynb.cells || [];
      const codeCells = cells.filter((c: any) => c.cell_type === 'code');
      
      if (codeCells.length === 0) {
        showToast('No code cells found in the uploaded Jupyter notebook!', 'info');
        return;
      }
      
      const importedNodes: any[] = [];
      const importedEdges: any[] = [];
      
      codeCells.forEach((cell: any, idx: number) => {
        const rawCode = Array.isArray(cell.source) ? cell.source.join('') : cell.source || '';
        const nodeId = `imported_node_${idx}_${Date.now()}`;
        
        let type = 'custom_node';
        let label = `Cell ${idx + 1}`;
        let color = '#a855f7';
        let inputs = [{ name: 'in', type: 'flow' }];
        let outputs = [{ name: 'out', type: 'flow' }];
        
        if (rawCode.includes('datasets') || rawCode.includes('DataLoader') || rawCode.includes('pd.read_csv')) {
          type = 'data_input';
          label = `Imported Data`;
          color = '#3b82f6';
          inputs = [{ name: 'in', type: 'flow' }];
          outputs = [{ name: 'data', type: 'data' }];
        } else if (rawCode.includes('train(') || rawCode.includes('optimizer') || rawCode.includes('epochs')) {
          type = 'model_training';
          label = `Imported Training`;
          color = '#f97316';
          inputs = [{ name: 'data_in', type: 'data' }];
          outputs = [{ name: 'model_out', type: 'model' }];
        } else if (rawCode.includes('eval(') || rawCode.includes('accuracy') || rawCode.includes('test_loss')) {
          type = 'evaluation';
          label = `Imported Eval`;
          color = '#14b8a6';
          inputs = [{ name: 'model_in', type: 'model' }];
          outputs = [];
        }
        
        importedNodes.push({
          id: nodeId,
          type,
          position: { x: 80 + idx * 260, y: 200 },
          data: {
            label,
            desc: `Imported Jupyter cell code block`,
            color,
            inputs,
            outputs,
            code: rawCode,
            onConfigChange: handleConfigChange,
            onDeleteNode: handleDeleteNode,
            nodeStatus: null,
            nodeError: null
          }
        });
      });
      
      for (let i = 0; i < importedNodes.length - 1; i++) {
        const sourceNode = importedNodes[i];
        const targetNode = importedNodes[i + 1];
        const sourceHandle = sourceNode.data.outputs[0]?.name || 'out';
        const targetHandle = targetNode.data.inputs[0]?.name || 'in';
        
        importedEdges.push({
          id: `edge_${sourceNode.id}_${targetNode.id}`,
          source: sourceNode.id,
          target: targetNode.id,
          sourceHandle,
          targetHandle,
          type: 'interactive',
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 15,
            height: 15,
            color: theme === 'dark' ? '#3b82f6' : '#2563eb'
          }
        });
      }
      
      const newId = `imported_${Date.now()}`;
      const newWf: WorkflowFile = {
        id: newId,
        name: `Notebook-Import-${workflows.length + 1}`,
        nodes: importedNodes,
        edges: importedEdges,
        isPinned: false,
        lastSaved: new Date().toLocaleString()
      };
      
      fetch(`${API_BASE_URL}/api/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(newWf)
      }).then(() => {
        setWorkflows(wfs => [...wfs, newWf]);
        setActiveWorkflowId(newId);
        showToast('Jupyter notebook imported successfully!', 'success');
      });
    } catch (e: any) {
      showToast('Failed to parse .ipynb file: ' + e.message, 'error');
    }
  };

  // Python Code Preview
  useEffect(() => {
    const codeBlocks: string[] = [];
    nodes.forEach(node => {
      if (node.data.code) {
        codeBlocks.push(`# --- Node: ${node.id} (${node.type}) --- \n${node.data.code}`);
      } else {
        if (node.type === 'start_node') {
          codeBlocks.push(`# --- Node: ${node.id} --- \nprint("Kaggle queue finished! Pipeline execution starting...")`);
        } else if (node.type === 'data_input') {
          const ds = node.data.dataset || 'MNIST';
          if (ds === 'MNIST') {
            codeBlocks.push(`# --- Node: ${node.id} --- \ntrain_dataset = datasets.MNIST('./data', train=True, download=True)\ntest_dataset = datasets.MNIST('./data', train=False)`);
          } else {
            codeBlocks.push(`# --- Node: ${node.id} --- \n# Loads ${ds} dataset dynamically...`);
          }
        } else if (node.type === 'model_training') {
          codeBlocks.push(`# --- Node: ${node.id} --- \nepochs = ${node.data.epochs || 1}\n# Training SimpleMLP loop...`);
        } else if (node.type === 'evaluation') {
          codeBlocks.push(`# --- Node: ${node.id} --- \nmodel.eval()\n# Validating on test loader...`);
        } else {
          codeBlocks.push(`# --- Node: ${node.id} --- \n# Executing custom template...`);
        }
      }
    });
    setGeneratedCode(codeBlocks.join('\n\n'));
  }, [nodes]);

  // Output parser
  const parseLogsForRealtimeMetrics = (stdout: string) => {
    const statuses: Record<string, 'running' | 'complete' | 'error' | null> = {};
    const errorsMap: Record<string, string> = {};
    const outputsMap: Record<string, any[]> = {};
    const parsedPlots: Record<string, any> = {};

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

      if (line.includes('##NODE_ERROR_MSG:')) {
        const payload = line.split('##NODE_ERROR_MSG:')[1].trim();
        const firstColon = payload.indexOf(':');
        if (firstColon !== -1) {
          const nodeId = payload.slice(0, firstColon);
          const errorMsg = payload.slice(firstColon + 1);
          errorsMap[nodeId] = errorMsg;
        }
      }

      if (line.includes('##PLOT:')) {
        try {
          const jsonStr = line.split('##PLOT:')[1].trim();
          const plotData = JSON.parse(jsonStr);
          const plotId = plotData.id;

          if (!parsedPlots[plotId]) {
            parsedPlots[plotId] = {
              id: plotId,
              type: plotData.type,
              series: {},
              labels: [],
              values: [],
              points3d: []
            };
          }

          if (plotData.type === 'line') {
            const seriesName = plotData.series || 'default';
            if (!parsedPlots[plotId].series[seriesName]) {
              parsedPlots[plotId].series[seriesName] = [];
            }
            parsedPlots[plotId].series[seriesName].push({ x: plotData.x, y: plotData.y });
          } else if (plotData.type === 'bar') {
            parsedPlots[plotId].labels = plotData.labels || [];
            parsedPlots[plotId].values = plotData.values || [];
          } else if (plotData.type === '3d') {
            parsedPlots[plotId].points3d.push({ x: plotData.x, y: plotData.y, z: plotData.z });
          }
        } catch (e) {
          console.error('Failed to parse real-time plot coordinate json:', e);
        }
      }

      if (line.includes('##NODE_OUTPUT:')) {
        try {
          const jsonStr = line.split('##NODE_OUTPUT:')[1].trim();
          const outputObj = JSON.parse(jsonStr);
          const activeNodeId = Object.keys(statuses).find(k => statuses[k] === 'running');
          if (activeNodeId) {
            if (!outputsMap[activeNodeId]) {
              outputsMap[activeNodeId] = [];
            }
            outputsMap[activeNodeId].push(outputObj);
          }
        } catch (e) {
          console.error('Failed to parse node rich output json:', e);
        }
      }
    });

    setNodeStatuses(statuses);
    setNodeErrors(errorsMap);
    setNodeOutputs(outputsMap);
    setPlots(parsedPlots);
  };

  const stopPipeline = async () => {
    if (!runId) return;
    try {
      setLogs((l) => l + `⏹️ Stopping execution on Kaggle...\n`);
      const res = await fetch(`${API_BASE_URL}/api/run/${runId}/stop`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Kaggle-Username': username,
          'X-Kaggle-Key': apiKey,
        }
      });
      const data = res.ok ? await res.json() : null;
      if (res.ok && data?.status === 'success') {
        setIsPolling(false);
        setRunStatus('stopped');
        showToast('Execution stopped successfully!', 'success');
        setLogs((l) => l + `⏹️ Run stopped by user.\n`);
      } else {
        throw new Error(data?.error_message || 'Stop request failed.');
      }
    } catch (e: any) {
      showToast(`Failed to stop run: ${e.message}`, 'error');
      setLogs((l) => l + `[-] Error stopping execution: ${e.message}\n`);
    }
  };

  const runPipeline = async (tillNodeId?: string) => {
    if (!username || !apiKey) {
      showToast('Please configure and verify your Kaggle credentials first.', 'info');
      setIsKaggleCredentialsOpen(true);
      return;
    }

    setLogs('Topologically compiling visual graph instances...\n');
    setRunStatus('queued');
    setNodeStatuses({});
    setNodeErrors({});
    setNodeOutputs({});
    setPlots({});
    setRunId(null);

    let nodesToRun = nodes;
    let edgesToRun = edges;

    if (tillNodeId) {
      const visited = new Set<string>();
      const queue = [tillNodeId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        if (!visited.has(curr)) {
          visited.add(curr);
          edges.forEach(e => {
            if (e.target === curr) queue.push(e.source);
          });
        }
      }
      nodesToRun = nodes.filter(n => visited.has(n.id));
      edgesToRun = edges.filter(e => visited.has(e.source) && visited.has(e.target));
      setLogs(l => l + `Filtered execution subgraph: compiling ${nodesToRun.length} of ${nodes.length} nodes.\n`);
    }

    const graphData = {
      nodes: nodesToRun.map((n) => ({ id: n.id, type: n.type, data: n.data })),
      edges: edgesToRun.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Kaggle-Username': username,
          'X-Kaggle-Key': apiKey,
        },
        body: JSON.stringify({ graph: graphData }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || 'Internal pipeline error.');
      }

      const data = await res.json();
      setRunId(data.run_id);
      setRunStatus('queued');
      setLogs((l) => l + `Notebook compiled! Push execution started.\nKernel URL: ${data.url}\nKernel status: queued. Waiting for Kaggle GPU...\n`);
      setIsPolling(true);
    } catch (e: any) {
      setRunStatus('error');
      setLogs((l) => l + `Failed to compile/run: ${e.message}\n`);
    }
  };

  useEffect(() => {
    if (!isPolling || !runId) return;

    let pollInterval: any;
    let consecutiveErrors = 0;
    
    const pollStatus = async () => {
      try {
        const statusRes = await fetch(`${API_BASE_URL}/api/run/${runId}/status`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Kaggle-Username': username, 
            'X-Kaggle-Key': apiKey 
          }
        });
        if (!statusRes.ok) throw new Error("Status query failed");
        
        const statusData = await statusRes.json();
        setRunStatus(statusData.status);
        consecutiveErrors = 0; // Reset error counter on successful query

        const outputRes = await fetch(`${API_BASE_URL}/api/run/${runId}/output`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'X-Kaggle-Username': username, 
            'X-Kaggle-Key': apiKey 
          }
        });
        if (outputRes.ok) {
          const outputData = await outputRes.json();
          if (outputData.logs) {
            setLogs(outputData.logs);
            parseLogsForRealtimeMetrics(outputData.logs);
          }
        }

        if (statusData.status === 'complete' || statusData.status === 'error') {
          setIsPolling(false);
          clearInterval(pollInterval);
        }
      } catch (e) {
        console.error('Error polling status logs:', e);
        consecutiveErrors += 1;
        if (consecutiveErrors >= 3) {
          setIsPolling(false);
          clearInterval(pollInterval);
          setRunStatus('error');
          setLogs(l => l + `\n[System Network Error]: Lost connection to remote execution host. Stopping poller.\n`);
        }
      }
    };

    pollStatus();
    pollInterval = setInterval(pollStatus, 5000);
    return () => clearInterval(pollInterval);
  }, [isPolling, runId, token, username, apiKey]);

  const handleSaveWorkspace = async () => {
    if (!activeWorkflow) return;
    const updatedWf = {
      ...activeWorkflow,
      nodes,
      edges,
      lastSaved: new Date().toLocaleString()
    };
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(updatedWf)
      });
      if (res.ok) {
        setWorkflows(workflows.map(w => w.id === activeWorkflowId ? updatedWf : w));
        setHasChanges(false);
        showToast(`Workflow "${activeWorkflow.name}" saved successfully!`, 'success');
      } else {
        showToast('Failed to save workflow.', 'error');
      }
    } catch (err: any) {
      showToast('Error saving workflow: ' + err.message, 'error');
    }
  };

  const handleDeployDataset = useCallback((name: string, type: 'presets' | 'uploaded' | 'kaggle', title?: string) => {
    const newNodeId = `data_input_${Date.now()}`;
    let code = '';
    let label = 'Dataset';
    let desc = '';

    if (type === 'uploaded') {
      label = name;
      desc = `Local dataset file`;
      const ext = name.split('.').pop()?.toLowerCase();
      if (ext === 'csv') {
        code = `import pandas as pd\nimport os\nprint(f"Loading local CSV {name}...")\ndf = pd.read_csv("./datasets/${name}")\nprint("Data preview shape:", df.shape)\n# First 5 rows output table\ntable_data = {'headers': list(df.columns[:5]), 'rows': df.head(5).values.tolist()}\nimport json\nprint(f"##NODE_OUTPUT:{{\\"type\\":\\"table\\",\\"data\\":{json.dumps(table_data)}}}")`;
      } else if (ext === 'json') {
        code = `import json\nprint(f"Loading local JSON {name}...")\nwith open("./datasets/${name}", "r") as f:\n    data = json.load(f)\nprint("Loaded JSON object details.")`;
      } else if (ext === 'zip') {
        code = `import zipfile\nprint(f"Opening zip archive {name}...")\nwith zipfile.ZipFile("./datasets/${name}", "r") as z:\n    print("Files in archive:", z.namelist()[:10])`;
      } else {
        code = `print("Loading local file ${name}...")\nimport os\nstat = os.stat("./datasets/${name}")\nprint("Size bytes:", stat.st_size)`;
      }
    } else if (type === 'kaggle') {
      label = title || name.split('/')[1];
      desc = `Kaggle dataset: ${name}`;
      const slug = name.split('/')[1];
      code = `import os\nimport pandas as pd\nimport json\ndataset_ref = "${name}"\ndataset_slug = "${slug}"\ninput_dir = f"/kaggle/input/{dataset_slug}"\nprint(f"Loading custom Kaggle dataset {dataset_ref} from {input_dir}...")\nif os.path.exists(input_dir):\n    files = os.listdir(input_dir)\n    print("Mounted files:", files)\nelse:\n    print("Dataset directory not found.")`;
    }

    const newNode: Node = {
      id: newNodeId,
      type: 'data_input',
      position: { x: 200, y: 150 },
      data: {
        label,
        desc,
        icon: '📊',
        color: '#3b82f6',
        inputs: [{ name: 'in', type: 'flow' }],
        outputs: [{ name: 'data', type: 'data' }],
        dataset: name,
        code,
        onConfigChange: handleConfigChange,
        onDeleteNode: handleDeleteNode,
        nodeStatus: null,
        nodeError: null
      }
    };

    setNodes(nds => nds.concat(newNode));
    setHasChanges(true);
    setCurrentPage('canvas');
    showToast(`Deployed dataset block "${label}" to your canvas workspace!`, 'success');
  }, [setNodes, handleConfigChange, handleDeleteNode]);

  const handleCreateNewWorkflow = async () => {
    const action = async () => {
      const nextNum = workflows.length + 1;
      const newId = `workflow_${Date.now()}`;
      const seedNodes = [
        { id: 'start_node_1', type: 'start_node', position: { x: 50, y: 150 }, data: { label: 'Start Node', desc: 'Trigger run sequence', inputs: [], outputs: [{ name: 'start_out', type: 'trigger' }] } },
        { id: 'data_input_1', type: 'data_input', position: { x: 190, y: 150 }, data: { label: 'Data Input', desc: 'Dataset: MNIST', inputs: [{ name: 'in', type: 'flow' }], outputs: [{ name: 'data', type: 'data' }], dataset: 'MNIST' } }
      ];
      const newWf: WorkflowFile = {
        id: newId,
        name: `WBF-Workflow${nextNum}`,
        nodes: seedNodes,
        edges: [],
        isPinned: false,
        lastSaved: new Date().toLocaleString()
      };
      
      try {
        const res = await fetch(`${API_BASE_URL}/api/workflows`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(newWf)
        });
        if (res.ok) {
          setWorkflows([...workflows, newWf]);
          setActiveWorkflowId(newId);
        }
      } catch (err) {
        console.error(err);
      }
    };

    if (hasChanges) {
      setUnsavedDialog({ isOpen: true, nextAction: action });
    } else {
      action();
    }
  };

  const handleOpenWorkflow = (id: string) => {
    const action = () => {
      setActiveWorkflowId(id);
      setCurrentPage('canvas');
    };

    if (hasChanges) {
      setUnsavedDialog({ isOpen: true, nextAction: action });
    } else {
      action();
    }
  };

  const handleDeleteWorkflow = async (id: string) => {
    if (workflows.length <= 1) {
      showToast('You must keep at least one workflow saved in your dashboard.', 'info');
      return;
    }
    if (window.confirm('Are you sure you want to delete this saved workflow?')) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/workflows/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const updated = workflows.filter(w => w.id !== id);
          setWorkflows(updated);
          if (activeWorkflowId === id) {
            setActiveWorkflowId(updated[0].id);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleRenameWorkflow = async (id: string, newName: string) => {
    const target = workflows.find(w => w.id === id);
    if (!target) return;
    const renamed = { ...target, name: newName };
    try {
      const res = await fetch(`${API_BASE_URL}/api/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(renamed)
      });
      if (res.ok) {
        setWorkflows(workflows.map(w => w.id === id ? renamed : w));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadWorkflow = (wf: WorkflowFile) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(wf, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `${wf.name}.json`);
    dlAnchorElem.click();
  };

  const handleTogglePin = async (id: string) => {
    const target = workflows.find(w => w.id === id);
    if (!target) return;

    const pinnedCount = workflows.filter(w => w.isPinned).length;
    if (!target.isPinned && pinnedCount >= 3) {
      showToast('You can only pin up to 3 workflows at max.', 'info');
      return;
    }

    const pinned = { ...target, isPinned: !target.isPinned };
    try {
      const res = await fetch(`${API_BASE_URL}/api/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(pinned)
      });
      if (res.ok) {
        setWorkflows(workflows.map(w => w.id === id ? pinned : w));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleForkWorkflow = async (wf: WorkflowFile) => {
    const newId = `fork_${Date.now()}`;
    const forked: WorkflowFile = {
      ...wf,
      id: newId,
      name: `${wf.name} (Forked)`,
      isPinned: false,
      isPublic: false,
      lastSaved: new Date().toLocaleString()
    };
    try {
      const res = await fetch(`${API_BASE_URL}/api/workflows`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(forked)
      });
      if (res.ok) {
        setWorkflows([...workflows, forked]);
        setActiveWorkflowId(newId);
        setCurrentPage('canvas');
        showToast(`Successfully loaded public template "${wf.name}"!`, 'success');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublishWorkflow = async () => {
    if (!activeWorkflow) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/workflows/${activeWorkflowId}/publish?is_public=true`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setWorkflows(workflows.map(w => w.id === activeWorkflowId ? { ...w, isPublic: true } : w));
        const commRes = await fetch(`${API_BASE_URL}/api/workflows/community`);
        if (commRes.ok) {
          setCommunityWorkflows(await commRes.json());
        }
        showToast(`Successfully published "${activeWorkflow.name}" to Public Gallery!`, 'success');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveCustomNodeTemplate = (tmpl: CustomNodeTemplate) => {
    const nextTemplates = [...customNodeTemplates, tmpl];
    setCustomNodeTemplates(nextTemplates);
    localStorage.setItem('WBF_CUSTOM_TEMPLATES', JSON.stringify(nextTemplates));
    showToast(`Custom node block "${tmpl.label}" registered successfully!`, 'success');
  };

  const onDragStart = (event: React.DragEvent, nodeType: string, customTmplIdx?: number) => {
    event.dataTransfer.setData('application/reactflow-type', nodeType);
    if (customTmplIdx !== undefined) {
      event.dataTransfer.setData('application/reactflow-custom-index', customTmplIdx.toString());
    }
    event.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow-type');
      if (!type) return;

      const reactFlowBounds = document.querySelector('.react-flow')?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      let nodeData: any = {};
      if (type === 'custom_node') {
        const customIdxStr = event.dataTransfer.getData('application/reactflow-custom-index');
        const customIdx = parseInt(customIdxStr);
        const template = customNodeTemplates[customIdx];
        if (template) {
          nodeData = {
            label: template.label,
            desc: template.desc,
            icon: '🔨',
            color: template.color,
            inputs: template.inputs,
            outputs: template.outputs,
            code: template.defaultCode,
          };
        }
      } else {
        const preset = DEFAULT_PRESETS.find(p => p.type === type);
        if (preset) {
          nodeData = {
            label: preset.label,
            desc: preset.desc,
            icon: preset.icon,
            color: preset.color,
            inputs: preset.inputs,
            outputs: preset.outputs,
            dataset: preset.dataset,
            epochs: preset.epochs,
          };
        }
      }

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: {
          ...nodeData,
          onConfigChange: handleConfigChange,
          onDeleteNode: handleDeleteNode,
          nodeStatus: null,
          nodeError: null
        },
      };

      setNodes((nds) => nds.concat(newNode));
      setHasChanges(true);
    },
    [customNodeTemplates, handleConfigChange, handleDeleteNode, setNodes]
  );

  const locateNodeOnCanvas = (nodeId: string) => {
    setIsConsoleOpen(false);
    setSelectedNodeId(nodeId);
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: { ...node.data, isSelected: true }
          };
        }
        return { ...node, data: { ...node.data, isSelected: false } };
      })
    );
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  // Filter Presets sidebar nodes
  const filteredPresets = DEFAULT_PRESETS.filter(p => 
    p.label.toLowerCase().includes(presetSearch.toLowerCase()) ||
    p.desc.toLowerCase().includes(presetSearch.toLowerCase())
  );

  // Authentication Panel Overlay (No Client Setup keys field - uses backend .env key configuration)
  if (!token) {
    return (
      <div className="w-full h-full bg-[#08090c] text-[#f8fafc] flex flex-col items-center justify-center p-6 relative font-sans overflow-y-auto">
        <div className="w-full max-w-md bg-[#0f111a]/70 border border-[#1f2438] rounded-2xl p-8 shadow-2xl backdrop-blur-md flex flex-col font-sans text-left">
          <div className="flex items-center gap-3 justify-center mb-6">
            <img src="/logo.png" className="w-9 h-9 object-contain rounded-lg shadow-inner" alt="WiseBlockForge Logo" />
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-500 to-indigo-400 bg-clip-text text-transparent font-sans">
              WiseBlockForge
            </span>
          </div>

          <div className="flex border-b border-[#1f2438] mb-6 p-0.5 bg-[#141724] rounded-lg font-sans">
            <button
              onClick={() => { setAuthTab('signin'); setAuthError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition border-none bg-transparent cursor-pointer ${authTab === 'signin' ? 'bg-blue-600 text-white' : 'text-[#94a3b8] hover:text-white'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => { setAuthTab('signup'); setAuthError(null); }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition border-none bg-transparent cursor-pointer ${authTab === 'signup' ? 'bg-blue-600 text-white' : 'text-[#94a3b8] hover:text-white'}`}
            >
              Sign Up
            </button>
          </div>

          {authError && (
            <div className="p-3 border border-red-500/30 bg-red-500/10 rounded-lg text-red-400 text-xs mb-4">
              ⚠️ {authError}
            </div>
          )}

          {authTab === 'signin' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[10px] text-[#94a3b8] mb-1 uppercase tracking-wider font-semibold">Username</label>
                <input
                  type="text"
                  required
                  value={inputUsername}
                  onChange={(e) => setInputUsername(e.target.value)}
                  className="w-full bg-[#141724] border border-[#1f2438] rounded px-3 py-2 text-xs text-[#f8fafc] focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#94a3b8] mb-1 uppercase tracking-wider font-semibold">Password</label>
                <input
                  type="password"
                  required
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  className="w-full bg-[#141724] border border-[#1f2438] rounded px-3 py-2 text-xs text-[#f8fafc] focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded transition border-none cursor-pointer"
              >
                Log In
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-[10px] text-[#94a3b8] mb-1 uppercase tracking-wider font-semibold">Username</label>
                <input
                  type="text"
                  required
                  value={regUsername}
                  onChange={(e) => setRegUsername(e.target.value)}
                  className="w-full bg-[#141724] border border-[#1f2438] rounded px-3 py-2 text-xs text-[#f8fafc] focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#94a3b8] mb-1 uppercase tracking-wider font-semibold">Password</label>
                <input
                  type="password"
                  required
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full bg-[#141724] border border-[#1f2438] rounded px-3 py-2 text-xs text-[#f8fafc] focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-[#94a3b8] mb-1 uppercase tracking-wider font-semibold">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={regConfirmPassword}
                  onChange={(e) => setRegConfirmPassword(e.target.value)}
                  className="w-full bg-[#141724] border border-[#1f2438] rounded px-3 py-2 text-xs text-[#f8fafc] focus:outline-none focus:border-blue-500"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-semibold text-xs rounded transition border-none cursor-pointer"
              >
                Register
              </button>
            </form>
          )}

          {/* Show Google Sign-In container conditionally if client ID is configured */}
          {googleClientId && (
            <>
              <div className="relative flex py-4 items-center justify-center">
                <div className="flex-grow border-t border-[#1f2438]"></div>
                <span className="flex-shrink mx-4 text-[10px] text-[#64748b] uppercase tracking-wider font-bold font-sans">OR</span>
                <div className="flex-grow border-t border-[#1f2438]"></div>
              </div>
              <div id="google-signin-btn" className="flex justify-center mb-2 animate-fade-in"></div>
            </>
          )}
        </div>
      </div>
    );
  }

  const edgesWithHandlers = edges.map((e: any) => ({
    ...e,
    type: 'interactive',
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 15,
      height: 15,
      color: theme === 'dark' ? '#3b82f6' : '#2563eb'
    },
    data: {
      onDelete: handleDeleteEdge,
      onInsert: handleInsertNodeOnEdge,
      customTemplates: customNodeTemplates
    }
  }));

  return (
    <div className="app-container h-full w-full bg-bg-app text-text-primary flex flex-col font-sans">
      {/* Header bar */}
      <header className="app-header h-14 bg-bg-panel border-b border-border flex items-center justify-between px-6 z-10 shrink-0 shadow-md">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setCurrentPage('dashboard')}>
            <img src="/logo.png" className="w-8 h-8 object-contain rounded-lg shadow-inner" alt="WiseBlockForge Logo" />
            <span className="logo-text text-base font-bold tracking-tight bg-gradient-to-r from-blue-500 to-indigo-400 bg-clip-text text-transparent">
              WiseBlockForge
            </span>
          </div>

          {currentPage === 'canvas' && activeWorkflow && (
            <div className="flex items-center gap-2 border-l border-border pl-6 font-sans">
              <span className="text-xs font-semibold text-text-secondary bg-bg-hover px-2.5 py-1 rounded-lg">
                📁 {activeWorkflow.name}
              </span>
              {hasChanges && <span className="w-2 h-2 rounded-full bg-yellow-500" title="Unsaved changes present" />}
              
              {/* File Click Dropdown */}
              <div className="relative ml-2">
                <button 
                  onClick={() => setActiveMenu(activeMenu === 'file' ? null : 'file')}
                  className="px-3 py-1 bg-bg-card hover:bg-bg-hover text-text-secondary hover:text-text-primary text-xs rounded border border-border flex items-center gap-1 transition cursor-pointer font-semibold focus:outline-none"
                >
                  File
                </button>
                {activeMenu === 'file' && (
                  <div className="absolute left-0 mt-1 w-48 bg-bg-panel border border-border rounded-lg shadow-2xl py-1 text-left z-50">
                    <button onClick={() => { handleCreateNewWorkflow(); setActiveMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-bg-hover text-xs text-text-primary border-none bg-transparent cursor-pointer">
                      📄 New Canvas
                    </button>
                    <button onClick={() => { handleSaveWorkspace(); setActiveMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-bg-hover text-xs text-text-primary border-none bg-transparent cursor-pointer">
                      💾 Save Current
                    </button>
                    <button onClick={() => { 
                      const next = prompt('Enter new workflow name:', activeWorkflow.name);
                      if (next) handleRenameWorkflow(activeWorkflowId, next);
                      setActiveMenu(null);
                    }} className="w-full text-left px-4 py-2 hover:bg-bg-hover text-xs text-text-primary border-none bg-transparent cursor-pointer">
                      ✏️ Rename
                    </button>
                    <button onClick={() => { handlePublishWorkflow(); setActiveMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-bg-hover text-xs text-text-primary border-none bg-transparent cursor-pointer">
                      🌍 Publish to Gallery
                    </button>
                    <div className="border-t border-border my-1"></div>
                    <label className="w-full text-left px-4 py-2 hover:bg-bg-hover text-xs text-text-primary flex items-center gap-1 cursor-pointer">
                      📤 Import JSON Workflow
                      <input 
                        type="file" 
                        accept=".json" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              const content = evt.target?.result as string;
                              try {
                                const parsed = JSON.parse(content);
                                if (!parsed.nodes || !parsed.edges) throw new Error("Invalid format");
                                const newId = `imported_${Date.now()}`;
                                const newWf: WorkflowFile = {
                                  ...parsed,
                                  id: newId,
                                  isPinned: false,
                                  lastSaved: new Date().toLocaleString()
                                };
                                fetch(`${API_BASE_URL}/api/workflows`, {
                                  method: 'POST',
                                  headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                  },
                                  body: JSON.stringify(newWf)
                                }).then(() => {
                                  setWorkflows(wfs => [...wfs, newWf]);
                                  setActiveWorkflowId(newId);
                                  showToast("Workflow imported successfully!", "success");
                                });
                              } catch (err: any) {
                                showToast("Failed to import workflow: " + err.message, "error");
                              }
                            };
                            reader.readAsText(file);
                          }
                          setActiveMenu(null);
                        }} 
                        className="hidden" 
                      />
                    </label>
                    <label className="w-full text-left px-4 py-2 hover:bg-bg-hover text-xs text-text-primary flex items-center gap-1 cursor-pointer">
                      📓 Import Notebook (.ipynb)
                      <input 
                        type="file" 
                        accept=".ipynb" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              const content = evt.target?.result as string;
                              handleImportIpynb(content);
                            };
                            reader.readAsText(file);
                          }
                          setActiveMenu(null);
                        }} 
                        className="hidden" 
                      />
                    </label>
                    <div className="border-t border-border my-1"></div>
                    <button onClick={() => { setCurrentPage('dashboard'); setActiveMenu(null); }} className="w-full text-left px-4 py-2 hover:bg-bg-hover text-xs text-text-primary border-none bg-transparent cursor-pointer">
                      💼 View Dashboard
                    </button>
                  </div>
                )}
              </div>

              {/* Run Click Dropdown */}
              <div className="relative ml-2">
                <button 
                  onClick={() => setActiveMenu(activeMenu === 'run' ? null : 'run')}
                  className="px-3 py-1 bg-bg-card hover:bg-bg-hover text-text-secondary hover:text-text-primary text-xs rounded border border-border flex items-center gap-1 transition cursor-pointer font-semibold focus:outline-none"
                >
                  Run
                </button>
                {activeMenu === 'run' && (
                  <div className="absolute left-0 mt-1 w-52 bg-bg-panel border border-border rounded-lg shadow-2xl py-1 text-left z-50 font-sans">
                    <button 
                      onClick={() => { runPipeline(); setActiveMenu(null); }} 
                      disabled={isPolling}
                      className="w-full text-left px-4 py-2 hover:bg-bg-hover text-xs text-text-primary border-none bg-transparent cursor-pointer disabled:opacity-50 font-medium"
                    >
                      🚀 Run Entire Pipeline
                    </button>
                    <button 
                      onClick={() => { 
                        if (!selectedNodeId) {
                          showToast("Please select a target node first by clicking on it.", "info");
                        } else {
                          runPipeline(selectedNodeId);
                        }
                        setActiveMenu(null);
                      }} 
                      disabled={isPolling}
                      className="w-full text-left px-4 py-2 hover:bg-bg-hover text-xs text-text-primary border-none bg-transparent cursor-pointer disabled:opacity-50 font-medium"
                    >
                      🎯 Run Till Selected Node
                    </button>
                  </div>
                )}
              </div>

              {/* Terminal Click Dropdown */}
              <div className="relative ml-2">
                <button 
                  onClick={() => setActiveMenu(activeMenu === 'terminal' ? null : 'terminal')}
                  className="px-3 py-1 bg-bg-card hover:bg-bg-hover text-text-secondary hover:text-text-primary text-xs rounded border border-border flex items-center gap-1 transition cursor-pointer font-semibold focus:outline-none"
                >
                  Terminal
                </button>
                {activeMenu === 'terminal' && (
                  <div className="absolute left-0 mt-1 w-56 bg-bg-panel border border-border rounded-lg shadow-2xl py-1 text-left z-50 font-sans">
                    <button 
                      onClick={() => { setShowConsoleTerminal(!showConsoleTerminal); setActiveMenu(null); }} 
                      className="w-full text-left px-4 py-2 hover:bg-bg-hover text-xs text-text-primary border-none bg-transparent cursor-pointer flex items-center justify-between"
                    >
                      <span>🖥️ Console Terminal</span>
                      <span className="text-blue-400 font-bold">{showConsoleTerminal ? '✓' : ''}</span>
                    </button>
                    <button 
                      onClick={() => { setShowLossCurves(!showLossCurves); setActiveMenu(null); }} 
                      className="w-full text-left px-4 py-2 hover:bg-bg-hover text-xs text-text-primary border-none bg-transparent cursor-pointer flex items-center justify-between"
                    >
                      <span>📊 Loss Curves & Charts</span>
                      <span className="text-blue-400 font-bold">{showLossCurves ? '✓' : ''}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Navigation Switcher Button Group */}
        <div className="flex gap-1.5 bg-slate-200/60 dark:bg-bg-card p-1 border border-border rounded-lg shadow-inner">
          <button
            onClick={() => setCurrentPage('canvas')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer border-none ${
              currentPage === 'canvas' 
                ? 'bg-blue-600 text-white shadow-md font-bold' 
                : 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-slate-300/40 dark:hover:bg-bg-hover'
            }`}
          >
            🖥️ Canvas
          </button>
          <button
            onClick={() => setCurrentPage('dashboard')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer border-none ${
              currentPage === 'dashboard' 
                ? 'bg-blue-600 text-white shadow-md font-bold' 
                : 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-slate-300/40 dark:hover:bg-bg-hover'
            }`}
          >
            💼 Dashboard
          </button>
          <button
            onClick={() => setCurrentPage('datasets')}
            className={`px-4 py-1.5 text-xs font-semibold rounded-md transition cursor-pointer border-none ${
              currentPage === 'datasets' 
                ? 'bg-blue-600 text-white shadow-md font-bold' 
                : 'bg-transparent text-text-secondary hover:text-text-primary hover:bg-slate-300/40 dark:hover:bg-bg-hover'
            }`}
          >
            📂 Datasets
          </button>
        </div>

        {/* Global actions */}
        <div className="flex items-center gap-4 font-sans text-right">
          <span className="text-[10px] text-[#94a3b8] font-semibold">
            👤 User: <span className="text-blue-400">{authUsername}</span>
          </span>
          
          <button
            className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-xs hover:bg-bg-hover transition cursor-pointer"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title="Toggle Light/Dark Theme"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <button
            onClick={handleLogout}
            className="px-2.5 py-1 bg-red-600/10 text-red-400 border border-red-600/20 hover:bg-red-600 hover:text-white rounded text-xs font-semibold cursor-pointer transition"
          >
            Log Out
          </button>
        </div>
      </header>

      {/* Pages Container */}
      <div className="flex-1 min-h-0 relative">
        {currentPage === 'dashboard' ? (
          <Dashboard
            workflows={workflows}
            communityWorkflows={communityWorkflows}
            activeWorkflowId={activeWorkflowId}
            onOpenWorkflow={handleOpenWorkflow}
            onDeleteWorkflow={handleDeleteWorkflow}
            onDownloadWorkflow={handleDownloadWorkflow}
            onTogglePin={handleTogglePin}
            onRenameWorkflow={handleRenameWorkflow}
            onForkWorkflow={handleForkWorkflow}
            onClose={() => setCurrentPage('canvas')}
          />
        ) : currentPage === 'datasets' ? (
          <DatasetsManager
            token={token}
            onDeployDataset={handleDeployDataset}
            showToast={showToast}
          />
        ) : (
          // CANVAS PAGE VIEW
          <div className="w-full h-full flex relative">
            
            {/* Sidebar Node Palette */}
            {isLeftSidebarOpen && (
              <aside className="w-64 border-r border-border bg-bg-panel/40 flex flex-col shrink-0 text-left font-sans">
                <div className="p-4 border-b border-border">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-2">
                    Node Palette Templates
                  </span>
                  
                  {/* Palette Search Bar */}
                  <input
                    type="text"
                    placeholder="🔍 Search presets..."
                    value={presetSearch}
                    onChange={(e) => setPresetSearch(e.target.value)}
                    className="w-full bg-bg-card border border-border rounded px-2.5 py-1.5 text-xs text-text-primary mb-3 focus:outline-none focus:border-blue-500 font-sans"
                  />

                  {/* Preset Nodes list scroll container */}
                  <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-2.5 pr-1">
                    {filteredPresets.length === 0 ? (
                      <div className="text-[10px] text-text-muted italic py-2 text-center">No presets match.</div>
                    ) : (
                      filteredPresets.map((p) => (
                        <div
                          key={p.type}
                          className="p-3 border border-border bg-bg-card rounded-xl cursor-grab hover:bg-bg-hover hover:border-blue-500/30 transition shadow"
                          draggable
                          onDragStart={(e) => onDragStart(e, p.type)}
                        >
                          <div className="font-bold text-xs flex items-center gap-1.5" style={{ color: p.color }}>
                            {p.icon} {p.label}
                          </div>
                          <div className="text-[9px] text-text-secondary mt-1">{p.desc}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                      My Custom Blocks
                    </span>
                    <button
                      onClick={() => setIsCreatorOpen(true)}
                      className="text-[9px] bg-blue-600/10 text-blue-400 border border-blue-600/30 hover:bg-blue-600/20 px-2 py-0.5 rounded transition font-semibold cursor-pointer"
                    >
                      + Creator
                    </button>
                  </div>

                  {customNodeTemplates.length === 0 ? (
                    <p className="text-[10px] text-text-muted italic text-center py-4 border border-dashed border-border rounded-lg bg-bg-card/20">
                      No custom nodes written. Click "+ Creator" to register custom blocks.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {customNodeTemplates.map((t, idx) => (
                        <div
                          key={t.type + idx}
                          className="p-3 border border-border bg-bg-card rounded-xl cursor-grab hover:bg-bg-hover transition shadow"
                          style={{ borderLeft: `3px solid ${t.color}` }}
                          draggable
                          onDragStart={(e) => onDragStart(e, 'custom_node', idx)}
                        >
                          <div className="font-bold text-xs text-text-primary truncate">
                            🔨 {t.label}
                          </div>
                          <div className="text-[9px] text-text-secondary truncate mt-0.5">{t.desc}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </aside>
            )}

            {/* Flow Canvas Area */}
            <div className="flex-1 h-full relative bg-bg-app">
              {/* Floating Collapse Toggles */}
              <button
                onClick={() => setIsLeftSidebarOpen(!isLeftSidebarOpen)}
                className="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-5 h-12 bg-[#1e293b]/90 hover:bg-[#1e293b] border border-border rounded-r-lg text-text-secondary hover:text-text-primary transition flex items-center justify-center cursor-pointer shadow-md text-xs font-sans"
                title={isLeftSidebarOpen ? 'Collapse Left Palette' : 'Expand Left Palette'}
                style={{ borderLeft: 'none' }}
              >
                {isLeftSidebarOpen ? '◀' : '▶'}
              </button>

              <button
                onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
                className="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-5 h-12 bg-[#1e293b]/90 hover:bg-[#1e293b] border border-border rounded-l-lg text-text-secondary hover:text-text-primary transition flex items-center justify-center cursor-pointer shadow-md text-xs font-sans"
                title={isRightSidebarOpen ? 'Collapse Right Inspector' : 'Expand Right Inspector'}
                style={{ borderRight: 'none' }}
              >
                {isRightSidebarOpen ? '▶' : '◀'}
              </button>

              <ReactFlow
                nodes={nodes}
                edges={edgesWithHandlers}
                onNodesChange={handleNodesChangeWrapped}
                onEdgesChange={handleEdgesChangeWrapped}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                onNodeClick={(_, node) => setSelectedNodeId(node.id)}
                onNodeDoubleClick={(_, node) => {
                  setSelectedNodeId(node.id);
                  setIsInspectorOpen(true);
                }}
                onPaneClick={() => {
                  setSelectedNodeId(null);
                  setActiveMenu(null);
                }}
                onDragOver={onDragOver}
                onDrop={onDrop}
                fitView
                minZoom={0.2}
                maxZoom={2.0}
              >
                <Background 
                  color={theme === 'dark' ? '#334155' : '#94a3b8'} 
                  gap={20} 
                  size={2.5} 
                />
                <Controls />
                <MiniMap style={{ height: 100 }} zoomable pannable />
              </ReactFlow>
            </div>

            {/* Properties side drawer */}
            {isRightSidebarOpen && (
              <aside className="w-80 border-l border-border bg-bg-panel/40 flex flex-col shrink-0 text-left overflow-y-auto custom-scrollbar font-sans">
                <div className="border-b border-border">
                  <div 
                    onClick={() => setIsKaggleCredentialsOpen(!isKaggleCredentialsOpen)}
                    className="p-4 bg-bg-card/30 hover:bg-bg-card/80 flex items-center justify-between cursor-pointer transition select-none"
                  >
                    <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider">
                      🗝️ Kaggle Setup
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-bold ${isKaggleVerified ? 'bg-green-600/20 text-green-400 border border-green-600/30' : 'bg-red-600/20 text-red-400 border border-red-600/30'}`}>
                      {isKaggleVerified ? 'Verified 🟢' : 'Not Configured 🔴'}
                    </span>
                  </div>

                  {isKaggleCredentialsOpen && (
                    <div className="p-4 bg-bg-panel/60 border-t border-border space-y-3">
                      <div>
                        <label className="block text-[10px] text-text-secondary mb-1">Username</label>
                        <input
                          type="text"
                          autoComplete="off"
                          className="w-full bg-bg-card border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-blue-500"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-text-secondary mb-1">API Key (Token)</label>
                        <input
                          type="password"
                          autoComplete="new-password"
                          className="w-full bg-bg-card border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none focus:border-blue-500"
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                        />
                      </div>
                      <button
                        onClick={handleSaveKaggle}
                        className="w-full py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded transition border-none cursor-pointer"
                      >
                        Save & Verify Credentials
                      </button>
                      <span className="block text-[8px] text-text-muted leading-normal mt-2">
                        ⚠️ Live plotting and run status updates require completed phone-verification on Kaggle settings dashboard to enable Internet kernels.
                      </span>
                    </div>
                  )}
                </div>

                {/* Execution Controls */}
                <div className="p-4 border-b border-border font-sans">
                  <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-3">
                    🚀 Remote Execution
                  </span>
                  <div className="space-y-3 font-sans">
                    <button
                      onClick={() => runPipeline()}
                      disabled={isPolling}
                      className="w-full py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:from-border disabled:to-border text-white font-bold text-xs rounded-lg shadow-md transition border-none cursor-pointer"
                    >
                      {isPolling ? 'Executing on Kaggle...' : 'Compile & Run Pipeline'}
                    </button>

                    {isPolling && (
                      <button
                        onClick={stopPipeline}
                        className="w-full py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs rounded-lg shadow-md transition border-none cursor-pointer mt-2"
                      >
                        ⏹️ Stop Run Execution
                      </button>
                    )}
                    
                    {runStatus && (
                      <div className="flex items-center justify-between text-xs bg-bg-card border border-border px-3 py-1.5 rounded-lg font-sans">
                        <span className="text-text-secondary font-sans">Status:</span>
                        <span className={`px-2 py-0.5 font-bold uppercase rounded-full text-[9px] ${
                          runStatus === 'queued' ? 'bg-gray-500/20 text-gray-400 border border-border' :
                          runStatus === 'running' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                          runStatus === 'complete' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          'bg-red-500/20 text-red-400 border border-red-500/30'
                        }`}>
                          {runStatus}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 border border-border rounded-lg overflow-hidden bg-bg-card">
                    <button
                      onClick={() => setShowCode(!showCode)}
                      className="w-full px-3 py-1.5 bg-bg-card hover:bg-bg-hover border-none font-semibold text-[10px] text-text-primary text-left flex items-center justify-between focus:outline-none cursor-pointer"
                    >
                      <span>{showCode ? '▼ Hide Generated Code' : '▶ Show Compiled Code'}</span>
                    </button>
                    {showCode && (
                      <pre className="p-3 bg-black/60 text-[#93c5fd] font-mono text-[9px] max-h-40 overflow-auto whitespace-pre leading-normal border-t border-border text-left font-sans">
                        {generatedCode}
                      </pre>
                    )}
                  </div>
                </div>

                {/* Side Drawer Node Inspector */}
                {selectedNode ? (
                  <div className="p-4 space-y-4">
                    <div>
                      <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                        Node Hyperparameters
                      </span>
                      <h3 className="font-bold text-xs text-text-primary">{selectedNode.data.label}</h3>
                      <p className="text-[10px] text-text-secondary mt-0.5">{selectedNode.data.desc}</p>
                    </div>

                    {/* Delete Block from Drawer properties list */}
                    {selectedNode.type !== 'start_node' && (
                      <button
                        onClick={() => handleDeleteNode(selectedNode.id)}
                        className="w-full py-1.5 bg-red-600/20 hover:bg-red-600/35 text-red-400 hover:text-red-300 text-xs font-semibold border border-red-600/30 rounded-lg cursor-pointer transition border-none"
                      >
                        ✕ Delete Block Node
                      </button>
                    )}

                    {/* Dataset Selector inputs */}
                    {selectedNode.type === 'data_input' && (
                      <div className="space-y-3 bg-bg-card/40 p-3 rounded-lg border border-border">
                        <div>
                          <label className="block text-[10px] text-text-secondary mb-1 font-semibold">Dataset Model</label>
                          <select
                            value={selectedNode.data.dataset || 'MNIST'}
                            onChange={(e) => {
                              const newDs = e.target.value;
                              let code = undefined;
                              if (newDs === 'MNIST') {
                                code = 'import torch\nfrom torchvision import datasets, transforms\ntransform = transforms.Compose([transforms.ToTensor(), transforms.Normalize((0.1307,), (0.3081,))])\nprint("Loading dataset: MNIST...")\ntrain_dataset = datasets.MNIST("./data", train=True, download=True, transform=transform)\ntest_dataset = datasets.MNIST("./data", train=False, transform=transform)\ntrain_loader = torch.utils.data.DataLoader(train_dataset, batch_size=64, shuffle=True)\ntest_loader = torch.utils.data.DataLoader(test_dataset, batch_size=1000, shuffle=False)\nprint("Dataset MNIST loaded successfully.")';
                              } else if (newDs === 'Titanic') {
                                code = 'import pandas as pd\nprint("Loading dataset: Titanic...")\nurl = "https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv"\ndf = pd.read_csv(url)\nprint("Titanic dataset loaded. Shape:", df.shape)';
                              } else if (newDs === 'Iris') {
                                code = 'import pandas as pd\nprint("Loading dataset: Iris...")\nurl = "https://raw.githubusercontent.com/mwaskom/seaborn-data/master/iris.csv"\ndf = pd.read_csv(url)\nprint("Iris dataset loaded. Shape:", df.shape)';
                              }
                              handleConfigChange(selectedNodeId!, { dataset: newDs, desc: `Dataset: ${newDs}`, code });
                            }}
                            className="w-full bg-bg-card border border-border text-xs text-text-primary rounded px-2 py-1.5 focus:outline-none"
                          >
                            <option value="MNIST">MNIST Handwritten Digits</option>
                            <option value="Titanic">Titanic Survival Data</option>
                            <option value="Iris">Iris Flower Species</option>
                            {selectedNode.data.dataset && !['MNIST', 'Titanic', 'Iris'].includes(selectedNode.data.dataset) && (
                              <option value={selectedNode.data.dataset}>{selectedNode.data.dataset}</option>
                            )}
                          </select>
                        </div>

                        <div className="pt-2 border-t border-dashed border-border">
                          <label className="block text-[10px] text-text-secondary mb-1 font-semibold">🔍 Search Kaggle Datasets</label>
                          <div className="flex gap-1">
                            <input
                              type="text"
                              placeholder="Search..."
                              id="kaggle-side-search-input"
                              className="w-full bg-bg-card border border-border rounded px-2 py-1 text-xs text-text-primary focus:outline-none"
                            />
                            <button
                              onClick={async () => {
                                const el = document.getElementById('kaggle-side-search-input') as HTMLInputElement;
                                const q = el?.value;
                                if (!q) return;
                                try {
                                  const res = await fetch(`${API_BASE_URL}/api/datasets/search?query=${encodeURIComponent(q)}`, {
                                    headers: { 'Authorization': `Bearer ${token}` }
                                  });
                                  if (res.ok) setKaggleSearchResults(await res.json());
                                } catch (err) {
                                  console.error(err);
                                }
                              }}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-semibold rounded cursor-pointer border-none"
                            >
                              Search
                            </button>
                          </div>

                          {/* Search Results list layout */}
                          {kaggleSearchResults.length > 0 && (
                            <div className="mt-2 max-h-32 overflow-y-auto border border-border rounded bg-black/20 p-1 space-y-1.5 custom-scrollbar">
                              {kaggleSearchResults.map((ds) => (
                                <div key={ds.ref} className="text-[10px] flex items-center justify-between gap-1 p-1 hover:bg-bg-hover rounded">
                                  <div className="truncate flex-1">
                                    <span className="font-semibold block truncate text-text-primary text-[9px]">{ds.title}</span>
                                    <span className="text-[8px] text-text-muted block truncate">{ds.ref}</span>
                                  </div>
                                  <button
                                    onClick={() => {
                                      const code = `import os\nimport pandas as pd\nimport json\ndataset_ref = "${ds.ref}"\ndataset_slug = "${ds.ref.split('/')[1]}"\ninput_dir = f"/kaggle/input/{dataset_slug}"\nprint(f"Loading custom Kaggle dataset {dataset_ref} from {input_dir}...")\nif os.path.exists(input_dir):\n    files = os.listdir(input_dir)\n    print("Mounted files:", files)\nelse:\n    print("Dataset directory not found.")`;
                                      handleConfigChange(selectedNodeId!, {
                                        dataset: ds.ref,
                                        desc: `Kaggle: ${ds.title}`,
                                        code: code
                                      });
                                      showToast(`Selected Kaggle dataset: ${ds.title}`, 'success');
                                    }}
                                    className="px-1.5 py-0.5 bg-green-600 hover:bg-green-500 text-white text-[8px] font-bold rounded cursor-pointer border-none"
                                  >
                                    Select
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="text-center font-sans">
                      <button
                        onClick={() => setIsInspectorOpen(true)}
                        className="w-full py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 hover:text-blue-300 text-xs font-semibold border border-blue-600/30 rounded-lg cursor-pointer transition font-sans"
                      >
                        🔍 Open Fullscreen Inspector Popup
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-text-muted flex-1 font-sans">
                    <span className="text-xl mb-1">🖱️</span>
                    <span className="text-[10px] font-semibold text-text-secondary">Node Inspector Empty</span>
                    <span className="text-[9px] mt-0.5">Double click any block on the canvas to configure parameters and edit python codes in a modal popup.</span>
                  </div>
                )}
              </aside>
            )}
          </div>
        )}
      </div>

      {/* Bottom status & themed logs console area */}
      {currentPage === 'canvas' && (showConsoleTerminal || showLossCurves) && (
        <footer className="h-44 border-t border-border bg-bg-app flex z-10 shrink-0 text-left overflow-hidden">
          {/* Charts/Plots tab */}
          {showLossCurves && (
            <div className="flex-1 border-r border-border overflow-y-auto custom-scrollbar flex flex-col">
              <div className="px-4 py-2 border-b border-border bg-bg-card/40 flex items-center justify-between shrink-0">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
                  📊 Real-Time Loss Curves & Charts
                </span>
                <button
                  onClick={() => setShowLossCurves(false)}
                  className="text-[10px] text-text-muted hover:text-red-400 bg-transparent border-none cursor-pointer p-0 font-bold"
                  title="Hide Loss Curves panel"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1">
                <ChartRenderer plots={plots} />
              </div>
            </div>
          )}

          {/* Theme-Aware Console logs box */}
          {showConsoleTerminal && (
            <div className={`flex flex-col shrink-0 ${showLossCurves ? 'w-96' : 'flex-1'}`} style={{ backgroundColor: 'var(--bg-console)', borderLeft: showLossCurves ? '1px solid var(--border-console)' : 'none' }}>
              <div className="px-4 py-2 border-b flex items-center justify-between shrink-0" style={{ borderColor: 'var(--border-console)', backgroundColor: 'var(--bg-card)' }}>
                <span className="text-[10px] font-bold font-mono" style={{ color: 'var(--text-console)' }}>
                  CONSOLE stdout terminal
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsConsoleOpen(true)}
                    className="px-2 py-0.5 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-[9px] font-bold rounded border border-blue-600/30 transition cursor-pointer"
                  >
                    🔍 Fullscreen Terminal
                  </button>
                  <button
                    onClick={() => setShowConsoleTerminal(false)}
                    className="text-[10px] text-text-muted hover:text-red-400 bg-transparent border-none cursor-pointer p-0 font-bold"
                    title="Hide Console panel"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="flex-1 p-3 font-mono text-[10px] overflow-y-auto whitespace-pre-wrap custom-scrollbar" style={{ color: 'var(--text-console)' }}>
                {logs ? logs : <span className="text-text-muted italic">Waiting for execution logs...</span>}
              </div>
            </div>
          )}
        </footer>
      )}

      {/* Fullscreen grouped Console modal overlay */}
      <ConsolePopup
        isOpen={isConsoleOpen}
        onClose={() => setIsConsoleOpen(false)}
        logs={logs}
        nodes={nodes}
        nodeStatuses={nodeStatuses}
        errors={nodeErrors}
        nodeOutputs={nodeOutputs}
        onLocateNode={locateNodeOnCanvas}
      />

      {/* Double Click Node Popup Modal Inspector (Premium Three-Column Layout) */}
      {isInspectorOpen && selectedNode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/75 backdrop-blur-sm font-sans">
          <div className="w-full max-w-5xl bg-bg-panel border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[85vh] font-sans">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-card/50 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-lg">{selectedNode.data.icon || '📦'}</span>
                <div>
                  <h2 className="font-bold text-text-primary text-sm">{selectedNode.data.label} ({selectedNode.type})</h2>
                  <p className="text-[10px] text-text-secondary">{selectedNode.data.desc}</p>
                </div>
              </div>
              <div className="flex gap-2">
                {selectedNode.type !== 'start_node' && (
                  <button
                    onClick={() => {
                      setIsInspectorOpen(false);
                      handleDeleteNode(selectedNode.id);
                    }}
                    className="px-3 py-1 text-xs font-semibold rounded bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-600/30 cursor-pointer transition border-none"
                  >
                    ✕ Delete Node
                  </button>
                )}
                <button
                  onClick={() => setIsInspectorOpen(false)}
                  className="px-3 py-1 rounded border border-border bg-bg-card hover:bg-bg-hover text-text-secondary hover:text-text-primary text-xs cursor-pointer font-semibold transition border-none"
                >
                  ✕ Close Inspector
                </button>
              </div>
            </div>

            {/* Three-Column Modal Body */}
            <div className="flex-1 flex flex-col md:flex-row gap-6 p-6 overflow-hidden min-h-[60vh] max-h-[70vh]">
              
              {/* Column 1: Left Parameters / Config */}
              <div className="w-full md:w-1/4 flex flex-col gap-4 overflow-y-auto pr-2 border-r border-border text-left font-sans custom-scrollbar">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                  ⚙️ Config Parameters
                </span>

                {/* Dataset hyperparameter selector */}
                {selectedNode.type === 'data_input' && (
                  <div className="space-y-4 bg-bg-card/30 p-4 border border-border rounded-xl">
                    <div>
                      <label className="block text-[10px] text-text-secondary mb-1.5 font-bold uppercase tracking-wider">Dataset preset</label>
                      <select
                        value={selectedNode.data.dataset || 'MNIST'}
                        onChange={(e) => {
                          const newDs = e.target.value;
                          let code = undefined;
                          if (newDs === 'MNIST') {
                            code = 'import torch\nfrom torchvision import datasets, transforms\ntransform = transforms.Compose([transforms.ToTensor(), transforms.Normalize((0.1307,), (0.3081,))])\nprint("Loading dataset: MNIST...")\ntrain_dataset = datasets.MNIST("./data", train=True, download=True, transform=transform)\ntest_dataset = datasets.MNIST("./data", train=False, transform=transform)\ntrain_loader = torch.utils.data.DataLoader(train_dataset, batch_size=64, shuffle=True)\ntest_loader = torch.utils.data.DataLoader(test_dataset, batch_size=1000, shuffle=False)\nprint("Dataset MNIST loaded successfully.")';
                          } else if (newDs === 'Titanic') {
                            code = 'import pandas as pd\nprint("Loading dataset: Titanic...")\nurl = "https://raw.githubusercontent.com/datasciencedojo/datasets/master/titanic.csv"\ndf = pd.read_csv(url)\nprint("Titanic dataset loaded. Shape:", df.shape)';
                          } else if (newDs === 'Iris') {
                            code = 'import pandas as pd\nprint("Loading dataset: Iris...")\nurl = "https://raw.githubusercontent.com/mwaskom/seaborn-data/master/iris.csv"\ndf = pd.read_csv(url)\nprint("Iris dataset loaded. Shape:", df.shape)';
                          }
                          handleConfigChange(selectedNodeId!, { dataset: newDs, desc: `Dataset: ${newDs}`, code });
                        }}
                        className="w-full bg-bg-card border border-border text-xs text-text-primary rounded px-2.5 py-1.5 focus:outline-none"
                      >
                        <option value="MNIST">MNIST Handwritten Digits</option>
                        <option value="Titanic">Titanic Survival Data</option>
                        <option value="Iris">Iris Flower Species</option>
                        {selectedNode.data.dataset && !['MNIST', 'Titanic', 'Iris'].includes(selectedNode.data.dataset) && (
                          <option value={selectedNode.data.dataset}>{selectedNode.data.dataset}</option>
                        )}
                      </select>
                    </div>

                    <div className="pt-2 border-t border-dashed border-border">
                      <label className="block text-[10px] text-text-secondary mb-1.5 font-bold uppercase tracking-wider">🔍 Search Kaggle Datasets</label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Search Kaggle..."
                          id="kaggle-modal-search-input"
                          className="flex-1 bg-bg-card border border-border rounded px-2.5 py-1 text-xs text-text-primary focus:outline-none"
                        />
                        <button
                          onClick={async () => {
                            const el = document.getElementById('kaggle-modal-search-input') as HTMLInputElement;
                            const q = el?.value;
                            if (!q) return;
                            try {
                              const res = await fetch(`${API_BASE_URL}/api/datasets/search?query=${encodeURIComponent(q)}`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                              });
                              if (res.ok) setKaggleSearchResults(await res.json());
                            } catch (err) {
                              console.error(err);
                            }
                          }}
                          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded cursor-pointer border-none"
                        >
                          Search
                        </button>
                      </div>
                    </div>

                    {kaggleSearchResults.length > 0 && (
                      <div className="border border-border rounded bg-black/20 p-2 max-h-40 overflow-y-auto custom-scrollbar space-y-1.5">
                        {kaggleSearchResults.map((ds) => (
                          <div key={ds.ref} className="text-[10px] flex items-center justify-between gap-2 p-1.5 hover:bg-bg-hover rounded border border-border/40 bg-bg-card/40">
                            <div className="truncate flex-1">
                              <span className="font-semibold block text-text-primary truncate">{ds.title}</span>
                              <span className="text-[8px] text-text-muted truncate block">{ds.ref} ({ds.size})</span>
                            </div>
                            <button
                              onClick={() => {
                                const code = `import os\nimport pandas as pd\nimport json\ndataset_ref = "${ds.ref}"\ndataset_slug = "${ds.ref.split('/')[1]}"\ninput_dir = f"/kaggle/input/{dataset_slug}"\nprint(f"Loading custom Kaggle dataset {dataset_ref} from {input_dir}...")\nif os.path.exists(input_dir):\n    files = os.listdir(input_dir)\n    print("Mounted files:", files)\nelse:\n    print("Dataset directory not found.")`;
                                handleConfigChange(selectedNodeId!, {
                                  dataset: ds.ref,
                                  desc: `Kaggle: ${ds.title}`,
                                  code: code
                                });
                                showToast(`Selected Kaggle dataset: ${ds.title}`, 'success');
                              }}
                              className="px-2 py-0.5 bg-green-600 hover:bg-green-500 text-white text-[9px] font-bold rounded cursor-pointer border-none"
                            >
                              Select
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Interactive Dataset Preview */}
                {selectedNode.type === 'data_input' && (
                  <div className="bg-bg-card/30 p-4 border border-border rounded-xl space-y-3 flex flex-col min-h-[220px] max-h-[350px]">
                    <span className="text-[10px] font-bold text-text-primary uppercase tracking-wider block">
                      📊 Dataset Preview
                    </span>
                    {loadingPreview ? (
                      <span className="text-xs text-text-muted italic block py-4 text-center">Loading preview data...</span>
                    ) : datasetPreview ? (
                      <div className="flex-1 overflow-auto custom-scrollbar text-[10px]">
                        {datasetPreview.format === 'csv' && (
                          <div className="border border-border rounded overflow-hidden">
                            <table className="min-w-full divide-y divide-border text-[9px] font-sans">
                              <thead className="bg-bg-card">
                                <tr>
                                  {datasetPreview.headers?.map((h: string, idx: number) => (
                                    <th key={idx} className="px-2 py-1 text-left font-bold text-text-muted truncate max-w-[80px]">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border bg-black/10">
                                {datasetPreview.rows?.map((row: string[], rIdx: number) => (
                                  <tr key={rIdx}>
                                    {row.map((cell: any, cIdx: number) => (
                                      <td key={cIdx} className="px-2 py-1 text-text-secondary truncate max-w-[80px]" title={String(cell)}>{String(cell)}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {datasetPreview.format === 'mnist' && (
                          <div className="border border-border rounded overflow-hidden">
                            <table className="min-w-full divide-y divide-border text-[9px] font-sans">
                              <thead className="bg-bg-card">
                                <tr>
                                  {datasetPreview.headers?.map((h: string, idx: number) => (
                                    <th key={idx} className="px-2 py-1 text-left font-bold text-text-muted">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border bg-black/10">
                                {datasetPreview.rows?.map((row: string[], rIdx: number) => (
                                  <tr key={rIdx}>
                                    {row.map((cell: any, cIdx: number) => (
                                      <td key={cIdx} className="px-2 py-1 text-text-secondary">{String(cell)}</td>
                                    ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                        {datasetPreview.format === 'json' && (
                          <pre className="p-2 bg-black/40 text-blue-400 font-mono text-[9px] leading-relaxed whitespace-pre-wrap rounded border border-border">
                            {datasetPreview.content}
                            {datasetPreview.content?.length >= 1000 && "..."}
                          </pre>
                        )}
                        {datasetPreview.format === 'zip' && (
                          <div className="space-y-1.5">
                            <span className="text-[9px] text-text-muted font-semibold uppercase tracking-wider block">
                              Files in Archive ({datasetPreview.total_files} total):
                            </span>
                            {datasetPreview.error ? (
                              <span className="text-red-400 font-mono text-[9px]">{datasetPreview.error}</span>
                            ) : (
                              <div className="bg-black/30 p-2 border border-border rounded space-y-1 font-mono text-[8px] text-green-400">
                                {datasetPreview.files?.map((f: string, idx: number) => (
                                  <div key={idx} className="truncate" title={f}>📄 {f}</div>
                                ))}
                                {datasetPreview.total_files > 10 && <div className="text-text-muted italic">...and {datasetPreview.total_files - 10} more files</div>}
                              </div>
                            )}
                          </div>
                        )}
                        {datasetPreview.format === 'other' && (
                          <div className="p-3 bg-bg-card border border-border rounded-xl space-y-1.5">
                            <div className="font-bold text-text-primary text-[10px] truncate">{datasetPreview.filename || selectedNode.data.dataset}</div>
                            <div className="text-[9px] text-text-secondary">Size: {datasetPreview.size_bytes ? `${(datasetPreview.size_bytes / 1024).toFixed(2)} KB` : 'unknown'}</div>
                            <div className="text-[9px] text-text-muted italic">No tabular preview layout is available for this format.</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted italic block py-4 text-center">No preview loaded.</span>
                    )}
                  </div>
                )}

                {/* Epochs hyperparameters if model_training */}
                {selectedNode.type === 'model_training' && (
                  <div className="bg-bg-card/30 p-4 border border-border rounded-xl space-y-2">
                    <div>
                      <label className="block text-[10px] text-text-secondary uppercase tracking-wider font-bold">Epochs Hyperparameter</label>
                      <span className="text-[9px] text-text-muted mt-0.5 block">Configure iterations length for training loop</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={selectedNode.data.epochs || 1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 1;
                        handleConfigChange(selectedNodeId!, { epochs: val });
                      }}
                      className="w-full text-center bg-bg-card border border-border text-text-primary text-xs rounded py-1.5 focus:outline-none"
                    />
                  </div>
                )}

                {/* Info and inputs details */}
                <div className="bg-bg-card/20 border border-border/80 p-3 rounded-lg text-[10px] text-text-secondary space-y-2">
                  <div className="font-bold text-text-primary">🔌 Connection Ports</div>
                  <div>
                    <span className="font-semibold block text-[9px] uppercase tracking-wider text-text-muted">Target Inputs:</span>
                    {selectedNode.data.inputs && selectedNode.data.inputs.length > 0 ? (
                      selectedNode.data.inputs.map((i: any) => <div key={i.name} className="mt-0.5 font-mono text-[9px] text-blue-400">{i.name} ({i.type})</div>)
                    ) : <span className="italic text-[9px]">None</span>}
                  </div>
                  <div>
                    <span className="font-semibold block text-[9px] uppercase tracking-wider text-text-muted">Source Outputs:</span>
                    {selectedNode.data.outputs && selectedNode.data.outputs.length > 0 ? (
                      selectedNode.data.outputs.map((o: any) => <div key={o.name} className="mt-0.5 font-mono text-[9px] text-green-400">{o.name} ({o.type})</div>)
                    ) : <span className="italic text-[9px]">None</span>}
                  </div>
                </div>
              </div>

              {/* Column 2: Center Code Editor */}
              <div className="flex-1 flex flex-col border border-border/80 rounded-xl overflow-hidden bg-black/40 min-h-[400px]">
                <div className="px-4 py-2 bg-bg-card/50 border-b border-border flex items-center justify-between text-[9px] text-text-muted font-mono shrink-0">
                  <span>Edit Python Instance Script Snippet</span>
                  <span className="text-[8px] bg-blue-600/10 text-blue-400 px-1.5 py-0.5 rounded font-bold uppercase">instance execution code</span>
                </div>
                <textarea
                  value={selectedNode.data.code !== undefined ? selectedNode.data.code : (
                    selectedNode.type === 'start_node' ? 'print("Kaggle queue finished! Pipeline execution starting...")' :
                    selectedNode.type === 'data_input' ? 'train_dataset = datasets.MNIST("./data", train=True, download=True)\ntest_dataset = datasets.MNIST("./data", train=False)' :
                    selectedNode.type === 'model_training' ? `epochs = ${selectedNode.data.epochs || 1}\n# Training SimpleMLP loop...` :
                    selectedNode.type === 'evaluation' ? 'model.eval()\n# Validating accuracy...' : '# Custom block code preset...'
                  )}
                  onChange={(e) => {
                    handleConfigChange(selectedNodeId!, { code: e.target.value });
                  }}
                  className="w-full flex-1 bg-transparent font-mono text-xs text-[#93c5fd] p-4 focus:outline-none leading-relaxed resize-none custom-scrollbar"
                />
              </div>

              {/* Column 3: Right Node Outputs / Tracebacks */}
              <div className="w-full md:w-1/4 flex flex-col gap-4 overflow-y-auto pl-2 border-l border-border text-left font-sans custom-scrollbar">
                <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block mb-1">
                  📊 Output stdout & status
                </span>

                {/* Node Traceback Error */}
                {selectedNode.data.nodeError && (
                  <div className="p-4 border border-red-500/25 bg-red-500/5 rounded-xl text-red-400">
                    <span className="text-[10px] font-bold block mb-1 uppercase tracking-wider">❌ Traceback Message:</span>
                    <pre className="font-mono text-[9px] whitespace-pre-wrap max-h-36 overflow-y-auto bg-black/40 p-3 rounded border border-red-500/10">
                      {selectedNode.data.nodeError}
                    </pre>
                  </div>
                )}

                {/* Active Specific node outputs list */}
                <div className="space-y-3">
                  <span className="text-[10px] font-bold text-text-secondary block">Variable Outputs:</span>
                  {nodeOutputs[selectedNode.id] && nodeOutputs[selectedNode.id].length > 0 ? (
                    <div className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar">
                      {nodeOutputs[selectedNode.id].map((out, idx) => (
                        <div key={idx} className="bg-black/20 border border-border p-2 rounded text-[10px] font-mono whitespace-pre-wrap text-text-primary">
                          {typeof out === 'object' ? JSON.stringify(out, null, 2) : String(out)}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span className="text-text-muted italic text-[10px] block border border-dashed border-border rounded p-3 text-center bg-bg-card/10">
                      No variables recorded for this block yet. Run pipeline to inspect output variables.
                    </span>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Custom Node template creator modal dialog */}
      <CustomNodeCreator
        isOpen={isCreatorOpen}
        onClose={() => setIsCreatorOpen(false)}
        onSave={handleSaveCustomNodeTemplate}
        showToast={showToast}
      />

      {/* Unsaved changes confirmation dialog modal */}
      {unsavedDialog?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-bg-panel border border-border rounded-xl p-6 w-full max-w-sm text-left shadow-2xl font-sans">
            <h3 className="font-bold text-text-primary text-sm mb-2 font-sans">💾 Unsaved Canvas Changes</h3>
            <p className="text-xs text-text-secondary mb-5 font-sans">
              Your active workflow "{activeWorkflow?.name}" contains unsaved modifications. Do you want to save them before proceeding?
            </p>
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setUnsavedDialog(null)}
                className="px-3 py-1.5 border border-border bg-bg-card hover:bg-bg-hover text-xs text-text-secondary rounded cursor-pointer border-none"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await handleSaveWorkspace();
                  setUnsavedDialog(null);
                  unsavedDialog.nextAction();
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white rounded cursor-pointer border-none"
              >
                Save & Continue
              </button>
              <button
                onClick={() => {
                  setHasChanges(false);
                  setUnsavedDialog(null);
                  unsavedDialog.nextAction();
                }}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-xs font-semibold text-white rounded cursor-pointer border-none"
              >
                Discard Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Sliding Toast notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-[#1e293b]/90 border border-blue-500/30 backdrop-blur-md text-white text-xs font-semibold rounded-xl shadow-lg animate-slide-in font-sans">
          <span>{toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}</span>
          <span>{toast.message}</span>
        </div>
      )}

    </div>
  );
}
