"use client"

/**
 * VisualPortfolio — a fully visual, animated-SVG portfolio experience.
 *
 * Every section is illustrated with hand-built SVG + advanced CSS animation
 * (stroke-draw, ember particles, molten gradients, orbits, live mini-UIs).
 * No images, almost no body copy — the story is told entirely in motion.
 *
 * Pure SVG + CSS + IntersectionObserver. No extra dependencies.
 * Themed to the site's "fire / ember" palette, but with a hardcoded dark
 * palette so it renders identically regardless of the active theme.
 *
 * Robustness notes:
 *  - Path/line/shape draw-in uses `pathLength={1}` + dash animation (uniform).
 *  - <text> can't use pathLength, so the name reveals with a clip-path wipe.
 *  - Every rotate/scale pivots via SMIL animateTransform (explicit cx,cy) or
 *    `transform-box: fill-box` so it never depends on transform-box defaults.
 */

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react"
import Link from "next/link"

/* ------------------------------------------------------------------ */
/*  palette + helpers                                                  */
/* ------------------------------------------------------------------ */

const C = {
  bg: "#0a0705",
  bg2: "#120a06",
  cream: "#fff4e6",
  gold: "#ffd98a",
  gold2: "#ffcf5c",
  orange: "#ff9d3c",
  orange2: "#ff7a18",
  red: "#ff4d2e",
  ember: "#e8431f",
  steel: "#2a211b",
  steelLine: "#4a3a2e",
}

/** deterministic pseudo-random so SSR and client agree (no hydration drift) */
const rng = (i: number) => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return x - Math.floor(x)
}

/**
 * Round to a fixed precision. CRITICAL for hydration: Math.sin/cos are not
 * bit-identical between the Node server and the browser, so any coordinate
 * derived from them must be rounded to the same string on both sides.
 */
const n = (v: number, p = 2) => Number(v.toFixed(p))
const pt = (deg: number, r: number, cx: number, cy: number) => ({
  x: n(cx + r * Math.cos((deg * Math.PI) / 180)),
  y: n(cy + r * Math.sin((deg * Math.PI) / 180)),
})

/** in-view trigger — adds the animation class once when scrolled into view */
function useInView<T extends Element>(threshold = 0.2) {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === "undefined") {
      setInView(true)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { threshold },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [threshold])
  return [ref, inView] as const
}

/* ------------------------------------------------------------------ */
/*  shared SVG defs (gradients + glow filters, document-global by id)  */
/* ------------------------------------------------------------------ */

function SharedDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <linearGradient id="molten" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={C.gold} />
          <stop offset="45%" stopColor={C.orange} />
          <stop offset="100%" stopColor={C.red} />
        </linearGradient>
        <linearGradient id="moltenV" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.gold2} />
          <stop offset="55%" stopColor={C.orange2} />
          <stop offset="100%" stopColor={C.ember} />
        </linearGradient>
        <radialGradient id="emberCore" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff7e6" />
          <stop offset="30%" stopColor={C.gold2} />
          <stop offset="70%" stopColor={C.orange2} />
          <stop offset="100%" stopColor={C.ember} stopOpacity="0" />
        </radialGradient>
        <radialGradient id="heatGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.orange} stopOpacity="0.55" />
          <stop offset="60%" stopColor={C.ember} stopOpacity="0.12" />
          <stop offset="100%" stopColor={C.ember} stopOpacity="0" />
        </radialGradient>
        <linearGradient id="steelGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#21190f" />
          <stop offset="100%" stopColor="#0d0907" />
        </linearGradient>

        <filter id="glow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="glowBig" x="-120%" y="-120%" width="340%" height="340%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
    </svg>
  )
}

/* ------------------------------------------------------------------ */
/*  page-wide ember particle field                                     */
/* ------------------------------------------------------------------ */

function EmberField({ count = 36, seed = 0 }: { count?: number; seed?: number }) {
  const embers = Array.from({ length: count }, (_, i) => {
    const a = rng(i + seed * 13)
    const b = rng(i + seed * 13 + 99)
    const c = rng(i + seed * 13 + 199)
    return {
      left: `${n(a * 100, 2)}%`,
      size: n(1.5 + b * 3.5, 2),
      delay: n(-c * 9, 2),
      dur: n(7 + b * 9, 2),
      drift: n((a - 0.5) * 60, 2),
      hue: c > 0.5 ? C.orange2 : C.gold2,
    }
  })
  return (
    <div className="vp-embers" aria-hidden="true">
      {embers.map((e, i) => (
        <span
          key={i}
          className="vp-ember"
          style={{
            left: e.left,
            width: e.size,
            height: e.size,
            background: e.hue,
            boxShadow: `0 0 ${e.size * 3}px ${e.hue}`,
            "--dur": `${e.dur}s`,
            "--delay": `${e.delay}s`,
            "--drift": `${e.drift}px`,
          } as CSSProperties}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  scene shell — handles in-view + consistent layout                  */
/* ------------------------------------------------------------------ */

function Scene({
  id,
  children,
  className = "",
}: {
  id: string
  children: (inView: boolean) => ReactNode
  className?: string
}) {
  const [ref, inView] = useInView<HTMLElement>(0.18)
  return (
    <section id={id} ref={ref} className={`vp-scene ${inView ? "in" : ""} ${className}`}>
      {children(inView)}
    </section>
  )
}

/* ================================================================== */
/*  1 · THE FORGE — hero                                                */
/* ================================================================== */

function ForgeHero() {
  return (
    <Scene id="forge" className="vp-hero">
      {() => (
        <>
          <EmberField count={44} />
          <svg className="vp-hero-heat" viewBox="0 0 800 800" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
            <circle cx="400" cy="430" r="360" fill="url(#heatGlow)" className="vp-breathe" />
          </svg>

          <div className="vp-hero-inner">
            {/* --- anvil + hammer + ingot --- */}
            <svg className="vp-forge-svg" viewBox="0 0 520 360" role="img" aria-label="A hammer striking a molten ingot on an anvil">
              <ellipse cx="260" cy="320" rx="190" ry="26" fill="url(#heatGlow)" opacity="0.7" />

              {/* anvil */}
              <g className="vp-anvil" filter="url(#glow)">
                <path className="stroke-draw" d="M150 250 H370 L350 276 H170 Z" fill="url(#steelGrad)" stroke="url(#molten)" strokeWidth="2.5" pathLength={1} style={{ animationDelay: "0.2s" }} />
                <path className="stroke-draw" d="M190 200 H330 Q345 200 345 214 V250 H175 V214 Q175 200 190 200 Z" fill="url(#steelGrad)" stroke="url(#molten)" strokeWidth="2.5" pathLength={1} style={{ animationDelay: "0.35s" }} />
                <path className="stroke-draw" d="M330 206 L398 196 Q410 200 400 210 L335 224 Z" fill="url(#steelGrad)" stroke="url(#molten)" strokeWidth="2.5" pathLength={1} style={{ animationDelay: "0.5s" }} />
                <rect className="stroke-draw" x="220" y="276" width="80" height="44" rx="3" fill="url(#steelGrad)" stroke="url(#molten)" strokeWidth="2" pathLength={1} style={{ animationDelay: "0.6s" }} />
              </g>

              {/* molten ingot */}
              <rect className="vp-ingot-heat" x="232" y="184" width="62" height="16" rx="4" fill="url(#moltenV)" filter="url(#glowBig)" />

              {/* hammer — rotation pivots on the handle end via SMIL (robust) */}
              <g className="vp-hammer">
                <line x1="150" y1="70" x2="250" y2="150" stroke="#3a2a1c" strokeWidth="9" strokeLinecap="round" />
                <g filter="url(#glow)">
                  <rect x="120" y="44" width="64" height="40" rx="7" fill="url(#steelGrad)" stroke="url(#molten)" strokeWidth="2.5" />
                  <rect x="178" y="50" width="14" height="28" rx="4" fill="url(#molten)" />
                </g>
                <animateTransform
                  attributeName="transform" type="rotate"
                  values="-48 150 70; 8 150 70; 0 150 70; -48 150 70; -48 150 70"
                  keyTimes="0;0.16;0.24;0.6;1"
                  keySplines="0.5 0 0.9 0.5; 0.2 0 0.4 1; 0.4 0 0.6 1; 0 0 1 1"
                  calcMode="spline" dur="1.4s" repeatCount="indefinite"
                />
              </g>

              {/* spark burst on each strike */}
              <g className="vp-sparks">
                {Array.from({ length: 10 }, (_, i) => {
                  const ang = Math.PI * (i / 9) - Math.PI
                  const ex = n(263 + Math.cos(ang) * (45 + rng(i) * 45))
                  const ey = n(186 + Math.sin(ang) * (38 + rng(i + 5) * 30) - 18)
                  const ey2 = n(ey + 22)
                  return (
                    <circle key={i} cx="263" cy="186" r={n(1 + rng(i + 2) * 1.6)} fill={i % 2 ? C.gold2 : C.cream} opacity="0">
                      <animate attributeName="cx" values={`263;${ex};${ex}`} keyTimes="0;0.28;1" keySplines="0.1 0.8 0.3 1;0 0 1 1" calcMode="spline" dur="1.4s" begin="0.16s" repeatCount="indefinite" />
                      <animate attributeName="cy" values={`186;${ey};${ey2}`} keyTimes="0;0.28;1" keySplines="0.1 0.8 0.3 1;0.4 0 1 1" calcMode="spline" dur="1.4s" begin="0.16s" repeatCount="indefinite" />
                      <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.04;0.3;1" dur="1.4s" begin="0.16s" repeatCount="indefinite" />
                    </circle>
                  )
                })}
              </g>
            </svg>

            {/* --- name reveals via clip-wipe --- */}
            <div className="vp-hero-title">
              <svg viewBox="0 0 620 130" className="vp-name" role="img" aria-label="Akash Vishwakarma">
                <text x="50%" y="74" textAnchor="middle" className="vp-name-text">AKASH</text>
                <text x="50%" y="112" textAnchor="middle" className="vp-name-sub">V I S H W A K A R M A</text>
              </svg>

              <p className="vp-role">
                <span className="vp-role-line" />
                Full-Stack Developer · Digital Blacksmith
                <span className="vp-role-line" />
              </p>

              <div className="vp-hero-cta">
                <a href="#work" className="vp-btn vp-btn-primary">
                  <span>Enter the Forge</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </a>
                <Link href="/" className="vp-btn vp-btn-ghost">Back to site</Link>
              </div>
            </div>
          </div>

          <div className="vp-scroll-cue" aria-hidden="true">
            <svg width="22" height="34" viewBox="0 0 22 34">
              <rect x="1" y="1" width="20" height="32" rx="10" fill="none" stroke={C.orange2} strokeWidth="1.5" opacity="0.5" />
              <circle cx="11" cy="9" r="3" fill={C.gold2} className="vp-scroll-dot" />
            </svg>
          </div>
        </>
      )}
    </Scene>
  )
}

/* ================================================================== */
/*  section heading                                                    */
/* ================================================================== */

function SceneHead({ index, kicker, title }: { index: string; kicker: string; title: string }) {
  return (
    <div className="vp-head">
      <span className="vp-head-index">{index}</span>
      <div>
        <span className="vp-head-kicker">{kicker}</span>
        <h2 className="vp-head-title">{title}</h2>
      </div>
    </div>
  )
}

/* ================================================================== */
/*  2 · THE MAKER                                                       */
/* ================================================================== */

function IdentityScene() {
  return (
    <Scene id="maker">
      {() => (
        <div className="vp-wrap">
          <SceneHead index="01" kicker="The hands behind it" title="The Maker" />

          <div className="vp-maker-grid">
            <svg viewBox="0 0 360 420" className="vp-maker-svg" role="img" aria-label="A line-art portrait built from circuitry">
              <circle cx="180" cy="180" r="150" fill="url(#heatGlow)" opacity="0.6" />

              {/* orbiting tool ring — SMIL rotation about (180,180) */}
              <g>
                <animateTransform attributeName="transform" type="rotate" from="0 180 180" to="360 180 180" dur="42s" repeatCount="indefinite" />
                <circle cx="180" cy="180" r="150" fill="none" stroke={C.steelLine} strokeWidth="1" strokeDasharray="3 7" opacity="0.6" />
                {[0, 72, 144, 216, 288].map((deg, i) => {
                  const { x, y } = pt(deg, 150, 180, 180)
                  return (
                    <g key={i}>
                      {/* counter-rotate so the glyph stays upright */}
                      <animateTransform attributeName="transform" type="rotate" from={`0 ${x} ${y}`} to={`-360 ${x} ${y}`} dur="42s" repeatCount="indefinite" />
                      <circle cx={x} cy={y} r="15" fill={C.bg2} stroke="url(#molten)" strokeWidth="1.5" filter="url(#glow)" />
                      <text x={x} y={y + 4} textAnchor="middle" className="vp-tool-glyph">{["</>", "{ }", "⚙", "λ", "◆"][i]}</text>
                    </g>
                  )
                })}
              </g>

              {/* head */}
              <g filter="url(#glow)">
                <path className="stroke-draw" pathLength={1} style={{ animationDelay: "0.2s" }} d="M120 150 Q120 95 180 95 Q240 95 240 150 Q240 185 226 205 L226 235 Q226 250 210 254 L210 270 Q210 285 180 285 Q150 285 150 270 L150 254 Q134 250 134 235 L134 205 Q120 185 120 150 Z" fill="none" stroke="url(#molten)" strokeWidth="2.5" />
                <path className="stroke-draw" pathLength={1} style={{ animationDelay: "0.5s" }} d="M120 300 Q120 270 180 268 Q240 270 240 300 L255 360 H105 Z" fill="url(#steelGrad)" stroke="url(#molten)" strokeWidth="2.5" />
                <path className="stroke-draw" pathLength={1} style={{ animationDelay: "0.8s" }} d="M150 165 H170 M190 165 H210 M180 165 V200 M165 215 Q180 225 195 215" fill="none" stroke={C.gold2} strokeWidth="2" strokeLinecap="round" />
                <circle cx="160" cy="165" r="3.5" fill={C.gold2} className="vp-blink" filter="url(#glow)" />
                <circle cx="200" cy="165" r="3.5" fill={C.gold2} className="vp-blink" filter="url(#glow)" style={{ animationDelay: "0.15s" }} />
                <circle cx="180" cy="330" r="10" fill="url(#emberCore)" className="vp-pulse" />
                <path className="stroke-draw" pathLength={1} style={{ animationDelay: "1.1s" }} d="M180 330 V300 M180 330 L150 345 M180 330 L210 345" fill="none" stroke={C.orange2} strokeWidth="1.5" />
              </g>
            </svg>

            <div className="vp-maker-copy">
              {[
                { n: "2+", l: "years forging the web" },
                { n: "50%", l: "lower API cost, shipped" },
                { n: "200+", l: "countries reached" },
                { n: "110+", l: "languages supported" },
              ].map((m, i) => (
                <div key={m.l} className="vp-stat" style={{ transitionDelay: `${0.2 + i * 0.12}s` }}>
                  <span className="vp-stat-num">{m.n}</span>
                  <span className="vp-stat-label">{m.l}</span>
                  <svg className="vp-stat-spark" width="40" height="40" viewBox="0 0 40 40">
                    <path className="vp-twinkle" d="M20 4 L23 17 L36 20 L23 23 L20 36 L17 23 L4 20 L17 17 Z" fill="url(#molten)" style={{ animationDelay: `${i * 0.4}s` }} />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Scene>
  )
}

/* ================================================================== */
/*  3 · SKILL CONSTELLATION                                             */
/* ================================================================== */

const SKILLS = [
  { label: "Next.js", deg: 0, r: 150 },
  { label: "React", deg: 51, r: 175 },
  { label: "TypeScript", deg: 102, r: 150 },
  { label: "Node.js", deg: 154, r: 180 },
  { label: "Postgres", deg: 206, r: 150 },
  { label: "AI / LLM", deg: 257, r: 178 },
  { label: "Tailwind", deg: 308, r: 150 },
]

function SkillsConstellation() {
  const cx = 300
  const cy = 240
  return (
    <Scene id="skills">
      {() => (
        <div className="vp-wrap">
          <SceneHead index="02" kicker="The tools, wired live" title="Skill Constellation" />

          <svg viewBox="0 0 600 480" className="vp-constellation" role="img" aria-label="A core wired to orbiting technology nodes">
            <circle cx={cx} cy={cy} r="200" fill="url(#heatGlow)" opacity="0.5" />

            {SKILLS.map((s, i) => {
              const { x, y } = pt(s.deg, s.r, cx, cy)
              return <line key={`w${i}`} x1={cx} y1={cy} x2={x} y2={y} className="stroke-draw" pathLength={1} stroke="url(#molten)" strokeWidth="1.5" style={{ animationDelay: `${0.3 + i * 0.1}s` }} />
            })}

            {SKILLS.map((s, i) => {
              const { x, y } = pt(s.deg, s.r, cx, cy)
              return (
                <circle key={`p${i}`} r="2.5" fill={C.cream} filter="url(#glow)">
                  <animate attributeName="cx" values={`${cx};${x}`} dur="1.8s" begin={`${1 + i * 0.25}s`} repeatCount="indefinite" />
                  <animate attributeName="cy" values={`${cy};${y}`} dur="1.8s" begin={`${1 + i * 0.25}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0;1;1;0" dur="1.8s" begin={`${1 + i * 0.25}s`} repeatCount="indefinite" />
                </circle>
              )
            })}

            {SKILLS.map((s, i) => {
              const { x, y } = pt(s.deg, s.r, cx, cy)
              return (
                <g key={`n${i}`} className="vp-node" style={{ transitionDelay: `${0.6 + i * 0.1}s` }}>
                  <circle cx={x} cy={y} r="34" fill={C.bg2} stroke="url(#molten)" strokeWidth="1.5" className="vp-node-ring" />
                  <circle cx={x} cy={y} r="34" fill="none" stroke={C.gold2} strokeWidth="1" opacity="0.25" className="vp-node-pulse" />
                  <text x={x} y={y + 4} textAnchor="middle" className="vp-node-label">{s.label}</text>
                </g>
              )
            })}

            {/* rotating core ring */}
            <g>
              <animateTransform attributeName="transform" type="rotate" from={`0 ${cx} ${cy}`} to={`360 ${cx} ${cy}`} dur="16s" repeatCount="indefinite" />
              <circle cx={cx} cy={cy} r="64" fill="none" stroke={C.orange2} strokeWidth="1" strokeDasharray="2 10" opacity="0.6" />
            </g>

            <g filter="url(#glowBig)">
              <circle cx={cx} cy={cy} r="46" fill="url(#emberCore)" className="vp-breathe" />
              <circle cx={cx} cy={cy} r="46" fill="none" stroke={C.cream} strokeWidth="1" opacity="0.4" />
              <text x={cx} y={cy + 6} textAnchor="middle" className="vp-core-glyph">{`</>`}</text>
            </g>
          </svg>
        </div>
      )}
    </Scene>
  )
}

/* ================================================================== */
/*  4 · FORGED WORK                                                     */
/* ================================================================== */

function ProjectDevice({
  title, tag, kind, delay,
}: { title: string; tag: string; kind: "dashboard" | "ai" | "global"; delay: number }) {
  return (
    <div className="vp-device" style={{ transitionDelay: `${delay}s` }}>
      <svg viewBox="0 0 320 220" role="img" aria-label={title}>
        <rect className="stroke-draw" x="8" y="8" width="304" height="204" rx="12" fill="url(#steelGrad)" stroke="url(#molten)" strokeWidth="2" pathLength={1} style={{ animationDelay: `${delay + 0.1}s` }} />
        <line x1="8" y1="38" x2="312" y2="38" stroke={C.steelLine} strokeWidth="1.5" />
        <circle cx="26" cy="23" r="4" fill={C.red} />
        <circle cx="42" cy="23" r="4" fill={C.gold2} />
        <circle cx="58" cy="23" r="4" fill={C.orange} />
        <rect x="120" y="18" width="120" height="10" rx="5" fill={C.steel} />

        {kind === "dashboard" && (
          <g>
            {[0, 1, 2, 3].map((i) => (
              <rect key={i} className="vp-bar" x={28 + i * 70} y="160" width="46" height="40" rx="3" fill="url(#moltenV)" style={{ animationDelay: `${delay + 0.6 + i * 0.15}s` }} />
            ))}
            <polyline className="stroke-draw" points="28,120 90,96 150,108 212,72 284,88" fill="none" stroke={C.gold2} strokeWidth="2.5" pathLength={1} style={{ animationDelay: `${delay + 0.5}s` }} filter="url(#glow)" />
            {[[28, 120], [90, 96], [150, 108], [212, 72], [284, 88]].map(([x, y], i) => (
              <circle key={i} className="vp-dot-pop" cx={x} cy={y} r="3" fill={C.cream} style={{ animationDelay: `${delay + 0.9 + i * 0.1}s` }} />
            ))}
          </g>
        )}

        {kind === "ai" && (
          <g>
            <circle className="stroke-draw" cx="160" cy="120" r="34" fill="none" stroke="url(#molten)" strokeWidth="2" pathLength={1} style={{ animationDelay: `${delay + 0.5}s` }} />
            {[[120, 100, 160, 90], [120, 140, 160, 150], [160, 90, 200, 100], [160, 150, 200, 140], [120, 100, 160, 150], [200, 100, 160, 90]].map(([x1, y1, x2, y2], i) => (
              <line key={i} className="stroke-draw" x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.orange2} strokeWidth="1.2" opacity="0.6" pathLength={1} style={{ animationDelay: `${delay + 0.7 + i * 0.05}s` }} />
            ))}
            {[[120, 100], [120, 140], [160, 90], [160, 150], [200, 100], [200, 140]].map(([x, y], i) => (
              <circle key={i} className="vp-dot-pop" cx={x} cy={y} r="5" fill={C.gold2} filter="url(#glow)" style={{ animationDelay: `${delay + 0.8 + i * 0.08}s` }} />
            ))}
            <circle cx="160" cy="120" r="9" fill="url(#emberCore)" className="vp-pulse" />
          </g>
        )}

        {kind === "global" && (
          <g>
            <circle className="stroke-draw" cx="160" cy="120" r="46" fill="none" stroke="url(#molten)" strokeWidth="2" pathLength={1} style={{ animationDelay: `${delay + 0.5}s` }} />
            <ellipse cx="160" cy="120" rx="46" ry="18" fill="none" stroke={C.steelLine} strokeWidth="1" />
            <ellipse cx="160" cy="120" rx="18" ry="46" fill="none" stroke={C.steelLine} strokeWidth="1" />
            <line x1="114" y1="120" x2="206" y2="120" stroke={C.steelLine} strokeWidth="1" />
            {[[140, 100], [182, 108], [150, 140], [178, 134]].map(([x, y], i) => (
              <g key={i}>
                <circle cx={x} cy={y} r="3" fill={C.gold2} filter="url(#glow)" />
                <circle className="vp-ping" cx={x} cy={y} r="3" fill="none" stroke={C.gold2} strokeWidth="1.5" style={{ animationDelay: `${delay + 0.9 + i * 0.25}s` }} />
              </g>
            ))}
          </g>
        )}
      </svg>
      <div className="vp-device-meta">
        <span className="vp-device-tag">{tag}</span>
        <h3 className="vp-device-title">{title}</h3>
      </div>
    </div>
  )
}

function ProjectsScene() {
  return (
    <Scene id="work">
      {() => (
        <div className="vp-wrap">
          <SceneHead index="03" kicker="Hammered into shape" title="Forged Work" />
          <div className="vp-devices">
            <ProjectDevice title="Realtime Analytics Suite" tag="Dashboard · Next.js" kind="dashboard" delay={0.1} />
            <ProjectDevice title="AI Cost Optimizer" tag="LLM Tooling · -50% spend" kind="ai" delay={0.25} />
            <ProjectDevice title="Multilingual Platform" tag="i18n · 200+ countries" kind="global" delay={0.4} />
          </div>
        </div>
      )}
    </Scene>
  )
}

/* ================================================================== */
/*  5 · THE PROCESS                                                     */
/* ================================================================== */

const FLOW = "M90 90 C 180 90 210 150 330 150 S 480 90 570 90 S 720 150 810 150"
const STATIONS = [
  { label: "Discover", glyph: "🔍", x: 90, y: 90 },
  { label: "Design", glyph: "✎", x: 330, y: 150 },
  { label: "Build", glyph: "⚒", x: 570, y: 90 },
  { label: "Ship", glyph: "🚀", x: 810, y: 150 },
]

function ProcessPipeline() {
  return (
    <Scene id="process">
      {() => (
        <div className="vp-wrap">
          <SceneHead index="04" kicker="From spark to shipped" title="The Process" />
          <svg viewBox="0 0 900 240" className="vp-pipeline" role="img" aria-label="A path through Discover, Design, Build and Ship">
            <path d={FLOW} fill="none" stroke={C.steel} strokeWidth="6" strokeLinecap="round" />
            <path className="stroke-draw" d={FLOW} fill="none" stroke="url(#molten)" strokeWidth="3" strokeLinecap="round" filter="url(#glow)" pathLength={1} />

            <circle r="5" fill={C.cream} filter="url(#glowBig)">
              <animateMotion dur="4s" begin="1.4s" repeatCount="indefinite" path={FLOW} />
            </circle>

            {STATIONS.map((s, i) => (
              <g key={s.label} className="vp-station" style={{ transitionDelay: `${0.8 + i * 0.4}s` }}>
                <circle cx={s.x} cy={s.y} r="30" fill={C.bg2} stroke="url(#molten)" strokeWidth="2" />
                <circle cx={s.x} cy={s.y} r="30" fill="none" stroke={C.gold2} strokeWidth="1" opacity="0.3" className="vp-node-pulse" />
                <text x={s.x} y={s.y + 7} textAnchor="middle" fontSize="20">{s.glyph}</text>
                <text x={s.x} y={s.y + 56} textAnchor="middle" className="vp-station-label">{s.label}</text>
                <text x={s.x} y={s.y - 42} textAnchor="middle" className="vp-station-num">{`0${i + 1}`}</text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </Scene>
  )
}

/* ================================================================== */
/*  6 · THE SIGNAL — CTA                                                */
/* ================================================================== */

const FLIGHT = "M150 120 Q 260 40 410 70"

function ContactBeacon() {
  return (
    <Scene id="signal" className="vp-signal">
      {() => (
        <>
          <EmberField count={28} seed={7} />
          <div className="vp-wrap vp-signal-wrap">
            <svg viewBox="0 0 440 300" className="vp-beacon" role="img" aria-label="A beacon firing an ember signal and a paper plane in flight">
              <circle cx="120" cy="200" r="140" fill="url(#heatGlow)" opacity="0.7" />

              <g filter="url(#glow)">
                <path className="stroke-draw" pathLength={1} style={{ animationDelay: "0.2s" }} d="M80 240 L160 240 L150 200 L90 200 Z" fill="url(#steelGrad)" stroke="url(#molten)" strokeWidth="2.5" />
                <line x1="120" y1="240" x2="120" y2="285" stroke="#3a2a1c" strokeWidth="8" strokeLinecap="round" />
                <ellipse cx="120" cy="285" rx="34" ry="7" fill="url(#heatGlow)" />
              </g>

              <path className="vp-flame" d="M120 200 C 100 175 110 160 120 140 C 130 160 140 175 120 200 Z" fill="url(#moltenV)" filter="url(#glowBig)" />
              <path className="vp-flame vp-flame-inner" d="M120 195 C 110 180 116 168 120 156 C 124 168 130 180 120 195 Z" fill={C.gold2} />

              {[0, 1, 2].map((i) => (
                <circle key={i} className="vp-signal-ring" cx="120" cy="150" r="20" fill="none" stroke={C.gold2} strokeWidth="1.5" style={{ animationDelay: `${i * 1}s` }} />
              ))}

              <path className="stroke-draw" d={FLIGHT} fill="none" stroke={C.steelLine} strokeWidth="1.5" strokeDasharray="4 6" pathLength={1} style={{ animationDelay: "0.6s" }} />
              <g>
                <polygon points="0,-7 14,0 0,7 4,0" fill="url(#molten)" stroke={C.cream} strokeWidth="0.8" filter="url(#glow)" />
                <animateMotion dur="3.2s" begin="1.2s" repeatCount="indefinite" rotate="auto" path={FLIGHT} />
              </g>
            </svg>

            <div className="vp-signal-copy">
              <h2 className="vp-signal-title">
                Let&rsquo;s forge<br />something <span className="vp-fire-word">unforgettable</span>.
              </h2>
              <div className="vp-hero-cta vp-signal-cta">
                <Link href="/contact" className="vp-btn vp-btn-primary">
                  <span>Start a project</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </Link>
                <Link href="/projects" className="vp-btn vp-btn-ghost">See case studies</Link>
              </div>
              <p className="vp-signal-foot">Available for new projects · Forged with Next.js</p>
            </div>
          </div>
        </>
      )}
    </Scene>
  )
}

/* ================================================================== */
/*  side progress rail                                                 */
/* ================================================================== */

const NAV = [
  { id: "forge", label: "Forge" },
  { id: "maker", label: "Maker" },
  { id: "skills", label: "Skills" },
  { id: "work", label: "Work" },
  { id: "process", label: "Process" },
  { id: "signal", label: "Signal" },
]

function ProgressRail() {
  const [active, setActive] = useState("forge")
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id) }),
      { rootMargin: "-45% 0px -45% 0px" },
    )
    NAV.forEach((n) => { const el = document.getElementById(n.id); if (el) io.observe(el) })
    return () => io.disconnect()
  }, [])
  return (
    <nav className="vp-rail" aria-label="Sections">
      {NAV.map((n) => (
        <a key={n.id} href={`#${n.id}`} className={`vp-rail-item ${active === n.id ? "on" : ""}`}>
          <span className="vp-rail-label">{n.label}</span>
          <span className="vp-rail-dot" />
        </a>
      ))}
    </nav>
  )
}

/* ================================================================== */
/*  main                                                               */
/* ================================================================== */

export function VisualPortfolio() {
  return (
    <div className="vp-root">
      <SharedDefs />
      <ProgressRail />
      <main>
        <ForgeHero />
        <IdentityScene />
        <SkillsConstellation />
        <ProjectsScene />
        <ProcessPipeline />
        <ContactBeacon />
      </main>
      <StyleBlock />
    </div>
  )
}

/* ================================================================== */
/*  all animation CSS, scoped under .vp-root                           */
/* ================================================================== */

function StyleBlock() {
  return (
    <style>{`
.vp-root {
  --cream: ${C.cream};
  --gold: ${C.gold2};
  --orange: ${C.orange2};
  position: relative;
  background: radial-gradient(120% 80% at 50% -10%, #1a0e07 0%, ${C.bg} 55%), ${C.bg};
  color: var(--cream);
  font-family: var(--font-sans, ui-sans-serif, system-ui, sans-serif);
  overflow-x: hidden;
}
.vp-root *, .vp-root *::before, .vp-root *::after { box-sizing: border-box; }

/* ---------- ember particles ---------- */
.vp-embers { position: absolute; inset: 0; overflow: hidden; pointer-events: none; z-index: 1; }
.vp-ember { position: absolute; bottom: -10px; border-radius: 50%; opacity: 0; animation: vp-rise var(--dur) linear var(--delay) infinite; }
@keyframes vp-rise {
  0% { transform: translateY(0) translateX(0) scale(1); opacity: 0; }
  10% { opacity: 1; }
  90% { opacity: 0.8; }
  100% { transform: translateY(-105vh) translateX(var(--drift)) scale(0.3); opacity: 0; }
}

/* ---------- scene shell ---------- */
.vp-scene { position: relative; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 8vh 5vw; z-index: 2; }
.vp-wrap { width: 100%; max-width: 1140px; margin: 0 auto; position: relative; z-index: 3; }

/* ---------- stroke-draw (paths/lines/shapes only) ---------- */
.stroke-draw { stroke-dasharray: 1; stroke-dashoffset: 1; will-change: stroke-dashoffset; }
.vp-scene.in .stroke-draw { animation: vp-draw 1.5s cubic-bezier(0.65, 0, 0.35, 1) forwards; }
@keyframes vp-draw { to { stroke-dashoffset: 0; } }

/* ---------- generic reveal ---------- */
.vp-node, .vp-station, .vp-device, .vp-stat { opacity: 0; transform: translateY(18px); transition: opacity 0.7s ease, transform 0.7s cubic-bezier(0.22,1,0.36,1); }
.vp-scene.in .vp-node, .vp-scene.in .vp-station, .vp-scene.in .vp-device, .vp-scene.in .vp-stat { opacity: 1; transform: translateY(0); }

/* ================= HERO ================= */
.vp-hero { flex-direction: column; gap: 1rem; text-align: center; }
.vp-hero-heat { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 0; }
.vp-hero-inner { position: relative; z-index: 3; display: flex; flex-direction: column; align-items: center; }
.vp-forge-svg { width: min(520px, 86vw); height: auto; }
.vp-ingot-heat { animation: vp-heat 1.4s ease-in-out infinite; }
@keyframes vp-heat { 0%,100% { filter: url(#glowBig) brightness(1); } 18% { filter: url(#glowBig) brightness(1.7); } }
.vp-breathe { transform-box: fill-box; transform-origin: center; animation: vp-breathe 4s ease-in-out infinite; }
@keyframes vp-breathe { 0%,100% { opacity: 0.7; transform: scale(1); } 50% { opacity: 1; transform: scale(1.04); } }

.vp-hero-title { margin-top: -1.5rem; position: relative; z-index: 4; }
.vp-name { width: min(620px, 92vw); height: auto; filter: drop-shadow(0 0 30px rgba(255,122,24,0.32)); }
.vp-name-text {
  font-size: 86px; font-weight: 900; letter-spacing: 2px;
  font-family: var(--font-sans, system-ui, sans-serif);
  fill: url(#molten); stroke: rgba(255,217,138,0.35); stroke-width: 0.8; paint-order: stroke;
  -webkit-clip-path: inset(0 100% 0 0); clip-path: inset(0 100% 0 0);
}
.vp-scene.in .vp-name-text { animation: vp-wipe 1.3s cubic-bezier(0.7,0,0.2,1) forwards 0.5s; }
@keyframes vp-wipe { to { -webkit-clip-path: inset(0 0 0 0); clip-path: inset(0 0 0 0); } }
.vp-name-sub { font-size: 15px; letter-spacing: 8px; fill: ${C.cream}; opacity: 0; font-weight: 500; }
.vp-scene.in .vp-name-sub { animation: vp-fade 1s ease forwards 1.5s; }
@keyframes vp-fade { to { opacity: 0.65; } }

.vp-role { display: flex; align-items: center; justify-content: center; gap: 14px; margin: 0.6rem 0 0; font-size: clamp(0.7rem, 1.4vw, 0.85rem); letter-spacing: 0.22em; text-transform: uppercase; color: ${C.orange}; font-family: var(--font-mono, ui-monospace, monospace); opacity: 0; }
.vp-scene.in .vp-role { animation: vp-fade-up 0.9s ease forwards 1.8s; }
@keyframes vp-fade-up { from { opacity:0; transform: translateY(10px);} to { opacity:0.9; transform:none;} }
.vp-role-line { width: 40px; height: 1px; background: linear-gradient(90deg, transparent, ${C.orange}); }
.vp-role-line:last-child { background: linear-gradient(90deg, ${C.orange}, transparent); }

.vp-hero-cta { display: flex; gap: 14px; justify-content: center; flex-wrap: wrap; margin-top: 1.8rem; }
.vp-hero .vp-hero-cta { opacity: 0; }
.vp-hero.in .vp-hero-cta { animation: vp-fade-up 0.9s ease forwards 2s; }

.vp-btn { display: inline-flex; align-items: center; gap: 9px; padding: 13px 24px; border-radius: 999px; font-weight: 600; font-size: 0.92rem; text-decoration: none; cursor: pointer; transition: transform .25s ease, box-shadow .25s ease, background .25s ease; }
.vp-btn-primary { background: linear-gradient(100deg, ${C.red}, ${C.orange2}); color: #1a0a04; box-shadow: 0 0 0 1px rgba(255,160,60,.4), 0 8px 30px -8px ${C.orange2}; }
.vp-btn-primary:hover { transform: translateY(-3px); box-shadow: 0 0 0 1px rgba(255,200,90,.6), 0 14px 44px -10px ${C.orange2}; }
.vp-btn-ghost { background: rgba(255,255,255,0.04); color: var(--cream); border: 1px solid rgba(255,255,255,0.16); }
.vp-btn-ghost:hover { background: rgba(255,255,255,0.09); transform: translateY(-3px); }

.vp-scroll-cue { position: absolute; bottom: 26px; left: 50%; transform: translateX(-50%); z-index: 4; opacity: 0.8; }
.vp-scroll-dot { animation: vp-scroll 1.8s ease-in-out infinite; }
@keyframes vp-scroll { 0%,100% { transform: translateY(0); opacity: 1; } 50% { transform: translateY(12px); opacity: 0.3; } }

/* ================= SECTION HEAD ================= */
.vp-head { display: flex; align-items: flex-start; gap: 18px; margin-bottom: 3rem; }
.vp-head-index { font-family: var(--font-mono, monospace); font-size: 0.8rem; letter-spacing: 0.2em; color: ${C.orange}; border: 1px solid rgba(255,160,60,.3); border-radius: 999px; padding: 5px 11px; margin-top: 6px; }
.vp-head-kicker { display:block; font-size: 0.78rem; letter-spacing: 0.24em; text-transform: uppercase; color: rgba(255,244,230,.5); font-family: var(--font-mono, monospace); }
.vp-head-title { margin: 4px 0 0; font-size: clamp(1.9rem, 5vw, 3.2rem); font-weight: 800; line-height: 1; background: linear-gradient(100deg, ${C.cream}, ${C.gold}, ${C.orange2}); -webkit-background-clip: text; background-clip: text; color: transparent; }

/* ================= MAKER ================= */
.vp-maker-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 3rem; align-items: center; }
.vp-maker-svg { width: 100%; max-width: 380px; height: auto; margin: 0 auto; }
.vp-tool-glyph { font-size: 12px; fill: ${C.gold}; font-family: var(--font-mono, monospace); }
.vp-blink { animation: vp-blink 4s ease-in-out infinite; }
@keyframes vp-blink { 0%,92%,100% { opacity: 1; } 95% { opacity: 0.15; } }
.vp-pulse { transform-box: fill-box; transform-origin: center; animation: vp-pulse 2.4s ease-in-out infinite; }
@keyframes vp-pulse { 0%,100% { opacity: 0.7; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.15); } }

.vp-maker-copy { display: grid; grid-template-columns: 1fr 1fr; gap: 1.4rem; }
.vp-stat { position: relative; padding: 1.2rem 1.3rem; border-radius: 16px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,160,60,0.14); overflow: hidden; }
.vp-stat-num { display: block; font-size: clamp(1.8rem, 4vw, 2.6rem); font-weight: 900; background: linear-gradient(100deg, ${C.gold}, ${C.orange2}); -webkit-background-clip: text; background-clip: text; color: transparent; }
.vp-stat-label { display: block; margin-top: 4px; font-size: 0.82rem; color: rgba(255,244,230,0.62); }
.vp-stat-spark { position: absolute; top: 8px; right: 8px; opacity: 0.8; }
.vp-twinkle { transform-box: fill-box; transform-origin: center; animation: vp-twinkle 3s ease-in-out infinite; }
@keyframes vp-twinkle { 0%,100% { opacity: 0.3; transform: scale(0.7) rotate(0deg); } 50% { opacity: 1; transform: scale(1) rotate(40deg); } }

/* ================= CONSTELLATION ================= */
.vp-constellation { width: 100%; max-width: 600px; height: auto; margin: 0 auto; display: block; }
.vp-node-label { font-size: 12px; font-weight: 600; fill: ${C.cream}; font-family: var(--font-mono, monospace); }
.vp-core-glyph { font-size: 26px; font-weight: 800; fill: #1a0a04; font-family: var(--font-mono, monospace); }
.vp-node-ring { transition: filter .3s; }
.vp-node:hover .vp-node-ring { filter: url(#glowBig); }
.vp-node-pulse { transform-box: fill-box; transform-origin: center; animation: vp-ring-pulse 3s ease-out infinite; }
@keyframes vp-ring-pulse { 0% { transform: scale(1); opacity: 0.5; } 100% { transform: scale(1.6); opacity: 0; } }

/* ================= DEVICES ================= */
.vp-devices { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.6rem; }
.vp-device { border-radius: 18px; padding: 14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,160,60,0.14); transition: transform .35s ease, box-shadow .35s ease, opacity .7s ease; }
.vp-device:hover { transform: translateY(-6px); box-shadow: 0 20px 50px -20px ${C.orange2}; border-color: rgba(255,160,60,0.4); }
.vp-device svg { width: 100%; height: auto; display: block; }
.vp-device-meta { padding: 12px 6px 4px; }
.vp-device-tag { font-size: 0.72rem; letter-spacing: 0.14em; text-transform: uppercase; color: ${C.orange}; font-family: var(--font-mono, monospace); }
.vp-device-title { margin: 5px 0 0; font-size: 1.05rem; font-weight: 700; color: var(--cream); }
.vp-bar { transform-box: fill-box; transform-origin: bottom; transform: scaleY(0); }
.vp-scene.in .vp-bar { animation: vp-bar 0.9s cubic-bezier(0.22,1,0.36,1) forwards; }
@keyframes vp-bar { to { transform: scaleY(1); } }
.vp-dot-pop { transform-box: fill-box; transform-origin: center; opacity: 0; transform: scale(0); }
.vp-scene.in .vp-dot-pop { animation: vp-pop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards; }
@keyframes vp-pop { to { opacity: 1; transform: scale(1); } }
.vp-ping { transform-box: fill-box; transform-origin: center; animation: vp-ping 2.2s ease-out infinite; }
@keyframes vp-ping { 0% { transform: scale(1); opacity: 0.9; } 100% { transform: scale(4); opacity: 0; } }

/* ================= PIPELINE ================= */
.vp-pipeline { width: 100%; max-width: 920px; height: auto; margin: 0 auto; display: block; }
.vp-station-label { font-size: 14px; font-weight: 700; fill: var(--cream); }
.vp-station-num { font-size: 11px; fill: ${C.orange}; font-family: var(--font-mono, monospace); letter-spacing: 0.1em; }

/* ================= SIGNAL ================= */
.vp-signal-wrap { display: grid; grid-template-columns: minmax(0,0.9fr) minmax(0,1.1fr); gap: 3rem; align-items: center; }
.vp-beacon { width: 100%; max-width: 440px; height: auto; }
.vp-flame { transform-box: fill-box; transform-origin: bottom center; animation: vp-flame 0.6s ease-in-out infinite alternate; }
.vp-flame-inner { animation-duration: 0.45s; }
@keyframes vp-flame { 0% { transform: scaleY(0.92) scaleX(1.04) translateY(2px); } 100% { transform: scaleY(1.08) scaleX(0.94) translateY(-3px); } }
.vp-signal-ring { transform-box: fill-box; transform-origin: center; animation: vp-signal-ring 3s ease-out infinite; }
@keyframes vp-signal-ring { 0% { transform: scale(0.4); opacity: 0.8; } 100% { transform: scale(3.4); opacity: 0; } }
.vp-signal-title { font-size: clamp(2rem, 5.5vw, 3.6rem); font-weight: 800; line-height: 1.05; margin: 0 0 1.6rem; color: var(--cream); }
.vp-fire-word { background: linear-gradient(100deg, ${C.red}, ${C.orange2}, ${C.gold}); -webkit-background-clip: text; background-clip: text; color: transparent; background-size: 200% 100%; animation: vp-shift 5s ease-in-out infinite; }
@keyframes vp-shift { 0%,100% { background-position: 0 50%; } 50% { background-position: 100% 50%; } }
.vp-signal-foot { margin-top: 1.4rem; font-size: 0.8rem; letter-spacing: 0.1em; color: rgba(255,244,230,0.45); font-family: var(--font-mono, monospace); }

/* ================= PROGRESS RAIL ================= */
.vp-rail { position: fixed; right: 22px; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 16px; z-index: 50; }
.vp-rail-item { display: flex; align-items: center; gap: 10px; justify-content: flex-end; text-decoration: none; }
.vp-rail-dot { width: 9px; height: 9px; border-radius: 50%; background: rgba(255,244,230,0.25); transition: all .3s ease; }
.vp-rail-label { font-size: 0.72rem; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,244,230,0.5); opacity: 0; transform: translateX(6px); transition: all .3s ease; font-family: var(--font-mono, monospace); }
.vp-rail-item:hover .vp-rail-label { opacity: 1; transform: none; }
.vp-rail-item.on .vp-rail-dot { background: ${C.orange2}; box-shadow: 0 0 12px ${C.orange2}; transform: scale(1.35); }
.vp-rail-item.on .vp-rail-label { opacity: 1; transform: none; color: ${C.gold}; }

/* ================= RESPONSIVE ================= */
@media (max-width: 860px) {
  .vp-maker-grid, .vp-signal-wrap { grid-template-columns: 1fr; gap: 2rem; }
  .vp-devices { grid-template-columns: 1fr; }
  .vp-rail { display: none; }
  .vp-name-text { font-size: 64px; }
}
@media (max-width: 520px) {
  .vp-maker-copy { grid-template-columns: 1fr; }
  .vp-head-title { font-size: 2rem; }
}

/* ================= REDUCED MOTION ================= */
@media (prefers-reduced-motion: reduce) {
  .vp-root * { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; }
  .stroke-draw { stroke-dashoffset: 0 !important; }
  .vp-name-text { -webkit-clip-path: none !important; clip-path: none !important; }
  .vp-name-sub, .vp-role, .vp-hero-cta { opacity: 1 !important; }
  .vp-node, .vp-station, .vp-device, .vp-stat { opacity: 1 !important; transform: none !important; }
  .vp-bar { transform: scaleY(1) !important; }
  .vp-dot-pop { opacity: 1 !important; transform: none !important; }
}
    `}</style>
  )
}
