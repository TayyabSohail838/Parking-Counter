"use client";

import { CLASS_COLORS, type Counts } from "@/lib/vision/types";
import type { Bucket, CountEvent } from "./useCounterEngine";
import { IN_COLOR, OUT_COLOR } from "@/components/dashboard/StackedBars";
import s from "./counter.module.css";

function Sparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className={s.sparkEmpty} />;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - (v / max) * 26}`).join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className={s.spark} aria-hidden>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function cumulative(timeline: Bucket[], key: "in" | "out") {
  let sum = 0;
  return timeline.map((b) => (sum += b[key]));
}

export function KpiRow({ counts, timeline }: { counts: Counts | null; timeline: Bucket[] }) {
  const t = counts?.total ?? { in: 0, out: 0, zone: 0, visited: 0 };
  const line = counts?.hasLine ?? false;
  const zone = counts?.hasZone ?? false;
  const cards = [
    { label: "Inbound", value: t.in, on: line, color: IN_COLOR, spark: cumulative(timeline, "in"), note: "crossed toward IN" },
    { label: "Outbound", value: t.out, on: line, color: OUT_COLOR, spark: cumulative(timeline, "out"), note: "crossed toward OUT" },
    { label: "In zone now", value: t.zone, on: zone, color: "var(--cyan)", spark: [], note: "currently inside" },
    { label: "Visited zone", value: t.visited, on: zone, color: "var(--accent-2)", spark: [], note: "unique objects" },
  ];
  return (
    <div className={s.kpis}>
      {cards.map((c) => (
        <div key={c.label} className={s.kpi}>
          <span className={s.kpiLabel}><i style={{ background: c.color }} />{c.label}</span>
          <strong className={s.kpiValue}>
            {c.on ? c.value.toLocaleString() : "–"}
          </strong>
          <span className={s.kpiNote}>{c.on ? c.note : c.label.includes("zone") ? "draw a zone" : "draw a line"}</span>
          <Sparkline values={c.spark} color={c.color} />
        </div>
      ))}
    </div>
  );
}

export function VehicleMix({ counts }: { counts: Counts | null }) {
  const rows = Object.entries(counts?.classes ?? {}).map(([name, r]) => ({
    name,
    total: r.in + r.out,
    zone: r.zone,
  }));
  const max = Math.max(1, ...rows.map((r) => r.total));
  const sum = rows.reduce((a, r) => a + r.total, 0);
  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <h2>By type</h2>
        <span className={s.cardMeta}>{sum} crossings</span>
      </div>
      <div className={s.mix}>
        {rows.map((r) => (
          <div key={r.name} className={s.mixRow}>
            <span className={s.mixName}>
              <i style={{ background: CLASS_COLORS[r.name] }} />
              {r.name}
            </span>
            <div className={s.mixTrack}>
              <div style={{ width: `${(r.total / max) * 100}%` }} />
            </div>
            <b>{r.total}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Timeline({ timeline }: { timeline: Bucket[] }) {
  const max = Math.max(1, ...timeline.map((b) => b.in + b.out));
  return (
    <div className={`${s.card} ${s.timelineCard}`}>
      <div className={s.cardHead}>
        <h2>Crossings over time</h2>
        <span className={s.cardMeta}>10-second intervals · last 5 min</span>
      </div>
      {timeline.length === 0 ? (
        <p className={s.empty}>Crossings will appear here as objects cross the line.</p>
      ) : (
        <div className={s.timeline} role="img" aria-label="Bar chart of crossings per 10 seconds">
          {timeline.map((b) => (
            <div key={b.start} className={s.tlCol} title={`${new Date(b.start).toLocaleTimeString()} · in ${b.in} · out ${b.out}`}>
              <div className={s.tlOut} style={{ height: `${(b.out / max) * 100}%` }} />
              <div className={s.tlIn} style={{ height: `${(b.in / max) * 100}%` }} />
            </div>
          ))}
        </div>
      )}
      <div className={s.legend}>
        <span><i style={{ background: IN_COLOR }} />In</span>
        <span><i style={{ background: OUT_COLOR }} />Out</span>
      </div>
    </div>
  );
}

export function EventLog({ events }: { events: CountEvent[] }) {
  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <h2>Recent crossings</h2>
      </div>
      {events.length === 0 ? (
        <p className={s.empty}>No crossings yet.</p>
      ) : (
        <ul className={s.events}>
          {events.map((e) => (
            <li key={e.key}>
              <time>{e.time}</time>
              <span><i style={{ background: CLASS_COLORS[e.name] }} />{e.name} #{e.id}</span>
              <b className={e.dir === "in" ? s.inTag : s.outTag}>{e.dir.toUpperCase()}</b>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
