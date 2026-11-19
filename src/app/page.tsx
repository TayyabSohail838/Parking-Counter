import { existsSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import { LogoMark } from "@/components/brand/LogoMark";
import { ScrollStory } from "@/components/landing/ScrollStory";
import { ShowroomBackdrop } from "@/components/landing/ShowroomBackdrop";
import { TabletDashboard } from "@/components/landing/TabletDashboard";
import s from "@/components/landing/landing.module.css";

function Logo() {
  return (
    <Link href="/" className={s.logo} aria-label="Parking Counter home">
      <LogoMark size={32} />
      <span>Parking Counter</span>
    </Link>
  );
}

const ICONS = {
  line: <path d="M3 17L21 7M7 4v5M17 15v5" />,
  zone: <path d="M4 7l7-3 9 4-2 11-12 1z" />,
  types: <path d="M3 14l2-5h14l2 5v4H3zM7 18v2M17 18v2M3 14h18" />,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4" />,
};

function Icon({ name }: { name: keyof typeof ICONS }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {ICONS[name]}
    </svg>
  );
}

const FEATURES = [
  {
    icon: "line" as const,
    title: "Line crossing, IN and OUT",
    text: "Draw a line across a road, gate or doorway. Every vehicle is counted once as it crosses, with its direction and type.",
  },
  {
    icon: "zone" as const,
    title: "Zone occupancy",
    text: "Outline a parking area, queue or junction to see how many vehicles are inside right now, and how many have visited.",
  },
  {
    icon: "types" as const,
    title: "Knows what it sees",
    text: "Cars, trucks, buses, motorcycles, bicycles and people are told apart and tallied separately, live.",
  },
  {
    icon: "shield" as const,
    title: "Private by design",
    text: "Detection runs on your own device. Video never leaves the browser, so there is nothing to upload and nothing stored.",
  },
];

const STEPS = [
  { n: "01", title: "Point a camera", text: "Use your webcam or phone camera, or open a recorded traffic video." },
  { n: "02", title: "Draw a line or zone", text: "Two clicks for a counting line, a few more for a zone. No setup files, no training." },
  { n: "03", title: "Watch the numbers move", text: "Boxes, trails and counts update live, broken down by vehicle type and direction." },
];

const PIPELINE = [
  { name: "Camera", detail: "getUserMedia" },
  { name: "OpenCV.js", detail: "resize · letterbox · blob" },
  { name: "YOLO11", detail: "ONNX Runtime · WebGPU" },
  { name: "Tracker", detail: "IDs across frames" },
  { name: "Counts", detail: "line · zone · type" },
];

const USE_CASES = [
  { title: "Traffic studies", text: "Replace clipboards and tally counters with a laptop on a tripod." },
  { title: "Parking lots", text: "Know how many spaces are taken and how busy each entrance is." },
  { title: "Drive-throughs", text: "Measure queue length and arrivals per hour, automatically." },
  { title: "Events & venues", text: "Count arrivals at gates and see peak times as they happen." },
];

const STACK = ["OpenCV.js", "YOLO11", "ONNX Runtime Web", "WebGPU", "Next.js", "Vercel"];

// The scroll-driven video hero is used when a frame sequence has been generated
// with tools/make_scroll_sequence.py. Checked on render (in production that is at
// build time), so adding or removing public/scroll takes effect without a restart.
function hasScrollStory() {
  return existsSync(path.join(process.cwd(), "public", "scroll", "manifest.json"));
}

export default function Home() {
  const HAS_SCROLL_STORY = hasScrollStory();
  return (
    <div className={s.page}>
      <header className={s.nav}>
        <div className={s.container}>
          <Logo />
          <nav className={s.navLinks} aria-label="Main">
            <a href="#features">Features</a>
            <a href="#how">How it works</a>
            <a href="#use-cases">Use cases</a>
            <a href="#tech">Technology</a>
          </nav>
          <Link href="/dashboard" className="btn btn-primary btn-sm">Dashboard</Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        {/* With a scroll video, the video is the whole hero. Without one,
            fall back to the tablet-dashboard hero. */}
        {HAS_SCROLL_STORY ? <ScrollStory /> : (
        <section className={s.scene}>
          <ShowroomBackdrop />
          <div className={`${s.container} ${s.sceneCopy}`}>
            <span className={s.eyebrow}><i />Computer vision that runs in your browser</span>
            <h1>
              Every vehicle, counted.
              <br />
              <span className={s.gradientText}>Live on any screen.</span>
            </h1>
            <p className={s.lead}>
              Parking Counter turns any camera into a traffic analytics dashboard. YOLO11 and OpenCV detect,
              track and count cars, trucks, buses and bikes, privately on your own device.
            </p>
            <div className={s.ctaRow}>
              <Link href="/app" className="btn btn-primary btn-lg">Launch live counter</Link>
              <a href="#how" className={`btn btn-lg ${s.glassBtn}`}>See how it works</a>
            </div>
          </div>

          <div className={s.tabletStage}>
            <div className={s.tabletDevice}>
              <span className={s.tabletCam} aria-hidden />
              <div className={s.tabletGlass} role="img" aria-label="Parking Counter traffic dashboard on a tablet">
                <TabletDashboard />
              </div>
            </div>
          </div>
        </section>
        )}

        {/* Stats strip */}
        <section className={s.statsStrip} aria-label="Highlights">
          <div className={`${s.container} ${s.stats}`}>
            <div><strong>6</strong><span>road-user types counted</span></div>
            <div><strong>2</strong><span>ways to count: line and zone</span></div>
            <div><strong>0</strong><span>video frames uploaded</span></div>
            <div><strong>1 click</strong><span>to start, in any modern browser</span></div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className={s.section}>
          <div className={s.container}>
            <div className={s.sectionHead}>
              <span className={s.kicker}>Features</span>
              <h2>Everything a traffic count needs. Nothing it doesn&apos;t.</h2>
              <p>Built on the same detector used in research labs, wrapped in a tool anyone can use in a minute.</p>
            </div>
            <div className={s.features}>
              {FEATURES.map((f) => (
                <article key={f.title} className={s.feature}>
                  <div className={s.featureIcon}><Icon name={f.icon} /></div>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className={`${s.section} ${s.sectionAlt}`}>
          <div className={s.container}>
            <div className={s.sectionHead}>
              <span className={s.kicker}>How it works</span>
              <h2>From camera to counts in three steps</h2>
            </div>
            <ol className={s.steps}>
              {STEPS.map((st) => (
                <li key={st.n} className={s.step}>
                  <span className={s.stepNum}>{st.n}</span>
                  <h3>{st.title}</h3>
                  <p>{st.text}</p>
                </li>
              ))}
            </ol>

            <div id="tech" className={s.pipeline}>
              <div className={s.pipelineHead}>
                <h3>What happens to every frame</h3>
                <p>Everything below runs locally, in the browser tab, many times per second.</p>
              </div>
              <div className={s.pipelineFlow}>
                {PIPELINE.map((p, i) => (
                  <div key={p.name} className={s.pipelineItem}>
                    <div className={s.pipelineNode}>
                      <strong>{p.name}</strong>
                      <span>{p.detail}</span>
                    </div>
                    {i < PIPELINE.length - 1 && <div className={s.pipelineArrow} aria-hidden />}
                  </div>
                ))}
              </div>
              <ul className={s.stack} aria-label="Technology">
                {STACK.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* Use cases */}
        <section id="use-cases" className={s.section}>
          <div className={s.container}>
            <div className={s.sectionHead}>
              <span className={s.kicker}>Use cases</span>
              <h2>Wherever vehicles come and go, it keeps count</h2>
            </div>
            <div className={s.useCases}>
              {USE_CASES.map((u, i) => (
                <article key={u.title} className={s.useCase}>
                  <span className={s.useCaseIndex}>{String(i + 1).padStart(2, "0")}</span>
                  <h3>{u.title}</h3>
                  <p>{u.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className={s.ctaBand}>
          <div className={s.container}>
            <div className={s.ctaCard}>
              <div>
                <h2>Start counting in under a minute</h2>
                <p>Open the app, allow your camera, draw a line. That&apos;s it.</p>
              </div>
              <Link href="/app" className="btn btn-primary btn-lg">Launch live counter</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <div className={`${s.container} ${s.footerInner}`}>
          <Logo />
          <p>Object detection with YOLO11 and OpenCV.js. Video is processed on your device and never uploaded.</p>
          <span>© {2026} Parking Counter</span>
        </div>
      </footer>
    </div>
  );
}
