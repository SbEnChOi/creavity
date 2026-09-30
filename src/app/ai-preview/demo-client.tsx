"use client";
import { useEffect, useMemo, useState } from "react";
import IdeaStudio from "@/components/ai/IdeaStudio";
import { createDemoTransport, DEMO_SEED } from "@/lib/ai/demo";
import { readDemo, saveDemo } from "@/lib/ai/persistence";
import type { Session } from "@/lib/ai/schema";

export default function DemoClient() {
  const [saved,setSaved] = useState<{sessions:Session[];lastId:string|null}|null>(null);
  useEffect(()=>{try{setSaved(readDemo(window.localStorage));}catch{setSaved({sessions:[],lastId:null});}},[]);
  const transport = useMemo(() => createDemoTransport(saved?.sessions??[],(sessions,lastId)=>{try{saveDemo(window.localStorage,sessions,lastId);}catch{/* The preview remains usable if browser storage is unavailable. */}}), [saved]);
  if(!saved)return <p role="status" className="px-8 py-12 text-base text-foreground/70">저장된 미리보기를 불러오고 있어요…</p>;
  function reset(){try{const current=readDemo(window.localStorage);saveDemo(window.localStorage,current.sessions,null);}catch{/* Nothing to clear. */}}
  return <IdeaStudio demo initialSeed={DEMO_SEED} initialSession={saved.sessions.find(session=>session.id===saved.lastId)??null} sessions={[...saved.sessions].reverse()} storageScope="preview" onReset={reset} transport={transport} />;
}
