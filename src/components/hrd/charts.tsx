import { useRef, useState } from "react";

import { cn } from "@/lib/utils";

type Point = { label: string; value: number };

/**
 * One measure over time as a single line. Hovering (or touching) shows a crosshair and
 * the exact value; the last point is labelled so the chart also reads without hovering.
 */
export function TrendChart({
  name,
  unit,
  points,
  ticks,
  className,
}: {
  /** What is plotted, for the tooltip and screen readers. */
  name: string;
  unit: string;
  points: Point[];
  /** Clean axis values, lowest to highest. The first and last set the scale. */
  ticks: number[];
  className?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const width = 480;
  const height = 200;
  const left = 36;
  const right = 44;
  const top = 16;
  const bottom = 30;
  const min = ticks[0] ?? 0;
  const max = ticks[ticks.length - 1] ?? 100;
  const x = (i: number) => left + (i / Math.max(1, points.length - 1)) * (width - left - right);
  const y = (v: number) => height - bottom - ((v - min) / (max - min)) * (height - top - bottom);

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.value).toFixed(1)}`)
    .join(" ");
  const lastIndex = points.length - 1;
  const last = points[lastIndex];
  const first = points[0];
  const active = hover === null ? null : points[hover];

  const locate = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = ((clientX - rect.left) / rect.width) * width;
    const index = Math.round(((ratio - left) / (width - left - right)) * lastIndex);
    setHover(Math.max(0, Math.min(lastIndex, index)));
  };

  return (
    <div
      ref={box}
      className={cn("relative", className)}
      onPointerMove={(e) => locate(e.clientX)}
      onPointerDown={(e) => locate(e.clientX)}
      onPointerLeave={() => setHover(null)}
    >
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${name}: ${first?.label} ${first?.value}${unit}에서 ${last?.label} ${last?.value}${unit}`}
        className="block w-full touch-none select-none"
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={left}
              x2={width - right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text
              x={left - 8}
              y={y(tick) + 4}
              textAnchor="end"
              fontSize="11"
              fill="var(--muted-foreground)"
            >
              {tick}
            </text>
          </g>
        ))}
        <path
          d={`${path} L${x(lastIndex).toFixed(1)} ${y(min)} L${x(0).toFixed(1)} ${y(min)} Z`}
          fill="var(--primary)"
          opacity="0.08"
        />
        <path
          d={path}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {active && hover !== null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={top}
            y2={height - bottom}
            stroke="var(--gold)"
            strokeWidth="1"
          />
        )}
        {last && (
          <>
            <circle
              cx={x(lastIndex)}
              cy={y(last.value)}
              r="5"
              fill="var(--primary)"
              stroke="var(--card)"
              strokeWidth="2"
            />
            <text
              x={x(lastIndex) + 10}
              y={y(last.value) + 4}
              fontSize="13"
              fontWeight="700"
              fill="var(--foreground)"
            >
              {last.value}
              {unit}
            </text>
          </>
        )}
        {active && hover !== null && hover !== lastIndex && (
          <circle
            cx={x(hover)}
            cy={y(active.value)}
            r="5"
            fill="var(--primary)"
            stroke="var(--card)"
            strokeWidth="2"
          />
        )}

        {[0, Math.floor(lastIndex / 2), lastIndex].map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 8}
            textAnchor={i === 0 ? "start" : i === lastIndex ? "end" : "middle"}
            fontSize="11"
            fill="var(--muted-foreground)"
          >
            {points[i]?.label}
          </text>
        ))}
      </svg>

      {active && hover !== null && (
        <div
          role="status"
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-sm border border-gold-soft bg-card px-2 py-1 text-xs shadow-soft"
          style={{ left: `${(x(hover) / width) * 100}%` }}
        >
          <span className="text-muted-foreground">{active.label}</span>{" "}
          <span className="font-semibold text-foreground">
            {active.value}
            {unit}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * A horizontal bar for a table cell: square at the baseline, rounded at the data end,
 * with the value printed at the tip.
 */
export function BarCell({
  value,
  max,
  label,
  emphasis = false,
}: {
  value: number;
  max: number;
  /** Text at the tip of the bar, e.g. "74점". */
  label: string;
  /** Draws the reader's eye to the row the note under the table talks about. */
  emphasis?: boolean;
}) {
  const share = Math.max(0.02, Math.min(1, value / max));
  return (
    <span className="grid grid-cols-[1fr_auto] items-center gap-2" title={label}>
      <span className="block h-3 rounded-r-[4px] bg-muted">
        <span
          className={cn("block h-full rounded-r-[4px]", emphasis ? "bg-primary" : "bg-primary/55")}
          style={{ width: `${share * 100}%` }}
        />
      </span>
      <span className="w-12 text-right text-sm font-semibold tabular-nums text-foreground">
        {label}
      </span>
    </span>
  );
}
