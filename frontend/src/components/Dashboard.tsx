import { useState } from 'react';

export interface WorkflowFile {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  isPinned: boolean;
  isPublic?: boolean;
  lastSaved: string;
  hasChanges?: boolean;
}

interface DashboardProps {
  workflows: WorkflowFile[];
  communityWorkflows: WorkflowFile[];
  activeWorkflowId: string | null;
  onOpenWorkflow: (id: string) => void;
  onDeleteWorkflow: (id: string) => void;
  onDownloadWorkflow: (workflow: WorkflowFile) => void;
  onTogglePin: (id: string) => void;
  onRenameWorkflow: (id: string, newName: string) => void;
  onForkWorkflow: (workflow: WorkflowFile) => void;
  onClose: () => void;
}

export default function Dashboard({
  workflows,
  communityWorkflows,
  activeWorkflowId,
  onOpenWorkflow,
  onDeleteWorkflow,
  onDownloadWorkflow,
  onTogglePin,
  onRenameWorkflow,
  onForkWorkflow,
  onClose,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'my-workflows' | 'community'>('my-workflows');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Filtering private workflows
  const pinnedWorkflows = workflows.filter(w => w.isPinned);
  const unpinnedWorkflows = workflows.filter(w => !w.isPinned);

  const startRename = (workflow: WorkflowFile) => {
    setEditingId(workflow.id);
    setEditName(workflow.name);
  };

  const saveRename = (id: string) => {
    if (!editName.trim()) return;
    onRenameWorkflow(id, editName.trim());
    setEditingId(null);
  };

  const filteredCommunity = communityWorkflows.filter(w => 
    w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    w.nodes.some(n => n.type.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col w-full h-full bg-bg-app text-left p-6 overflow-y-auto custom-scrollbar">
      
      {/* Dashboard Top Navigation */}
      <div className="flex items-center justify-between border-b border-border pb-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💼</span>
          <div>
            <h1 className="text-xl font-bold text-text-primary">WiseBlockForge Dashboard</h1>
            <p className="text-xs text-text-secondary">Create, save, and share machine learning workflows</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="px-4 py-2 border border-border bg-bg-card hover:bg-bg-hover text-text-primary text-xs font-semibold rounded-lg transition"
        >
          ← Go Back to Canvas
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-6">
        <button
          onClick={() => setActiveTab('my-workflows')}
          className={`px-6 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'my-workflows' 
              ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500 font-bold' 
              : 'border-transparent text-text-secondary hover:text-text-primary hover:border-slate-300 dark:hover:border-border'
          }`}
        >
          My Saved Workflows ({workflows.length})
        </button>
        <button
          onClick={() => setActiveTab('community')}
          className={`px-6 py-2.5 text-sm font-semibold border-b-2 transition ${
            activeTab === 'community' 
              ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-500 font-bold' 
              : 'border-transparent text-text-secondary hover:text-text-primary hover:border-slate-300 dark:hover:border-border'
          }`}
        >
          🌍 Public Community Gallery ({communityWorkflows.length})
        </button>
      </div>

      {activeTab === 'my-workflows' ? (
        // PRIVATE WORKFLOWS TAB
        <div className="space-y-8">
          
          {/* Pinned Workflows */}
          {pinnedWorkflows.length > 0 && (
            <div>
              <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4 flex items-center gap-2">
                📌 Pinned Pipelines (Max 3)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pinnedWorkflows.map(w => (
                  <WorkflowCard
                    key={w.id}
                    w={w}
                    activeWorkflowId={activeWorkflowId}
                    editingId={editingId}
                    editName={editName}
                    setEditName={setEditName}
                    saveRename={saveRename}
                    startRename={startRename}
                    onOpenWorkflow={onOpenWorkflow}
                    onTogglePin={onTogglePin}
                    onDownloadWorkflow={onDownloadWorkflow}
                    onDeleteWorkflow={onDeleteWorkflow}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Recent/Unpinned Workflows */}
          <div>
            <h2 className="text-xs font-bold text-text-muted uppercase tracking-wider mb-4">
              📂 My Workflows
            </h2>
            {unpinnedWorkflows.length === 0 && pinnedWorkflows.length === 0 ? (
              <div className="text-center p-12 border border-dashed border-border rounded-2xl bg-bg-panel/40">
                <span className="text-3xl">🗂️</span>
                <h3 className="font-semibold text-text-primary mt-2">No workflows created yet</h3>
                <p className="text-xs text-text-secondary mt-1">Open the file menu in the top bar to create a new canvas.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {unpinnedWorkflows.map(w => (
                  <WorkflowCard
                    key={w.id}
                    w={w}
                    activeWorkflowId={activeWorkflowId}
                    editingId={editingId}
                    editName={editName}
                    setEditName={setEditName}
                    saveRename={saveRename}
                    startRename={startRename}
                    onOpenWorkflow={onOpenWorkflow}
                    onTogglePin={onTogglePin}
                    onDownloadWorkflow={onDownloadWorkflow}
                    onDeleteWorkflow={onDeleteWorkflow}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      ) : (
        // COMMUNITY PUBLIC GALLERY TAB
        <div className="space-y-6">
          <div className="flex items-center gap-4 bg-bg-card border border-border p-3 rounded-xl max-w-md">
            <span className="text-sm">🔍</span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search public templates by name, node type..."
              className="w-full bg-transparent border-none text-text-primary text-xs focus:outline-none"
            />
          </div>

          {filteredCommunity.length === 0 ? (
            <div className="text-center py-12 text-text-muted">
              <span>🌐</span>
              <p className="text-xs mt-1">No community templates matched your search query.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCommunity.map(w => (
                <div key={w.id} className="glass-panel border border-border rounded-xl p-5 flex flex-col justify-between hover:scale-[1.01] hover:border-blue-500/40 transition shadow-lg">
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold text-text-primary text-sm flex items-center gap-1.5">
                        🌍 {w.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-text-secondary line-clamp-2 mb-4">
                      {w.nodes.length} nodes connected. Default code templates for building machine learning workflows.
                    </p>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {Array.from(new Set(w.nodes.map(n => n.type))).map(t => (
                        <span key={t} className="text-[9px] px-2 py-0.5 rounded bg-bg-hover text-text-muted border border-border font-mono">
                          {t.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
                    <span className="text-[10px] text-text-muted">Author: WBF Community</span>
                    <button
                      onClick={() => onForkWorkflow(w)}
                      className="px-3 py-1 bg-blue-600/20 text-blue-400 border border-blue-600/30 hover:bg-blue-600/30 rounded-lg text-xs font-semibold transition"
                    >
                      💾 Fork to Private
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Reusable Workflow Grid Card Component
// ---------------------------------------------------------------------
interface CardProps {
  w: WorkflowFile;
  activeWorkflowId: string | null;
  editingId: string | null;
  editName: string;
  setEditName: (v: string) => void;
  saveRename: (id: string) => void;
  startRename: (w: WorkflowFile) => void;
  onOpenWorkflow: (id: string) => void;
  onTogglePin: (id: string) => void;
  onDownloadWorkflow: (w: WorkflowFile) => void;
  onDeleteWorkflow: (id: string) => void;
}

function WorkflowCard({
  w,
  activeWorkflowId,
  editingId,
  editName,
  setEditName,
  saveRename,
  startRename,
  onOpenWorkflow,
  onTogglePin,
  onDownloadWorkflow,
  onDeleteWorkflow,
}: CardProps) {
  return (
    <div
      className={`glass-panel border rounded-2xl p-5 flex flex-col justify-between hover:scale-[1.01] transition shadow-lg ${
        activeWorkflowId === w.id ? 'border-blue-600 ring-1 ring-blue-600/30' : 'border-border'
      }`}
    >
      <div>
        <div className="flex items-start justify-between mb-3 gap-2">
          {editingId === w.id ? (
            <div className="flex items-center gap-1.5 w-full">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 bg-bg-hover border border-border rounded px-2 py-0.5 text-text-primary text-xs"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && saveRename(w.id)}
              />
              <button onClick={() => saveRename(w.id)} className="text-green-400 hover:text-green-300 text-xs font-bold">✓</button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text-primary text-sm line-clamp-1">{w.name}</span>
              <button
                onClick={() => startRename(w)}
                className="text-[10px] text-text-muted hover:text-text-primary transition"
              >
                ✏️
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => onTogglePin(w.id)}
              className={`text-xs p-1 rounded hover:bg-bg-hover transition ${w.isPinned ? 'text-yellow-400' : 'text-text-muted'}`}
            >
              📌
            </button>
          </div>
        </div>

        <div className="text-[10px] text-text-muted mb-4 font-mono space-y-0.5">
          <div>Nodes: {w.nodes.length} | Edges: {w.edges.length}</div>
          <div>Last saved: {w.lastSaved}</div>
          {w.isPublic && <div className="text-blue-400">🌐 Published (Public)</div>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-border pt-4 mt-2">
        <button
          onClick={() => onOpenWorkflow(w.id)}
          className="flex-1 px-2 py-1.5 bg-blue-600 text-white hover:bg-blue-500 rounded-lg text-xs font-bold text-center transition"
        >
          Open
        </button>
        <button
          onClick={() => onDownloadWorkflow(w)}
          className="px-2.5 py-1.5 border border-border bg-bg-card hover:bg-bg-hover text-text-secondary hover:text-text-primary rounded-lg text-xs transition"
          title="Download JSON File"
        >
          💾 Download
        </button>
        <button
          onClick={() => onDeleteWorkflow(w.id)}
          className="px-2.5 py-1.5 border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg text-xs transition animate-pulse-once"
          title="Delete Workflow"
        >
          🗑️
        </button>
      </div>
    </div>
  );
}
