import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  Position,
  Handle,
  BaseEdge,
  getSmoothStepPath,
} from 'reactflow';
import dagre from 'dagre';
import 'reactflow/dist/style.css';
import {
  fetchReport,
  fetchSessionReview,
  retryQuestion,
  generateRoadmap,
  getNodeInfo,
} from '../services/mockApi';
import RadarChart from '../components/RadarChart';
import ScoreCard from '../components/ScoreCard';
import FeedbackPanel from '../components/FeedbackPanel';
import StatusChip from '../components/StatusChip';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { useTheme } from '../context/ThemeContext';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#080c14',
  surface: '#0e1420',
  surfaceHover: '#141c2e',
  border: '#1e2d45',
  borderBright: '#2a3f5f',
  spineBlue: '#3b82f6',
  spineBlueDim: '#1d4ed8',
  gold: '#f59e0b',
  goldDim: '#d97706',
  goldGlow: 'rgba(245,158,11,0.15)',
  red: '#ef4444',
  redDim: '#dc2626',
  redGlow: 'rgba(239,68,68,0.12)',
  purple: '#a855f7',
  purpleDim: '#7c3aed',
  purpleGlow: 'rgba(168,85,247,0.10)',
  teal: '#14b8a6',
  green: '#22c55e',
  greenGlow: 'rgba(34,197,94,0.12)',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#475569',
};

// Status colours
const STATUS_META = {
  done: {
    color: C.green,
    bg: 'rgba(34,197,94,0.10)',
    label: 'Done',
    icon: '✓',
  },
  'in-progress': {
    color: C.gold,
    bg: 'rgba(245,158,11,0.10)',
    label: 'In Progress',
    icon: '◷',
  },
  'not-started': {
    color: C.textMuted,
    bg: 'transparent',
    label: 'Not Started',
    icon: '○',
  },
};

// Heatmap difficulty colours
const DIFF_COLOR = {
  Beginner: { border: '#22c55e', bg: 'rgba(34,197,94,0.08)', text: '#86efac' },
  Intermediate: {
    border: '#f59e0b',
    bg: 'rgba(245,158,11,0.08)',
    text: '#fde68a',
  },
  Advanced: { border: '#ef4444', bg: 'rgba(239,68,68,0.08)', text: '#fca5a5' },
  default: {
    border: C.borderBright,
    bg: C.surfaceHover,
    text: C.textSecondary,
  },
};

// ─── localStorage helpers ─────────────────────────────────────────────────────
const LS_KEY = 'roadmap_progress';

function loadProgress(roadmapId) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    return all[roadmapId] || {};
  } catch {
    return {};
  }
}

function saveProgress(roadmapId, progress) {
  try {
    const all = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
    all[roadmapId] = progress;
    localStorage.setItem(LS_KEY, JSON.stringify(all));
  } catch {}
}

// ─── Dagre LR layout ──────────────────────────────────────────────────────────
const NODE_DIMS = {
  root: { w: 170, h: 52 },
  main: { w: 190, h: 58 },
  subtopic: { w: 162, h: 40 },
  leaf: { w: 148, h: 34 },
  optional: { w: 148, h: 34 },
  focus: { w: 155, h: 44 },
};

function applyDagreLayout(nodes, edges) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'LR',
    nodesep: 22,
    ranksep: 72,
    marginx: 32,
    marginy: 32,
  });
  nodes.forEach((n) => {
    const d = NODE_DIMS[n.type] || { w: 148, h: 34 };
    g.setNode(n.id, { width: d.w, height: d.h });
  });
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);
  return nodes.map((n) => {
    const pos = g.node(n.id);
    if (!pos) return n;
    const d = NODE_DIMS[n.type] || { w: 148, h: 34 };
    return {
      ...n,
      position: { x: pos.x - d.w / 2, y: pos.y - d.h / 2 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
  });
}

// ─── Edges ────────────────────────────────────────────────────────────────────
function SpineEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 10,
  });
  const dimmed = data?.dimmed;
  return (
    <>
      <BaseEdge
        id={`${id}-g`}
        path={path}
        style={{
          stroke: C.spineBlue,
          strokeWidth: 6,
          opacity: dimmed ? 0.03 : 0.15,
          filter: 'blur(3px)',
        }}
      />
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: C.spineBlue,
          strokeWidth: 2,
          opacity: dimmed ? 0.08 : 1,
        }}
      />
    </>
  );
}
function BranchEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 6,
  });
  const dimmed = data?.dimmed;
  return (
    <BaseEdge
      id={id}
      path={path}
      style={{
        stroke: C.borderBright,
        strokeWidth: 1.5,
        strokeDasharray: '5 4',
        opacity: dimmed ? 0.06 : 1,
      }}
    />
  );
}
function FocusEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 6,
  });
  const dimmed = data?.dimmed;
  return (
    <>
      <BaseEdge
        id={`${id}-g`}
        path={path}
        style={{
          stroke: C.red,
          strokeWidth: 4,
          opacity: dimmed ? 0.03 : 0.2,
          filter: 'blur(2px)',
        }}
      />
      <BaseEdge
        id={id}
        path={path}
        style={{
          stroke: C.red,
          strokeWidth: 1.5,
          strokeDasharray: '4 3',
          opacity: dimmed ? 0.06 : 1,
        }}
      />
    </>
  );
}
function OptionalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) {
  const [path] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    borderRadius: 6,
  });
  const dimmed = data?.dimmed;
  return (
    <BaseEdge
      id={id}
      path={path}
      style={{
        stroke: C.purple,
        strokeWidth: 1.5,
        strokeDasharray: '6 4',
        opacity: dimmed ? 0.05 : 0.7,
      }}
    />
  );
}
const edgeTypes = {
  spine: SpineEdge,
  branch: BranchEdge,
  focus: FocusEdge,
  optional: OptionalEdge,
};

// ─── Handle helpers ───────────────────────────────────────────────────────────
const Src = ({ color = C.borderBright }) => (
  <Handle
    type="source"
    position={Position.Right}
    style={{
      width: 6,
      height: 6,
      background: color,
      border: `1.5px solid ${color}`,
      borderRadius: 2,
      right: -3,
    }}
  />
);
const Tgt = ({ color = C.borderBright }) => (
  <Handle
    type="target"
    position={Position.Left}
    style={{
      width: 6,
      height: 6,
      background: color,
      border: `1.5px solid ${color}`,
      borderRadius: 2,
      left: -3,
    }}
  />
);

// ─── Done overlay ─────────────────────────────────────────────────────────────
function DoneRing({ small }) {
  const s = small ? 16 : 20;
  return (
    <div
      style={{
        width: s,
        height: s,
        borderRadius: '50%',
        background: C.green,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: small ? 9 : 11,
        color: '#fff',
        fontWeight: 800,
        flexShrink: 0,
        boxShadow: `0 0 8px ${C.greenGlow}`,
      }}
    >
      ✓
    </div>
  );
}

// ─── Node factory helper ──────────────────────────────────────────────────────
// Each node receives: data.status, data.heatmap, data.dimmed, data.difficultyData
function nodeStyle(base, status, dimmed, heatmap, diffData) {
  if (dimmed) return { ...base, opacity: 0.12, filter: 'grayscale(0.8)' };
  if (status === 'done')
    return { ...base, opacity: 0.55, filter: 'grayscale(0.4)' };
  if (heatmap && diffData)
    return {
      ...base,
      border: `1px solid ${diffData.border}`,
      background: diffData.bg,
      boxShadow: `0 0 12px ${diffData.border}22`,
    };
  return base;
}

// ─── Node components ──────────────────────────────────────────────────────────
const RootNode = ({ data }) => (
  <div
    style={{
      position: 'relative',
      padding: 2,
      borderRadius: 10,
      background: `linear-gradient(135deg, ${C.gold}, ${C.goldDim})`,
      boxShadow: `0 0 24px ${C.goldGlow}, 0 4px 16px rgba(0,0,0,0.4)`,
      opacity: data.dimmed ? 0.15 : 1,
    }}
  >
    <div
      style={{
        background: 'linear-gradient(135deg,#1a1200,#120d00)',
        borderRadius: 8,
        padding: '10px 22px',
        minWidth: 140,
        textAlign: 'center',
      }}
    >
      <div
        style={{
          color: C.gold,
          fontWeight: 800,
          fontSize: 15,
          letterSpacing: '0.02em',
        }}
      >
        {data.label}
      </div>
      <div
        style={{
          color: C.goldDim,
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          marginTop: 3,
        }}
      >
        Learning Path
      </div>
    </div>
    <Src color={C.spineBlue} />
  </div>
);

const MainNode = ({ data, selected }) => {
  const isWeak = data.isWeak;
  const accent = isWeak ? C.red : C.spineBlue;
  const accentG = isWeak ? C.redGlow : 'rgba(59,130,246,0.12)';
  const status = data.status || 'not-started';
  const sm = STATUS_META[status];
  const hd =
    data.heatmap && data.difficultyData
      ? DIFF_COLOR[data.difficultyData] || DIFF_COLOR.default
      : null;

  const base = {
    position: 'relative',
    borderRadius: 8,
    border: `1px solid ${isWeak ? C.redDim : C.borderBright}`,
    background: `linear-gradient(135deg, ${C.surfaceHover} 0%, ${C.surface} 100%)`,
    boxShadow: selected
      ? `0 0 0 1.5px ${accent}, 0 0 20px ${accentG}`
      : `0 0 12px ${accentG}`,
    padding: '10px 14px 10px 18px',
    minWidth: 170,
    cursor: 'pointer',
    transition: 'all 0.15s',
    overflow: 'hidden',
  };

  const finalStyle = nodeStyle(
    base,
    status,
    data.dimmed,
    data.heatmap,
    hd?.bg ? hd : null
  );

  return (
    <div style={finalStyle}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          background: `linear-gradient(180deg,${accent},${isWeak ? C.redDim : C.spineBlueDim})`,
          borderRadius: '8px 0 0 8px',
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 6,
        }}
      >
        <div style={{ flex: 1 }}>
          {isWeak && (
            <div
              style={{
                fontSize: 8,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: C.red,
                textTransform: 'uppercase',
                marginBottom: 3,
              }}
            >
              ⚠ Focus
            </div>
          )}
          <div
            style={{
              color: data.heatmap && hd ? hd.text : C.textPrimary,
              fontWeight: 700,
              fontSize: 13,
              lineHeight: 1.25,
            }}
          >
            {data.label}
          </div>
          {data.timeToLearn && (
            <div style={{ color: C.textMuted, fontSize: 10, marginTop: 4 }}>
              <span style={{ color: accent, opacity: 0.7 }}>◷</span>{' '}
              {data.timeToLearn}
            </div>
          )}
        </div>
        {status === 'done' && <DoneRing />}
        {status === 'in-progress' && (
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: C.gold,
              boxShadow: `0 0 6px ${C.gold}`,
              marginTop: 3,
              flexShrink: 0,
            }}
          />
        )}
      </div>
      <Tgt color={accent} />
      <Src color={accent} />
    </div>
  );
};

const SubtopicNode = ({ data, selected }) => {
  const status = data.status || 'not-started';
  const hd =
    data.heatmap && data.difficultyData
      ? DIFF_COLOR[data.difficultyData] || DIFF_COLOR.default
      : null;
  return (
    <div
      style={nodeStyle(
        {
          borderRadius: 6,
          border: `1px solid ${selected ? C.gold : C.border}`,
          background: selected ? 'rgba(245,158,11,0.06)' : C.surface,
          padding: '7px 12px',
          minWidth: 140,
          cursor: 'pointer',
          transition: 'all 0.15s',
          boxShadow: selected
            ? `0 0 12px ${C.goldGlow}`
            : '0 1px 4px rgba(0,0,0,0.3)',
        },
        status,
        data.dimmed,
        data.heatmap,
        hd
      )}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
        }}
      >
        <span
          style={{
            color:
              data.heatmap && hd
                ? hd.text
                : selected
                  ? C.gold
                  : C.textSecondary,
            fontWeight: 600,
            fontSize: 11.5,
            lineHeight: 1.3,
            flex: 1,
            textAlign: 'center',
          }}
        >
          {data.isWeak && (
            <span style={{ color: C.red, marginRight: 4, fontSize: 9 }}>⚠</span>
          )}
          {data.label}
        </span>
        {status === 'done' && <DoneRing small />}
      </div>
      <Tgt />
      <Src />
    </div>
  );
};

const LeafNode = ({ data, selected }) => {
  const status = data.status || 'not-started';
  const hd =
    data.heatmap && data.difficultyData
      ? DIFF_COLOR[data.difficultyData] || DIFF_COLOR.default
      : null;
  return (
    <div
      style={nodeStyle(
        {
          borderRadius: 5,
          border: `1px solid ${selected ? C.teal : '#1a2840'}`,
          background: selected ? 'rgba(20,184,166,0.08)' : '#0a0f1a',
          padding: '5px 10px',
          minWidth: 120,
          cursor: 'pointer',
          transition: 'all 0.12s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
        },
        status,
        data.dimmed,
        data.heatmap,
        hd
      )}
    >
      <span
        style={{
          color: data.heatmap && hd ? hd.text : selected ? C.teal : C.textMuted,
          fontSize: 11,
          fontWeight: 500,
          flex: 1,
          textAlign: 'center',
        }}
      >
        {data.isWeak && (
          <span style={{ color: C.red, fontSize: 9, marginRight: 3 }}>⚠</span>
        )}
        {data.label}
      </span>
      {status === 'done' && <DoneRing small />}
      <Tgt color="#1a2840" />
      <Src color="#1a2840" />
    </div>
  );
};

const OptionalNode = ({ data, selected }) => {
  const status = data.status || 'not-started';
  return (
    <div
      style={nodeStyle(
        {
          borderRadius: 5,
          border: `1px dashed ${selected ? C.purple : C.purpleDim}`,
          background: selected ? C.purpleGlow : 'rgba(124,58,237,0.04)',
          padding: '5px 10px',
          minWidth: 120,
          cursor: 'pointer',
          transition: 'all 0.12s',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 5,
        },
        status,
        data.dimmed,
        false,
        null
      )}
    >
      <span style={{ color: C.purple, fontSize: 8, opacity: 0.8 }}>◆</span>
      <span
        style={{
          color: selected ? C.purple : '#6d4ab0',
          fontSize: 11,
          fontWeight: 500,
        }}
      >
        {data.label}
      </span>
      {status === 'done' && <DoneRing small />}
      <Tgt color={C.purpleDim} />
      <Src color={C.purpleDim} />
    </div>
  );
};

const FocusNode = ({ data, selected }) => {
  const status = data.status || 'not-started';
  return (
    <div
      style={nodeStyle(
        {
          position: 'relative',
          borderRadius: 6,
          border: `1.5px solid ${C.red}`,
          background:
            'linear-gradient(135deg,rgba(239,68,68,0.12),rgba(220,38,38,0.06))',
          padding: '8px 12px',
          minWidth: 130,
          cursor: 'pointer',
          transition: 'all 0.15s',
          boxShadow: `0 0 16px ${C.redGlow}`,
          overflow: 'hidden',
        },
        status,
        data.dimmed,
        false,
        null
      )}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg,transparent,${C.red},transparent)`,
        }}
      />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.12em',
              color: C.red,
              textTransform: 'uppercase',
              marginBottom: 3,
            }}
          >
            ⚠ Focus
          </div>
          <div
            style={{
              color: '#fca5a5',
              fontWeight: 600,
              fontSize: 12,
              lineHeight: 1.25,
            }}
          >
            {data.label}
          </div>
        </div>
        {status === 'done' && <DoneRing small />}
      </div>
      <Tgt color={C.red} />
      <Src color={C.red} />
    </div>
  );
};

const nodeTypes = {
  root: RootNode,
  main: MainNode,
  subtopic: SubtopicNode,
  leaf: LeafNode,
  optional: OptionalNode,
  focus: FocusNode,
};

// ─── Progress bar ─────────────────────────────────────────────────────────────
function ProgressBar({ progress, nodes }) {
  const trackable = nodes.filter((n) => n.type !== 'root');
  const total = trackable.length;
  const done = trackable.filter((n) => progress[n.id] === 'done').length;
  const inProg = trackable.filter(
    (n) => progress[n.id] === 'in-progress'
  ).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      style={{
        padding: '10px 18px',
        borderBottom: `1px solid ${C.border}`,
        background: C.surface,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 7,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: C.textPrimary, fontSize: 12, fontWeight: 700 }}>
            {done}{' '}
            <span style={{ color: C.textMuted, fontWeight: 400 }}>
              / {total} completed
            </span>
          </span>
          {inProg > 0 && (
            <span
              style={{
                fontSize: 11,
                color: C.gold,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: C.gold,
                  display: 'inline-block',
                }}
              />
              {inProg} in progress
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: pct === 100 ? C.green : C.textSecondary,
          }}
        >
          {pct}%
        </span>
      </div>
      {/* Track */}
      <div
        style={{
          height: 5,
          borderRadius: 99,
          background: C.border,
          overflow: 'hidden',
        }}
      >
        {/* In-progress layer */}
        <div
          style={{
            height: '100%',
            borderRadius: 99,
            width: `${Math.round(((done + inProg) / total) * 100)}%`,
            background: C.gold,
            opacity: 0.35,
            position: 'absolute',
            transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
          }}
        />
        {/* Done layer */}
        <div
          style={{
            height: '100%',
            borderRadius: 99,
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${C.spineBlue}, ${C.green})`,
            transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: pct > 0 ? `0 0 8px ${C.green}55` : 'none',
            position: 'relative',
          }}
        />
      </div>
      {pct === 100 && (
        <div
          style={{
            textAlign: 'center',
            marginTop: 6,
            fontSize: 11,
            color: C.green,
            fontWeight: 700,
            letterSpacing: '0.05em',
          }}
        >
          🎉 Roadmap Complete!
        </div>
      )}
    </div>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────
function ToolbarBtn({ active, onClick, children, title, color }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 10px',
        borderRadius: 6,
        cursor: 'pointer',
        fontSize: 11,
        fontWeight: 600,
        border: `1px solid ${active ? color || C.spineBlue : C.border}`,
        background: active ? `${color || C.spineBlue}18` : 'transparent',
        color: active ? color || C.spineBlue : C.textMuted,
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  );
}

// ─── Side panel ───────────────────────────────────────────────────────────────
const resourceBadge = {
  Course: {
    bg: 'rgba(245,158,11,0.1)',
    color: C.gold,
    border: 'rgba(245,158,11,0.3)',
  },
  Article: {
    bg: 'rgba(59,130,246,0.1)',
    color: '#60a5fa',
    border: 'rgba(59,130,246,0.3)',
  },
  Video: {
    bg: 'rgba(239,68,68,0.1)',
    color: '#f87171',
    border: 'rgba(239,68,68,0.3)',
  },
  Book: {
    bg: 'rgba(168,85,247,0.1)',
    color: '#c084fc',
    border: 'rgba(168,85,247,0.3)',
  },
  Resource: {
    bg: 'rgba(71,85,105,0.3)',
    color: C.textSecondary,
    border: 'rgba(71,85,105,0.5)',
  },
};

function SidePanel({ node, targetRole, onClose, progress, onStatusChange }) {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const status = progress[node?.id] || 'not-started';

  useEffect(() => {
    if (!node) return;
    setInfo(null);
    if (node.data.description) {
      setInfo({
        description: node.data.description,
        resources: node.data.resources || [],
        timeToLearn: node.data.timeToLearn,
        priority: node.data.priority,
        whatYouWillLearn: [],
        prerequisites: [],
        difficulty: 'Intermediate',
      });
    }
    setLoading(true);
    getNodeInfo(node.data.label, targetRole)
      .then(setInfo)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [node?.id, targetRole]);

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!node) return null;
  const isWeak = node.data.isWeak || node.type === 'focus';
  const accent = isWeak
    ? C.red
    : node.type === 'optional'
      ? C.purple
      : C.spineBlue;

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 64,
        bottom: 0,
        width: 380,
        background: C.surface,
        borderLeft: `1px solid ${C.border}`,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
      }}
    >
      <div
        style={{
          height: 2,
          background: `linear-gradient(90deg,${accent},transparent)`,
          flexShrink: 0,
        }}
      />

      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
            <div
              style={{
                display: 'flex',
                gap: 5,
                flexWrap: 'wrap',
                marginBottom: 8,
              }}
            >
              {isWeak && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: C.red,
                    background: 'rgba(239,68,68,0.12)',
                    border: `1px solid rgba(239,68,68,0.3)`,
                    padding: '2px 7px',
                    borderRadius: 3,
                  }}
                >
                  ⚠ Focus
                </span>
              )}
              {info?.priority && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color:
                      info.priority === 'High'
                        ? C.red
                        : info.priority === 'Medium'
                          ? C.gold
                          : C.teal,
                    background:
                      info.priority === 'High'
                        ? 'rgba(239,68,68,0.1)'
                        : info.priority === 'Medium'
                          ? 'rgba(245,158,11,0.1)'
                          : 'rgba(20,184,166,0.1)',
                    padding: '2px 7px',
                    borderRadius: 3,
                  }}
                >
                  {info.priority}
                </span>
              )}
              {info?.difficulty && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: C.textMuted,
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    padding: '2px 7px',
                    borderRadius: 3,
                  }}
                >
                  {info.difficulty}
                </span>
              )}
            </div>
            <h3
              style={{
                color: C.textPrimary,
                fontWeight: 700,
                fontSize: 15,
                lineHeight: 1.3,
                margin: 0,
              }}
            >
              {node.data.label}
            </h3>
            {info?.timeToLearn && (
              <p style={{ color: C.textMuted, fontSize: 11, marginTop: 5 }}>
                ◷ {info.timeToLearn} to learn
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: `1px solid ${C.border}`,
              borderRadius: 6,
              color: C.textMuted,
              cursor: 'pointer',
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Status changer */}
        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          {Object.entries(STATUS_META).map(([key, meta]) => (
            <button
              key={key}
              onClick={() => onStatusChange(node.id, key)}
              style={{
                flex: 1,
                padding: '7px 4px',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 11,
                fontWeight: 600,
                border: `1px solid ${status === key ? meta.color : C.border}`,
                background: status === key ? `${meta.color}18` : 'transparent',
                color: status === key ? meta.color : C.textMuted,
                transition: 'all 0.15s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
              }}
            >
              <span>{meta.icon}</span> {meta.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
        {info?.description && (
          <p
            style={{
              color: C.textSecondary,
              fontSize: 12.5,
              lineHeight: 1.7,
              margin: '0 0 20px',
            }}
          >
            {info.description}
          </p>
        )}

        {info?.whatYouWillLearn?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: C.textMuted,
                marginBottom: 10,
              }}
            >
              What You'll Learn
            </div>
            {info.whatYouWillLearn.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  marginBottom: 7,
                }}
              >
                <span
                  style={{
                    color: accent,
                    fontSize: 14,
                    lineHeight: 1,
                    marginTop: 1,
                    flexShrink: 0,
                  }}
                >
                  ›
                </span>
                <span
                  style={{
                    color: C.textSecondary,
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {item}
                </span>
              </div>
            ))}
          </div>
        )}

        {info?.prerequisites?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: C.textMuted,
                marginBottom: 10,
              }}
            >
              Prerequisites
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {info.prerequisites.map((p, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: 11,
                    padding: '3px 9px',
                    borderRadius: 4,
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    color: C.textSecondary,
                  }}
                >
                  {p}
                </span>
              ))}
            </div>
          </div>
        )}

        {(info?.difficulty || info?.timeToLearn) && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 8,
              marginBottom: 20,
            }}
          >
            {[
              ['Difficulty', info?.difficulty],
              ['Time', info?.timeToLearn],
            ]
              .filter(([, v]) => v)
              .map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    padding: 10,
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      color: C.textMuted,
                      marginBottom: 5,
                    }}
                  >
                    {label}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: C.textPrimary,
                    }}
                  >
                    {value}
                  </div>
                </div>
              ))}
          </div>
        )}

        {info?.resources?.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: C.textMuted,
                marginBottom: 10,
              }}
            >
              Resources
            </div>
            {info.resources.map((r, i) => {
              const b = resourceBadge[r.type] || resourceBadge.Resource;
              return (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    marginBottom: 6,
                    background: C.bg,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    textDecoration: 'none',
                    transition: 'all 0.15s',
                  }}
                >
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 3,
                      flexShrink: 0,
                      background: b.bg,
                      color: b.color,
                      border: `1px solid ${b.border}`,
                    }}
                  >
                    {r.type}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: C.textSecondary,
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {r.title}
                  </span>
                  {r.free === false && (
                    <span
                      style={{
                        fontSize: 9,
                        color: C.gold,
                        background: 'rgba(245,158,11,0.1)',
                        padding: '2px 6px',
                        borderRadius: 3,
                      }}
                    >
                      Paid
                    </span>
                  )}
                  <span style={{ color: C.textMuted, fontSize: 12 }}>→</span>
                </a>
              );
            })}
          </div>
        )}

        {loading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 0',
              color: C.textMuted,
              fontSize: 12,
            }}
          >
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                border: `2px solid ${C.border}`,
                borderTopColor: accent,
                animation: 'spin 0.7s linear infinite',
              }}
            />
            Fetching details...
          </div>
        )}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Edge mapper with focus/dim data ─────────────────────────────────────────
function buildEdges(edges, focusedMainId, nodes) {
  if (!focusedMainId)
    return edges.map((e) => ({
      ...e,
      type: e.edgeType || 'branch',
      data: { dimmed: false },
    }));

  // collect all node ids in the focused branch (BFS)
  const adj = {};
  edges.forEach((e) => {
    (adj[e.source] = adj[e.source] || []).push(e.target);
  });
  const visited = new Set([focusedMainId]);
  const queue = [focusedMainId];
  while (queue.length) {
    const cur = queue.shift();
    (adj[cur] || []).forEach((t) => {
      if (!visited.has(t)) {
        visited.add(t);
        queue.push(t);
      }
    });
  }
  // also include root → focusedMainId path
  edges.forEach((e) => {
    if (e.target === focusedMainId) visited.add(e.source);
  });

  return edges.map((e) => ({
    ...e,
    type: e.edgeType || 'branch',
    data: { dimmed: !visited.has(e.source) || !visited.has(e.target) },
  }));
}

// ─── Inner flow (needs ReactFlow context for export) ──────────────────────────
function RoadmapFlow({
  nodes: rawNodes,
  edges: rawEdges,
  targetRole,
  roadmapId,
}) {
  const { getNodes, fitView } = useReactFlow();
  const flowRef = useRef(null);

  // ── State ────────────────────────────────────────────────────────────────
  const [progress, setProgress] = useState(() => loadProgress(roadmapId));
  const [focusedId, setFocusedId] = useState(null); // focused main node id
  const [heatmap, setHeatmap] = useState(false);
  const [selectedNode, setSelectedNode] = useState(null);
  const [diffMap, setDiffMap] = useState({}); // nodeId → difficulty string

  // Persist progress
  useEffect(() => {
    saveProgress(roadmapId, progress);
  }, [roadmapId, progress]);

  // Fetch difficulty for heatmap when toggled on
  useEffect(() => {
    if (!heatmap) return;
    const missing = rawNodes.filter((n) => n.type !== 'root' && !diffMap[n.id]);
    if (missing.length === 0) return;
    // Batch: assign difficulty based on node type heuristic (real app would use AI)
    const updates = {};
    rawNodes.forEach((n) => {
      if (diffMap[n.id]) return;
      if (n.type === 'root' || n.type === 'main')
        updates[n.id] = 'Intermediate';
      else if (n.type === 'leaf' || n.type === 'optional')
        updates[n.id] = 'Beginner';
      else if (n.type === 'focus') updates[n.id] = 'Advanced';
      else updates[n.id] = 'Intermediate';
    });
    setDiffMap((prev) => ({ ...prev, ...updates }));
  }, [heatmap, rawNodes]);

  // ── Build nodes with runtime data injected ───────────────────────────────
  const layoutNodes = useMemo(() => {
    const base = applyDagreLayout(rawNodes, rawEdges);
    return base.map((n) => {
      const dimmed = focusedId
        ? (() => {
            // build reachable set from focusedId
            const adj = {};
            rawEdges.forEach((e) => {
              (adj[e.source] = adj[e.source] || []).push(e.target);
            });
            const vis = new Set([focusedId]);
            const q = [focusedId];
            while (q.length) {
              const c = q.shift();
              (adj[c] || []).forEach((t) => {
                if (!vis.has(t)) {
                  vis.add(t);
                  q.push(t);
                }
              });
            }
            rawEdges.forEach((e) => {
              if (e.target === focusedId) vis.add(e.source);
            });
            return !vis.has(n.id);
          })()
        : false;

      return {
        ...n,
        data: {
          ...n.data,
          status: progress[n.id] || 'not-started',
          dimmed,
          heatmap,
          difficultyData: diffMap[n.id] || null,
        },
      };
    });
  }, [rawNodes, rawEdges, progress, focusedId, heatmap, diffMap]);

  const layoutEdges = useMemo(
    () => buildEdges(rawEdges, focusedId, rawNodes),
    [rawEdges, focusedId, rawNodes]
  );

  const [rfNodes, , onNodesChange] = useNodesState(layoutNodes);
  const [rfEdges, , onEdgesChange] = useEdgesState(layoutEdges);

  // Sync when layoutNodes / layoutEdges change
  useEffect(() => {
    onNodesChange(layoutNodes.map((n) => ({ type: 'reset', item: n })));
  }, [layoutNodes]);
  useEffect(() => {
    onEdgesChange(layoutEdges.map((e) => ({ type: 'reset', item: e })));
  }, [layoutEdges]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleNodeClick = useCallback((_, node) => {
    if (node.type === 'root') return;

    // Focus mode: clicking a main node toggles focus
    if (node.type === 'main') {
      setFocusedId((prev) => (prev === node.id ? null : node.id));
      setSelectedNode(null);
      return;
    }

    setSelectedNode((prev) => (prev?.id === node.id ? null : node));
  }, []);

  const handleStatusChange = useCallback((nodeId, newStatus) => {
    setProgress((prev) => ({ ...prev, [nodeId]: newStatus }));
  }, []);

  // ── Export PNG ────────────────────────────────────────────────────────────
  const handleExport = useCallback(async () => {
    try {
      const { toPng } = await import('html-to-image');
      const el = flowRef.current?.querySelector('.react-flow__viewport');
      if (!el) return;

      // Temporarily zoom to fit
      fitView({ padding: 0.05, duration: 0 });
      await new Promise((r) => setTimeout(r, 100));

      const dataUrl = await toPng(el, {
        backgroundColor: C.bg,
        pixelRatio: 2,
        style: { borderRadius: 0 },
      });

      const a = document.createElement('a');
      a.download = `${targetRole.replace(/\s+/g, '-').toLowerCase()}-roadmap.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      console.error('Export failed:', err);
      alert(
        'Export failed. Make sure html-to-image is installed:\nnpm install html-to-image'
      );
    }
  }, [targetRole, fitView]);

  // ── Stats ─────────────────────────────────────────────────────────────────
  const trackable = rawNodes.filter((n) => n.type !== 'root');

  return (
    <div
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        border: `1px solid ${C.border}`,
        background: C.bg,
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          padding: '10px 18px',
          borderBottom: `1px solid ${C.border}`,
          background: C.surface,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {['#ef4444', '#f59e0b', '#22c55e'].map((c, i) => (
            <div
              key={i}
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: c,
                opacity: 0.7,
              }}
            />
          ))}
          <div style={{ width: 1, height: 16, background: C.border }} />
          <span style={{ color: C.textPrimary, fontWeight: 700, fontSize: 13 }}>
            {targetRole}
          </span>
          <span
            style={{
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: C.gold,
              background: 'rgba(245,158,11,0.08)',
              border: `1px solid rgba(245,158,11,0.2)`,
              padding: '2px 8px',
              borderRadius: 4,
            }}
          >
            AI Roadmap
          </span>
          <span style={{ color: C.textMuted, fontSize: 10 }}>
            {trackable.length} nodes
          </span>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {focusedId && (
            <ToolbarBtn
              active
              onClick={() => setFocusedId(null)}
              color={C.gold}
            >
              <span style={{ fontSize: 12 }}>◎</span> Exit Focus
            </ToolbarBtn>
          )}
          <ToolbarBtn
            active={heatmap}
            onClick={() => setHeatmap((v) => !v)}
            color={C.teal}
            title="Difficulty heatmap"
          >
            <span style={{ fontSize: 12 }}>🌡</span> Heatmap
          </ToolbarBtn>
          <ToolbarBtn onClick={handleExport} title="Export as PNG">
            <span style={{ fontSize: 12 }}>↓</span> Export PNG
          </ToolbarBtn>

          {/* Legend */}
          <div style={{ width: 1, height: 18, background: C.border }} />
          {[
            { color: C.spineBlue, label: 'Path' },
            { color: C.red, label: 'Focus' },
            { color: C.purple, label: 'Optional' },
          ].map(({ color, label }) => (
            <div
              key={label}
              style={{ display: 'flex', alignItems: 'center', gap: 4 }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: color,
                }}
              />
              <span style={{ color: C.textMuted, fontSize: 10 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Progress bar ── */}
      <ProgressBar progress={progress} nodes={rawNodes} />

      {/* Focus mode banner */}
      {focusedId && (
        <div
          style={{
            padding: '7px 18px',
            background: 'rgba(245,158,11,0.06)',
            borderBottom: `1px solid rgba(245,158,11,0.15)`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span style={{ fontSize: 12 }}>◎</span>
          <span style={{ color: C.gold, fontSize: 11, fontWeight: 600 }}>
            Focus mode — showing branch for "
            {rawNodes.find((n) => n.id === focusedId)?.data?.label}"
          </span>
          <span style={{ color: C.textMuted, fontSize: 11 }}>
            · Click the same node or "Exit Focus" to reset
          </span>
        </div>
      )}

      {/* Heatmap banner */}
      {heatmap && (
        <div
          style={{
            padding: '7px 18px',
            background: 'rgba(20,184,166,0.05)',
            borderBottom: `1px solid rgba(20,184,166,0.15)`,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
          }}
        >
          <span style={{ color: C.teal, fontSize: 11, fontWeight: 700 }}>
            🌡 Difficulty Heatmap
          </span>
          {[
            ['Beginner', '#22c55e'],
            ['Intermediate', '#f59e0b'],
            ['Advanced', '#ef4444'],
          ].map(([label, color]) => (
            <div
              key={label}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: color,
                }}
              />
              <span style={{ color: C.textMuted, fontSize: 10 }}>{label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Canvas ── */}
      <div ref={flowRef} style={{ height: 680 }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.08 }}
          minZoom={0.15}
          maxZoom={2.5}
          proOptions={{ hideAttribution: true }}
          style={{ background: C.bg, height: '100%' }}
        >
          <Controls
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
            }}
          />
          <MiniMap
            nodeColor={(n) => {
              if (n.type === 'root') return C.gold;
              if (n.type === 'focus') return C.red;
              if (n.type === 'optional') return C.purple;
              if (n.type === 'main')
                return n.data?.isWeak ? C.red : C.spineBlue;
              return '#1a2840';
            }}
            maskColor="rgba(8,12,20,0.75)"
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 8,
            }}
          />
          <Background variant="dots" gap={28} size={0.7} color="#0e1622" />
        </ReactFlow>
      </div>

      {selectedNode && (
        <SidePanel
          node={selectedNode}
          targetRole={targetRole}
          onClose={() => setSelectedNode(null)}
          progress={progress}
          onStatusChange={handleStatusChange}
        />
      )}
    </div>
  );
}

// Wrap with provider so useReactFlow works
function RoadmapSection({ nodes, edges, targetRole, roadmapId }) {
  return (
    <ReactFlowProvider>
      <RoadmapFlow
        nodes={nodes}
        edges={edges}
        targetRole={targetRole}
        roadmapId={roadmapId}
      />
    </ReactFlowProvider>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PerformanceAnalysisPage() {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const sessionId = sessionStorage.getItem('currentSessionId');

  const [report, setReport] = useState(null);
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [roadmap, setRoadmap] = useState(null);
  const [roadmapLoading, setRoadmapLoading] = useState(false);
  const [roadmapError, setRoadmapError] = useState(null);
  const [roadmapRole, setRoadmapRole] = useState('');

  useEffect(() => {
    if (!sessionId) {
      navigate('/setup');
      return;
    }
    (async () => {
      try {
        const [r, rv] = await Promise.all([
          fetchReport(sessionId),
          fetchSessionReview(sessionId),
        ]);
        setReport(r);
        setReview(rv);
      } catch {
        setError('Failed to load results.');
      } finally {
        setLoading(false);
      }
    })();
  }, [sessionId, navigate]);

  useEffect(() => {
    if (!report) return;
    (async () => {
      setRoadmapLoading(true);
      setRoadmapError(null);
      try {
        const questions = JSON.parse(
          sessionStorage.getItem('currentQuestions') || '[]'
        );
        const role =
          questions[0]?.role ||
          review?.session?.title?.replace(
            / (TECHNICAL|HR|MIXED|COMMUNICATION) Interview$/,
            ''
          ) ||
          'Professional';
        setRoadmapRole(role);
        const weaknesses = Array.isArray(report.weaknesses)
          ? report.weaknesses
          : [];
        const rd = report.radarData || { labels: [], values: [] };
        const lowAreas = rd.labels.filter((_, i) => (rd.values[i] ?? 10) < 7);
        const weakSkills = [...new Set([...weaknesses, ...lowAreas])].slice(
          0,
          5
        );
        const data = await generateRoadmap(role, weakSkills);
        setRoadmap(data);
      } catch {
        setRoadmapError('Could not generate roadmap.');
      } finally {
        setRoadmapLoading(false);
      }
    })();
  }, [report, review]);

  if (loading) return <LoadingState message="Loading your results..." />;
  if (error)
    return (
      <ErrorState
        title="Error"
        message={error}
        onRetry={() => window.location.reload()}
      />
    );

  const radarData = report?.radarData || { labels: [], values: [] };
  const recommendations = Array.isArray(report?.recommendations)
    ? report.recommendations
    : [];
  const getStatus = (s) =>
    s >= 8
      ? 'excellent'
      : s >= 7
        ? 'good'
        : s >= 6
          ? 'borderline'
          : 'needs-improvement';

  // Stable roadmap ID for localStorage (role + session)
  const roadmapId = `${roadmapRole}-${sessionId}`
    .replace(/\s+/g, '-')
    .toLowerCase();

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <section className="text-center mb-12">
        <p className="section-header mb-2">Session Complete</p>
        <h1 className="mb-3">Performance Analysis</h1>
        <div className="inline-flex items-baseline gap-2 mb-2">
          <span className="text-6xl font-extrabold text-primary-500">
            {report?.overallScore ?? 'N/A'}
          </span>
          <span className="text-2xl text-ink-500 font-bold">/ 10</span>
        </div>
        <p className="text-ink-500">
          Overall Rating:{' '}
          <span className="font-bold text-ink-900">
            {report?.ratingLabel ?? 'N/A'}
          </span>
        </p>
        {report?.summary && (
          <p className="text-ink-500 mt-2 max-w-xl mx-auto text-sm">
            {report.summary}
          </p>
        )}
      </section>

      <section className="grid lg:grid-cols-2 gap-8 mb-12">
        <div className="card flex items-center justify-center p-8">
          <div className="w-full max-w-sm">
            {radarData.labels.length > 0 ? (
              <RadarChart labels={radarData.labels} values={radarData.values} />
            ) : (
              <p className="text-ink-500 text-center">No radar data</p>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ScoreCard label="Overall Score" score={report?.overallScore ?? 0} />
          {radarData.labels.map((label, i) => (
            <ScoreCard
              key={label}
              label={label}
              score={radarData.values[i] ?? 0}
            />
          ))}
        </div>
      </section>

      {recommendations.length > 0 && (
        <section className="mb-12">
          <FeedbackPanel suggestions={recommendations} />
        </section>
      )}

      {review?.questions?.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-6">Question Breakdown</h2>
          <div className="space-y-4">
            {review.questions.map((q, idx) => (
              <div
                key={q.id}
                className="card flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-bold text-ink-500">
                      Q{idx + 1}
                    </span>
                    {q.score && <StatusChip status={getStatus(q.score)} />}
                  </div>
                  <p className="text-sm text-ink-700 line-clamp-1">
                    {q.content}
                  </p>
                  {q.transcript && (
                    <p className="text-xs text-ink-500 mt-1 line-clamp-1">
                      "{q.transcript}"
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xl font-extrabold text-ink-900">
                      {q.score ?? 'N/A'}
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-ink-500 font-bold">
                      Score
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      try {
                        const r = await retryQuestion(sessionId, q.id);
                        sessionStorage.setItem('currentSessionId', sessionId);
                        sessionStorage.setItem(
                          'currentQuestions',
                          JSON.stringify([r.question])
                        );
                        navigate('/interview');
                      } catch (e) {
                        console.error('Retry failed:', e);
                      }
                    }}
                    className="btn-secondary text-xs py-1.5 px-3"
                  >
                    🔄 Retry
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-12">
        <div className="mb-4">
          <h2>Personalized Learning Roadmap</h2>
          <p
            className={`text-sm mt-1 ${isDark ? 'text-white/50' : 'text-ink-500'}`}
          >
            Click <strong>main nodes</strong> to focus a branch · click any
            other node for details & status
          </p>
        </div>

        {roadmapLoading && (
          <div
            style={{
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              padding: '64px 32px',
              textAlign: 'center',
              background: C.surface,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: '50%',
                margin: '0 auto 20px',
                border: `3px solid ${C.border}`,
                borderTopColor: C.spineBlue,
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <p
              style={{
                color: C.textPrimary,
                fontWeight: 600,
                fontSize: 14,
                margin: '0 0 6px',
              }}
            >
              Building your roadmap...
            </p>
            <p style={{ color: C.textMuted, fontSize: 12 }}>
              Mapping your personalised learning path
            </p>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {roadmapError && !roadmapLoading && (
          <div className="bg-red-950 border border-red-800 text-red-400 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
            <span>{roadmapError}</span>
            <button
              onClick={() => window.location.reload()}
              className="text-xs font-semibold underline ml-4"
            >
              Retry
            </button>
          </div>
        )}

        {!roadmapLoading && roadmap && (
          <RoadmapSection
            nodes={roadmap.nodes}
            edges={roadmap.edges}
            targetRole={roadmapRole}
            roadmapId={roadmapId}
          />
        )}
      </section>

      <section className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={() => navigate('/setup')}
          className="btn-secondary px-8"
        >
          🔄 Practice Again
        </button>
        <button
          onClick={() => navigate('/history')}
          className="btn-primary px-8"
        >
          💾 View History
        </button>
      </section>
    </div>
  );
}
