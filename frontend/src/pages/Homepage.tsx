import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Orb from '../components/ui/Orb';

/* ── Typewriter ─────────────────────────────────────────── */
const WORDS = ['Prescriptions', 'Quotations', 'Medications', 'Healthcare'];

function useTypewriter() {
  const [text, setText] = useState('');
  const [wIdx, setWIdx] = useState(0);
  const [cIdx, setCIdx] = useState(0);
  const [del, setDel]   = useState(false);

  useEffect(() => {
    const word = WORDS[wIdx];
    if (!del && cIdx < word.length) {
      const t = setTimeout(() => setCIdx(c => c + 1), 80);
      return () => clearTimeout(t);
    }
    if (!del && cIdx === word.length) {
      const t = setTimeout(() => setDel(true), 2200);
      return () => clearTimeout(t);
    }
    if (del && cIdx > 0) {
      const t = setTimeout(() => setCIdx(c => c - 1), 45);
      return () => clearTimeout(t);
    }
    if (del && cIdx === 0) {
      setDel(false);
      setWIdx(i => (i + 1) % WORDS.length);
    }
  }, [cIdx, del, wIdx]);

  useEffect(() => { setText(WORDS[wIdx].slice(0, cIdx)); }, [cIdx, wIdx]);
  return text;
}

/* ── Animated counter ───────────────────────────────────── */
function useCounter(target: number, dur: number, active: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    let start: number | null = null;
    const step = (ts: number) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / dur, 1);
      setN(Math.floor((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [active, target, dur]);
  return n;
}

/* ── Variants ───────────────────────────────────────────── */
const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.25 } },
};
const fadeUp = {
  hidden: { y: 28, opacity: 0 },
  show:   { y: 0,  opacity: 1, transition: { type: 'spring', damping: 14, stiffness: 100 } },
};
const scaleIn = {
  hidden: { scale: 0.82, opacity: 0 },
  show:   { scale: 1,    opacity: 1, transition: { type: 'spring', damping: 14, stiffness: 130 } },
};
const btn = {
  rest:  { scale: 1 },
  hover: { scale: 1.05, transition: { type: 'spring', stiffness: 420, damping: 12 } },
  tap:   { scale: 0.96 },
};

/* ═══════════════════════════════════════════════════════════ */
export default function HomePage() {
  const navigate    = useNavigate();
  const word        = useTypewriter();
  const statsRef    = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  const c1 = useCounter(98,  1800, inView);
  const c2 = useCounter(500, 2000, inView);
  const c3 = useCounter(8,   1500, inView);

  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.3 });
    if (statsRef.current) obs.observe(statsRef.current);
    return () => obs.disconnect();
  }, []);

  /* ── Feature data ─────────────────────────────────────── */
  const features = [
    { icon: '🧠', title: 'Gemini Vision AI', desc: 'Reads handwriting directly — no OCR errors. Understands BD, TDS, OD, PRN abbreviations in real prescriptions.' },
    { icon: '📍', title: 'Proximity Finder',  desc: 'GPS + GN Division matching. Send to multiple nearby pharmacies at once and compare prices side by side.' },
    { icon: '💬', title: 'Real-time Chat',    desc: 'Per-pharmacy isolated threads via Socket.IO. Instant delivery — no page refresh, full typing indicators.' },
    { icon: '⚡', title: 'Auto Quotation',    desc: 'Pharmacies auto-generate quotes from live inventory. Prices appear in seconds, not hours.' },
    { icon: '📦', title: 'Order Tracking',    desc: '13-state lifecycle: Confirmed → Preparing → Dispatched / Pickup Ready → Completed with live notifications.' },
    { icon: '🔐', title: 'Secure by Design',  desc: 'JWT auth, bcrypt, role-based access. Your prescription only reaches pharmacies you choose.' },
  ];

  const steps = [
    { n: '01', t: 'Upload Photo',         d: 'Snap your handwritten prescription. Any quality, any doctor handwriting.' },
    { n: '02', t: 'AI Reads It',          d: 'Gemini Vision extracts every medicine, dose and frequency in 3–8 seconds.' },
    { n: '03', t: 'Select Pharmacies',    d: 'GPS-matched pharmacies nearby. Choose one or many for comparison.' },
    { n: '04', t: 'Receive Quotes',       d: 'Auto-generated from live inventory. Compare price, ETA and delivery.' },
    { n: '05', t: 'Track Your Order',     d: 'Real-time status from preparation through doorstep delivery.' },
  ];

  return (
    <>
      {/* ── Global styles ─────────────────────────────────── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800;900&display=swap');

        html { scroll-behavior: smooth; }

        .ml-home {
          font-family: 'Sora', 'Inter', system-ui, sans-serif;
          background: #0d1520;
          color: #dbe8f4;
          overflow-x: hidden;
          min-height: 100vh;
        }

        /* NAV */
        .ml-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 200;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 clamp(1.25rem, 5vw, 3.5rem);
          height: 60px;
          background: rgba(13, 21, 32, 0.80);
          backdrop-filter: blur(18px);
          border-bottom: 1px solid rgba(14, 165, 233, 0.12);
        }
        .ml-logo {
          display: flex; align-items: center; gap: 9px;
          font-weight: 700; font-size: 1.1rem; color: #e2edf7;
          text-decoration: none; letter-spacing: -0.01em;
        }
        .ml-logo-mark {
          width: 30px; height: 30px; border-radius: 8px;
          background: linear-gradient(135deg, #0284c7 0%, #0d9488 100%);
          display: grid; place-items: center; font-size: 0.95rem;
          box-shadow: 0 0 16px rgba(2, 132, 199, 0.45);
        }
        .ml-nav-actions { display: flex; gap: 8px; }
        .ml-nav-ghost {
          padding: 6px 16px; border-radius: 8px; font-size: 0.82rem; font-weight: 600;
          border: 1px solid rgba(14, 165, 233, 0.28); background: transparent;
          color: #7dd3fc; cursor: pointer; font-family: inherit;
          transition: all 0.2s;
        }
        .ml-nav-ghost:hover { background: rgba(14,165,233,0.1); border-color: #0ea5e9; color: #e0f2fe; }
        .ml-nav-solid {
          padding: 6px 16px; border-radius: 8px; font-size: 0.82rem; font-weight: 700;
          border: none; cursor: pointer; font-family: inherit;
          background: linear-gradient(135deg, #0284c7, #0369a1);
          color: #fff;
          box-shadow: 0 0 18px rgba(2,132,199,0.4);
          transition: all 0.2s;
        }
        .ml-nav-solid:hover { box-shadow: 0 0 28px rgba(2,132,199,0.6); transform: translateY(-1px); }

        /* HERO wrap */
        .ml-hero {
          position: relative;
          min-height: 100vh;
          display: flex; align-items: center; justify-content: center;
          overflow: hidden;
          padding-top: 60px;
        }

        /* Orb fills exactly this section */
        .ml-orb-bg {
          position: absolute; inset: 0; z-index: 0;
        }

        /* Dark gradient overlays so content is readable */
        .ml-orb-vignette {
          position: absolute; inset: 0; z-index: 1;
          background:
            radial-gradient(ellipse 70% 60% at 50% 50%,
              rgba(13,21,32,0.10) 0%,
              rgba(13,21,32,0.45) 55%,
              rgba(13,21,32,0.88) 100%),
            linear-gradient(to bottom,
              rgba(13,21,32,0.60) 0%,
              rgba(13,21,32,0.00) 20%,
              rgba(13,21,32,0.00) 75%,
              rgba(13,21,32,0.90) 100%);
          pointer-events: none;
        }

        /* Hero content sits above orb */
        .ml-hero-content {
          position: relative; z-index: 10;
          display: flex; flex-direction: column;
          align-items: center; text-align: center;
          padding: 0 clamp(1.25rem, 5vw, 4rem);
          max-width: 720px; width: 100%;
          pointer-events: none; /* let orb respond below */
        }
        /* Only interactive elements get events */
        .ml-hero-content .ml-clickable { pointer-events: auto; }

        /* badge */
        .ml-badge {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 5px 14px; border-radius: 100px;
          border: 1px solid rgba(14,165,233,0.30);
          background: rgba(14,165,233,0.08);
          font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em;
          text-transform: uppercase; color: #7dd3fc;
          margin-bottom: 1.4rem;
          backdrop-filter: blur(8px);
        }
        .ml-badge-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #0ea5e9;
          animation: bdot 2s ease-in-out infinite;
          box-shadow: 0 0 6px #0ea5e9;
        }
        @keyframes bdot { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:0.6} }

        /* title */
        .ml-title {
          font-size: clamp(2.2rem, 6vw, 3.8rem);
          font-weight: 900; line-height: 1.08;
          letter-spacing: -0.03em; color: #f0f8ff;
          margin-bottom: 0.3rem;
          text-shadow: 0 2px 40px rgba(13,21,32,0.8);
        }
        .ml-title-word {
          background: linear-gradient(135deg, #38bdf8 0%, #0d9488 80%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
          min-height: 1.15em; display: inline-block;
        }
        .ml-cursor {
          display: inline-block; width: 3px; height: 0.82em;
          background: #0ea5e9; margin-left: 3px; vertical-align: middle;
          animation: cur 1s steps(1) infinite;
        }
        @keyframes cur { 0%,49%{opacity:1} 50%,100%{opacity:0} }

        /* subtitle */
        .ml-sub {
          font-size: clamp(0.92rem, 1.5vw, 1.08rem);
          color: #7a9ab8; line-height: 1.72;
          margin: 1.3rem 0 2rem;
          max-width: 500px;
          text-shadow: 0 1px 12px rgba(13,21,32,0.9);
        }

        /* cta row */
        .ml-ctas {
          display: flex; gap: 12px; flex-wrap: wrap; justify-content: center;
        }
        .ml-btn-primary {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 13px 30px; border-radius: 11px; border: none;
          background: linear-gradient(135deg, #0284c7 0%, #075985 100%);
          color: #fff; font-family: inherit; font-size: 0.96rem; font-weight: 700;
          cursor: pointer;
          box-shadow: 0 0 36px rgba(2,132,199,0.50), 0 4px 18px rgba(0,0,0,0.35);
          letter-spacing: -0.01em; position: relative; overflow: hidden;
        }
        .ml-btn-primary::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.12), transparent);
          pointer-events: none;
        }
        .ml-btn-ghost {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 13px 24px; border-radius: 11px;
          border: 1px solid rgba(14,165,233,0.25);
          background: rgba(14,165,233,0.07);
          color: #bae6fd; font-family: inherit; font-size: 0.96rem; font-weight: 600;
          cursor: pointer; backdrop-filter: blur(8px);
          transition: all 0.2s;
        }
        .ml-btn-ghost:hover { background: rgba(14,165,233,0.13); border-color: rgba(14,165,233,0.45); color: #e0f2fe; }

        /* pill badges below CTA */
        .ml-pills {
          display: flex; gap: 10px; flex-wrap: wrap;
          justify-content: center; margin-top: 1.8rem;
        }
        .ml-pill {
          display: flex; align-items: center; gap: 6px;
          padding: 5px 13px; border-radius: 100px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.09);
          font-size: 0.75rem; font-weight: 600; color: #7a9ab8;
          backdrop-filter: blur(8px);
        }
        .ml-pill-dot { width: 6px; height: 6px; border-radius: 50%; }
        .ml-pill-dot.sky  { background: #38bdf8; box-shadow: 0 0 5px #38bdf8; }
        .ml-pill-dot.teal { background: #14b8a6; box-shadow: 0 0 5px #14b8a6; }
        .ml-pill-dot.blue { background: #60a5fa; box-shadow: 0 0 5px #60a5fa; }

        /* scroll hint */
        .ml-scroll-hint {
          position: absolute; bottom: 2rem; left: 50%; transform: translateX(-50%);
          z-index: 10; display: flex; flex-direction: column; align-items: center; gap: 6px;
          color: #3a5570; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; animation: sh 2.5s ease-in-out infinite;
        }
        @keyframes sh { 0%,100%{opacity:0.4;transform:translateX(-50%) translateY(0)} 50%{opacity:0.9;transform:translateX(-50%) translateY(-6px)} }
        .ml-scroll-bar {
          width: 1px; height: 40px;
          background: linear-gradient(to bottom, #0ea5e9, transparent);
        }

        /* ── STATS ──────────────────────────────────────────── */
        .ml-stats {
          background: rgba(10,18,28,0.95);
          border-top: 1px solid rgba(14,165,233,0.12);
          border-bottom: 1px solid rgba(14,165,233,0.12);
          padding: 3rem clamp(1.25rem,5vw,4rem);
        }
        .ml-stats-grid {
          display: grid; grid-template-columns: repeat(3,1fr);
          gap: 2rem; max-width: 800px; margin: 0 auto; text-align: center;
        }
        @media(max-width:580px){ .ml-stats-grid { grid-template-columns: 1fr; } }
        .ml-stat-num {
          font-size: clamp(2rem,4vw,2.8rem);
          font-weight: 900; color: #e0f2fe;
          letter-spacing: -0.03em;
        }
        .ml-stat-num em { color: #0ea5e9; font-style: normal; }
        .ml-stat-label { font-size: 0.82rem; color: #3a5570; margin-top: 4px; font-weight: 500; }

        /* ── SECTION shared ─────────────────────────────────── */
        .ml-section {
          padding: 5.5rem clamp(1.25rem,5vw,4rem);
          max-width: 1200px; margin: 0 auto;
        }
        .ml-sect-eyebrow {
          text-align: center; font-size: 0.72rem; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: #0ea5e9; margin-bottom: 0.8rem;
        }
        .ml-sect-title {
          text-align: center;
          font-size: clamp(1.65rem,3vw,2.4rem);
          font-weight: 800; letter-spacing: -0.025em;
          color: #dbe8f4; margin-bottom: 0.7rem; line-height: 1.18;
        }
        .ml-sect-sub {
          text-align: center; font-size: 0.93rem;
          color: #3a5570; max-width: 500px;
          margin: 0 auto 3rem; line-height: 1.7;
        }

        /* ── FEATURES ───────────────────────────────────────── */
        .ml-features-wrap {
          background: #0a1219;
          border-top: 1px solid rgba(14,165,233,0.08);
        }
        .ml-feat-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(270px,1fr));
          gap: 1.2rem;
        }
        .ml-feat-card {
          background: rgba(14,165,233,0.04);
          border: 1px solid rgba(14,165,233,0.10);
          border-radius: 16px; padding: 1.6rem;
          transition: all 0.3s;
        }
        .ml-feat-card:hover {
          border-color: rgba(14,165,233,0.28);
          background: rgba(14,165,233,0.08);
          transform: translateY(-4px);
          box-shadow: 0 16px 48px rgba(2,132,199,0.12);
        }
        .ml-feat-icon { font-size: 1.75rem; margin-bottom: 0.9rem; }
        .ml-feat-title { font-size: 0.98rem; font-weight: 700; color: #c7dff0; margin-bottom: 0.5rem; }
        .ml-feat-desc  { font-size: 0.82rem; color: #3a5570; line-height: 1.65; }

        /* ── STEPS ──────────────────────────────────────────── */
        .ml-steps-wrap {
          background: rgba(8,14,22,0.98);
          border-top: 1px solid rgba(14,165,233,0.07);
        }
        .ml-steps-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(210px,1fr));
          gap: 1.1rem;
        }
        .ml-step {
          display: flex; gap: 1rem; align-items: flex-start;
          background: rgba(14,165,233,0.03);
          border: 1px solid rgba(14,165,233,0.08);
          border-radius: 14px; padding: 1.4rem;
          transition: all 0.3s;
        }
        .ml-step:hover { border-color: rgba(14,165,233,0.22); transform: translateY(-3px); }
        .ml-step-num {
          flex-shrink: 0; width: 34px; height: 34px;
          border-radius: 9px;
          background: linear-gradient(135deg, #0284c7, #0d9488);
          display: grid; place-items: center;
          font-size: 0.78rem; font-weight: 800; color: #fff;
          box-shadow: 0 0 14px rgba(2,132,199,0.38);
        }
        .ml-step-title { font-size: 0.92rem; font-weight: 700; color: #c7dff0; margin-bottom: 0.35rem; }
        .ml-step-desc  { font-size: 0.80rem; color: #3a5570; line-height: 1.6; }

        /* ── BOTTOM CTA ─────────────────────────────────────── */
        .ml-cta-section {
          text-align: center;
          padding: 6rem clamp(1.25rem,5vw,4rem);
          position: relative; overflow: hidden;
          background: #0d1520;
          border-top: 1px solid rgba(14,165,233,0.08);
        }
        .ml-cta-glow {
          position: absolute; top: 50%; left: 50%;
          transform: translate(-50%,-50%);
          width: 700px; height: 350px;
          background: radial-gradient(ellipse, rgba(2,132,199,0.10) 0%, transparent 70%);
          pointer-events: none;
        }
        .ml-cta-title {
          font-size: clamp(1.8rem,3.5vw,2.8rem);
          font-weight: 900; letter-spacing: -0.03em;
          color: #dbe8f4; margin-bottom: 0.9rem;
          position: relative;
        }
        .ml-cta-grad {
          background: linear-gradient(135deg, #38bdf8, #0d9488);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .ml-cta-sub {
          font-size: 0.95rem; color: #3a5570; margin-bottom: 2.2rem; position: relative;
        }
        .ml-cta-row { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; position: relative; }

        /* ── FOOTER ─────────────────────────────────────────── */
        .ml-footer {
          padding: 2rem clamp(1.25rem,5vw,4rem);
          border-top: 1px solid rgba(255,255,255,0.05);
          display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;
          background: #09111a;
        }
        .ml-footer-left { display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.9rem; color: #3a5570; }
        .ml-footer-right { font-size: 0.75rem; color: #1e3044; }
      `}</style>

      <div className="ml-home">

        {/* ─── HERO ────────────────────────────────────────── */}
        <section className="ml-hero">

          {/* Orb — full section background, responds to mouse */}
          <div className="ml-orb-bg">
            <Orb
              hoverIntensity={2}
              rotateOnHover
              hue={25}
              forceHoverState={false}
              backgroundColor="#0d1520"
            />
          </div>

          {/* Vignette so text stays readable */}
          <div className="ml-orb-vignette" />

          {/* Hero content floats above */}
          <motion.div
            className="ml-hero-content"
            variants={stagger}
            initial="hidden"
            animate="show"
          >
            {/* Badge */}
            <motion.div className="ml-badge" variants={fadeUp}>
              <span className="ml-badge-dot" />
              AI-Powered · Sri Lanka's First
            </motion.div>

            {/* Title */}
            <motion.h1 className="ml-title" variants={scaleIn}>
              Smart<br />
              <span className="ml-title-word">
                {word}<span className="ml-cursor" />
              </span>
              <br />Management
            </motion.h1>

            {/* Sub */}
            <motion.p className="ml-sub" variants={fadeUp}>
              Upload any handwritten prescription. Gemini Vision AI reads it
              in seconds, finds nearby pharmacies, and delivers real-time quotes — all in one place.
            </motion.p>

            {/* Buttons — clickable */}
            <motion.div className="ml-ctas ml-clickable" variants={fadeUp}>
              <motion.button
                className="ml-btn-primary ml-clickable"
                variants={btn} initial="rest" whileHover="hover" whileTap="tap"
                onClick={() => navigate('/login')}
              >
                Get Started Free
                <motion.span
                  initial={{ x: 0 }}
                  whileHover={{ x: 5 }}
                  style={{ display: 'inline-block' }}
                >→</motion.span>
              </motion.button>

              <motion.button
                className="ml-btn-ghost ml-clickable"
                variants={btn} initial="rest" whileHover="hover" whileTap="tap"
                onClick={() => navigate('/register')}
              >
                📋 Register Pharmacy
              </motion.button>
            </motion.div>

            {/* Status pills */}
            <motion.div className="ml-pills" variants={fadeUp}>
              <span className="ml-pill"><span className="ml-pill-dot sky" />VLM Extraction ✓</span>
              <span className="ml-pill"><span className="ml-pill-dot teal" />Real-time Chat</span>
              <span className="ml-pill"><span className="ml-pill-dot blue" />Auto Quotation</span>
            </motion.div>
          </motion.div>

          {/* Scroll hint */}
          <div className="ml-scroll-hint">
            <div className="ml-scroll-bar" />
            Scroll
          </div>
        </section>

        {/* ─── STATS BAND ──────────────────────────────────── */}
        <div className="ml-stats" ref={statsRef}>
          <div className="ml-stats-grid">
            {[
              { n: c1,  unit: '%', label: 'AI Extraction Accuracy' },
              { n: c2,  unit: '+', label: 'Medicines in Database'  },
              { n: c3,  unit: 's', label: 'Avg Processing Time'   },
            ].map(({ n, unit, label }) => (
              <div key={label} style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
                <div className="ml-stat-num">{n}<em>{unit}</em></div>
                <div className="ml-stat-label">{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── FEATURES ────────────────────────────────────── */}
        <div className="ml-features-wrap">
          <div className="ml-section">
            <p className="ml-sect-eyebrow">Platform Features</p>
            <h2 className="ml-sect-title">Everything you need.<br />Nothing you don't.</h2>
            <p className="ml-sect-sub">Built specifically for Sri Lanka's independent pharmacies and patients.</p>
            <div className="ml-feat-grid">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  className="ml-feat-card"
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-60px' }}
                  transition={{ delay: i * 0.08, type: 'spring', damping: 14 }}
                >
                  <div className="ml-feat-icon">{f.icon}</div>
                  <div className="ml-feat-title">{f.title}</div>
                  <div className="ml-feat-desc">{f.desc}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── HOW IT WORKS ────────────────────────────────── */}
        <div className="ml-steps-wrap">
          <div className="ml-section">
            <p className="ml-sect-eyebrow">How It Works</p>
            <h2 className="ml-sect-title">Five steps.<br />Prescription to medicines.</h2>
            <p className="ml-sect-sub" style={{ marginBottom: '2.5rem' }}>Designed so anyone can use it — no technical knowledge needed.</p>
            <div className="ml-steps-grid">
              {steps.map((s, i) => (
                <motion.div
                  key={s.n}
                  className="ml-step"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-50px' }}
                  transition={{ delay: i * 0.09, type: 'spring', damping: 14 }}
                >
                  <div className="ml-step-num">{s.n}</div>
                  <div>
                    <div className="ml-step-title">{s.t}</div>
                    <div className="ml-step-desc">{s.d}</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── BOTTOM CTA ──────────────────────────────────── */}
        <section className="ml-cta-section">
          <div className="ml-cta-glow" />
          <motion.h2
            className="ml-cta-title"
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ type: 'spring', damping: 14 }}
          >
            Ready to modernise your<br />
            <span className="ml-cta-grad">prescription experience?</span>
          </motion.h2>
          <p className="ml-cta-sub">Join patients and pharmacies already using MediLink.</p>
          <div className="ml-cta-row">
            <motion.button
              className="ml-btn-primary"
              variants={btn} initial="rest" whileHover="hover" whileTap="tap"
              onClick={() => navigate('/login')}
            >
              Get Started — It's Free <span>→</span>
            </motion.button>
            <motion.button
              className="ml-btn-ghost"
              variants={btn} initial="rest" whileHover="hover" whileTap="tap"
              onClick={() => navigate('/register')}
            >
              Register Your Pharmacy
            </motion.button>
          </div>
        </section>
      </div>
    </>
  );
}