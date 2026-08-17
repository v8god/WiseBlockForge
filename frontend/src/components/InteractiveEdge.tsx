import React, { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps
} from '@xyflow/react';

export default function InteractiveEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data
}: EdgeProps & { data?: any }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
    borderRadius: 8,
  });

  const [isHovered, setIsHovered] = useState(false);
  const [showNodeSelector, setShowNodeSelector] = useState(false);

  // Handle Delete Click
  const onDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (data?.onDelete) {
      data.onDelete(id);
    }
  };

  // Handle Insert Click
  const onInsertSelect = (nodeType: string, customIdx?: number) => {
    if (data?.onInsert) {
      data.onInsert(id, nodeType, labelX, labelY, customIdx);
    }
    setShowNodeSelector(false);
  };

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setShowNodeSelector(false);
      }}
      className="interactive-edge-group"
    >
      {/* Invisible thicker path to make hovering easier */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={15}
        className="react-flow__edge-interaction"
        style={{ cursor: 'pointer' }}
      />
      <BaseEdge path={edgePath} style={style} markerEnd={markerEnd} />
      
      {(isHovered || showNodeSelector) && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
              zIndex: 1000,
            }}
            className="nodrag nopan flex flex-col items-center"
          >
            {/* Action buttons bar */}
            <div className="flex items-center gap-1.5 bg-bg-panel border border-border px-2 py-1 rounded-full shadow-2xl backdrop-blur-md">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowNodeSelector(!showNodeSelector);
                }}
                className="w-5 h-5 rounded-full bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white flex items-center justify-center text-[10px] border border-blue-600/30 transition cursor-pointer"
                title="Insert node here"
              >
                ＋
              </button>
              <button
                onClick={onDeleteClick}
                className="w-5 h-5 rounded-full bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white flex items-center justify-center text-[10px] border border-red-500/30 transition cursor-pointer"
                title="Delete connection"
              >
                🗑️
              </button>
            </div>

            {/* Quick-insert dropdown selector list */}
            {showNodeSelector && (
              <div className="absolute top-7 bg-bg-card border border-border rounded-xl shadow-2xl p-1.5 min-w-[140px] flex flex-col gap-1 z-50 text-left">
                <span className="text-[8px] font-bold text-text-muted px-2 py-0.5 uppercase tracking-wider block">
                  Insert Block
                </span>
                <button
                  onClick={() => onInsertSelect('model_training')}
                  className="w-full px-2 py-1 text-[10px] text-text-primary hover:bg-bg-hover text-left rounded transition border-none bg-transparent cursor-pointer"
                >
                  ⚙️ Model Training
                </button>
                <button
                  onClick={() => onInsertSelect('evaluation')}
                  className="w-full px-2 py-1 text-[10px] text-text-primary hover:bg-bg-hover text-left rounded transition border-none bg-transparent cursor-pointer"
                >
                  📈 Evaluation
                </button>
                
                {/* Custom blocks if available */}
                {data?.customTemplates && data.customTemplates.length > 0 && (
                  <>
                    <div className="border-t border-border my-0.5"></div>
                    <span className="text-[8px] font-bold text-text-muted px-2 py-0.5 uppercase tracking-wider block">
                      My Custom Nodes
                    </span>
                    {data.customTemplates.map((t: any, idx: number) => (
                      <button
                        key={t.type + idx}
                        onClick={() => onInsertSelect('custom_node', idx)}
                        className="w-full px-2 py-1 text-[10px] text-text-primary hover:bg-bg-hover text-left truncate rounded transition border-none bg-transparent cursor-pointer"
                      >
                        🔨 {t.label}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </EdgeLabelRenderer>
      )}
    </g>
  );
}
