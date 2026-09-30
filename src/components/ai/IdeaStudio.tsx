"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, ChevronLeft, CloudCheck, Lightbulb, Loader2, MessageCircle, Plus, Search, Sparkles } from "lucide-react";
import { TOPICS, MODE_LABELS, dialogueMode, topicLabels, REFINEMENT_PRESETS, sessionSchema, type DialogueMode, type AiRequest, type Session, type Topic } from "@/lib/ai/schema";
import { composerKey, readComposer, saveComposer, type Composer } from "@/lib/ai/persistence";
import DraftPreview from "./DraftPreview";
import ResearchPanel from "./ResearchPanel";
import ShareIdea from "./ShareIdea";
import ConversationHistory from "./ConversationHistory";

type Props = { initialSession?: Session | null; sessions?: Session[]; initialSeed?: string; configured?: boolean; setupError?: string; demo?: boolean; storageScope?: string; sourceVisible?: boolean; onReset?: () => void; transport?: (request: AiRequest) => Promise<Session> };
export default function IdeaStudio({initialSession=null,sessions=[],initialSeed="",configured=true,setupError,demo=false,storageScope="preview",sourceVisible=true,onReset,transport}:Props) {
  const [session,setSession]=useState<Session|null>(initialSession);
  const [recent,setRecent]=useState(sessions);
  const [seed,setSeed]=useState(initialSeed);
  const [mode,setMode]=useState<DialogueMode>("explore");
  const [format,setFormat]=useState<"basic"|"extended">("basic");
  const [useResearch,setUseResearch]=useState(true);
  const [choices,setChoices]=useState<string[]>([]);
  const [custom,setCustom]=useState("");
  const [feedback,setFeedback]=useState("");
  const [focusDirection,setFocusDirection]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [localReady,setLocalReady]=useState(false);
  const [localAvailable,setLocalAvailable]=useState(true);
  const [online,setOnline]=useState(true);
  const [waitingId,setWaitingId]=useState<string|null>(null);
  const [rightTab,setRightTab]=useState<"intent"|"research">("intent");
  const inFlight=useRef(false);
  const heading=useRef<HTMLHeadingElement>(null);
  const pendingId=useRef<string|null>(null);
  const key=composerKey(storageScope);
  const state=session?.state;
  const activeMode=state?dialogueMode(state):mode;
  const labels=topicLabels(activeMode);
  const base=session?{id:session.id,revision:session.revision}:null;
  const processing=!!session?.processing_until&&new Date(session.processing_until).getTime()>Date.now();
  const disabled=busy||processing||!!waitingId;
  const focusCandidates=[...new Set([...(state?.answers.find(a=>a.topic==="solution")?.value.split(" / ")??[]),...(state?.draft?.suggestions??[])])].slice(0,6);
  const composer:Composer={seed,mode,format,useResearch,sessionId:session?.id??pendingId.current,revision:session?.revision??null,choices,custom,feedback,focusDirection};
  function persist(value:Composer) { try{setLocalAvailable(saveComposer(window.localStorage,key,value));}catch{setLocalAvailable(false);} }
  function accept(next:Session,clear=true) {
    setSession(next);setRecent(old=>[next,...old.filter(item=>item.id!==next.id)].slice(0,10));
    if(clear){setChoices([]);setCustom("");setFeedback("");setFocusDirection("");}
    pendingId.current=null;
    persist({...composer,sessionId:next.id,revision:next.revision,...(clear?{choices:[],custom:"",feedback:"",focusDirection:""}:{})});
    if(!demo)window.history.replaceState(null,"",`/ai?session=${next.id}`);
  }
  async function readSaved(id:string) {
    const response=await fetch(`/api/ai?id=${id}`,{cache:"no-store"});
    const data=await response.json();if(!response.ok)throw new Error(data.error);
    return sessionSchema.parse(data.session) as Session;
  }
  useEffect(()=>{
    let active=true;
    let cached:Composer|null=null;
    try{cached=readComposer(window.localStorage,key);}catch{setLocalAvailable(false);}
    if(cached){
      if(!demo&&initialSession&&!initialSeed&&!new URLSearchParams(window.location.search).has("session")&&!cached.sessionId&&cached.seed.trim()){
        setSession(null);setSeed(cached.seed);setMode(cached.mode);setFormat(cached.format);setUseResearch(cached.useResearch);
        setNotice("작성 중이던 새 메모를 불러왔어요. 이전 대화는 보관함에 남아 있어요.");
      }
      if(!initialSession&&(!initialSeed||demo)){setSeed(cached.seed);setMode(cached.mode);setFormat(cached.format);setUseResearch(cached.useResearch);}
      if(initialSession&&cached.sessionId===initialSession.id&&cached.revision===initialSession.revision){setChoices(cached.choices);setCustom(cached.custom);setFeedback(cached.feedback);setFocusDirection(cached.focusDirection);}
      else if(!demo&&!initialSession&&!initialSeed&&cached.sessionId&&new URLSearchParams(window.location.search).get("new")!=="1"){
        pendingId.current=cached.sessionId;
        setWaitingId(cached.sessionId);
        readSaved(cached.sessionId).then(next=>{if(!active)return;setSession(next);if(next.revision===cached.revision){setChoices(cached.choices);setCustom(cached.custom);setFeedback(cached.feedback);setFocusDirection(cached.focusDirection);}window.history.replaceState(null,"",`/ai?session=${next.id}`);}).catch(()=>{if(active)setNotice("이전에 적던 메모는 이 기기에 남아 있어요. 보관함에서 대화를 다시 찾을 수 있어요.");}).finally(()=>{if(active){pendingId.current=null;setWaitingId(null);}});
      }
    }
    setLocalReady(true);setOnline(navigator.onLine);
    const changed=()=>setOnline(navigator.onLine);
    window.addEventListener("online",changed);window.addEventListener("offline",changed);
    return()=>{active=false;window.removeEventListener("online",changed);window.removeEventListener("offline",changed);};
  // Each mounted studio is scoped to its authenticated user and server-selected session.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[key]);
  useEffect(()=>{if(localReady)persist(composer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[localReady,seed,mode,format,useResearch,session?.id,session?.revision,choices,custom,feedback,focusDirection,key]);
  useEffect(()=>{
    if(demo||!session||!session.processing_until||new Date(session.processing_until).getTime()<=Date.now())return;
    setWaitingId(session.id);
    const timer=window.setInterval(()=>{readSaved(session.id).then(next=>{if(next.revision!==session.revision||!next.processing_until||new Date(next.processing_until).getTime()<=Date.now()){accept(next,next.revision!==session.revision);setWaitingId(null);setNotice("저장된 대화를 불러왔어요.");}}).catch(()=>{setWaitingId(null);setError("저장된 대화를 불러오지 못했어요. 연결이 돌아오면 다시 불러와주세요.");});},5000);
    return()=>window.clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[demo,session?.id,session?.revision,session?.processing_until]);
  async function refreshSaved() {
    const id=session?.id??pendingId.current;
    if(!id)return;
    setBusy(true);setError("");
    try{const next=await readSaved(id);accept(next,next.revision!==(session?.revision??null));setWaitingId(null);setNotice("저장된 대화를 불러왔어요. 이어서 작성할 수 있어요.");}catch(e){setError(e instanceof Error?e.message:"대화를 불러오지 못했어요.");}finally{setBusy(false);}
  }
  async function run(request:AiRequest) {
    if(inFlight.current)return;
    inFlight.current=true;setBusy(true);setError("");setNotice("");
    let sent=request;
    let expectedId=session?.id??null;
    let expectedRevision=session?.revision??-1;
    if(request.action==="start"||request.action==="fork_focus"){
      expectedId=crypto.randomUUID();sent={...request,requestId:expectedId};pendingId.current=expectedId;
      expectedRevision=-1;
      persist({...composer,sessionId:expectedId,revision:null});
    }
    try{
      let next:Session;
      if(transport)next=await transport(sent);
      else{const response=await fetch("/api/ai",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(sent)});const data=await response.json();if(!response.ok)throw new Error(data.error||"요청을 처리하지 못했어요.");next=sessionSchema.parse(data.session) as Session;}
      accept(next);setWaitingId(null);heading.current?.focus();
    }catch(e){
      const message=e instanceof Error?e.message:"연결이 끊겼어요. 작성한 내용을 유지하고 다시 시도해주세요.";
      let recovered=false;
      if(!demo&&expectedId){try{const saved=await readSaved(expectedId);if(saved.revision>expectedRevision&&(saved.state.question||saved.state.phase!=="questions")){accept(saved);setNotice("응답 연결이 끊겼지만 대화는 저장됐어요. 최신 기록에서 이어갈 수 있어요.");recovered=true;}else{accept(saved,false);if(saved.processing_until&&new Date(saved.processing_until).getTime()>Date.now())setWaitingId(saved.id);}}catch{/* Keep the typed memo and answer locally when the network is unavailable. */}}
      if(!recovered)setError(message);
    }finally{inFlight.current=false;setBusy(false);}
  }
  function back(topic:Topic){if(base)void run({action:"back",...base,topic});}
  function reset(){setSession(null);setSeed("");setChoices([]);setCustom("");setFeedback("");setFocusDirection("");setError("");setNotice("");setWaitingId(null);pendingId.current=null;persist({...composer,seed:"",sessionId:null,revision:null,choices:[],custom:"",feedback:"",focusDirection:""});onReset?.();if(!demo)window.history.replaceState(null,"","/ai?new=1");}
  const canAnswer=choices.length>0&&(!choices.includes("other")||custom.trim().length>0);
  return <div className="ai-studio mx-auto max-w-6xl px-5 py-7 md:px-9 md:py-10">
    {demo&&<p className="mb-6 rounded-xl bg-surface px-4 py-3 text-sm leading-6 text-foreground/70">미리보기예요. 대화는 이 브라우저에 저장하며 실제 AI·검색은 실행하지 않아요.</p>}
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-sm font-medium text-accent"><Sparkles size={15}/>생각을 키우는 공간</div><h1 className="text-3xl font-semibold tracking-tight">AI 구체화</h1><p className="mt-2 text-base leading-7 text-foreground/70">{session?"여러 가능성을 발견하고, 마음에 드는 방향을 한 걸음 더 펼쳐보세요.":"정리되지 않은 메모도 좋아요. 대화하며 가능성을 찾아볼까요?"}</p></div><nav aria-label="아이디어 메뉴" className="flex flex-wrap items-center gap-2">{!demo&&<Link href="/ai/archive" className="ai-secondary">보관함</Link>}{session&&<button type="button" disabled={disabled} onClick={reset} className="ai-secondary"><Plus size={15}/>새 아이디어</button>}</nav></header>
    {(setupError||!configured)&&<p role="status" className="mb-6 rounded-xl bg-surface p-4 text-base leading-7">{setupError||"AI 연결을 준비하고 있어요. 잠시 후 이용해주세요."}</p>}
    {!online&&<p role="status" className="mb-5 rounded-xl border border-border-default bg-surface p-4 text-sm leading-6">인터넷 연결이 끊겼어요. 작성 중인 내용은 이 기기에 유지해요. 연결이 돌아오면 이어갈 수 있어요.</p>}
    {notice&&<p role="status" className="mb-5 rounded-xl bg-accent/5 px-4 py-3 text-sm leading-6 text-foreground/80">{notice}</p>}
    {!session?<div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_280px]"><section className="rounded-2xl border border-border-default p-5 md:p-7"><div className="mb-6 flex items-start gap-3"><span className="rounded-xl bg-surface p-3"><Lightbulb size={21} strokeWidth={1.5}/></span><div><h2 className="text-lg font-semibold">어떤 생각에서 시작할까요?</h2><p className="mt-1 text-sm leading-6 text-foreground/70">짧게 적어주시면 하나씩 질문할게요.</p></div></div>
      <form onSubmit={e=>{e.preventDefault();void run({action:"start",seed,format,useResearch,mode});}}><label htmlFor="idea-seed" className="mb-2 block text-sm font-semibold">아이디어 메모</label><textarea id="idea-seed" value={seed} maxLength={8000} onChange={e=>setSeed(e.target.value)} rows={6} placeholder={"문득 떠오른 아이디어나 해결하고 싶은 불편을 적어주세요.\n예: 읽다가 떠오른 생각을 책갈피에 남겨, 나중에 다시 꺼내 쓰고 싶어요."} className="ai-textarea"/><div className="mt-2 flex items-center justify-between text-xs text-foreground/65"><span>{localReady&&localAvailable?"작성 중인 메모도 이 기기에 저장해요":"메모를 적어보세요"}</span><span>{seed.length.toLocaleString()} / 8,000</span></div>
      <fieldset className="mt-7"><legend className="mb-3 text-sm font-semibold">어떤 대화를 나누고 싶나요?</legend><div className="grid gap-3 sm:grid-cols-2">{([["explore","가능성을 넓혀볼래요","활용 장면과 파생 기능을 탐색하고 나중에 쓸 아이디어로 보관해요."],["focus","실제로 써보고 싶어요","관심 있는 방향을 대상·방법·첫 실험으로 구체화해요."]] as const).map(([value,title,detail])=><button type="button" key={value} aria-pressed={mode===value} onClick={()=>{setMode(value);if(value==="explore")setFormat("basic");}} className={`rounded-xl border p-4 text-left transition-colors ${mode===value?"border-accent/50 bg-accent/5":"border-border-default hover:bg-surface"}`}><span className="flex items-center justify-between gap-2 text-base font-semibold">{title}{mode===value&&<Check size={16} className="shrink-0 text-accent"/>}</span><span className="mt-2 block break-keep text-sm leading-6 text-foreground/70">{detail}</span></button>)}</div><p className="mt-3 text-sm leading-6 text-foreground/65">먼저 넓게 탐색하고, 나중에 실행으로 이어가도 좋아요.</p></fieldset>
      {mode==="focus"&&<fieldset className="mt-5"><legend className="mb-2 text-sm font-semibold">정리할 내용</legend><div className="flex flex-wrap gap-2">{([["basic","아이디어 정리"],["extended","아이디어 + 실행 계획"]] as const).map(([value,title])=><button key={value} type="button" aria-pressed={format===value} onClick={()=>setFormat(value)} className={`rounded-lg border px-3 py-2 text-sm ${format===value?"border-accent/40 bg-accent/5":"border-border-default"}`}>{title}</button>)}</div></fieldset>}
      <label className="my-6 flex cursor-pointer items-start gap-3 text-sm leading-6 text-foreground/75"><input type="checkbox" checked={useResearch} onChange={e=>setUseResearch(e.target.checked)} className="mt-1.5 accent-[#2563eb]"/><span>방향을 확인한 뒤 관련 사례와 글·사진·영상을 찾아볼게요.<span className="mt-1 block text-xs text-foreground/65">검색 서비스에 관련 주제가 전달돼요. 개인정보는 메모에서 지워주세요.</span></span></label>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border-default pt-5"><p className="max-w-sm text-xs leading-6 text-foreground/65">메모와 답변은 AI 서비스로 전달돼요.<br/>비공개 대화는 본인과 관리자만 볼 수 있어요.</p><button type="submit" disabled={seed.trim().length<5||disabled||!localReady||!online||!configured||!!setupError} className="ai-primary">{busy?<Loader2 size={16} className="animate-spin"/>:<ArrowRight size={16}/>}대화 시작하기</button></div></form></section>
      <aside className="space-y-6"><div className="rounded-2xl bg-surface p-5"><h2 className="text-sm font-semibold">생각을 정리하는 세 단계</h2><ol className="mt-5 space-y-5">{[["01","가능성을 발견해요","여러 답과 기타를 함께 고를 수 있어요."],["02","내 생각으로 남겨요","선택한 내용과 미정인 부분을 확인해요."],["03","필요할 때 이어가요","보관한 아이디어를 실행으로 발전시켜요."]].map(([n,t,d])=><li key={n} className="flex gap-3"><span className="text-xs text-foreground/60">{n}</span><div><p className="text-sm font-semibold">{t}</p><p className="mt-1 break-keep text-sm leading-6 text-foreground/70">{d}</p></div></li>)}</ol></div>{recent.length>0&&<section><h2 className="mb-3 text-sm font-semibold">이어서 생각해볼까요?</h2><ul className="space-y-3">{recent.slice(0,5).map(item=><li key={item.id}>{demo?<button type="button" onClick={()=>accept(item)} className="block w-full rounded-xl border border-border-default p-4 text-left hover:bg-surface"><p className="line-clamp-2 text-base font-medium">{item.state.draft?.title||item.state.seed}</p><p className="mt-2 text-xs text-foreground/65">{MODE_LABELS[dialogueMode(item.state)]} · {item.state.phase==="review"?"정리 완료":"진행 중"}</p></button>:<Link href={`/ai?session=${item.id}`} className="block rounded-xl border border-border-default p-4 hover:bg-surface"><p className="line-clamp-2 text-base font-medium">{item.state.draft?.title||item.state.seed}</p><p className="mt-2 text-xs text-foreground/65">{MODE_LABELS[dialogueMode(item.state)]} · {item.state.phase==="review"?"정리 완료":"진행 중"}</p></Link>}</li>)}</ul></section>}</aside></div>:
      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_280px]"><section className="min-w-0"><div className="mb-5 flex flex-wrap items-center gap-3"><span className="rounded-full bg-accent/5 px-3 py-1 text-sm font-medium text-accent">{MODE_LABELS[activeMode]}</span><span className="ml-auto flex items-center gap-1.5 text-xs text-foreground/65"><CloudCheck size={14}/>{demo?"이 브라우저에 저장됨":"대화 저장됨"}</span></div>
      {state?.sourceSessionId&&sourceVisible&&!demo&&<Link href={`/ai?session=${state.sourceSessionId}`} className="mb-4 inline-block text-sm text-accent hover:underline">원래 탐색 기록 보기</Link>}
      {state?.focusDirection&&<details className="mb-5 rounded-xl bg-surface p-4"><summary className="cursor-pointer text-sm font-medium">이번에 구체화할 방향</summary><p className="mt-3 whitespace-pre-wrap text-base leading-7">{state.focusDirection}</p></details>}
      <div className="mb-5 flex items-center gap-3 text-sm text-foreground/70"><span>{state?.phase==="questions"?`${(state.answers.length??0)+1}번째 생각 · ${state.question?labels[state.question.topic]:"대화 준비"}`:state?.phase==="confirm"?"선택한 내용 확인":"정리된 아이디어"}</span><span className="ml-auto text-xs">{state?.answers.length} / {TOPICS.length}</span></div>
      {state?.phase==="questions"&&!state.question&&<div className="rounded-2xl border border-border-default p-6"><h2 className="text-xl font-semibold">메모는 저장됐어요</h2><p className="mt-3 text-base leading-7 text-foreground/70">{processing?"첫 질문을 준비하고 있어요. 잠시 기다리면 이어서 보여드릴게요.":"대화를 이어서 첫 질문을 받아볼까요?"}</p><button type="button" disabled={disabled||!online} onClick={()=>base&&void run({action:"resume",...base})} className="ai-primary mt-5">{processing?<Loader2 size={16} className="animate-spin"/>:<ArrowRight size={16}/>}저장된 메모로 이어가기</button></div>}
      {state?.pendingAnswer&&<div className="mb-4 rounded-xl bg-surface p-4"><p className="mb-2 text-xs font-semibold text-foreground/65">조금 더 확인하고 싶은 답변</p><p className="text-base leading-7">{state.pendingAnswer.value}</p></div>}
      {state?.refinementRequest&&state.phase==="questions"&&<p className="mb-4 rounded-xl bg-surface p-4 text-sm leading-7">정리 방향을 바꾸기 전에 생각을 다시 확인할게요.<span className="mt-2 block">{state.refinementRequest}</span></p>}
      {state?.phase==="questions"&&state.question&&<div className="rounded-2xl border border-border-default p-5 md:p-7"><div className="mb-4 flex items-center gap-2 text-xs font-medium text-foreground/65"><MessageCircle size={15}/>크래비 AI</div><h2 ref={heading} tabIndex={-1} className="break-keep text-[22px] font-semibold leading-9 tracking-tight outline-none">{state.question.prompt}</h2>{state.question.reason&&<details className="mt-3"><summary className="cursor-pointer text-sm text-foreground/65">이 질문을 하는 이유</summary><p className="mt-2 break-keep text-sm leading-7 text-foreground/75">{state.question.reason}</p></details>}
        <form className="mt-6" onSubmit={e=>{e.preventDefault();if(base)void run({action:"answer",...base,choices,custom});}}><fieldset disabled={disabled}><legend className="mb-3 text-sm text-foreground/70">여러 개 골라도 좋아요. 기타로 직접 적을 수도 있어요.</legend><div className="grid gap-3 sm:grid-cols-2">{[...state.question.options,{id:"other",label:"기타 · 직접 작성",detail:"선택지에 없는 생각을 적어주세요."}].map(option=><button type="button" key={option.id} aria-pressed={choices.includes(option.id)} onClick={()=>setChoices(old=>old.includes(option.id)?old.filter(id=>id!==option.id):[...old,option.id])} className={`ai-option ${choices.includes(option.id)?"ai-option-selected":""}`}><span className="ai-option-number" aria-hidden="true">{choices.includes(option.id)&&<Check size={14}/>}</span><span className="min-w-0"><span className="block break-keep text-base font-semibold leading-7">{option.label}</span><span className="mt-1 block break-keep text-sm leading-6 text-foreground/70">{option.detail}</span></span></button>)}</div>{choices.includes("other")&&<textarea aria-label="기타 답변" autoFocus value={custom} maxLength={2000} onChange={e=>setCustom(e.target.value)} rows={3} placeholder="떠오른 생각을 자유롭게 적어주세요." className="ai-textarea mt-4"/>}</fieldset><div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border-default pt-5"><button type="button" disabled={disabled||!online} onClick={()=>base&&void run({action:"clarify",...base})} className="text-sm text-foreground/70 hover:underline">다른 선택지로 물어봐주세요</button><div className="flex items-center gap-3"><span className="text-xs text-foreground/65" aria-live="polite">{choices.length>0?`${choices.length}개 선택`:"선택을 기다리고 있어요"}</span><button type="submit" disabled={!canAnswer||disabled||!online} className="ai-primary">{busy?<Loader2 size={16} className="animate-spin"/>:<ArrowRight size={16}/>}이 답변으로 이어가기</button></div></div></form></div>}
      {state?.phase==="confirm"&&<div className="rounded-2xl border border-border-default p-5 md:p-7"><h2 className="text-xl font-semibold">{activeMode==="explore"?"이 가능성들을 기록으로 남길까요?":"이 방향으로 정리해볼까요?"}</h2><p className="mt-3 text-base leading-7 text-foreground/70">{activeMode==="explore"?"하나의 실행 방향을 정하지 않아도 괜찮아요. 관심 있는 가능성과 미정인 부분을 함께 남겨둘게요.":"선택한 내용을 바탕으로 아이디어와 실행 방법을 정리할게요."}</p><div className="mt-6 space-y-4">{state.answers.map(answer=><div key={answer.topic} className="rounded-xl bg-surface p-4"><div className="flex justify-between gap-3"><p className="text-sm font-semibold">{labels[answer.topic]}</p><button type="button" disabled={disabled} onClick={()=>back(answer.topic)} className="text-xs text-foreground/65 hover:underline">답변 수정</button></div><p className="mt-2 whitespace-pre-wrap text-base leading-7">{answer.value}</p></div>)}</div><button type="button" disabled={disabled||!online} onClick={()=>base&&void run({action:"confirm",...base})} className="ai-primary mt-6">{busy?<Loader2 size={16} className="animate-spin"/>:<Sparkles size={16}/>}아이디어 정리하기</button></div>}
      {state?.pendingRefinement&&<div role="status" className="mb-5 rounded-xl border border-accent/20 bg-accent/5 p-5 text-base leading-7"><p>‘{labels[state.pendingRefinement.topic]}’이 달라질 수 있어요. 방향을 바꾸려는 요청이 맞나요?</p><p className="mt-2 text-sm">{state.pendingRefinement.feedback}</p><div className="mt-4 flex flex-wrap gap-2"><button type="button" disabled={disabled} onClick={()=>base&&void run({action:"confirm_refinement",...base})} className="ai-primary">방향을 바꾸고 다시 확인</button><button type="button" disabled={disabled} onClick={()=>base&&void run({action:"cancel_refinement",...base})} className="ai-secondary">기존 방향 유지</button></div></div>}
      {state?.phase==="review"&&state.draft&&<div className="rounded-2xl border border-border-default p-5 md:p-7"><div className="mb-7 flex flex-wrap items-center justify-between gap-3 border-b border-border-default pb-5"><p className="text-sm text-foreground/65">내 생각을 정리한 기록</p>{!demo&&<ShareIdea session={session} disabled={disabled||!!state.pendingRefinement}/>}</div><DraftPreview draft={state.draft}/>
        {activeMode==="explore"&&<details className="mt-8 rounded-xl border border-accent/20 bg-accent/5 p-5"><summary className="cursor-pointer text-base font-semibold">마음에 드는 가능성을 실행으로 이어가기</summary><p className="mt-3 break-keep text-sm leading-7 text-foreground/70">지금의 탐색 기록은 남겨둘게요. 더 구체화하고 싶은 방향을 골라 새 대화로 이어갈 수 있어요.</p><div className="my-4 flex flex-wrap gap-2">{focusCandidates.map((candidate,index)=><button type="button" key={index} disabled={disabled} onClick={()=>setFocusDirection(old=>(old?`${old}\n${candidate}`:candidate).slice(0,2000))} className="rounded-lg border border-border-default bg-white px-3 py-2 text-left text-sm leading-6 hover:bg-surface">{candidate}</button>)}</div><form onSubmit={e=>{e.preventDefault();if(base)void run({action:"fork_focus",...base,direction:focusDirection});}}><label htmlFor="focus-direction" className="mb-2 block text-sm font-medium">구체화할 방향</label><textarea id="focus-direction" value={focusDirection} maxLength={2000} onChange={e=>setFocusDirection(e.target.value)} rows={3} className="ai-textarea" placeholder="여러 기능을 함께 골라도 좋아요. 직접 적을 수도 있어요."/><button type="submit" disabled={disabled||!!state.pendingRefinement||focusDirection.trim().length<3||!online} className="ai-primary mt-4"><ArrowRight size={15}/>이 방향으로 새 대화 시작</button></form></details>}
        <details className="mt-7 border-t border-border-default pt-5"><summary className="cursor-pointer text-base font-semibold">더 다듬고 싶은 부분이 있나요?</summary><div className="mt-4 flex flex-wrap gap-2">{REFINEMENT_PRESETS.map(preset=><button key={preset} type="button" onClick={()=>setFeedback(preset)} disabled={disabled} className="ai-secondary">{preset.includes("간결")?"문장 다듬기":preset.includes("평가")?"장점과 한계 살펴보기":"새 가능성 더하기"}</button>)}</div><textarea aria-label="다듬기 요청" value={feedback} maxLength={2000} onChange={e=>setFeedback(e.target.value)} rows={3} placeholder="어떤 부분을 다듬고 싶나요?" className="ai-textarea mt-4"/><div className="mt-3 flex justify-end"><button type="button" disabled={disabled||!!state.pendingRefinement||feedback.trim().length<3||!online} onClick={()=>base&&void run({action:"refine",...base,feedback})} className="ai-secondary">요청한 내용으로 다듬기</button></div></details>
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-border-default pt-5"><button type="button" disabled={disabled} onClick={()=>back("goal")} className="flex items-center gap-1 text-sm text-foreground/70"><ChevronLeft size={14}/>방향 다시 살펴보기</button>{demo?<span className="text-sm text-foreground/65">운영 사이트에서 작성·공유할 수 있어요.</span>:<Link href={`/new?ai=${session.id}`} className={`ai-primary ${disabled||state.pendingRefinement?"pointer-events-none opacity-40":""}`}><ArrowRight size={15}/>문서로 작성하기</Link>}</div></div>}
      {busy&&<p role="status" className="mt-5 flex items-center gap-2 text-sm text-foreground/70"><Loader2 size={15} className="animate-spin"/>{state?.phase==="confirm"&&state.useResearch?"관련 자료를 찾고 정리하고 있어요…":"생각을 이어갈 질문을 준비하고 있어요…"}</p>}
      {!demo&&<ConversationHistory key={`${session.id}:${session.revision}`} session={session}/>}</section>
      <aside className="min-w-0 rounded-2xl border border-border-default p-5 lg:sticky lg:top-6"><div className="mb-5 flex gap-5 border-b border-border-default">{([["intent","생각 노트"],["research","참고 자료"]] as const).map(([value,title])=><button type="button" key={value} onClick={()=>setRightTab(value)} aria-pressed={rightTab===value} className={`border-b-2 pb-3 text-sm ${rightTab===value?"border-accent font-semibold text-accent":"border-transparent text-foreground/65"}`}>{title}</button>)}</div>{rightTab==="intent"?<div className="space-y-4"><details><summary className="cursor-pointer text-sm font-medium">처음 적은 메모</summary><p className="mt-3 whitespace-pre-wrap break-keep text-sm leading-7 text-foreground/75">{state?.seed}</p></details><ol className="space-y-3 border-t border-border-default pt-4">{TOPICS.map(topic=>{const answer=state?.answers.find(a=>a.topic===topic);return <li key={topic}><div className="flex items-center gap-2 text-sm"><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${answer?"bg-accent/10 text-accent":"bg-surface text-foreground/40"}`}>{answer?<Check size={12}/>:<span className="h-1.5 w-1.5 rounded-full bg-border-default"/>}</span><span className={state?.question?.topic===topic?"font-semibold":"text-foreground/70"}>{labels[topic]}</span></div>{answer&&<details className="ml-7 mt-1"><summary className="cursor-pointer text-xs leading-6 text-foreground/65">선택한 내용 보기</summary><p className="mt-2 whitespace-pre-wrap break-keep text-sm leading-7 text-foreground/75">{answer.value}</p><button type="button" disabled={disabled} onClick={()=>back(topic)} className="mt-2 text-xs text-accent hover:underline">이 답변부터 다시 확인</button></details>}</li>;})}</ol><p className="border-t border-border-default pt-4 text-xs leading-6 text-foreground/65">내 답변을 보관해요. 이전 답변을 바꾸면 그 뒤의 방향은 다시 확인하고, 기존 답변은 대화 기록에 남겨요.</p></div>:<div className="space-y-5"><ResearchPanel research={state?.research??null}/><button type="button" disabled={disabled||!online} onClick={()=>base&&void run({action:"research",...base})} className="ai-secondary w-full"><Search size={15}/>{state?.research?"자료 더 찾아보기":"관련 자료 찾아보기"}</button></div>}</aside></div>}
    {error&&<div role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-7 text-red-800"><p>{error}</p><p className="mt-1">작성한 내용은 지우지 않았어요.</p>{!demo&&(session||pendingId.current)&&<button type="button" onClick={()=>void refreshSaved()} disabled={busy} className="mt-2 underline">저장된 대화 불러오기</button>}</div>}
    {!localAvailable&&<p role="status" className="mt-4 text-sm leading-6 text-foreground/70">이 브라우저에 작성 중인 내용을 저장하지 못했어요. 답변을 제출하면 운영 보관함에 저장돼요.</p>}
  </div>;
}
