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
  const t = counts?.total ?? { in: 0, out: 0, zone: 0, visited: 0, now: 0, seen: 0 };
  const line = counts?.hasLine ?? false;
  const zone = counts?.hasZone ?? false;
  // Most common type seen so far, for the live view.
  const top = Object.entries(counts?.classes ?? {}).sort((a, b) => b[1].seen - a[1].seen)[0];
  type Card = { label: string; value: string; color: string; spark: number[]; note: string; small?: boolean };
  const n = (v: number) => v.toLocaleString();
  const live: Card[] = [
    { label: "In view now", value: n(t.now), color: "var(--cyan)", spark: [], note: "vehicles on screen" },
    { label: "Seen so far", value: n(t.seen), color: "var(--accent-2)", spark: [], note: "unique this session" },
  ];
  const extra: Card[] = [
    top && top[1].seen > 0
      ? { label: "Most common", value: top[0][0].toUpperCase() + top[0].slice(1), color: "var(--accent)", spark: [], note: `${n(top[1].seen)} of ${n(t.seen)} seen`, small: true }
      : { label: "Most common", value: "–", color: "var(--accent)", spark: [], note: "waiting for vehicles" },
    { label: "Count in / out", value: "Draw a line", color: "var(--muted)", spark: [], note: "or a zone, in Counting →", small: true },
  ];
  // Every tile always shows something live: counting tiles once a line / zone
  // is drawn, live "on screen" numbers in the slots that aren't in use yet.
  const cards: Card[] = [
    ...(line
      ? [
          { label: "Inbound", value: n(t.in), color: IN_COLOR, spark: cumulative(timeline, "in"), note: "crossed toward IN" },
          { label: "Outbound", value: n(t.out), color: OUT_COLOR, spark: cumulative(timeline, "out"), note: "crossed toward OUT" },
        ]
      : live),
    ...(zone
      ? [
          { label: "In zone now", value: n(t.zone), color: "var(--cyan)", spark: [], note: "currently inside" },
          { label: "Visited zone", value: n(t.visited), color: "var(--accent-2)", spark: [], note: "unique vehicles" },
        ]
      : line ? live : extra),
  ];
  return (
    <div className={s.kpis} aria-live="polite">
      {cards.map((c) => (
        <div key={c.label} className={s.kpi}>
          <span className={s.kpiLabel}><i style={{ background: c.color }} />{c.label}</span>
          <strong className={`${s.kpiValue} ${c.small ? s.kpiValueText : ""}`}>{c.value}</strong>
          <span className={s.kpiNote}>{c.note}</span>
          <Sparkline values={c.spark} color={c.color} />
        </div>
      ))}
    </div>
  );
}

export function VehicleMix({ counts }: { counts: Counts | null }) {
  // With a line: crossings per type. With only a zone: unique vehicles per
  // type that visited it (e.g. how many trucks used the loading bay).
  // With nothing drawn: unique vehicles seen so far, per type (live).
  const byZone = !!counts && !counts.hasLine && counts.hasZone;
  const bySeen = !counts || (!counts.hasLine && !counts.hasZone);
  const rows = Object.entries(counts?.classes ?? {}).map(([name, r]) => ({
    name,
    total: bySeen ? r.seen : byZone ? r.visited : r.in + r.out,
    zone: r.zone,
  }));
  const max = Math.max(1, ...rows.map((r) => r.total));
  const sum = rows.reduce((a, r) => a + r.total, 0);
  return (
    <div className={s.card}>
      <div className={s.cardHead}>
        <h2>By type</h2>
        <span className={s.cardMeta}>{sum} {bySeen ? "seen (unique)" : byZone ? "in zone (unique)" : "crossings"}</span>
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
