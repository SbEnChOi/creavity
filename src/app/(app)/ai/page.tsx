import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import IdeaStudio from "@/components/ai/IdeaStudio";
import type { Session } from "@/lib/ai/schema";

export const dynamic = "force-dynamic";

export default async function AiPage({ searchParams: query }: { searchParams: Promise<{ session?: string; idea?: string; new?: string }> }) {
  const searchParams = await query;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  if (user.is_anonymous) return <IdeaStudio storageScope={user.id} configured={false} setupError="AI 구체화와 메모 보관은 회원 계정으로 이용할 수 있어요. 회원가입 또는 회원 로그인을 해주세요." />;
  const { data, error } = await supabase.from("ai_sessions").select("id, user_id, revision, state, updated_at, processing_until").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(10);
  let initialSession: Session | null = null;
  let setupError = error ? "AI 대화 저장소 연결이 필요합니다. 운영자가 Supabase AI 마이그레이션을 적용해주세요." : "";
  if (searchParams.session) {
    if (z.string().uuid().safeParse(searchParams.session).success) {
      const { data: session } = await supabase.from("ai_sessions").select("id, user_id, revision, state, updated_at, processing_until").eq("id", searchParams.session).eq("user_id", user.id).maybeSingle();
      initialSession = session as Session | null;
    }
    if (!initialSession) setupError ||= "요청한 대화를 찾을 수 없습니다. 최근 대화에서 다시 선택해주세요.";
  }
  else if(searchParams.new !== "1" && !searchParams.idea) initialSession = (data?.[0] as Session) ?? null;
  let initialSeed = "";
  if (searchParams.idea && z.string().uuid().safeParse(searchParams.idea).success) {
    const { data: idea } = await supabase.from("ideas").select("title, body").eq("id", searchParams.idea).eq("author_id", user.id).maybeSingle();
    if (idea) {
      const combined = [idea.title, idea.body].filter(Boolean).join("\n\n");
      if (combined.length > 8000) setupError ||= "메모가 8,000자를 넘어 AI에 가져올 수 없어요. 기존 메모를 확인하고 필요한 부분만 입력해주세요.";
      else initialSeed = combined;
    } else setupError ||= "이 계정에서 메모를 찾을 수 없어요. 아이디어 목록에서 다시 확인해주세요.";
  } else if (searchParams.idea) setupError ||= "메모 주소를 확인해주세요.";
  if (searchParams.idea && !initialSeed && setupError) return <div className="mx-auto max-w-3xl px-5 py-10"><p role="alert" className="rounded-xl border border-border-default bg-surface p-5 text-foreground">{setupError}</p><a href="/ideas" className="ai-secondary mt-5">아이디어 목록으로 돌아가기</a></div>;
  let sourceVisible = true;
  if(initialSession?.state.sourceSessionId){const { data: source }=await supabase.from("ai_sessions").select("id").eq("id",initialSession.state.sourceSessionId).eq("user_id",user.id).maybeSingle();sourceVisible=!!source;}
  return <IdeaStudio key={initialSession?.id || searchParams.idea || "new"} initialSession={initialSession} sessions={(data ?? []) as Session[]} storageScope={user.id} sourceVisible={sourceVisible} initialSeed={initialSeed} configured={!!process.env.OPENAI_API_KEY} setupError={setupError} />;
}
