import type { Metadata } from "next"
import { VisualPortfolio } from "@/components/visual/visual-portfolio"

export const metadata: Metadata = {
  title: "Visual Portfolio · Akash Vishwakarma",
  description:
    "A fully animated, SVG-illustrated journey through the work — forged in fire.",
}

export default function VisualPage() {
  return <VisualPortfolio />
}
