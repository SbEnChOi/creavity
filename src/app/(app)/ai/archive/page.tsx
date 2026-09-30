import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dialogueMode, MODE_LABELS, type Session } from "@/lib/ai/schema";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 12;

export default async function IdeaArchive({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().slice(0, 200);
  const page = /^\d+$/.test(params.page ?? "") ? Math.max(1, Math.min(100000, Number(params.page))) : 1;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) redirect("/ai");
  let query = supabase.from("ai_sessions").select("id, revision, state, updated_at", { count: "exact" }).eq("user_id", user.id);
  if (q) query = query.ilike("state->>seed", `%${q.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, count, error } = await query.order("updated_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const sessions = (data ?? []) as Session[];
  const pageUrl = (value: number) => `/ai/archive?${new URLSearchParams({ ...(q ? { q } : {}), page: String(value) })}`;
  return <div className="mx-auto max-w-5xl px-5 py-10 md:px-10">
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold">아이디어 보관함</h1><p className="mt-3 text-base leading-7 text-foreground/75">탐색한 가능성과 진행 중인 대화를 다시 꺼내 볼 수 있어요. 이곳에는 내 대화만 보여요.</p></div><Link href="/ai?new=1" className="ai-primary">새 아이디어 탐색</Link></div>
    <form action="/ai/archive" className="mb-7 flex gap-3"><label htmlFor="archive-query" className="sr-only">아이디어 메모 검색</label><input id="archive-query" name="q" defaultValue={q} maxLength={200} placeholder="처음 적은 메모로 검색" className="min-w-0 flex-1 rounded-lg border border-border-default bg-surface px-4 py-3 text-base placeholder:text-foreground/50" /><button type="submit" className="ai-secondary">검색</button></form>
    {error ? <p role="alert" className="rounded-lg bg-surface p-5 text-base">대화를 불러오지 못했어요. 잠시 후 다시 열어주세요.</p> : sessions.length ? <ul className="grid gap-4 md:grid-cols-2">{sessions.map(session => <li key={session.id}><Link href={`/ai?session=${session.id}`} className="block h-full rounded-xl border border-border-default p-5 hover:bg-surface"><div className="mb-3 flex flex-wrap items-center gap-2 text-sm"><span className="rounded-md bg-accent/5 px-2 py-1 font-medium text-accent">{MODE_LABELS[dialogueMode(session.state)]}</span><span className="text-foreground/70">{session.state.phase === "review" ? "기록 완성" : "대화 진행 중"}</span></div><h2 className="line-clamp-2 text-lg font-semibold leading-7">{session.state.draft?.title || session.state.seed.split("\n")[0]}</h2><p className="mt-3 line-clamp-3 whitespace-pre-wrap text-base leading-7 text-foreground/80">{session.state.seed}</p><p className="mt-4 text-sm text-foreground/70">{new Date(session.updated_at).toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })}{session.state.sourceSessionId ? " · 확장 탐색에서 이어진 대화" : ""}</p></Link></li>)}</ul> : <p className="rounded-xl bg-surface p-6 text-base leading-7 text-foreground/75">{q ? "검색한 메모가 없어요. 다른 단어로 찾아볼까요?" : "아직 보관한 대화가 없어요. 메모를 적고 탐색을 시작하면 자동으로 보관돼요."}</p>}
    {!error && <nav aria-label="보관함 페이지" className="mt-7 flex items-center justify-between gap-3 text-sm text-foreground/75">{page > 1 ? <Link href={pageUrl(page - 1)} className="ai-secondary">이전</Link> : <span />}<span>{count ?? 0}개 대화 · {page}페이지</span>{page * PAGE_SIZE < (count ?? 0) ? <Link href={pageUrl(page + 1)} className="ai-secondary">다음</Link> : <span />}</nav>}
  </div>;
}
