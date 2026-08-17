import React, { useState, useEffect, useRef } from 'react';

interface Point2D {
  x: number;
  y: number;
  color: string;
}

interface PlotInfo {
  id: string;
  type: 'line' | 'bar' | '3d';
  series?: Record<string, { x: number; y: number }[]>; // For line charts
  labels?: string[]; // For bar charts
  values?: number[]; // For bar charts
  points3d?: { x: number; y: number; z: number }[]; // For 3D surface simulation
}

interface ChartRendererProps {
  plots: Record<string, PlotInfo>;
}

export default function ChartRenderer({ plots }: ChartRendererProps) {
  const plotKeys = Object.keys(plots);

  if (plotKeys.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 border border-dashed border-border rounded-xl p-8 text-center text-text-muted">
        <span className="text-3xl mb-2">📊</span>
        <p className="text-sm font-medium text-text-secondary">No active charts yet</p>
        <p className="text-xs mt-1">Start a run to stream loss curves and evaluations in real time.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4">
      {plotKeys.map((key) => {
        const plot = plots[key];
        return (
          <div key={key} className="glass-panel rounded-2xl border border-border p-5 flex flex-col min-h-[320px] shadow-lg">
            <div className="flex items-center justify-between mb-4">
              <span className="font-semibold text-text-primary text-sm flex items-center gap-2">
                {plot.type === 'line' && '📈'}
                {plot.type === 'bar' && '📊'}
                {plot.type === '3d' && '🎛️'}
                {key.replace(/_/g, ' ').toUpperCase()}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-bg-hover text-text-muted border border-border">
                {plot.type}
              </span>
            </div>

            <div className="flex-1 min-h-[220px] relative">
              {plot.type === 'line' && <LineChart plot={plot} />}
              {plot.type === 'bar' && <BarChart plot={plot} />}
              {plot.type === '3d' && <ThreeDPlot plot={plot} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// SVG Line Chart Component
// ---------------------------------------------------------------------
function LineChart({ plot }: { plot: PlotInfo }) {
  const series = plot.series || {};
  const seriesNames = Object.keys(series);

  if (seriesNames.length === 0) return <div className="text-xs text-text-muted">Empty line series...</div>;

  // Find Global min/max for scaling
  let allPoints = seriesNames.flatMap(name => series[name]);
  if (allPoints.length === 0) return <div className="text-xs text-text-muted flex justify-center items-center h-full">Waiting for plot coordinates...</div>;

  const minX = Math.min(...allPoints.map(p => p.x));
  const maxX = Math.max(...allPoints.map(p => p.x));
  const minY = Math.min(...allPoints.map(p => p.y));
  const maxY = Math.max(...allPoints.map(p => p.y));

  const padding = 35;
  const width = 380;
  const height = 200;

  const getSvgCoords = (x: number, y: number) => {
    const xSpan = maxX - minX || 1;
    const ySpan = maxY - minY || 1;

    const svgX = padding + ((x - minX) / xSpan) * (width - 2 * padding);
    // Invert Y for SVG coordinates
    const svgY = height - padding - ((y - minY) / ySpan) * (height - 2 * padding);
    return { svgX, svgY };
  };

  const colors = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b'];

  return (
    <div className="h-full w-full flex flex-col justify-between">
      <svg className="w-full h-full min-h-[180px]" viewBox={`0 0 ${width} ${height}`}>
        {/* Draw grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
          const yPos = padding + ratio * (height - 2 * padding);
          return (
            <line
              key={i}
              x1={padding}
              y1={yPos}
              x2={width - padding}
              y2={yPos}
              stroke="var(--border-color)"
              strokeDasharray="4 4"
            />
          );
        })}

        {/* Draw Series Lines */}
        {seriesNames.map((name, sIdx) => {
          const points = series[name];
          if (points.length === 0) return null;

          const color = colors[sIdx % colors.length];
          const coords = points.map(p => getSvgCoords(p.x, p.y));
          
          // Build path string
          const pathString = coords.reduce((acc, c, idx) => {
            return acc + `${idx === 0 ? 'M' : 'L'} ${c.svgX} ${c.svgY}`;
          }, '');

          // Build gradient fill area path
          const fillPathString = pathString + 
            ` L ${coords[coords.length - 1].svgX} ${height - padding}` +
            ` L ${coords[0].svgX} ${height - padding} Z`;

          return (
            <g key={name}>
              {/* Glow filter definition */}
              <defs>
                <linearGradient id={`grad-${name}`} x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={color} stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Area path */}
              <path d={fillPathString} fill={`url(#grad-${name})`} />

              {/* Line path */}
              <path
                d={pathString}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Draw node dots */}
              {coords.map((c, cIdx) => (
                <circle
                  key={cIdx}
                  cx={c.svgX}
                  cy={c.svgY}
                  r="3.5"
                  fill="var(--bg-card)"
                  stroke={color}
                  strokeWidth="2"
                  className="transition-transform duration-100 hover:scale-150 cursor-pointer"
                />
              ))}
            </g>
          );
        })}

        {/* X and Y labels */}
        <text x={padding} y={height - 5} fill="var(--text-muted)" fontSize="9" textAnchor="middle">
          {minX.toFixed(0)}
        </text>
        <text x={width - padding} y={height - 5} fill="var(--text-muted)" fontSize="9" textAnchor="middle">
          {maxX.toFixed(0)}
        </text>
        <text x={5} y={padding} fill="var(--text-muted)" fontSize="9">
          {maxY.toFixed(2)}
        </text>
        <text x={5} y={height - padding} fill="var(--text-muted)" fontSize="9">
          {minY.toFixed(2)}
        </text>
      </svg>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mt-2 justify-center">
        {seriesNames.map((name, sIdx) => (
          <div key={name} className="flex items-center gap-2 text-xs">
            <span
              className="w-3 h-3 rounded-full border"
              style={{ backgroundColor: colors[sIdx % colors.length], borderColor: 'var(--border-color)' }}
            />
            <span className="text-text-secondary">{name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// SVG Bar Chart Component
// ---------------------------------------------------------------------
function BarChart({ plot }: { plot: PlotInfo }) {
  const labels = plot.labels || [];
  const values = plot.values || [];

  if (labels.length === 0) return <div className="text-xs text-text-muted">Empty bar series...</div>;

  const maxVal = Math.max(...values, 1);
  const width = 380;
  const height = 200;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const barAreaWidth = width - paddingLeft - paddingRight;
  const barAreaHeight = height - paddingTop - paddingBottom;
  const barWidth = Math.min(45, (barAreaWidth / labels.length) - 15);

  return (
    <svg className="w-full h-full min-h-[180px]" viewBox={`0 0 ${width} ${height}`}>
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
        const yPos = paddingTop + (1 - ratio) * barAreaHeight;
        return (
          <g key={i}>
            <line
              x1={paddingLeft}
              y1={yPos}
              x2={width - paddingRight}
              y2={yPos}
              stroke="var(--border-color)"
              strokeDasharray="2 2"
            />
            <text x={paddingLeft - 8} y={yPos + 3} fill="var(--text-muted)" fontSize="9" textAnchor="end">
              {(ratio * maxVal).toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* Render Bars */}
      {labels.map((label, idx) => {
        const val = values[idx] || 0;
        const barHeight = (val / maxVal) * barAreaHeight;
        const xPos = paddingLeft + (idx * (barAreaWidth / labels.length)) + (barAreaWidth / labels.length / 2) - (barWidth / 2);
        const yPos = height - paddingBottom - barHeight;

        return (
          <g key={label} className="group">
            {/* Linear Gradient for styling */}
            <defs>
              <linearGradient id={`bar-grad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-teal)" />
                <stop offset="100%" stopColor="var(--color-blue)" />
              </linearGradient>
            </defs>

            {/* Glowing Bar */}
            <rect
              x={xPos}
              y={yPos}
              width={barWidth}
              height={barHeight}
              rx="4"
              fill={`url(#bar-grad-${idx})`}
              className="transition-all duration-200 hover:opacity-90 cursor-pointer shadow-md"
            />

            {/* Hover values text overlay */}
            <text
              x={xPos + barWidth / 2}
              y={yPos - 6}
              fill="var(--text-primary)"
              fontSize="9"
              fontWeight="bold"
              textAnchor="middle"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {val.toFixed(1)}
            </text>

            {/* X Labels */}
            <text
              x={xPos + barWidth / 2}
              y={height - paddingBottom + 16}
              fill="var(--text-secondary)"
              fontSize="9"
              textAnchor="middle"
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------
// SVG 3D Plot Component with Mouse Rotation Interaction
// ---------------------------------------------------------------------
function ThreeDPlot({ plot }: { plot: PlotInfo }) {
  const points = plot.points3d || [];
  
  // Set default sphere/surface simulation points if empty
  const [dataPoints, setDataPoints] = useState<{x: number; y: number; z: number}[]>([]);
  const [angles, setAngles] = useState({ rx: 0.5, ry: 0.6 }); // rotation values
  const containerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({ isDragging: false, lastX: 0, lastY: 0 });

  useEffect(() => {
    if (points.length > 0) {
      setDataPoints(points);
    } else {
      // Generate simulated loss coordinates surface
      const simSurface = [];
      for (let x = -5; x <= 5; x += 1.5) {
        for (let y = -5; y <= 5; y += 1.5) {
          // Sphere paraboloid loss landscape
          const z = (x*x + y*y) / 10;
          simSurface.push({ x: x/5, y: y/5, z: z/5 });
        }
      }
      setDataPoints(simSurface);
    }
  }, [points]);

  const handleMouseDown = (e: React.MouseEvent) => {
    dragRef.current.isDragging = true;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragRef.current.isDragging) return;
    const deltaX = e.clientX - dragRef.current.lastX;
    const deltaY = e.clientY - dragRef.current.lastY;

    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;

    setAngles(prev => ({
      rx: prev.rx + deltaY * 0.01,
      ry: prev.ry + deltaX * 0.01
    }));
  };

  const handleMouseUpOrLeave = () => {
    dragRef.current.isDragging = false;
  };

  // Projection logic
  const width = 380;
  const height = 200;
  const cx = width / 2;
  const cy = height / 2;
  const scale = 120; // 3D viewport scale

  const projectedPoints: Point2D[] = dataPoints.map(p => {
    // Rotation calculations on X and Y axes
    const cosY = Math.cos(angles.ry);
    const sinY = Math.sin(angles.ry);
    const cosX = Math.cos(angles.rx);
    const sinX = Math.sin(angles.rx);

    // Apply rotation transformations
    const xRot = p.x * cosY - p.z * sinY;
    const zRot = p.x * sinY + p.z * cosY;
    const yRot = p.y * cosX - zRot * sinX;
    const zFinal = p.y * sinX + zRot * cosX;

    // Perspective factor
    const depth = 2.5;
    const factor = scale / (depth + zFinal);
    const xProj = cx + xRot * factor;
    const yProj = cy + yRot * factor;

    // Color gradient mapping based on height (z coordinate)
    const normalizedHeight = Math.max(0, Math.min(1, (p.z + 0.5)));
    const color = `hsl(${260 - normalizedHeight * 120}, 85%, 60%)`; // Blue -> Violet -> Crimson

    return { x: xProj, y: yProj, color };
  });

  return (
    <div
      ref={containerRef}
      className="w-full h-full cursor-grab active:cursor-grabbing select-none flex flex-col items-center justify-between"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUpOrLeave}
      onMouseLeave={handleMouseUpOrLeave}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/10 rounded-xl pointer-events-none" />
      <svg className="w-full h-full min-h-[180px]" viewBox={`0 0 ${width} ${height}`}>
        {/* Draw mock 3D bounding box wireframe */}
        <g stroke="var(--border-color)" strokeWidth="0.8" opacity="0.4" fill="none">
          {/* Wiregrid helper could be computed, draw center lines */}
          <line x1={cx} y1={0} x2={cx} y2={height} strokeDasharray="3 3" />
          <line x1={0} y1={cy} x2={width} y2={cy} strokeDasharray="3 3" />
        </g>

        {/* Render 3D points */}
        {projectedPoints.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r="4"
            fill={p.color}
            className="transition-all duration-75"
            style={{ filter: 'drop-shadow(0 0 3px ' + p.color + ')' }}
          />
        ))}
      </svg>
      <span className="text-[10px] text-text-muted mb-1 pointer-events-none">
        🖱️ Click & Drag to Rotate Optimization Surface (3D View)
      </span>
    </div>
  );
}
