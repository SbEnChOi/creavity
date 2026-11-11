"use client";
import { useEffect, useMemo, useState } from "react";
import IdeaStudio from "@/components/ai/IdeaStudio";
import { createDemoTransport, DEMO_SEED } from "@/lib/ai/demo";
import { readDemo, saveDemo } from "@/lib/ai/persistence";
import { newMemoState } from "@/lib/ai/memo";
import type { Session } from "@/lib/ai/schema";

export default function DemoClient() {
  const [saved,setSaved] = useState<{sessions:Session[];lastId:string|null}|null>(null);
  useEffect(()=>{try{setSaved(readDemo(window.localStorage));}catch{setSaved({sessions:[],lastId:null});}},[]);
  const transport = useMemo(() => createDemoTransport(saved?.sessions??[],(sessions,lastId)=>{try{saveDemo(window.localStorage,sessions,lastId);}catch{/* The preview remains usable if browser storage is unavailable. */}}), [saved]);
  if(!saved)return <p role="status" className="px-8 py-12 text-base text-foreground/70">저장된 미리보기를 불러오고 있어요…</p>;
  async function saveMemo(seed:string,id:string):Promise<Session>{
    const current=readDemo(window.localStorage);
    const existing=current.sessions.find(item=>item.id===id);
    if(existing)return existing;
    const memo:Session={id,revision:0,state:newMemoState({action:"start",seed,mode:"explore",format:"basic",useResearch:false}),updated_at:new Date().toISOString()};
    if(!saveDemo(window.localStorage,[...current.sessions,memo],id))throw new Error("이 브라우저에 메모를 저장하지 못했어요.");
    setSaved({sessions:[...current.sessions,memo],lastId:id});
    return memo;
  }
  function reset(){try{const current=readDemo(window.localStorage);saveDemo(window.localStorage,current.sessions,null);}catch{/* Nothing to clear. */}}
  return <IdeaStudio demo initialSeed={DEMO_SEED} initialSession={saved.sessions.find(session=>session.id===saved.lastId)??null} sessions={[...saved.sessions].reverse()} storageScope="preview" onReset={reset} transport={transport} saveMemo={saveMemo} />;
}
