import s from "./tablet.module.css";

/* A dense analytics dashboard shown on the hero tablet. Illustrative data. */

type IconName = "grid" | "camera" | "lanes" | "car" | "zone" | "chart" | "download" | "gear";
const ICON_PATHS: Record<IconName, string> = {
  grid: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z",
  camera: "M15 10l5-3v10l-5-3zM3 7h12v10H3z",
  lanes: "M6 3v18M12 3v4M12 10v4M12 17v4M18 3v18",
  car: "M3 14l2-5h14l2 5v4H3zM7 18v2M17 18v2M3 14h18",
  zone: "M4 7l7-3 9 4-2 11-12 1z",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  download: "M12 3v12M7 10l5 5 5-5M4 21h16",
  gear: "M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-2-4-2 1-2-1-1-2h-4l-1 2-2 1-2-1-2 4 2 1v2l-2 1 2 4 2-1 2 1 1 2h4l1-2 2-1 2 1 2-4-2-1z",
};
function Icon({ name }: { name: IconName }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

const NAV: [IconName, string][] = [
  ["grid", "Overview"], ["camera", "Cameras"], ["lanes", "Lanes"], ["car", "Vehicles"],
  ["zone", "Zones"], ["chart", "Reports"], ["download", "Exports"], ["gear", "Settings"],
];

const KPIS = [
  { label: "Total vehicles", value: "24.5K", delta: "+12.4%", note: "vs last month" },
  { label: "Inbound", value: "12,814", delta: "+8.7%", note: "vs last month" },
  { label: "Peak hour", value: "08:00", delta: "1,184", note: "vehicles / hour" },
  { label: "Avg. per hour", value: "1.02K", delta: "+3.2%", note: "vs last month" },
];

// 30 days of traffic for the trend chart
const TREND = [52, 58, 55, 61, 57, 64, 70, 62, 66, 60, 68, 73, 69, 75, 71, 66, 72, 78, 74, 80, 76, 71, 77, 83, 79, 85, 81, 88, 84, 92];

const TYPES = [
  { name: "Car", pct: 45, color: "#3b82f6" },
  { name: "Truck", pct: 20, color: "#60a5fa" },
  { name: "Bus", pct: 15, color: "#818cf8" },
  { name: "Motorcycle", pct: 13, color: "#a78bfa" },
  { name: "Bicycle", pct: 7, color: "#c4b5fd" },
];

const CAMERAS = [
  { name: "Main St · North", count: "6,241", pct: 100, hue: 210 },
  { name: "Harbor Rd", count: "4,872", pct: 78, hue: 190 },
  { name: "5th Avenue", count: "4,105", pct: 66, hue: 230 },
  { name: "Airport Exit", count: "3,630", pct: 58, hue: 250 },
  { name: "Ring Road", count: "2,914", pct: 47, hue: 200 },
];

const HOURLY = [22, 35, 61, 92, 74, 58, 63, 70, 66, 59, 71, 86, 79, 54];

const BOTTOM = [
  { label: "Active cameras", value: "24", note: "+2 this week" },
  { label: "Zone alerts", value: "89", note: "−6.1% vs last month" },
  { label: "Detection accuracy", value: "96.4%", note: "+0.8 pts" },
];

const R = 30;
const C = 2 * Math.PI * R;
const DONUT = TYPES.map((t, i) => ({
  ...t,
  len: (t.pct / 100) * C,
  start: (TYPES.slice(0, i).reduce((a, x) => a + x.pct, 0) / 100) * C,
}));

function trendPath(close: boolean) {
  const max = Math.max(...TREND);
  const min = Math.min(...TREND) - 10;
  const pts = TREND.map((v, i) => [(i / (TREND.length - 1)) * 300, 92 - ((v - min) / (max - min)) * 80]);
  const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  return close ? `${line} L300,100 L0,100 Z` : line;
}

export function TabletDashboard() {
  return (
    <div className={s.dash}>
      <aside className={s.side}>
        <div className={s.sideLogo} aria-hidden>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <path d="M5 16h14" />
            <rect x="7" y="7" width="7" height="5" rx="1" />
            <circle cx="17.5" cy="9.5" r="1.6" fill="#fff" />
          </svg>
        </div>
        {NAV.map(([icon, label], i) => (
          <div key={label} className={i === 0 ? s.navActive : s.navItem}>
            <Icon name={icon} />
            <span>{label}</span>
          </div>
        ))}
      </aside>

      <div className={s.body}>
        <div className={s.top}>
          <div>
            <div className={s.title}>Traffic Overview</div>
            <div className={s.date}>Nov 20, 2026</div>
          </div>
          <div className={s.topRight}>
            <span className={s.chip}>Filters</span>
            <span className={s.chip}>This month ▾</span>
            <div className={s.user}>
              <div>
                <b>Alex Morgan</b>
                <span>Operations</span>
              </div>
              <i className={s.avatar} />
            </div>
          </div>
        </div>

        <div className={s.kpis}>
          {KPIS.map((k) => (
            <div key={k.label} className={s.card}>
              <span className={s.label}>{k.label}</span>
              <strong className={s.big}>{k.value}</strong>
              <span className={s.delta}><b>{k.delta}</b> {k.note}</span>
            </div>
          ))}
        </div>

        <div className={s.row2}>
          <div className={s.card}>
            <div className={s.cardHead}>
              <span className={s.cardTitle}>Traffic trend</span>
              <span className={s.chip}>Daily ▾</span>
            </div>
            <svg viewBox="0 0 300 100" preserveAspectRatio="none" className={s.trend} aria-hidden>
              <defs>
                <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#3b82f6" stopOpacity="0.45" />
                  <stop offset="1" stopColor="#3b82f6" stopOpacity="0" />
                </linearGradient>
              </defs>
              {[20, 45, 70].map((y) => <line key={y} x1="0" x2="300" y1={y} y2={y} className={s.grid} />)}
              <path d={trendPath(true)} fill="url(#trendFill)" />
              <path d={trendPath(false)} fill="none" stroke="#60a5fa" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className={s.axis}>
              {["Nov 1", "Nov 8", "Nov 15", "Nov 22", "Nov 30"].map((d) => <span key={d}>{d}</span>)}
            </div>
          </div>
          <div className={s.card}>
            <div className={s.cardHead}><span className={s.cardTitle}>Vehicles by type</span></div>
            <div className={s.donutWrap}>
              <svg viewBox="0 0 80 80" className={s.donut} aria-hidden>
                {DONUT.map((d) => (
                  <circle key={d.name} cx="40" cy="40" r={R} fill="none" stroke={d.color} strokeWidth="11"
                    strokeDasharray={`${d.len - 1} ${C - d.len + 1}`} strokeDashoffset={-d.start}
                    transform="rotate(-90 40 40)" />
                ))}
              </svg>
              <ul className={s.legend}>
                {TYPES.map((t) => (
                  <li key={t.name}><i style={{ background: t.color }} />{t.name}<b>{t.pct}%</b></li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className={s.row3}>
          <div className={s.card}>
            <div className={s.cardHead}>
              <span className={s.cardTitle}>Top cameras</span>
              <span className={s.link}>View all</span>
            </div>
            <ul className={s.cams}>
              {CAMERAS.map((c) => (
                <li key={c.name}>
                  <i className={s.thumb} style={{ background: `linear-gradient(135deg, hsl(${c.hue} 45% 32%), hsl(${c.hue} 50% 14%))` }} />
                  <span className={s.camName}>{c.name}</span>
                  <b>{c.count}</b>
                  <div className={s.camBar}><div style={{ width: `${c.pct}%` }} /></div>
                </li>
              ))}
            </ul>
          </div>
          <div className={s.card}>
            <div className={s.cardHead}>
              <span className={s.cardTitle}>Hourly volume</span>
              <span className={s.chip}>Today ▾</span>
            </div>
            <div className={s.hourly}>
              {HOURLY.map((v, i) => (
                <div key={i} className={s.hourCol}><div style={{ height: `${v}%` }} /></div>
              ))}
            </div>
            <div className={s.axis}>
              {["06", "09", "12", "15", "19"].map((h) => <span key={h}>{h}:00</span>)}
            </div>
          </div>
          <div className={s.card}>
            <div className={s.cardHead}><span className={s.cardTitle}>Zone summary</span></div>
            <div className={s.zoneTotal}>
              <span className={s.label}>Vehicles in zones</span>
              <strong className={s.big}>482</strong>
            </div>
            <div className={s.zoneSplit}>
              <div><span className={s.label}>Parking A</span><strong>370</strong></div>
              <div><span className={s.label}>Loading bay</span><strong>112</strong></div>
            </div>
            <div className={s.occupancy}>
              <div className={s.occupancyHead}><span>Occupancy</span><b>74%</b></div>
              <div className={s.occupancyTrack}>
                <span style={{ width: "57%" }} />
                <span style={{ width: "17%" }} />
              </div>
            </div>
            <span className={s.link}>Open zones</span>
          </div>
        </div>

        <div className={s.bottom}>
          {BOTTOM.map((b) => (
            <div key={b.label} className={s.card}>
              <span className={s.label}>{b.label}</span>
              <strong className={s.mid}>{b.value}</strong>
              <span className={s.delta}><b>{b.note}</b></span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
