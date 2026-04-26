import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { ASTNode } from '../engine/types';

interface ASTViewerProps {
  ast: ASTNode | null;
}

export interface LayoutNode {
  id: number;
  x: number;
  y: number;
  label: string;
  subLabel: string;
  nodeType: string;
  depth: number;
  childCount: number;
  collapsed: boolean;
  astNode: ASTNode;
}

export interface LayoutEdge {
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export const NODE_W = 110;
export const NODE_H = 38;
export const GAP_X = 24;
export const GAP_Y = 72;
export const MAX_VISIBLE = 600;
export const DEFAULT_COLLAPSE_DEPTH = 4;

export function getNodeColors(nodeType: string): { fill: string; stroke: string } {
  switch (nodeType) {
    case 'FunctionDeclaration': return { fill: '#0f2d4a', stroke: '#00d4ff' };
    case 'IfStatement': case 'ForStatement': case 'WhileStatement':
      return { fill: '#2d1f06', stroke: '#f59e0b' };
    case 'ReturnStatement': return { fill: '#2d0a0a', stroke: '#ef4444' };
    case 'BinaryExpression': case 'AssignmentExpression':
      return { fill: '#062d12', stroke: '#10b981' };
    case 'UnaryExpression': case 'UpdateExpression':
      return { fill: '#101828', stroke: '#6366f1' };
    case 'CallExpression': return { fill: '#1e0d30', stroke: '#a855f7' };
    case 'Identifier': case 'Literal':
      return { fill: '#111827', stroke: '#475569' };
    case 'VariableDeclaration': return { fill: '#0d1f1f', stroke: '#14b8a6' };
    case 'BlockStatement': case 'Program':
      return { fill: '#131520', stroke: '#2a3547' };
    default: return { fill: '#111827', stroke: '#334155' };
  }
}

export function getChildren(n: ASTNode): ASTNode[] {
  const c: ASTNode[] = [];
  if ('body' in n) {
    if (Array.isArray(n.body)) c.push(...(n.body as ASTNode[]));
    else if (n.body && typeof n.body === 'object' && 'type' in n.body) c.push(n.body as ASTNode);
  }
  if ('init' in n && n.init && typeof n.init === 'object' && 'type' in n.init) c.push(n.init as ASTNode);
  if ('condition' in n && n.condition) c.push(n.condition as ASTNode);
  if ('update' in n && n.update) c.push(n.update as ASTNode);
  if ('test' in n && n.test) c.push(n.test as ASTNode);
  if ('consequent' in n && n.consequent) c.push(n.consequent as ASTNode);
  if ('alternate' in n && n.alternate) c.push(n.alternate as ASTNode);
  if ('left' in n && n.left) c.push(n.left as ASTNode);
  if ('right' in n && n.right) c.push(n.right as ASTNode);
  if ('argument' in n && n.argument && typeof n.argument === 'object' && 'type' in n.argument) c.push(n.argument as ASTNode);
  if ('arguments' in n && Array.isArray(n.arguments)) c.push(...(n.arguments as ASTNode[]));
  if ('expression' in n && n.expression) c.push(n.expression as ASTNode);
  if ('callee' in n && n.callee) c.push(n.callee as ASTNode);
  return c;
}

export function getLabel(node: ASTNode): { label: string; subLabel: string } {
  let label = node.type;
  let subLabel = '';
  if (label.length > 15) label = label.slice(0, 14) + '…';
  if ('name' in node && node.name) subLabel = String(node.name);
  else if ('operator' in node && node.operator) subLabel = String(node.operator);
  else if ('value' in node && node.value !== undefined) subLabel = String(node.value);
  else if ('varType' in node && node.varType) subLabel = String(node.varType);
  if (subLabel.length > 14) subLabel = subLabel.slice(0, 13) + '…';
  return { label, subLabel };
}

export function countChildren(n: ASTNode): number {
  let count = 0;
  const ch = getChildren(n);
  count += ch.length;
  for (const child of ch) count += countChildren(child);
  return count;
}

export function buildTreeLayout(ast: ASTNode | null, collapsedNodes: Set<number>) {
  if (!ast) return { layoutNodes: [], layoutEdges: [], totalWidth: 0, totalHeight: 0, totalNodeCount: 0 };

  const nodes: LayoutNode[] = [];
  const edges: LayoutEdge[] = [];
  let nodeId = 0;
  let totalCount = 0;

  function computeLayout(astNode: ASTNode, depth: number, xOffset: number): { id: number; width: number; x: number } {
    const id = nodeId++;
    totalCount++;
    const children = getChildren(astNode);
    const { label, subLabel } = getLabel(astNode);
    const cc = countChildren(astNode);
    const isCollapsed = collapsedNodes.has(id) || (depth >= DEFAULT_COLLAPSE_DEPTH && !collapsedNodes.has(-id));

    let myX = xOffset;
    const myY = depth * GAP_Y + 40;
    let childrenWidth = 0;
    const childPositions: { id: number; x: number }[] = [];

    if (children.length > 0 && !isCollapsed && totalCount < MAX_VISIBLE) {
      let currentX = xOffset;
      for (const child of children) {
        const result = computeLayout(child, depth + 1, currentX);
        childPositions.push({ id: result.id, x: result.x });
        currentX += result.width + GAP_X;
        childrenWidth += result.width + GAP_X;
      }
      childrenWidth -= GAP_X;
      myX = xOffset + childrenWidth / 2 - NODE_W / 2;

      for (const cp of childPositions) {
        edges.push({
          id: `e-${id}-${cp.id}`,
          x1: myX + NODE_W / 2,
          y1: myY + NODE_H,
          x2: cp.x + NODE_W / 2,
          y2: myY + GAP_Y,
        });
      }
    } else {
      childrenWidth = NODE_W;
    }

    nodes.push({
      id,
      x: myX,
      y: myY,
      label,
      subLabel,
      nodeType: astNode.type,
      depth,
      childCount: cc,
      collapsed: isCollapsed && children.length > 0,
      astNode
    });

    return { id, width: Math.max(NODE_W, childrenWidth), x: myX };
  }

  const { width: totalW } = computeLayout(ast, 0, 40);

  return {
    layoutNodes: nodes,
    layoutEdges: edges,
    totalWidth: Math.max(totalW + 120, 800),
    totalHeight: nodes.length > 0 ? Math.max(...nodes.map(n => n.y)) + 120 : 400,
    totalNodeCount: totalCount,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// VIRTUALIZED SVG CANVAS — only renders nodes inside the current viewport
// ─────────────────────────────────────────────────────────────────────────────
interface CanvasProps {
  layoutNodes: LayoutNode[];
  layoutEdges: LayoutEdge[];
  totalWidth: number;
  totalHeight: number;
  onToggleNode: (id: number) => void;
  renderNode: (n: LayoutNode) => React.ReactNode;
}

function VirtualizedCanvas({ layoutNodes, layoutEdges, totalWidth, totalHeight, onToggleNode, renderNode }: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const zoomRef = useRef(1);
  const panRef = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [zoomDisplay, setZoomDisplay] = useState(100);
  // viewport in world coords for virtualization
  const [viewport, setViewport] = useState({ minX: -9999, maxX: 9999, minY: -9999, maxY: 9999 });

  const updateViewport = useCallback(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const z = zoomRef.current;
    const px = panRef.current.x;
    const py = panRef.current.y;
    // world = (screen - pan) / zoom
    const margin = Math.max(NODE_W * 2, 200);
    setViewport({
      minX: (-px) / z - margin,
      maxX: (-px + rect.width) / z + margin,
      minY: (-py) / z - margin,
      maxY: (-py + rect.height) / z + margin,
    });
  }, []);

  const applyTransform = useCallback(() => {
    if (gRef.current) {
      gRef.current.setAttribute('transform', `translate(${panRef.current.x},${panRef.current.y}) scale(${zoomRef.current})`);
    }
    updateViewport();
  }, [updateViewport]);

  const fitToScreen = useCallback(() => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const scaleX = rect.width / (totalWidth + 60);
    const scaleY = rect.height / (totalHeight + 60);
    const newZoom = Math.min(scaleX, scaleY, 1.5);
    zoomRef.current = newZoom;
    panRef.current.x = (rect.width - totalWidth * newZoom) / 2;
    panRef.current.y = 20;
    setZoomDisplay(Math.round(newZoom * 100));
    applyTransform();
  }, [totalWidth, totalHeight, applyTransform]);

  // Block page scroll when mouse is over the canvas
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      const newZoom = Math.max(0.08, Math.min(6, zoomRef.current + delta * zoomRef.current));
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const scale = newZoom / zoomRef.current;
      panRef.current.x = mx - scale * (mx - panRef.current.x);
      panRef.current.y = my - scale * (my - panRef.current.y);
      zoomRef.current = newZoom;
      setZoomDisplay(Math.round(newZoom * 100));
      applyTransform();
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [applyTransform]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - panRef.current.x, y: e.clientY - panRef.current.y };
    if (svgRef.current) svgRef.current.style.cursor = 'grabbing';
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    panRef.current.x = e.clientX - dragStart.current.x;
    panRef.current.y = e.clientY - dragStart.current.y;
    applyTransform();
  }, [applyTransform]);

  const stopDrag = useCallback(() => {
    isDragging.current = false;
    if (svgRef.current) svgRef.current.style.cursor = 'grab';
  }, []);

  useEffect(() => {
    if (layoutNodes.length > 0) {
      const t = setTimeout(fitToScreen, 60);
      return () => clearTimeout(t);
    }
  }, [layoutNodes.length, fitToScreen]);

  // Zoom buttons
  const zoomIn = () => {
    zoomRef.current = Math.min(6, zoomRef.current * 1.25);
    setZoomDisplay(Math.round(zoomRef.current * 100));
    applyTransform();
  };
  const zoomOut = () => {
    zoomRef.current = Math.max(0.08, zoomRef.current / 1.25);
    setZoomDisplay(Math.round(zoomRef.current * 100));
    applyTransform();
  };
  const resetZoom = () => fitToScreen();

  // Virtualize: only render nodes inside viewport
  const visibleNodes = layoutNodes.filter(n =>
    n.x + NODE_W >= viewport.minX && n.x <= viewport.maxX &&
    n.y + NODE_H >= viewport.minY && n.y <= viewport.maxY
  );
  const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
  const visibleEdges = layoutEdges.filter(e => {
    // include edge if either endpoint node is visible
    const [, parentId, childId] = e.id.split('-').map(Number);
    return visibleNodeIds.has(parentId) || visibleNodeIds.has(childId) ||
      (e.x1 >= viewport.minX && e.x1 <= viewport.maxX) ||
      (e.x2 >= viewport.minX && e.x2 <= viewport.maxX);
  });

  return (
    <div ref={containerRef} className="relative flex flex-col h-full select-none">
      {/* Toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d1117] border-b border-white/5 shrink-0">
        <button onClick={zoomOut} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white text-lg font-mono transition-colors" title="Zoom Out">−</button>
        <span className="text-xs text-gray-400 font-mono w-12 text-center tabular-nums">{zoomDisplay}%</span>
        <button onClick={zoomIn} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white text-lg font-mono transition-colors" title="Zoom In">+</button>
        <div className="w-px h-4 bg-white/10 mx-1" />
        <button onClick={resetZoom} className="px-2 py-0.5 text-xs text-gray-300 hover:text-[#00d4ff] hover:bg-white/5 rounded border border-white/10 transition-colors" title="Fit to Screen">Fit</button>
        <div className="flex-1" />
        <span className="text-xs text-gray-600 font-mono">{layoutNodes.length} nodes · scroll to zoom · drag to pan · click node to collapse</span>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="cursor-grab"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
          onDoubleClick={resetZoom}
        >
          <g ref={gRef}>
            {/* Edges */}
            {visibleEdges.map(e => {
              const midY = (e.y1 + e.y2) / 2;
              return (
                <path
                  key={e.id}
                  d={`M ${e.x1} ${e.y1} C ${e.x1} ${midY}, ${e.x2} ${midY}, ${e.x2} ${e.y2}`}
                  fill="none"
                  stroke="#2a3a50"
                  strokeWidth="1.5"
                />
              );
            })}
            {/* Nodes */}
            {visibleNodes.map(n => (
              <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                {renderNode(n)}
              </g>
            ))}
          </g>
        </svg>

        {/* Mini-map */}
        <MiniMap
          nodes={layoutNodes}
          totalWidth={totalWidth}
          totalHeight={totalHeight}
          pan={panRef}
          zoom={zoomRef}
          svgRef={svgRef}
        />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MINI-MAP
// ─────────────────────────────────────────────────────────────────────────────
function MiniMap({ nodes, totalWidth, totalHeight, pan, zoom, svgRef }: any) {
  const [, forceRender] = useState(0);
  const mapW = 120, mapH = 80;

  useEffect(() => {
    const interval = setInterval(() => forceRender(x => x + 1), 200);
    return () => clearInterval(interval);
  }, []);

  if (!nodes.length || !svgRef.current) return null;

  const scaleX = mapW / totalWidth;
  const scaleY = mapH / totalHeight;
  const scale = Math.min(scaleX, scaleY);

  const svgRect = svgRef.current.getBoundingClientRect();
  const vpX = (-pan.current.x) / zoom.current;
  const vpY = (-pan.current.y) / zoom.current;
  const vpW = svgRect.width / zoom.current;
  const vpH = svgRect.height / zoom.current;

  return (
    <div className="absolute bottom-3 right-3 bg-[#0d1117]/90 border border-white/10 rounded-lg overflow-hidden shadow-2xl backdrop-blur-sm" style={{ width: mapW + 8, height: mapH + 8, padding: 4 }}>
      <svg width={mapW} height={mapH}>
        {nodes.map((n: LayoutNode) => {
          const { fill, stroke } = getNodeColors(n.nodeType);
          return (
            <rect
              key={n.id}
              x={n.x * scale}
              y={n.y * scale}
              width={Math.max(2, NODE_W * scale)}
              height={Math.max(1, NODE_H * scale)}
              fill={fill}
              stroke={stroke}
              strokeWidth={0.5}
              rx={1}
            />
          );
        })}
        {/* viewport rect */}
        <rect
          x={vpX * scale}
          y={vpY * scale}
          width={vpW * scale}
          height={vpH * scale}
          fill="rgba(0,212,255,0.08)"
          stroke="#00d4ff"
          strokeWidth={1}
          rx={1}
        />
      </svg>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NODE RENDERER
// ─────────────────────────────────────────────────────────────────────────────
function ASTNodeBox({ n, onToggle }: { n: LayoutNode; onToggle: (id: number) => void }) {
  const { fill, stroke } = getNodeColors(n.nodeType);
  const canCollapse = n.childCount > 0;

  return (
    <>
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={6}
        fill={fill}
        stroke={stroke}
        strokeWidth={1.5}
        strokeDasharray={n.collapsed ? '5,3' : 'none'}
        style={{ cursor: canCollapse ? 'pointer' : 'default' }}
        onClick={(e) => { e.stopPropagation(); if (canCollapse) onToggle(n.id); }}
      />
      <text
        x={NODE_W / 2}
        y={n.subLabel ? 13 : 21}
        fill="#cbd5e1"
        fontSize={9}
        fontFamily="'JetBrains Mono', monospace"
        textAnchor="middle"
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >{n.label}</text>
      {n.subLabel && (
        <text
          x={NODE_W / 2}
          y={26}
          fill={stroke}
          fontSize={9}
          fontFamily="'JetBrains Mono', monospace"
          textAnchor="middle"
          fontWeight="bold"
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >{n.subLabel}</text>
      )}
      {n.collapsed && (
        <text x={NODE_W + 4} y={22} fill="#64748b" fontSize={8} fontFamily="monospace"
          style={{ pointerEvents: 'none' }}>▶ {n.childCount}</text>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export function ASTViewer({ ast }: ASTViewerProps) {
  const [collapsedNodes, setCollapsedNodes] = useState<Set<number>>(new Set());
  const [allCollapsed, setAllCollapsed] = useState(false);

  const layout = useMemo(() => buildTreeLayout(ast, collapsedNodes), [ast, collapsedNodes]);
  const { layoutNodes, layoutEdges, totalWidth, totalHeight, totalNodeCount } = layout;

  const toggleNode = useCallback((id: number) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); next.add(-id); }
      else { next.delete(-id); next.add(id); }
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (allCollapsed) {
      const exp = new Set<number>();
      for (let i = 0; i < totalNodeCount; i++) exp.add(-i);
      setCollapsedNodes(exp);
      setAllCollapsed(false);
    } else {
      const col = new Set<number>();
      layoutNodes.forEach(n => { if (n.depth >= 1 && n.childCount > 0) col.add(n.id); });
      setCollapsedNodes(col);
      setAllCollapsed(true);
    }
  }, [allCollapsed, totalNodeCount, layoutNodes]);

  if (!ast) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
        <svg className="w-10 h-10 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5"
            d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm">Paste code to visualize the Abstract Syntax Tree</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0a0e1a]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-[#0d1117] border-b border-white/5 shrink-0">
        <span className="text-[#00d4ff] text-xs font-semibold font-mono uppercase tracking-wider">Abstract Syntax Tree</span>
        <div className="flex-1" />
        <span className="text-xs text-gray-500 font-mono">{totalNodeCount} total nodes</span>
        <button
          onClick={toggleAll}
          className="px-2 py-1 text-xs text-gray-300 hover:text-[#00d4ff] hover:bg-white/5 rounded border border-white/10 transition-colors"
        >
          {allCollapsed ? 'Expand All' : 'Collapse All'}
        </button>
      </div>

      <div className="flex-1 overflow-hidden">
        <VirtualizedCanvas
          layoutNodes={layoutNodes}
          layoutEdges={layoutEdges}
          totalWidth={totalWidth}
          totalHeight={totalHeight}
          onToggleNode={toggleNode}
          renderNode={(n) => <ASTNodeBox n={n} onToggle={toggleNode} />}
        />
      </div>
    </div>
  );
}
