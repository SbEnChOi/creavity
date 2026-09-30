"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronLeft, FileText, Lightbulb, Loader2, MessageCircle, Plus, Search, Sparkles } from "lucide-react";
import { TOPICS, TOPIC_LABELS, REFINEMENT_PRESETS, type AiRequest, type Session, type Topic } from "@/lib/ai/schema";
import DraftPreview from "./DraftPreview";
import ResearchPanel from "./ResearchPanel";

type Props = { initialSession?: Session | null; sessions?: Session[]; initialSeed?: string; configured?: boolean; setupError?: string; demo?: boolean; transport?: (request: AiRequest) => Promise<Session> };

export default function IdeaStudio({ initialSession = null, sessions = [], initialSeed = "", configured = true, setupError, demo = false, transport }: Props) {
  const [session, setSession] = useState<Session | null>(initialSession);
  const [seed, setSeed] = useState(initialSeed);
  const [format, setFormat] = useState<"basic" | "extended">("basic");
  const [useResearch, setUseResearch] = useState(true);
  const [choices, setChoices] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rightTab, setRightTab] = useState<"intent" | "research">("intent");
  const inFlight = useRef(false);
  const currentQuestion = useRef<HTMLDivElement>(null);
  const state = session?.state;

  useEffect(() => { setChoices([]); setCustom(""); }, [session?.revision]);
  useEffect(() => { if (state?.question) currentQuestion.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }); }, [state?.question]);

  async function run(request: AiRequest) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError("");
    try {
      let next: Session;
      if (transport) next = await transport(request);
      else {
        const res = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(request) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "요청을 처리하지 못했습니다.");
        next = data.session;
      }
      setSession(next); setFeedback("");
      if (!demo) window.history.replaceState(null, "", `/ai?session=${next.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "연결에 문제가 생겼습니다. 다시 시도해주세요."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const base = session ? { id: session.id, revision: session.revision } : null;
  function back(topic: Topic) { if (base) void run({ action: "back", ...base, topic }); }
  function toggle(id: string) {
    setChoices((prev) => prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]);
  }
  function reset() {
    setSession(null); setError(""); setChoices([]); setCustom("");
    if (!demo) window.history.replaceState(null, "", "/ai");
  }
  const canAnswer = choices.length > 0 && (!choices.includes("other") || custom.trim().length > 0);

  return <div className="ai-studio mx-auto max-w-6xl px-5 py-8 md:px-10 md:py-10">
    {demo && <div className="mb-5 rounded-lg border border-border-default bg-surface px-4 py-3 text-sm leading-5">개발용 미리보기 · 예시 응답으로 화면 흐름을 확인합니다. 실제 AI·검색·저장은 실행되지 않습니다.</div>}
    <header className="mb-8 flex items-start justify-between gap-4">
      <div><div className="mb-3 flex items-center gap-2 text-sm text-foreground/70"><Sparkles size={14} /><span>CREAVY / IDEA STUDIO</span></div>
        <h1 className="text-3xl font-semibold tracking-tight">AI 구체화</h1>
        <p className="mt-2 text-base leading-6 text-foreground/75">떠오른 생각을, 내 의도대로 한 걸음 더.</p>
      </div>
      {session && <button type="button" disabled={busy} onClick={reset} className="ai-secondary shrink-0"><Plus size={14} />새 대화</button>}
    </header>
    {(setupError || !configured) && <p role="status" className="mb-6 rounded-lg bg-surface p-4 text-base leading-6 text-foreground/70">{setupError || "AI 연결 준비 중입니다. 운영자가 서버의 AI API 키를 설정하면 이용할 수 있습니다."}</p>}

    {!session ? <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="rounded-2xl border border-border-default bg-white p-5 md:p-7">
        <div className="mb-6 flex items-start gap-3"><span className="rounded-lg bg-surface p-2.5"><Lightbulb size={20} strokeWidth={1.5} /></span><div><h2 className="font-medium">짧은 메모에서 시작하기</h2><p className="mt-1 text-sm leading-5 text-foreground/70">필요한 내용을 선택형 질문으로 하나씩 확인한다.</p></div></div>
        <form onSubmit={(e) => { e.preventDefault(); void run({ action: "start", seed, format, useResearch }); }}>
          <label htmlFor="idea-seed" className="mb-2 block text-sm font-medium">아이디어 메모</label>
          <textarea id="idea-seed" value={seed} maxLength={8000} onChange={(e) => setSeed(e.target.value)} rows={8} placeholder={"예: 비 오는 날 학교에서 우산을 빌릴 수 있으면 좋겠다.\n빌리고 돌려주는 과정을 간단하게 만들고 싶어."} className="ai-textarea" />
          <div className="mt-2 text-right text-sm text-foreground/70">{seed.length.toLocaleString()} / 8,000</div>
          <fieldset className="mt-6"><legend className="mb-2 text-sm font-medium">정리 양식</legend><div className="grid gap-2 sm:grid-cols-2">
            {([ ["basic", "기본 양식", "발견 · 분석 · 확장 · 한 줄 정리"], ["extended", "기본 + 실행 계획", "대상 · 상황 · 첫 실험 · 성공 기준"] ] as const).map(([value, label, detail]) =>
              <button type="button" key={value} aria-pressed={format === value} onClick={() => setFormat(value)} className={`rounded-lg border p-3 text-left transition-colors ${format === value ? "border-accent/50 bg-accent/5" : "border-border-default hover:bg-surface"}`}><span className="text-base font-medium">{label}</span><span className="mt-1 block text-sm leading-5 text-foreground/70">{detail}</span></button>)}
          </div></fieldset>
          <label className="my-6 flex cursor-pointer items-start gap-2 text-sm leading-5 text-foreground/75"><input type="checkbox" checked={useResearch} onChange={(e) => setUseResearch(e.target.checked)} className="mt-1 accent-[#2563eb]" /><span>방향 확인 후 인터넷에서 관련 사례와 글·사진·영상 자료 찾기<br /><span className="text-foreground/70">관련 주제가 검색 서비스로 전달됩니다. 개인정보는 메모에서 지워주세요.</span></span></label>
          <div className="flex flex-col items-start gap-4 border-t border-border-default pt-5 sm:flex-row sm:items-center sm:justify-between"><span className="text-sm text-foreground/70">메모와 답변이 AI 서비스로 전달되며, 대화는 나만 볼 수 있어요.</span><button type="submit" disabled={seed.trim().length < 5 || busy || !configured || !!setupError} className="ai-primary shrink-0">{busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}함께 구체화하기</button></div>
        </form>
      </section>
      <aside className="space-y-6"><div className="rounded-xl bg-surface p-5"><h2 className="mb-5 text-sm font-medium text-foreground/70">생각이 정리되는 과정</h2><ol className="space-y-5">{[["01", "의도 이해", "선택형 질문과 기타 직접 작성"], ["02", "방향 확인", "대상과 목적을 확인한 뒤 정리"], ["03", "양식으로 정리", "초안 검토 후 새로 작성에 적용"]].map(([n,t,d]) => <li key={n} className="flex gap-3"><span className="text-sm text-foreground/60">{n}</span><div><p className="text-base font-medium">{t}</p><p className="mt-1 text-sm leading-5 text-foreground/70">{d}</p></div></li>)}</ol></div>
        {sessions.length > 0 && <section><h2 className="mb-3 text-sm font-medium text-foreground/70">최근 대화</h2><ul className="space-y-2">{sessions.map((s) => <li key={s.id}><Link href={`/ai?session=${s.id}`} className="block rounded-lg border border-border-default p-3 hover:bg-surface"><p className="line-clamp-2 text-base">{s.state.seed}</p><span className="mt-2 block text-sm text-foreground/70">{s.state.phase === "review" ? "초안 검토" : "구체화 중"} · {new Date(s.updated_at).toLocaleDateString("ko-KR")}</span></Link></li>)}</ul></section>}
      </aside>
    </div> : <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center gap-2 text-sm"><span className="rounded-full bg-surface px-3 py-1.5">{state?.phase === "questions" ? "01 · 선택하며 구체화" : state?.phase === "confirm" ? "02 · 방향 확인" : "03 · 초안 검토"}</span><span className="text-foreground/70">{state?.answers.length} / {TOPICS.length} 방향 확인</span><div className="ml-auto flex gap-1" aria-hidden="true">{TOPICS.map((t) => <span key={t} className={`h-1 w-4 rounded-full ${state?.answers.some((a) => a.topic === t) ? "bg-foreground" : "bg-border-default"}`} />)}</div></div>
        <details className="mb-6 rounded-xl border border-border-default p-4"><summary className="cursor-pointer text-sm font-medium text-foreground/75">처음 적은 메모</summary><p className="mt-3 whitespace-pre-wrap break-words text-base leading-7">{state?.seed}</p></details>
        {state?.phase !== "review" && state?.answers.map((a) => <div key={a.topic} className="mb-4 rounded-xl bg-surface p-4"><div className="flex items-center justify-between"><span className="text-sm text-foreground/70">{TOPIC_LABELS[a.topic]}</span><button type="button" onClick={() => back(a.topic)} disabled={busy} className="text-sm text-foreground/70 hover:underline">답변 수정</button></div><p className="mt-2 text-base leading-6">{a.value}</p></div>)}
        {state?.pendingAnswer && state.phase === "questions" && <div className="mb-4 rounded-xl bg-surface p-4"><p className="mb-2 text-sm text-foreground/70">조금 더 확인할 답변</p><p className="text-base leading-6">{state.pendingAnswer.value}</p></div>}
        {state?.refinementRequest && state.phase === "questions" && <p role="status" className="mb-4 rounded-xl bg-surface p-4 text-base leading-6">변경 전에 방향을 다시 확인한다.<span className="mt-2 block text-sm text-foreground/75">{state.refinementRequest}</span></p>}
        {state?.phase === "questions" && state.question && <div ref={currentQuestion} className="rounded-2xl border border-border-default p-5 md:p-6">
          <div className="mb-4 flex items-center gap-2 text-sm text-foreground/70"><MessageCircle size={15} /><span>크래비 AI · {TOPIC_LABELS[state.question.topic]}</span></div>
          <h2 className="text-xl font-semibold leading-8">{state.question.prompt}</h2><p className="mb-5 mt-2 text-sm leading-6 text-foreground/70">{state.question.reason}</p>
          <form onSubmit={(e) => { e.preventDefault(); if (base) void run({ action: "answer", ...base, choices, custom }); }}>
            <fieldset disabled={busy}><legend className="mb-3 text-sm font-medium text-accent">여러 개 선택 가능 · 기타와 함께 선택할 수 있다.</legend><div className="space-y-2">
              {[...state.question.options, { id: "other", label: "기타 · 직접 작성", detail: "선택지에 내 생각이 없어요." }].map((o, i) => <button type="button" key={o.id} aria-pressed={choices.includes(o.id)} onClick={() => toggle(o.id)} className={`ai-option ${choices.includes(o.id) ? "ai-option-selected" : ""}`}><span className="ai-option-number">{choices.includes(o.id) ? <Check size={13} /> : String.fromCharCode(65+i)}</span><span><span className="block text-base font-medium">{o.label}</span><span className="mt-1 block text-sm leading-5 text-foreground/70">{o.detail}</span></span></button>)}
            </div>{choices.includes("other") && <textarea aria-label="기타 답변" autoFocus value={custom} maxLength={2000} onChange={(e) => setCustom(e.target.value)} rows={3} placeholder="원하는 방향을 구체적으로 적어주세요." className="ai-textarea mt-3" />}</fieldset>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><button type="button" disabled={busy} onClick={() => base && void run({ action: "clarify", ...base })} className="text-sm text-foreground/70 hover:underline">선택하기 어려워요 · 더 물어봐주세요</button><button type="submit" disabled={!canAnswer || busy} className="ai-primary">{busy ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}답변하고 계속</button></div>
          </form>
        </div>}
        {state?.phase === "confirm" && <div className="rounded-2xl border border-border-default p-6"><div className="mb-3 flex items-center gap-2 text-sm text-foreground/70"><Check size={14} />정리 전, 방향 확인</div><h2 className="text-xl font-semibold">이 방향이 내 생각과 맞나요?</h2><p className="mt-3 text-base leading-7 text-foreground/75">위에 모은 답변을 확인해주세요. 다른 부분은 ‘답변 수정’으로 고칠 수 있어요. 확인한 답변을 바탕으로 기존 작성 양식에 맞춰 초안을 정리합니다.</p><button type="button" disabled={busy} onClick={() => base && void run({ action: "confirm", ...base })} className="ai-primary mt-6">{busy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}이 방향으로 정리해주세요</button></div>}
        {state?.pendingRefinement && <div role="status" className="rounded-xl border border-border-default bg-surface p-5 text-base leading-6"><p>이 요청은 ‘{TOPIC_LABELS[state.pendingRefinement.topic]}’ 변경으로 이어질 수 있어요. 방향을 바꾸려는 요청이 맞나요?</p><p className="mt-2 text-sm text-foreground/75">{state.pendingRefinement.feedback}</p><p className="mt-2 text-sm text-foreground/70">선택할 때까지 기존 답변과 초안을 유지합니다.</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => base && void run({ action: "confirm_refinement", ...base })} className="ai-primary">방향을 바꾸고 다시 확인</button><button type="button" disabled={busy} onClick={() => base && void run({ action: "cancel_refinement", ...base })} className="ai-secondary">기존 초안 유지</button></div></div>}
        {state?.phase === "review" && state.draft && <div className="rounded-2xl border border-border-default p-5 md:p-7"><div className="mb-6 flex items-center gap-2 text-sm text-foreground/70"><FileText size={14} />{state.format === "basic" ? "기본 작성 양식" : "기본 양식 + 실행 계획"} · 검토용 초안</div><DraftPreview draft={state.draft} />
          <div className="mt-8 border-t border-border-default pt-6"><label htmlFor="draft-feedback" className="mb-2 block text-sm font-medium">더 다듬고 싶은 부분</label><div className="mb-3 flex flex-wrap gap-2">{REFINEMENT_PRESETS.map((f) => <button key={f} type="button" onClick={() => setFeedback(f)} disabled={busy} className="rounded-full border border-border-default px-3 py-1.5 text-sm hover:bg-surface">{f.includes("간결") ? "간결하게 첨삭" : f.includes("평가") ? "객관적으로 평가" : "추가 아이디어"}</button>)}</div><textarea id="draft-feedback" value={feedback} maxLength={2000} onChange={(e) => setFeedback(e.target.value)} rows={3} placeholder="예: 원래 목적은 유지하고, 첫 실험을 더 작게 만들어줘." className="ai-textarea" /><div className="mt-3 flex justify-end"><button type="button" disabled={busy || !!state.pendingRefinement || feedback.trim().length < 3} onClick={() => base && void run({ action: "refine", ...base, feedback })} className="ai-secondary">다시 다듬기</button></div></div>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border-default pt-6"><button type="button" disabled={busy} onClick={() => back("goal")} className="flex items-center gap-1 text-sm text-foreground/70"><ChevronLeft size={13} />방향부터 다시 확인</button>{demo ? <span className="text-sm text-foreground/70">실제 연결 시 ‘새로 작성에 적용’ 가능</span> : <Link href={`/new?ai=${session.id}`} className={`ai-primary ${busy || state.pendingRefinement ? "pointer-events-none opacity-40" : ""}`}><ArrowRight size={14} />새로 작성에 적용</Link>}</div>
        </div>}
        {busy && <p role="status" className="mt-5 flex items-center gap-2 text-sm text-foreground/75"><Loader2 size={14} className="animate-spin" />{state?.phase === "confirm" && state.useResearch ? "관련 자료 검색과 초안 정리 중…" : "답변 정리 중…"}</p>}
        {error && <div role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-base leading-6 text-red-700">{error}{session && !demo && <Link href={`/ai?session=${session.id}`} className="ml-2 underline">저장된 대화 다시 열기</Link>}</div>}
      </section>
      <aside className="lg:sticky lg:top-8"><div className="mb-5 flex gap-4 border-b border-border-default">{([ ["intent", "확인한 방향"], ["research", "참고 자료"] ] as const).map(([value, label]) => <button key={value} type="button" onClick={() => setRightTab(value)} aria-pressed={rightTab === value} className={`border-b-2 pb-3 text-sm ${rightTab === value ? "border-accent font-semibold text-accent" : "border-transparent text-foreground/70"}`}>{label}</button>)}</div>
        {rightTab === "intent" ? <div className="space-y-4">{TOPICS.map((topic) => { const a = state?.answers.find((v) => v.topic === topic); return <div key={topic}><div className="mb-1 flex items-center gap-2 text-sm text-foreground/70">{a ? <Check size={12} /> : <span className="h-2 w-2 rounded-full bg-border-default" />}{TOPIC_LABELS[topic]}{a && <button type="button" onClick={() => back(topic)} disabled={busy} className="ml-auto hover:underline">수정</button>}</div><p className={`text-sm leading-6 ${a ? "text-foreground/75" : "text-foreground/60"}`}>{a?.value || "아직 확인 전"}</p></div>; })}<p className="border-t border-border-default pt-4 text-sm leading-5 text-foreground/70">선택하거나 직접 적은 답변을 기록한다. AI 제안은 따로 표시한다.</p></div> : <div className="space-y-5"><ResearchPanel research={state?.research ?? null} /><button type="button" disabled={busy} onClick={() => base && void run({ action: "research", ...base })} className="ai-secondary w-full"><Search size={13} />{state?.research ? "자료 다시 찾기" : "지금 자료 찾기"}</button></div>}
      </aside>
    </div>}
    {!session && error && <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-4 text-base text-red-700">{error}</p>}
  </div>;
}
