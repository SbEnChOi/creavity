import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MODE_LABELS, sessionSchema } from "@/lib/ai/schema";
import AdminAIEditor from "./session-editor";
import type { ConversationEntry } from "@/lib/ai/messages";
export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;
type Row = { id: string; user_id: string; updated_at: string; seed: string; mode: "explore" | "focus" | null; phase: string; title: string | null };
export default async function AdminAI({ searchParams }: { searchParams: Promise<{ q?: string; owner?: string; page?: string; session?: string }> }) {
  const params = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/login");
  const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!me?.is_admin) redirect("/dashboard");
  const q = (params.q ?? "").trim().slice(0, 200);
  const owner = z.string().uuid().safeParse(params.owner).success ? params.owner! : "";
  const page = /^\d+$/.test(params.page ?? "") ? Math.max(1,Math.min(100000,Number(params.page))) : 1;
  const { data: people } = await supabase.from("profiles").select("id,display_name").order("display_name");
  const members = people ?? [];
  const names = Object.fromEntries(members.map(p=>[p.id,p.display_name || "이름 없는 사용자"]));
  let query = supabase.from("ai_sessions").select("id,user_id,updated_at,seed:state->>seed,mode:state->>mode,phase:state->>phase,title:state->draft->>title", { count:"exact" });
  if (q) query = query.ilike("state->>seed", `%${q.replace(/[\\%_]/g,"\\$&")}%`);
  if (owner) query = query.eq("user_id",owner);
  const { data, count, error } = await query.order("updated_at",{ascending:false}).range((page-1)*PAGE_SIZE,page*PAGE_SIZE-1);
  const id = z.string().uuid().safeParse(params.session).success ? params.session! : "";
  const { data: selected } = id ? await supabase.from("ai_sessions").select("id,user_id,revision,state,updated_at,processing_until").eq("id",id).maybeSingle() : {data:null};
  const parsed = sessionSchema.safeParse(selected);
  const { data: messages } = id ? await supabase.from("ai_session_messages").select("role,text,payload").eq("session_id",id).order("revision").order("entry_number") : {data:[]};
  const { data: events } = id ? await supabase.from("admin_ai_events").select("id,action,actor_id,created_at").eq("session_id",id).order("created_at",{ascending:false}).limit(20) : {data:[]};
  const url = (patch: Record<string,string>) => `/admin/ai?${new URLSearchParams({ ...(q?{q}:{}), ...(owner?{owner}:{}), page:String(page), ...patch })}`;
  return <div className="mx-auto max-w-6xl px-5 py-10 md:px-10"><header className="mb-8 flex flex-wrap justify-between gap-4"><div><Link href="/admin" className="text-sm text-foreground/70 hover:underline">관리자 화면</Link><h1 className="mt-3 text-3xl font-semibold">AI 대화 관리</h1><p className="mt-3 text-base leading-7 text-foreground/70">전체 사용자의 대화와 정리본을 확인하고 관리할 수 있어요. 수정·이동은 변경 이력에 남아요.</p></div></header>
    <form action="/admin/ai" className="mb-7 grid gap-3 sm:grid-cols-[1fr_220px_auto]"><input aria-label="전체 AI 메모 검색" name="q" defaultValue={q} placeholder="아이디어 메모 검색" className="ai-input"/><select aria-label="대화 소유자" name="owner" defaultValue={owner} className="ai-input"><option value="">모든 사용자</option>{members.map(p=><option key={p.id} value={p.id}>{names[p.id]}</option>)}</select><button className="ai-secondary">검색</button></form>
    {error ? <p role="alert">대화 목록을 불러오지 못했어요.</p> : <div className="grid items-start gap-6 lg:grid-cols-[320px_minmax(0,1fr)]"><section><p className="mb-3 text-sm text-foreground/70">{count??0}개 대화</p><ul className="space-y-3">{((data ?? []) as unknown as Row[]).map(row=><li key={row.id}><Link href={url({session:row.id})} className={`block rounded-xl border p-4 ${id===row.id?"border-accent/40 bg-accent/5":"border-border-default hover:bg-surface"}`}><p className="mb-2 text-xs font-medium text-accent">{names[row.user_id]} · {MODE_LABELS[row.mode ?? "focus"]}</p><h2 className="line-clamp-2 text-base font-semibold leading-6">{row.title || row.seed}</h2><p className="mt-2 text-sm text-foreground/70">{row.phase==="review"?"정리 완료":"진행 중"} · {new Date(row.updated_at).toLocaleDateString("ko-KR")}</p></Link></li>)}</ul><nav aria-label="관리자 대화 목록 페이지" className="mt-4 flex justify-between text-sm">{page>1?<Link href={url({page:String(page-1)})} className="ai-secondary">이전</Link>:<span/>}{page*PAGE_SIZE<(count??0)&&<Link href={url({page:String(page+1)})} className="ai-secondary">다음</Link>}</nav></section>
      {parsed.success?<AdminAIEditor key={`${parsed.data.id}:${parsed.data.revision}`} session={parsed.data} members={members} messages={(messages??[]) as ConversationEntry[]} events={events??[]}/>:<div className="rounded-2xl border border-border-default bg-surface p-8 text-base leading-7 text-foreground/70">{id?"대화를 불러오지 못했어요. 목록에서 다시 선택해주세요.":"대화를 선택하면 원문·답변·정리본·변경 이력을 확인할 수 있어요."}</div>}
    </div>}
  </div>;
}
