"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, Globe, Lock, Share2, Users, X } from "lucide-react";
import type { Session } from "@/lib/ai/schema";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Share = { id: string; visibility: "private" | "custom" | "public"; recipient_ids: string[] };
export default function ShareIdea({ session, disabled }: { session: Session; disabled?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [visibility, setVisibility] = useState<Share["visibility"]>("private");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [people, setPeople] = useState<{ id: string; display_name: string | null }[]>([]);
  const [share, setShare] = useState<Share | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    let active = true;
    setBusy(true); setError(""); setLoaded(false); setMessage("");
    Promise.all([fetch(`/api/ai/share?id=${session.id}`, { cache: "no-store" }).then(async r => { const value = await r.json(); if (!r.ok) throw new Error(value.error); return value; }), createSupabaseBrowserClient().from("profiles").select("id,display_name").order("display_name")]).then(([data, members]) => {
      if (!active) return;
      setShare(data.share); setVisibility(data.share?.visibility ?? "private"); setRecipients(data.share?.recipient_ids ?? []); setPeople(members.data ?? []); setLoaded(true);
    }).catch(e => { if (active) setError(e instanceof Error ? e.message : "공유 설정을 불러오지 못했어요."); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [open, session.id]);
  function close() { dialog.current?.close(); setOpen(false); trigger.current?.focus(); }
  async function save() {
    setBusy(true); setError(""); setMessage("");
    try {
      const res = await fetch("/api/ai/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: session.id, revision: session.revision, visibility, recipients }) });
      const data = await res.json(); if (!res.ok) throw new Error(data.error);
      setShare(data.share); setMessage(visibility === "private" ? "공유를 해제했어요." : "현재 정리본을 공유했어요. 링크를 복사해 전달할 수 있어요.");
    } catch (e) { setError(e instanceof Error ? e.message : "공유하지 못했어요."); } finally { setBusy(false); }
  }
  async function copy() {
    if (!share) return;
    try { await navigator.clipboard.writeText(`${window.location.origin}/ai-share/${share.id}`); setMessage("공유 링크를 복사했어요."); } catch { setMessage("아래 링크를 직접 복사해주세요."); }
  }
  return <><button ref={trigger} type="button" onClick={() => setOpen(true)} disabled={disabled} className="ai-secondary"><Share2 size={16} />아이디어 공유</button>
    <dialog ref={dialog} onCancel={close} className="w-[min(92vw,560px)] rounded-2xl border border-border-default p-0 backdrop:bg-black/30">
      <div className="p-6 md:p-8"><div className="mb-3 flex items-center justify-between"><h2 className="text-xl font-semibold">정리한 아이디어 공유하기</h2><button type="button" aria-label="공유 설정 닫기" onClick={close} className="rounded-lg p-2 hover:bg-surface"><X size={18}/></button></div>
        <p className="mb-6 text-sm leading-6 text-foreground/70">정리본과 참고 자료만 공유해요. 원문 메모와 비공개 대화는 포함하지 않아요. 수정한 정리본은 공유 설정을 다시 저장해야 반영돼요.</p>
        <fieldset disabled={busy || !loaded}><legend className="mb-3 text-sm font-medium">누가 볼 수 있나요?</legend><div className="space-y-2">{([
          ["private", "나만 보기", "기존 공유 링크에서도 내용을 볼 수 없어요.", Lock], ["custom", "선택한 사용자", "로그인한 공유 대상만 볼 수 있어요.", Users], ["public", "링크가 있는 누구나", "로그인 없이 정리본을 볼 수 있어요.", Globe],
        ] as const).map(([value,title,detail,Icon]) => <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${visibility === value ? "border-accent/40 bg-accent/5" : "border-border-default"}`}><input type="radio" name="share-visibility" value={value} checked={visibility===value} onChange={() => setVisibility(value)} className="mt-1 accent-[#2563eb]"/><Icon size={17} className="mt-1 shrink-0"/><span><span className="block font-medium">{title}</span><span className="mt-1 block text-sm leading-6 text-foreground/70">{detail}</span></span></label>)}</div>
        {visibility === "custom" && <div className="mt-4 max-h-44 overflow-auto rounded-xl border border-border-default p-3">{people.filter(p=>p.id!==session.user_id).map(p=><label key={p.id} className="flex cursor-pointer items-center gap-3 rounded-lg p-2 hover:bg-surface"><input type="checkbox" checked={recipients.includes(p.id)} onChange={()=>setRecipients(old=>old.includes(p.id)?old.filter(id=>id!==p.id):[...old,p.id])} className="accent-[#2563eb]"/>{p.display_name || "이름 없는 사용자"}</label>)}</div>}</fieldset>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}{message && <p role="status" className="mt-4 flex items-start gap-2 text-sm leading-6"><Check size={16} className="mt-1 shrink-0"/>{message}</p>}
        {share && share.visibility !== "private" && <div className="mt-4 rounded-xl bg-surface p-4"><label htmlFor="share-url" className="mb-2 block text-sm font-medium">공유 링크</label><input id="share-url" readOnly value={`${typeof window === "undefined" ? "" : window.location.origin}/ai-share/${share.id}`} className="w-full rounded-md border border-border-default bg-white p-2 text-sm"/><div className="mt-3 flex gap-2"><button type="button" onClick={copy} className="ai-secondary"><Copy size={14}/>링크 복사</button><Link href={`/ai-share/${share.id}`} target="_blank" className="ai-secondary">정리본 보기</Link></div></div>}
        <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={close} className="ai-secondary">닫기</button><button type="button" disabled={busy || !loaded || visibility === "custom" && !recipients.length} onClick={save} className="ai-primary">{busy ? "불러오는 중…" : "공유 설정 저장"}</button></div>
      </div>
    </dialog></>;
}
