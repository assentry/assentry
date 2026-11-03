"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "../../lib/useReducedMotion";
import { StaticTrustNetwork } from "./StaticTrustNetwork";

const TrustNetworkScene = dynamic(() => import("./TrustNetworkScene"), { ssr: false });

export function HeroVisual() {
  const reducedMotion = useReducedMotion();

  return (
    <div className="relative h-[460px] w-full sm:h-[560px]">
      {reducedMotion ? <StaticTrustNetwork /> : <TrustNetworkScene />}
    </div>
  );
}
