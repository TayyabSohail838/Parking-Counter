"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { preload } from "react-dom";
import { LogoMark } from "@/components/brand/LogoMark";
import {
  buildSampleHistory, clearHistory, getHistorySnapshot, parseHistory, subscribeHistory,
  type CountEvent, type History,
} from "@/lib/history";
import { IN_COLOR, OUT_COLOR, StackedBars, type InOutBucket } from "./StackedBars";
import s from "./dashboard.module.css";

type Range = "today" | "7d" | "all";
const RANGES: [Range, string][] = [["today", "Today"], ["7d", "Last 7 days"], ["all", "All time"]];
const DAY = 86_400_000;

const pad = (n: number) => String(n).padStart(2, "0");
const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
const fmtTime = (t: number) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const fmtDay = (t: number) => new Date(t).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
const fmtDuration = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${pad(m % 60)} min`;
};

function useHistory(): History {
  const raw = useSyncExternalStore(subscribeHistory, getHistorySnapshot, () => "");
  return useMemo(() => parseHistory(raw), [raw]);
}

/**
 * The current time as an external store that ticks once a minute, so render
 * stays pure and "Today" rolls over at midnight. 0 during the server pre-render.
 */
const MINUTE = 60_000;
function subscribeClock(onTick: () => void) {
  const id = window.setInterval(onTick, MINUTE);
  return () => window.clearInterval(id);
}
const getClock = () => Math.floor(Date.now() / MINUTE) * MINUTE;
function useNow() {
  return useSyncExternalStore(subscribeClock, getClock, () => 0);
}

function exportCsv(events: CountEvent[]) {
  const rows = [["time", "type", "direction", "session"], ...events.map((e) => [new Date(e.t).toISOString(), e.type, e.dir, e.session])];
  const blob = new Blob([rows.map((r) => r.join(",")).join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `parking-counter-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const NO_DATA: History = { sessions: [], events: [] };

export function Dashboard() {
  // start fetching the background still before the stylesheet asks for it
  // (sizes mirror the CSS: the 960px file on phones, the 1920px file above 720px)
  preload("/dashboard/bg.webp", {
    as: "image",
    fetchPriority: "high",
    imageSrcSet: "/dashboard/bg-sm.webp 960w, /dashboard/bg.webp 1920w",
    imageSizes: "(max-width: 720px) 320px, 1921px",
  });
  const stored = useHistory();
  const now = useNow();
  // Nothing counted on this device yet: show a realistic preview week (not saved)
  // so the dashboard always has data; real counts replace it automatically.
  const hasReal = stored.events.length > 0;
  const preview = useMemo(() => (hasReal || !now ? null : buildSampleHistory(now)), [hasReal, now]);
  const history = hasReal ? stored : preview ?? NO_DATA;
  const [chosenRange, setRange] = useState<Range | null>(null);
  // Until the user picks a range: "Today" if anything was counted today, else the last 7 days.
  // events are stored in time order, so the last one tells us about today
  const countedToday = (history.events.at(-1)?.t ?? 0) >= startOfDay(now);
  const range: Range = chosenRange ?? (countedToday ? "today" : "7d");

  const isSample = !hasReal || stored.sessions.some((x) => x.sample);
  const from = range === "today" ? startOfDay(now) : range === "7d" ? startOfDay(now) - 6 * DAY : 0;
  const events = useMemo(() => history.events.filter((e) => e.t >= from), [history.events, from]);

  const stats = useMemo(() => {
    const inbound = events.filter((e) => e.dir === "in").length;
    const byHour = Array.from({ length: 24 }, (_, h) => ({ h, in: 0, out: 0 }));
    for (const e of events) byHour[new Date(e.t).getHours()][e.dir] += 1;
    const peak = byHour.reduce((a, b) => (b.in + b.out > a.in + a.out ? b : a), byHour[0]);
    const byType = new Map<string, number>();
    for (const e of events) byType.set(e.type, (byType.get(e.type) ?? 0) + 1);
    return {
      total: events.length,
      inbound,
      outbound: events.length - inbound,
      net: inbound - (events.length - inbound),
      byHour,
      peak: peak.in + peak.out > 0 ? peak : null,
      byType: [...byType.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [events]);

  const hourly: InOutBucket[] = useMemo(() => stats.byHour.map((b) => ({
    label: pad(b.h),
    title: `${pad(b.h)}:00–${pad((b.h + 1) % 24)}:00`,
    in: b.in,
    out: b.out,
  })), [stats.byHour]);

  const daily: InOutBucket[] = useMemo(() => {
    if (range === "today") return [];
    const first = range === "7d" ? from : startOfDay(events[0]?.t ?? now);
    const days = Math.min(60, Math.round((startOfDay(now) - first) / DAY) + 1);
    const buckets = Array.from({ length: days }, (_, i) => {
      const t = first + i * DAY;
      return { label: new Date(t).toLocaleDateString([], { weekday: "short" }), title: fmtDay(t), in: 0, out: 0, t };
    });
    for (const e of events) {
      const i = Math.round((startOfDay(e.t) - first) / DAY);
      if (buckets[i]) buckets[i][e.dir] += 1;
    }
    return buckets;
  }, [range, from, events, now]);

  const sessions = useMemo(() => {
    // one pass over the events instead of one pass per session
    const counts = new Map<string, number>();
    for (const e of history.events) counts.set(e.session, (counts.get(e.session) ?? 0) + 1);
    return history.sessions
      .filter((x) => x.end >= from)
      .slice(-8)
      .reverse()
      .map((x) => ({ ...x, count: counts.get(x.id) ?? 0 }));
  }, [history, from]);
  const recent = events.slice(-10).reverse();
  const rangeLabel = RANGES.find((r) => r[0] === range)![1].toLowerCase();

  return (
    <div className={s.page}>
      <div className={s.bg} aria-hidden />
      <header className={s.topbar}>
        <div className={s.topInner}>
          <Link href="/" className={s.brand} aria-label="Parking Counter home">
            <LogoMark size={32} />
            <span>Parking Counter</span>
          </Link>
          <nav className={s.navLinks} aria-label="Main">
            <Link href="/">Home</Link>
            <Link href="/dashboard" aria-current="page">Dashboard</Link>
          </nav>
          <Link href="/app" className="btn btn-primary btn-sm">Open live counter</Link>
        </div>
      </header>

      <main className={s.main}>
        <div className={s.head}>
          <div>
            <span className={s.kicker}>Dashboard</span>
            <h1>Counts on this device</h1>
            <p className={s.lead}>
              Everything the live counter has counted in this browser. Nothing is uploaded.
              {hasReal && isSample && <b className={s.sampleTag}>Showing sample data</b>}
            </p>
          </div>
          <div className={s.controls}>
              <div className={s.segmented} role="group" aria-label="Time range">
                {RANGES.map(([value, label]) => (
                  <button key={value} aria-pressed={range === value} onClick={() => setRange(value)}>{label}</button>
                ))}
              </div>
              <button className="btn btn-sm" onClick={() => exportCsv(events)} disabled={!events.length}>Export CSV</button>
              {hasReal && (
                <button
                  className={`btn btn-sm ${s.danger}`}
                  onClick={() => window.confirm("Delete all counting history saved on this device?") && clearHistory()}
                >
                  Clear data
                </button>
              )}
          </div>
        </div>

        {!hasReal && (
          <div className={s.notice} role="note">
            <span className={s.noticeDot} aria-hidden />
            <p>
              <b>Preview data.</b> Nothing has been counted on this device yet, so this is a sample week.
              Start the live counter and your own crossings replace it automatically.
            </p>
            <Link href="/app" className="btn btn-primary btn-sm">Start counting</Link>
          </div>
        )}

          <>
            {/* KPI tiles */}
            <section className={s.kpis} aria-label="Totals">
              <div className={s.kpi}>
                <span className={s.kpiLabel}>Total crossings</span>
                <strong className={s.kpiValue}>{stats.total.toLocaleString()}</strong>
                <span className={s.kpiNote}>{rangeLabel}</span>
              </div>
              <div className={s.kpi}>
                <span className={s.kpiLabel}><i style={{ background: IN_COLOR }} />Inbound</span>
                <strong className={s.kpiValue}>{stats.inbound.toLocaleString()}</strong>
                <span className={s.kpiNote}>crossed toward IN</span>
              </div>
              <div className={s.kpi}>
                <span className={s.kpiLabel}><i style={{ background: OUT_COLOR }} />Outbound</span>
                <strong className={s.kpiValue}>{stats.outbound.toLocaleString()}</strong>
                <span className={s.kpiNote}>
                  net {stats.net >= 0 ? "+" : "−"}{Math.abs(stats.net).toLocaleString()} {stats.net >= 0 ? "arrived" : "left"}
                </span>
              </div>
              <div className={s.kpi}>
                <span className={s.kpiLabel}>Busiest hour</span>
                <strong className={s.kpiValue}>{stats.peak ? `${pad(stats.peak.h)}:00` : "–"}</strong>
                <span className={s.kpiNote}>
                  {stats.peak ? `${(stats.peak.in + stats.peak.out).toLocaleString()} crossings` : "no crossings yet"}
                </span>
              </div>
            </section>

            <div className={s.grid}>
              <section className={`${s.card} ${s.span2}`}>
                <div className={s.cardHead}>
                  <h2>Crossings by hour</h2>
                  <span className={s.cardMeta}>{range === "today" ? "today" : `summed over ${rangeLabel}`}</span>
                </div>
                <StackedBars data={hourly} labelEvery={3} caption="Crossings by hour of day, in and out" />
              </section>

              <section className={s.card}>
                <div className={s.cardHead}>
                  <h2>By type</h2>
                  <span className={s.cardMeta}>{stats.total.toLocaleString()} crossings</span>
                </div>
                {stats.byType.length === 0 ? <p className={s.muted}>No crossings in this range.</p> : (
                  <ul className={s.types}>
                    {stats.byType.map(([type, n]) => (
                      <li key={type}>
                        <span className={s.typeName}>{type}</span>
                        <div className={s.typeTrack}><div style={{ width: `${(n / stats.byType[0][1]) * 100}%` }} /></div>
                        <b>{n.toLocaleString()}</b>
                        <span className={s.typePct}>{Math.round((n / stats.total) * 100)}%</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {range !== "today" && (
                <section className={`${s.card} ${s.span3}`}>
                  <div className={s.cardHead}>
                    <h2>Daily totals</h2>
                    <span className={s.cardMeta}>{rangeLabel}</span>
                  </div>
                  <StackedBars data={daily} labelEvery={daily.length > 14 ? 7 : 1} caption="Crossings per day, in and out" />
                </section>
              )}

              <section className={`${s.card} ${s.span2}`}>
                <div className={s.cardHead}>
                  <h2>Recent crossings</h2>
                  <span className={s.cardMeta}>latest 10</span>
                </div>
                {recent.length === 0 ? <p className={s.muted}>No crossings in this range.</p> : (
                  <table className={s.table}>
                    <thead><tr><th scope="col">Time</th><th scope="col">Type</th><th scope="col">Direction</th><th scope="col">Day</th></tr></thead>
                    <tbody>
                      {recent.map((e, i) => (
                        <tr key={`${e.t}-${i}`}>
                          <td className={s.mono}>{fmtTime(e.t)}</td>
                          <td className={s.cap}>{e.type}</td>
                          <td>
                            <span className={s.dir}>
                              <i style={{ background: e.dir === "in" ? IN_COLOR : OUT_COLOR }} />
                              {e.dir === "in" ? "In" : "Out"}
                            </span>
                          </td>
                          <td className={s.muted}>{fmtDay(e.t)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </section>

              <section className={s.card}>
                <div className={s.cardHead}>
                  <h2>Sessions</h2>
                  <span className={s.cardMeta}>camera or video runs</span>
                </div>
                {sessions.length === 0 ? <p className={s.muted}>No sessions in this range.</p> : (
                  <ul className={s.sessions}>
                    {sessions.map((x) => (
                      <li key={x.id}>
                        <div>
                          <b>{fmtDay(x.start)}</b>
                          <span className={s.muted}>
                            {fmtTime(x.start)}–{fmtTime(x.end)} · {fmtDuration(x.end - x.start)} · {x.source === "file" ? "video file" : "camera"}
                          </span>
                        </div>
                        <strong>{x.count.toLocaleString()}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
      </main>
    </div>
  );
}
