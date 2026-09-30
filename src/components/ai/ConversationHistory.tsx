"use client";
import { useState } from "react";
import { draftSchema, questionSchema, type Session } from "@/lib/ai/schema";
import type { ConversationEntry } from "@/lib/ai/messages";
import DraftPreview from "./DraftPreview";
import FormattedText from "../FormattedText";
export function ConversationEntries({ messages }: { messages: ConversationEntry[] }) {
  return <ol className="space-y-5">{messages.map((entry,index)=>{
    const question = questionSchema.safeParse(entry.payload?.question);
    const draft = draftSchema.safeParse(entry.payload?.draft);
    return <li key={index} className={`rounded-xl border border-border-default p-4 ${entry.role === "user" ? "bg-surface" : "bg-white"}`}><p className="mb-2 text-xs font-semibold text-foreground/65">{entry.role==="user"?"사용자":"크래비 AI"}</p>{draft.success?<DraftPreview draft={draft.data}/>:<><div className="text-base leading-7"><FormattedText value={entry.text}/></div>{question.success&&<ul className="mt-3 space-y-2 text-sm leading-6 text-foreground/75">{question.data.options.map(option=><li key={option.id}><span className="font-medium">{option.label}</span>{option.detail&&` — ${option.detail}`}</li>)}</ul>}</>}</li>;
  })}</ol>;
}
export default function ConversationHistory({ session }: { session: Session }) {
  const [messages,setMessages] = useState<ConversationEntry[]|null>(null);
  const [error,setError] = useState("");
  const [busy,setBusy] = useState(false);
  async function load() {
    if(messages || busy) return;
    setBusy(true); setError("");
    try { const response = await fetch(`/api/ai?id=${session.id}&history=1`,{cache:"no-store"}); const data=await response.json(); if(!response.ok) throw new Error(data.error); setMessages(data.messages); } catch(e) { setError(e instanceof Error?e.message:"대화 기록을 불러오지 못했어요."); } finally { setBusy(false); }
  }
  return <details className="mt-6 rounded-xl border border-border-default p-4" onToggle={e=>{if(e.currentTarget.open)void load();}}><summary className="cursor-pointer text-sm font-medium">대화 기록 보기</summary><div className="mt-5">{busy&&<p role="status">기록을 불러오고 있어요…</p>}{error&&<p role="alert">{error}<button type="button" onClick={load} className="ml-2 underline">다시 불러오기</button></p>}{messages&&messages.length>0?<ConversationEntries messages={messages}/>:!busy&&!error&&<div className="space-y-4"><p className="text-sm text-foreground/70">기존 대화는 저장된 질문과 답변을 보여드려요.</p>{(session.state.history??session.state.answers).map((a,index)=><div key={index} className="rounded-xl bg-surface p-4"><p className="font-medium leading-7">{a.question}</p><p className="mt-2 whitespace-pre-wrap text-base leading-7">{a.value}</p></div>)}</div>}</div></details>;
}
