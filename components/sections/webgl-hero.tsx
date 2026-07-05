"use client"

/**
 * WebglHero — "Ignition Forge".
 *
 * A cinematic, WebGL-driven landing: ~20k GPU fire-particles (see Akasha3D)
 * morph chaos → sacred Fibonacci sphere → dodecahedron over the FIRST screen of
 * scroll, while the developer's last name ignites from an ember outline into the
 * accent gradient in lockstep with the field finding order.
 *
 * One clock: a local `useScroll` MotionValue drives BOTH the shader's morph
 * uniform (via a ref written in a MotionValue listener — never setState, so zero
 * re-renders while scrolling) and the DOM reveals. Hovering the primary CTA eases
 * a small additive bias into the same value, so the field gathers toward the solid
 * when you reach for the button.
 *
 * Robustness:
 *  · Content readability is DECOUPLED from scroll — every element enters on load,
 *    so a visitor who never scrolls still sees a finished, legible hero.
 *  · No WebGL  → Akasha3DMount renders nothing; the designed molten-forge backdrop
 *    stands alone.
 *  · prefers-reduced-motion → no scroll listener; the field is pinned to its final
 *    ordered SOLID frame and the name renders resolved. No scroll-jacking.
 *  · SSR-safe: identical markup on server and client (no Math.random in render;
 *    grain is a static SVG data-URI). Nothing uses position:fixed (SectionReveal's
 *    transform is our containing block).
 */

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion"
import { ArrowRight, Github, Linkedin, Twitter, Mail, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Magnetic } from "@/components/magnetic"
import { SpeakingIntro } from "@/components/speaking-intro"
import { Akasha3DMount } from "@/components/akasha-3d-mount"
import type { SocialLink } from "@/lib/db"

interface WebglHeroProps {
  developerName: string
  professionalTitle: string
  tagline: string
  primaryCtaText: string
  primaryCtaUrl: string
  secondaryCtaText: string
  secondaryCtaUrl: string
  socialLinks?: SocialLink[]
  content?: Record<string, unknown>
}

const socialIcons: Record<string, typeof Github> = {
  github: Github,
  linkedin: Linkedin,
  twitter: Twitter,
}

const fallbackSocialLinks = [
  { href: "https://github.com", icon: Github, label: "GitHub" },
  { href: "https://linkedin.com", icon: Linkedin, label: "LinkedIn" },
  { href: "https://twitter.com", icon: Twitter, label: "Twitter" },
  { href: "mailto:hello@akash.dev", icon: Mail, label: "Email" },
]

/** Static, deterministic film-grain tile (no per-frame canvas, hydration-safe). */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"

const NAME_GRADIENT = "linear-gradient(100deg,#ff4d2e,#ff7a18 45%,#ffd24a)"

export function WebglHero({
  developerName,
  professionalTitle,
  tagline,
  primaryCtaText,
  primaryCtaUrl,
  secondaryCtaText,
  secondaryCtaUrl,
  socialLinks,
  content,
}: WebglHeroProps) {
  const prefersReduced = useReducedMotion() ?? false
  // Reduced-motion gates real (SSR'd) markup below — the ping dot, the scroll cue,
  // and the entrance `initial` props — so it must NOT differ between the server
  // render and the first client render. useReducedMotion() resolves to the true
  // preference on the client's first paint, which would mismatch the server's
  // full-motion HTML and trigger a hydration error. Gate it behind a mounted flag:
  // full-motion until mounted, then diverge as a normal post-hydration update.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const reduced = mounted && prefersReduced

  const availabilityText =
    (content?.availability_text as string) || "Available for new projects"

  const nameParts = developerName.trim().split(/\s+/)
  const firstName = nameParts[0] || developerName
  const eyebrow = nameParts.length > 1 ? nameParts.slice(0, -1).join(" ") : "Hi, I'm"
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : developerName

  const introLines = (content?.intro_lines as string[]) || [
    `Hi — I'm ${firstName}, a ${professionalTitle.toLowerCase()}.`,
    "For over two years I've built scalable web applications with Next.js, React, TypeScript, and Node.js.",
    "I've shipped AI-powered tools that cut API costs by fifty percent and boosted efficiency by thirty percent.",
    "And I've scaled multilingual platforms to more than two hundred countries across a hundred and ten languages.",
    "Let's build something great together.",
  ]
  const metrics = (content?.metrics as string[]) || [
    "2+ yrs experience",
    "50% lower API costs",
    "+30% efficiency",
    "200+ countries",
    "110+ languages",
  ]

  /* ---------------- the one clock: scroll → morph ---------------- */
  const heroRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(0) // written into the shader every frame it changes
  const hoverBias = useRef(0) // CTA intent-bias, eased by rAF
  const biasTarget = useRef(0)
  const rafId = useRef<number | null>(null)

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  })

  // A single MotionValue every DOM reveal derives from. In reduced-motion it is
  // pinned to 1 (resolved), so the name/underline/glow render finished with no
  // scroll dependency.
  const morph = useMotionValue(0)

  // Push the combined scroll + hover-bias value into both the shader ref and the
  // reveal MotionValue. Never touches React state.
  const applyProgress = () => {
    const p = Math.min(1, scrollYProgress.get() + hoverBias.current)
    progressRef.current = p
    morph.set(p)
  }

  useMotionValueEvent(scrollYProgress, "change", () => {
    if (reduced) return
    applyProgress()
  })

  useEffect(() => {
    if (reduced) {
      // Pin the field to its final ordered dodecahedron; no scroll listening.
      progressRef.current = 1
      morph.set(1)
      return
    }
    // Sync once on mount (covers reloads landing mid-hero).
    applyProgress()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced])

  // rAF ease for the CTA intent-bias (self-cancelling).
  useEffect(() => {
    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current)
    }
  }, [])

  const tickBias = () => {
    const target = biasTarget.current
    const next = hoverBias.current + (target - hoverBias.current) * 0.14
    hoverBias.current = Math.abs(target - next) < 0.0006 ? target : next
    applyProgress()
    if (hoverBias.current !== target) {
      rafId.current = requestAnimationFrame(tickBias)
    }
  }

  const easeBias = (target: number) => {
    if (reduced) return
    biasTarget.current = target
    if (rafId.current != null) cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(tickBias)
  }

  /* ---------------- scroll-derived reveal values ---------------- */
  // Bands land on the shader's own smoothstep stages (chaos→sacred ~0.58,
  // sacred→solid ~0.5–1.0). Content visibility is NOT gated on these — only
  // enhancement (outline→fill, blur→sharp, glow, underline) is.
  const nameFill = useTransform(morph, [0.34, 0.62], [0, 1])
  const nameBlur = useTransform(morph, [0.3, 0.58], ["blur(2px)", "blur(0px)"])
  const nameTracking = useTransform(morph, [0.3, 0.58], ["-0.02em", "-0.045em"])
  const resolve = useTransform(morph, [0.66, 0.92], [0, 1])
  const cueOpacity = useTransform(morph, [0, 0.15], [1, 0])
  const cueBeadY = useTransform(morph, [0, 1], [0, 14])

  // Gentle on-load entrance (independent of scroll). Kept minimal under
  // reduced-motion (no translation).
  const enter = (delay: number) =>
    reduced
      ? { initial: false as const }
      : {
          initial: { opacity: 0, y: 16 },
          animate: { opacity: 1, y: 0 },
          transition: { duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] as const },
        }

  const socials =
    socialLinks && socialLinks.length > 0
      ? socialLinks.map((l) => ({
          key: l.id as string | number,
          href: l.url,
          label: l.platform,
          Icon: socialIcons[l.platform.toLowerCase()] || Mail,
        }))
      : fallbackSocialLinks.map((s) => ({ key: s.label, href: s.href, label: s.label, Icon: s.icon }))

  return (
    <div
      ref={heroRef}
      className="relative flex min-h-[max(100vh,640px)] w-full items-end overflow-hidden lg:items-center"
      style={{ backgroundColor: "#08070b" }}
    >
      {/* z-0 — molten forge backdrop (also the full no-WebGL fallback) */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(58% 52% at 66% 40%, rgba(255,122,24,0.26), rgba(232,67,31,0.11) 42%, transparent 72%)," +
            "radial-gradient(120% 80% at 50% -12%, rgba(26,14,7,0.9), transparent 60%)," +
            "#08070b",
        }}
      />

      {/* z-[1] — the WebGL particle field (renders nothing without WebGL) */}
      <Akasha3DMount progressRef={progressRef} className="absolute inset-0 z-1" />

      {/* z-[2] — cinematic overlays (pointer-events-none so the cursor reaches the field) */}
      <div className="pointer-events-none absolute inset-0 z-2">
        {/* vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 120% at 50% 45%, transparent 55%, rgba(8,7,11,0.55) 100%)",
          }}
        />
        {/* contrast scrim — protects the left column on desktop, bottom on mobile */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(0deg, rgba(8,7,11,0.86), transparent 42%)," +
              "linear-gradient(90deg, rgba(8,7,11,0.9) 0%, rgba(8,7,11,0.5) 34%, transparent 62%)",
          }}
        />
        {/* film grain */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: GRAIN, mixBlendMode: "overlay" }}
        />
      </div>

      {/* z-10 — content column */}
      <div className="relative z-10 w-full">
        <div className="mx-auto w-full max-w-3xl px-6 pb-24 text-center sm:px-8 lg:mx-0 lg:pb-0 lg:pl-[8vw] lg:pr-0 lg:text-left">
          {/* availability pill */}
          <motion.div
            {...enter(0)}
            className="mb-7 inline-flex items-center gap-2.5 rounded-full px-4 py-1.5 text-xs font-medium backdrop-blur-md"
            style={{
              background: "rgba(255,122,24,0.10)",
              border: "1px solid rgba(255,122,24,0.25)",
              color: "#ffd24a",
            }}
          >
            <span className="relative flex h-2 w-2">
              {!reduced && (
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75"
                  style={{ background: "#34d399" }}
                />
              )}
              <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: "#34d399" }} />
            </span>
            {availabilityText}
          </motion.div>

          {/* mono kicker with hairline ember rules */}
          <motion.div
            {...enter(0.08)}
            className="mb-4 flex items-center gap-3 lg:justify-start justify-center"
          >
            <span
              className="hidden h-px w-8 sm:block"
              style={{ background: "linear-gradient(90deg,transparent,#ff7a18)" }}
            />
            <span
              className="font-mono text-[0.72rem] uppercase tracking-[0.3em] sm:text-[0.78rem]"
              style={{ color: "#ff9a4a" }}
            >
              {professionalTitle}
            </span>
            <span
              className="hidden h-px w-8 sm:block lg:hidden"
              style={{ background: "linear-gradient(90deg,#ff7a18,transparent)" }}
            />
          </motion.div>

          {/* name headline */}
          <motion.h1
            {...enter(0.14)}
            className="font-black uppercase leading-[0.88]"
            style={{ color: "#f5ede6", letterSpacing: nameTracking }}
          >
            <span
              className="block"
              style={{ color: "rgba(245,237,230,0.55)", fontSize: "clamp(1.3rem,3.6vw,2.7rem)" }}
            >
              {eyebrow}
            </span>
            <motion.span
              className="relative inline-block"
              style={{ filter: nameBlur, fontSize: "clamp(3rem,9vw,6.5rem)" }}
            >
              {/* legible fire-gradient name — the accessible copy, fully visible
                  at rest (a non-scroller must read a finished hero) */}
              <span
                style={{
                  backgroundImage: NAME_GRADIENT,
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  textShadow: "0 0 34px rgba(255,122,24,0.22)",
                }}
              >
                {lastName}
              </span>
              {/* white-hot ignite — brightens over the base as the field finds
                  order; scroll only ENHANCES the already-legible name */}
              <motion.span
                aria-hidden
                className="absolute inset-0"
                style={{
                  opacity: nameFill,
                  backgroundImage: "linear-gradient(100deg,#ffb26b,#ffe6a8 50%,#ffffff)",
                  WebkitBackgroundClip: "text",
                  backgroundClip: "text",
                  color: "transparent",
                  textShadow: "0 0 42px rgba(255,190,110,0.4)",
                }}
              >
                {lastName}
              </motion.span>
              {/* underline bar — draws in on SOLID */}
              <motion.span
                aria-hidden
                className="absolute -bottom-1 left-0 h-0.75 w-full origin-left rounded-full"
                style={{ scaleX: resolve, opacity: resolve, background: "linear-gradient(90deg,#ff4d2e,#ffd24a)" }}
              />
            </motion.span>
          </motion.h1>

          {/* tagline / speaking intro (carries the metric chips) */}
          <motion.div {...enter(0.22)}>
            <SpeakingIntro idle={tagline} lines={introLines} metrics={metrics} />
          </motion.div>

          {/* CTAs */}
          <motion.div
            {...enter(0.32)}
            className="mt-10 flex flex-col items-center gap-3 sm:flex-row lg:items-start lg:justify-start justify-center"
          >
            <span
              className="inline-flex"
              onPointerEnter={() => easeBias(0.14)}
              onPointerLeave={() => easeBias(0)}
            >
              <Magnetic strength={0.28}>
                <Button
                  asChild
                  size="lg"
                  className="group h-12 rounded-full px-6 text-sm font-semibold"
                  style={{ background: "linear-gradient(100deg,#ff4d2e,#ff7a18)", color: "#1a0a04", border: "none" }}
                >
                  <Link href={primaryCtaUrl}>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {primaryCtaText}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                </Button>
              </Magnetic>
            </span>
            <Magnetic strength={0.28}>
              <Button
                asChild
                variant="outline"
                size="lg"
                className="h-12 rounded-full px-6 text-sm font-semibold"
                style={{ background: "rgba(255,255,255,0.05)", borderColor: "rgba(255,255,255,0.18)", color: "#f5ede6" }}
              >
                <Link href={secondaryCtaUrl}>{secondaryCtaText}</Link>
              </Button>
            </Magnetic>
          </motion.div>

          {/* socials */}
          <motion.div
            {...enter(0.42)}
            className="mt-10 flex items-center justify-center gap-1 lg:justify-start"
          >
            {socials.map((l) => (
              <Link
                key={l.key}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group rounded-full p-3 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#ff7a18]"
                style={{ color: "rgba(245,237,230,0.6)" }}
              >
                <l.Icon className="h-5 w-5 transition-colors group-hover:text-[#ff7a18]" />
                <span className="sr-only">{l.label}</span>
              </Link>
            ))}
          </motion.div>
        </div>
      </div>

      {/* scroll cue — a live progress bead (fades out once the forge condenses) */}
      {!reduced && (
        <motion.div
          className="absolute bottom-7 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 sm:flex lg:left-[8vw] lg:translate-x-0 lg:items-start"
          style={{ opacity: cueOpacity }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.3em]" style={{ color: "rgba(245,237,230,0.4)" }}>
            Scroll
          </span>
          <div
            className="flex h-9 w-5 justify-center rounded-full pt-1.5"
            style={{ border: "1px solid rgba(245,237,230,0.25)" }}
          >
            <motion.span
              className="h-1.5 w-1 rounded-full"
              style={{ background: "#ff7a18", y: cueBeadY }}
            />
          </div>
        </motion.div>
      )}
    </div>
  )
}
