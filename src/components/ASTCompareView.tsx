/**
 * ASTCompareView — Independent side-by-side AST diff
 *
 * Each panel has its OWN zoom, pan, drag state — fully independent.
 * Scroll/zoom in BEFORE does NOT affect AFTER and vice versa.
 * Parent only owns: layout data, diffMap, collapse toggles.
 */

import React, { useMemo, useRef, useCallback, useState, useEffect } from 'react';
import { ASTNode, OptimizationSuggestion } from '../engine/types';
import {
  buildTreeLayout,
  getNodeColors,
  getLabel,
  getChildren,
  LayoutNode,
  LayoutEdge,
  NODE_W,
  NODE_H,
} from './ASTViewer';

// ─────────────────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────────────────
interface ASTCompareViewProps {
  beforeAST: ASTNode | null;
  afterAST: ASTNode | null;
  suggestions: OptimizationSuggestion[];
}

type NodeStatus = 'unchanged' | 'changed' | 'added' | 'removed';

// ─────────────────────────────────────────────────────────────────────────────
// DIFF ENGINE — greedy lookahead, handles insertions/deletions
// ─────────────────────────────────────────────────────────────────────────────
function buildDiffMap(
  beforeAST: ASTNode | null,
  afterAST: ASTNode | null
): Map<ASTNode, NodeStatus> {
  const map = new Map<ASTNode, NodeStatus>();
  if (!beforeAST || !afterAST) return map;

  function markAll(n: any, status: NodeStatus) {
    if (!n || typeof n !== 'object') return;
    if ('type' in n) map.set(n, status);
    for (const k of Object.keys(n)) {
      if (k === 'line' || k === 'column' || k === 'raw') continue;
      const v = n[k];
      if (Array.isArray(v)) v.forEach((c: any) => markAll(c, status));
      else if (v && typeof v === 'object' && 'type' in v) markAll(v, status);
    }
  }

  function walk(b: any, a: any) {
    if (!b && !a) return;
    if (b && !a) { markAll(b, 'removed'); return; }
    if (!b && a) { markAll(a, 'added'); return; }
    if (b.type !== a.type) { markAll(b, 'removed'); markAll(a, 'added'); return; }

    const same =
      b.value === a.value &&
      b.name === a.name &&
      b.operator === a.operator &&
      b.varType === a.varType;

    map.set(b, same ? 'unchanged' : 'changed');
    map.set(a, same ? 'unchanged' : 'changed');
    if (!same) (a as any)._prevSub = getLabel(b).subLabel;

    diffArrays(getChildren(b), getChildren(a));
  }

  const LOOK = 6;
  function diffArrays(bA: any[], aA: any[]) {
    let bi = 0, ai = 0;
    while (bi < bA.length && ai < aA.length) {
      const bItem = bA[bi], aItem = aA[ai];
      if (bItem?.type === aItem?.type) {
        walk(bItem, aItem); bi++; ai++;
      } else {
        let synced = false;
        for (let la = ai + 1; la < Math.min(aA.length, ai + LOOK); la++) {
          if (aA[la]?.type === bItem?.type) {
            for (let k = ai; k < la; k++) markAll(aA[k], 'added');
            ai = la; synced = true; break;
          }
        }
        if (!synced) {
          for (let lb = bi + 1; lb < Math.min(bA.length, bi + LOOK); lb++) {
            if (bA[lb]?.type === aItem?.type) {
              for (let k = bi; k < lb; k++) markAll(bA[k], 'removed');
              bi = lb; synced = true; break;
            }
          }
        }
        if (!synced) {
          markAll(bItem, 'removed'); markAll(aItem, 'added'); bi++; ai++;
        }
      }
    }
    while (bi < bA.length) { markAll(bA[bi], 'removed'); bi++; }
    while (ai < aA.length) { markAll(aA[ai], 'added'); ai++; }
  }

  walk(beforeAST, afterAST);
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE NODE RENDERER (stateless)
// ─────────────────────────────────────────────────────────────────────────────
function DiffNodeBox({
  n,
  status,
  onToggle,
}: {
  n: LayoutNode;
  status: NodeStatus;
  onToggle: (id: number) => void;
}) {
  const { fill, stroke } = getNodeColors(n.nodeType);
  const { label, subLabel } = getLabel(n.astNode);
  const prevSub = (n.astNode as any)._prevSub as string | undefined;

  let borderColor = stroke;
  let bg = fill;
  let glyph: string | null = null;
  let opacity = 1;

  if (status === 'added')   { borderColor = '#10b981'; bg = '#031a0e'; glyph = '+'; }
  if (status === 'removed') { borderColor = '#ef4444'; bg = '#1a0505'; glyph = '−'; opacity = 0.65; }
  if (status === 'changed') { borderColor = '#f59e0b'; bg = '#1a1005'; }

  const canToggle = n.childCount > 0;
  const displaySub = (status === 'changed' && prevSub && prevSub !== subLabel)
    ? `${prevSub}→${subLabel}`
    : subLabel;

  return (
    <g transform={`translate(${n.x}, ${n.y})`} opacity={opacity}>
      <rect
        width={NODE_W} height={NODE_H} rx={6}
        fill={bg} stroke={borderColor}
        strokeWidth={status !== 'unchanged' ? 2.5 : 1.5}
        strokeDasharray={n.collapsed ? '5,3' : 'none'}
        style={{ cursor: canToggle ? 'pointer' : 'default' }}
        onClick={(e) => { e.stopPropagation(); if (canToggle) onToggle(n.id); }}
      />
      {glyph && (
        <>
          <rect x={NODE_W - 14} y={1} width={13} height={11} rx={3}
            fill={borderColor} style={{ pointerEvents: 'none' }} />
          <text x={NODE_W - 7.5} y={9.5} fill="#fff" fontSize={9}
            textAnchor="middle" fontWeight="bold"
            style={{ pointerEvents: 'none', userSelect: 'none' }}>{glyph}</text>
        </>
      )}
      <text x={NODE_W / 2} y={displaySub ? 13 : 21}
        fill="#cbd5e1" fontSize={9} fontFamily="'JetBrains Mono', monospace"
        textAnchor="middle"
        textDecoration={status === 'removed' ? 'line-through' : 'none'}
        style={{ pointerEvents: 'none', userSelect: 'none' }}>{label}</text>
      {displaySub && (
        <text x={NODE_W / 2} y={26}
          fill={borderColor} fontSize={9} fontFamily="'JetBrains Mono', monospace"
          textAnchor="middle" fontWeight="bold"
          textDecoration={status === 'removed' ? 'line-through' : 'none'}
          style={{ pointerEvents: 'none', userSelect: 'none' }}>{displaySub}</text>
      )}
      {n.collapsed && (
        <text x={NODE_W + 4} y={22} fill="#475569" fontSize={8}
          fontFamily="monospace" style={{ pointerEvents: 'none', userSelect: 'none' }}>
          ▶ {n.childCount}
        </text>
      )}
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// INDEPENDENT PANEL — owns its own zoom, pan, drag, viewport
// ─────────────────────────────────────────────────────────────────────────────
interface IndependentPanelProps {
  title: string;
  titleClass: string;
  layoutNodes: LayoutNode[];
  layoutEdges: LayoutEdge[];
  totalWidth: number;
  totalHeight: number;
  diffMap: Map<ASTNode, NodeStatus>;
  onToggle: (id: number) => void;
}

function IndependentPanel({
  title, titleClass,
  layoutNodes, layoutEdges,
  totalWidth, totalHeight,
  diffMap, onToggle,
}: IndependentPanelProps) {
  // Each panel owns its own transform state
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef   = useRef<SVGGElement>(null);
  const zoomRef = useRef(1);
  const panRef  = useRef({ x: 60, y: 40 });
  const isDragging = useRef(false);
  const dragStart  = useRef({ x: 0, y: 0 });
  const rafRef     = useRef<number | null>(null);

  // Zoom display & virtualization viewport — only these need React state
  const [zoomPct, setZoomPct]   = useState(100);
  const [viewport, setViewport] = useState({
    minX: -500, maxX: 8000, minY: -200, maxY: 4000,
  });

  // Apply transform directly to DOM — no React re-render
  const applyTransform = useCallback(() => {
    const t = `translate(${panRef.current.x},${panRef.current.y}) scale(${zoomRef.current})`;
    gRef.current?.setAttribute('transform', t);
    setZoomPct(Math.round(zoomRef.current * 100));

    // Debounce viewport update for virtualization
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const z  = zoomRef.current;
      const px = panRef.current.x;
      const py = panRef.current.y;
      const m  = 280;
      setViewport({
        minX: (-px) / z - m,
        maxX: (-px + rect.width)  / z + m,
        minY: (-py) / z - m,
        maxY: (-py + rect.height) / z + m,
      });
    });
  }, []);

  // Fit this panel to its own screen
  const fitToScreen = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const scaleX = (rect.width  - 60) / (totalWidth  + 40);
    const scaleY = (rect.height - 60) / (totalHeight + 60);
    const newZoom = Math.min(scaleX, scaleY, 1.5);
    zoomRef.current = newZoom > 0.04 ? newZoom : 0.3;
    panRef.current = {
      x: Math.max(20, (rect.width - totalWidth * zoomRef.current) / 2),
      y: 36,
    };
    applyTransform();
  }, [totalWidth, totalHeight, applyTransform]);

  // Auto-fit on mount / layout change
  useEffect(() => {
    if (layoutNodes.length > 0) {
      const t = setTimeout(fitToScreen, 80);
      return () => clearTimeout(t);
    }
  }, [layoutNodes.length, fitToScreen]);

  // Wheel zoom — passive:false to block page scroll, isolated to THIS svg
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.04, Math.min(10, zoomRef.current * factor));
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const scale = newZoom / zoomRef.current;
      panRef.current.x = mx - scale * (mx - panRef.current.x);
      panRef.current.y = my - scale * (my - panRef.current.y);
      zoomRef.current = newZoom;
      applyTransform();
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, [applyTransform]);

  // Mouse drag
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    isDragging.current = true;
    dragStart.current = {
      x: e.clientX - panRef.current.x,
      y: e.clientY - panRef.current.y,
    };
    if (svgRef.current) svgRef.current.style.cursor = 'grabbing';
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    panRef.current.x = e.clientX - dragStart.current.x;
    panRef.current.y = e.clientY - dragStart.current.y;
    applyTransform();
  }, [applyTransform]);

  const onStopDrag = useCallback(() => {
    isDragging.current = false;
    if (svgRef.current) svgRef.current.style.cursor = 'grab';
  }, []);

  // Zoom buttons (panel-local)
  const zoomIn  = () => { zoomRef.current = Math.min(10, zoomRef.current * 1.25); applyTransform(); };
  const zoomOut = () => { zoomRef.current = Math.max(0.04, zoomRef.current / 1.25); applyTransform(); };

  // Virtualize — only render nodes in viewport
  const visNodes = layoutNodes.filter(n =>
    n.x + NODE_W >= viewport.minX && n.x <= viewport.maxX &&
    n.y + NODE_H >= viewport.minY && n.y <= viewport.maxY
  );

  return (
    <div className="flex-1 flex flex-col overflow-hidden border-r border-white/5 last:border-0">
      {/* Panel toolbar */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0d1117] border-b border-white/5 shrink-0">
        <span className={`px-2.5 py-0.5 ${titleClass} text-xs font-bold rounded-md border`}>
          {title}
        </span>
        <div className="flex-1" />
        <button onClick={zoomOut}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white font-mono text-base transition-colors">−</button>
        <span className="text-xs text-gray-500 font-mono tabular-nums w-10 text-center">{zoomPct}%</span>
        <button onClick={zoomIn}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 text-gray-400 hover:text-white font-mono text-base transition-colors">+</button>
        <button onClick={fitToScreen}
          className="px-2 py-0.5 text-xs rounded border border-white/10 text-gray-400 hover:text-[#00d4ff] hover:bg-white/5 transition-colors ml-1">
          Fit
        </button>
        <span className="text-xs text-gray-700 font-mono ml-1">{visNodes.length}/{layoutNodes.length}</span>
      </div>

      {/* SVG canvas */}
      <div className="flex-1 relative overflow-hidden">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="cursor-grab select-none"
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onStopDrag}
          onMouseLeave={onStopDrag}
        >
          <g ref={gRef}>
            {/* Edges */}
            {layoutEdges.map((e) => {
              const midY = (e.y1 + e.y2) / 2;
              return (
                <path key={e.id}
                  d={`M ${e.x1} ${e.y1} C ${e.x1} ${midY}, ${e.x2} ${midY}, ${e.x2} ${e.y2}`}
                  fill="none" stroke="#1e2d3d" strokeWidth="1.5"
                />
              );
            })}
            {/* Nodes (virtualized) */}
            {visNodes.map((n) => (
              <DiffNodeBox
                key={n.id}
                n={n}
                status={diffMap.get(n.astNode) || 'unchanged'}
                onToggle={onToggle}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export function ASTCompareView({ beforeAST, afterAST, suggestions }: ASTCompareViewProps) {
  const [leftCollapsed,  setLeftCollapsed]  = useState<Set<number>>(new Set());
  const [rightCollapsed, setRightCollapsed] = useState<Set<number>>(new Set());

  const leftLayout  = useMemo(() => buildTreeLayout(beforeAST, leftCollapsed),  [beforeAST,  leftCollapsed]);
  const rightLayout = useMemo(() => buildTreeLayout(afterAST,  rightCollapsed), [afterAST, rightCollapsed]);
  const diffMap     = useMemo(() => buildDiffMap(beforeAST, afterAST),          [beforeAST, afterAST]);

  const toggleLeft  = useCallback((id: number) => setLeftCollapsed(prev => {
    const n = new Set(prev);
    n.has(id) ? (n.delete(id), n.add(-id)) : (n.delete(-id), n.add(id));
    return n;
  }), []);

  const toggleRight = useCallback((id: number) => setRightCollapsed(prev => {
    const n = new Set(prev);
    n.has(id) ? (n.delete(id), n.add(-id)) : (n.delete(-id), n.add(id));
    return n;
  }), []);

  // Stats
  let removed = 0, added = 0, changed = 0, unchanged = 0;
  for (const [, s] of diffMap) {
    if (s === 'removed') removed++;
    else if (s === 'added') added++;
    else if (s === 'changed') changed++;
    else unchanged++;
  }
  changed   = Math.floor(changed   / 2);
  unchanged = Math.floor(unchanged / 2);

  if (!beforeAST && !afterAST) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 text-sm">
        Analyze code to see AST comparison
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#08090f] overflow-hidden">

      {/* Global stats bar */}
      <div className="flex items-center gap-2 px-4 py-2 bg-[#0d1117] border-b border-white/5 shrink-0 flex-wrap">
        <span className="text-xs text-gray-500 font-mono uppercase tracking-wider mr-2">Diff Summary</span>
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-red-500/15 border border-red-500/30 text-red-400">− {removed} removed</span>
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-amber-500/15 border border-amber-500/30 text-amber-400">⟳ {changed} changed</span>
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-green-500/15 border border-green-500/30 text-green-400">+ {added} added</span>
        <span className="px-2 py-0.5 rounded text-xs font-mono bg-slate-500/10 border border-slate-500/20 text-slate-400">○ {unchanged} same</span>
        <div className="flex-1" />
        <span className="text-xs text-gray-600 font-mono">Each panel zooms/pans independently</span>
      </div>

      {/* Two fully independent panels */}
      <div className="flex-1 flex overflow-hidden">
        <IndependentPanel
          title="BEFORE — Original"
          titleClass="bg-red-500/20 border-red-500/40 text-red-400"
          layoutNodes={leftLayout.layoutNodes}
          layoutEdges={leftLayout.layoutEdges}
          totalWidth={leftLayout.totalWidth}
          totalHeight={leftLayout.totalHeight}
          diffMap={diffMap}
          onToggle={toggleLeft}
        />
        <IndependentPanel
          title="AFTER — Optimized"
          titleClass="bg-green-500/20 border-green-500/40 text-green-400"
          layoutNodes={rightLayout.layoutNodes}
          layoutEdges={rightLayout.layoutEdges}
          totalWidth={rightLayout.totalWidth}
          totalHeight={rightLayout.totalHeight}
          diffMap={diffMap}
          onToggle={toggleRight}
        />
      </div>

      {/* Help footer */}
      <div className="shrink-0 px-4 py-1 bg-[#0d1117] border-t border-white/5 text-xs text-gray-600 font-mono">
        Each panel is independent — scroll/drag/zoom only affects that panel · Click a node to collapse its subtree
      </div>
    </div>
  );
}
