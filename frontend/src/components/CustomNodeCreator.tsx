import { useState } from 'react';

export interface CustomNodeTemplate {
  type: string; // generated as 'custom_node_<uuid>'
  label: string;
  desc: string;
  color: string; // hex or category slug
  inputs: { name: string; type: string }[];
  outputs: { name: string; type: string }[];
  defaultCode: string;
}

interface CustomNodeCreatorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: CustomNodeTemplate) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export default function CustomNodeCreator({ isOpen, onClose, onSave, showToast }: CustomNodeCreatorProps) {
  const [label, setLabel] = useState('');
  const [desc, setDesc] = useState('');
  const [color, setColor] = useState('#64748b'); // defaults to slate/gray
  const [inputs, setInputs] = useState<{ name: string; type: string }[]>([
    { name: 'in_data', type: 'data' }
  ]);
  const [outputs, setOutputs] = useState<{ name: string; type: string }[]>([
    { name: 'out_data', type: 'data' }
  ]);
  const [defaultCode, setDefaultCode] = useState(
    '# Write your custom Python execution node code here\n' +
    '# Available variables from previous nodes: inputs, etc.\n' +
    '# E.g. print("Custom node processing...")\n' +
    '# out_data = in_data * 2'
  );

  if (!isOpen) return null;

  const handleAddInput = () => {
    setInputs([...inputs, { name: `input_${inputs.length + 1}`, type: 'data' }]);
  };

  const handleRemoveInput = (idx: number) => {
    setInputs(inputs.filter((_, i) => i !== idx));
  };

  const handleInputValChange = (idx: number, field: 'name' | 'type', val: string) => {
    const next = [...inputs];
    next[idx] = { ...next[idx], [field]: val };
    setInputs(next);
  };

  const handleAddOutput = () => {
    setOutputs([...outputs, { name: `output_${outputs.length + 1}`, type: 'data' }]);
  };

  const handleRemoveOutput = (idx: number) => {
    setOutputs(outputs.filter((_, i) => i !== idx));
  };

  const handleOutputValChange = (idx: number, field: 'name' | 'type', val: string) => {
    const next = [...outputs];
    next[idx] = { ...next[idx], [field]: val };
    setOutputs(next);
  };

  const handleSave = () => {
    if (!label.trim()) {
      if (showToast) {
        showToast('Please provide a Node Label.', 'info');
      } else {
        alert('Please provide a Node Label.');
      }
      return;
    }

    const cleanLabel = label.trim();
    // Generate a unique node type identifier
    const uniqueType = `custom_node_${cleanLabel.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now().toString().slice(-4)}`;

    onSave({
      type: uniqueType,
      label: cleanLabel,
      desc: desc.trim() || 'Custom visual block',
      color,
      inputs,
      outputs,
      defaultCode,
    });

    // Reset fields
    setLabel('');
    setDesc('');
    setColor('#64748b');
    setInputs([{ name: 'in_data', type: 'data' }]);
    setOutputs([{ name: 'out_data', type: 'data' }]);
    setDefaultCode('# Write your custom Python execution node code here\n');
    onClose();
  };

  const nodeColors = [
    { label: 'Blue (I/O)', value: '#3b82f6' },
    { label: 'Cyan (Preproc)', value: '#06b6d4' },
    { label: 'Purple (Model)', value: '#a855f7' },
    { label: 'Indigo (Optim)', value: '#6366f1' },
    { label: 'Orange (Train)', value: '#f97316' },
    { label: 'Teal (Eval)', value: '#14b8a6' },
    { label: 'Green (Viz)', value: '#22c55e' },
    { label: 'Slate (Custom)', value: '#64748b' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85 backdrop-blur-sm text-left">
      <div className="flex flex-col w-full max-w-3xl max-h-[85vh] glass-panel border border-border rounded-2xl shadow-2xl overflow-hidden bg-bg-panel">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-bg-panel/40">
          <div>
            <h2 className="font-bold text-text-primary text-base">🔨 Build Custom Reusable Node</h2>
            <p className="text-xs text-text-secondary">Define customized ports, parameters, styling, and default Python templates</p>
          </div>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary text-sm p-1">✕</button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          
          {/* Node Basics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Node Name / Label</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Standard Scaler"
                className="w-full bg-bg-card border border-border rounded-lg px-3 py-2 text-text-primary text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Short Description</label>
              <input
                type="text"
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                placeholder="e.g. Standardizes data values to zero mean"
                className="w-full bg-bg-card border border-border rounded-lg px-3 py-2 text-text-primary text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Color Selector */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">Category Style (Border Glow Color)</label>
            <div className="flex flex-wrap gap-2">
              {nodeColors.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setColor(c.value)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs transition ${
                    color === c.value 
                      ? 'border-blue-500 bg-blue-500/10 text-text-primary font-bold' 
                      : 'border-border bg-bg-card text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: c.value }} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Ports Manager */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Input Ports */}
            <div className="border border-border/60 rounded-xl p-4 bg-bg-panel/40">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-text-secondary uppercase">Input Ports</span>
                <button
                  onClick={handleAddInput}
                  className="text-[10px] bg-blue-600/20 text-blue-400 border border-blue-600/30 hover:bg-blue-600/30 px-2 py-0.5 rounded transition font-semibold"
                >
                  + Add Input
                </button>
              </div>

              {inputs.length === 0 ? (
                <p className="text-[10px] text-text-muted italic py-2">No inputs defined. The node will have no entry sockets.</p>
              ) : (
                <div className="space-y-2">
                  {inputs.map((inp, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={inp.name}
                        onChange={(e) => handleInputValChange(idx, 'name', e.target.value)}
                        placeholder="Port ID"
                        className="flex-1 bg-bg-card border border-border rounded px-2 py-1 text-text-primary text-xs font-mono"
                      />
                      <select
                        value={inp.type}
                        onChange={(e) => handleInputValChange(idx, 'type', e.target.value)}
                        className="bg-bg-card border border-border rounded px-1.5 py-1 text-text-primary text-xs"
                      >
                        <option value="data">data</option>
                        <option value="model">model</option>
                        <option value="optimizer">optimizer</option>
                      </select>
                      <button
                        onClick={() => handleRemoveInput(idx)}
                        className="text-red-400 hover:text-red-300 text-xs px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Output Ports */}
            <div className="border border-border/60 rounded-xl p-4 bg-bg-panel/40">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold text-text-secondary uppercase">Output Ports</span>
                <button
                  onClick={handleAddOutput}
                  className="text-[10px] bg-blue-600/20 text-blue-400 border border-blue-600/30 hover:bg-blue-600/30 px-2 py-0.5 rounded transition font-semibold"
                >
                  + Add Output
                </button>
              </div>

              {outputs.length === 0 ? (
                <p className="text-[10px] text-text-muted italic py-2">No outputs defined. The node will have no exit sockets.</p>
              ) : (
                <div className="space-y-2">
                  {outputs.map((out, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={out.name}
                        onChange={(e) => handleOutputValChange(idx, 'name', e.target.value)}
                        placeholder="Port ID"
                        className="flex-1 bg-bg-card border border-border rounded px-2 py-1 text-text-primary text-xs font-mono"
                      />
                      <select
                        value={out.type}
                        onChange={(e) => handleOutputValChange(idx, 'type', e.target.value)}
                        className="bg-bg-card border border-border rounded px-1.5 py-1 text-text-primary text-xs"
                      >
                        <option value="data">data</option>
                        <option value="model">model</option>
                        <option value="optimizer">optimizer</option>
                      </select>
                      <button
                        onClick={() => handleRemoveOutput(idx)}
                        className="text-red-400 hover:text-red-300 text-xs px-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Python Code Template */}
          <div>
            <label className="block text-xs font-semibold text-text-secondary mb-1.5 uppercase tracking-wide">Python Script Code Preset</label>
            <div className="border border-border rounded-xl overflow-hidden bg-black/60">
              <div className="flex items-center justify-between px-4 py-1.5 bg-bg-card/50 border-b border-border text-[10px] text-text-muted font-mono">
                <span>python code template (preset default)</span>
              </div>
              <textarea
                value={defaultCode}
                onChange={(e) => setDefaultCode(e.target.value)}
                rows={6}
                className="w-full bg-black/50 text-[#93c5fd] font-mono text-xs p-4 focus:outline-none leading-relaxed resize-y"
              />
            </div>
            <p className="text-[10px] text-text-muted mt-1.5">
              ⚠️ Custom node scripts compile directly inside the Jupyter Notebook. Modify the template variables to match input port mappings.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border bg-bg-panel/50">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border bg-bg-card hover:bg-bg-hover text-text-secondary text-xs rounded-lg transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs rounded-lg shadow transition"
          >
            Create & Register Node
          </button>
        </div>

      </div>
    </div>
  );
}
