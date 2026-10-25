import { useId } from "react";

// A 3-way "Swap Circle": each student gives one item and receives the one they wanted.
// AP → RK (DSA book), RK → KS (calculator), KS → AP (lab coat).
const NODES = [
  { x: 140, y: 34, initials: "AP" },
  { x: 246, y: 186, initials: "RK" },
  { x: 34, y: 186, initials: "KS" },
];

const EDGES = [
  { d: "M157 59 Q216 94 227 158", label: "DSA book", x: 232, y: 100, anchor: "start" },
  { d: "M216 188 Q140 216 68 188", label: "Calculator", x: 140, y: 236, anchor: "middle" },
  { d: "M51 161 Q64 94 121 62", label: "Lab coat", x: 48, y: 100, anchor: "end" },
];

const THEMES = {
  default: {
    edge: "stroke-brand-400 dark:stroke-brand-400",
    arrow: "fill-brand-400",
    label: "fill-slate-600 dark:fill-slate-300",
    ring: "stroke-white dark:stroke-slate-900",
    initials: "fill-white",
  },
  onBrand: {
    edge: "stroke-white/70",
    arrow: "fill-white/70",
    label: "fill-white/90",
    ring: "stroke-white/40",
    initials: "fill-white",
  },
};

export default function SwapCircleDiagram({ variant = "default", className = "" }) {
  // React ids contain characters that url(#…) can't reference, so keep only safe ones.
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const theme = THEMES[variant];

  return (
    <svg
      viewBox="-60 0 400 250"
      className={className}
      role="img"
      aria-label="Swap Circle: three students trade a DSA book, a calculator and a lab coat in a loop"
    >
      <defs>
        <linearGradient id={`${id}-node`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" />
          <stop offset="0.55" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#d946ef" />
        </linearGradient>
        <marker id={`${id}-arrow`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" className={theme.arrow} />
        </marker>
      </defs>

      {EDGES.map((edge) => (
        <g key={edge.label}>
          <path
            d={edge.d}
            fill="none"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray="6 6"
            markerEnd={`url(#${id}-arrow)`}
            className={`${theme.edge} animate-dash`}
          />
          <text x={edge.x} y={edge.y} textAnchor={edge.anchor} fontSize="13" fontWeight="600" className={theme.label}>
            {edge.label}
          </text>
        </g>
      ))}

      {NODES.map((node) => (
        <g key={node.initials}>
          <circle cx={node.x} cy={node.y} r="26" fill={`url(#${id}-node)`} strokeWidth="4" className={theme.ring} />
          <text
            x={node.x}
            y={node.y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="15"
            fontWeight="700"
            className={theme.initials}
          >
            {node.initials}
          </text>
        </g>
      ))}
    </svg>
  );
}
