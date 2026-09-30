"use client";
import { useMemo } from "react";
import IdeaStudio from "@/components/ai/IdeaStudio";
import { createDemoTransport, DEMO_SEED } from "@/lib/ai/demo";

export default function DemoClient() {
  const transport = useMemo(() => createDemoTransport(), []);
  return <IdeaStudio demo initialSeed={DEMO_SEED} transport={transport} />;
}
