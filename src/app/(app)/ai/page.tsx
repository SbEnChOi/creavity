import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";
import IdeaStudio from "@/components/ai/IdeaStudio";
import type { Session } from "@/lib/ai/schema";

export const dynamic = "force-dynamic";

export default async function AiPage({ searchParams: query }: { searchParams: Promise<{ session?: string; idea?: string }> }) {
  const searchParams = await query;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from("ai_sessions").select("id, revision, state, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(10);
  let initialSession: Session | null = null;
  let setupError = error ? "AI 대화 저장소 연결이 필요합니다. 운영자가 Supabase AI 마이그레이션을 적용해주세요." : "";
  if (searchParams.session) {
    if (z.string().uuid().safeParse(searchParams.session).success) {
      const { data: session } = await supabase.from("ai_sessions").select("id, revision, state, updated_at").eq("id", searchParams.session).eq("user_id", user.id).maybeSingle();
      initialSession = session as Session | null;
    }
    if (!initialSession) setupError ||= "요청한 대화를 찾을 수 없습니다. 최근 대화에서 다시 선택해주세요.";
  }
  let initialSeed = "";
  if (searchParams.idea && z.string().uuid().safeParse(searchParams.idea).success) {
    const { data: idea } = await supabase.from("ideas").select("title, body").eq("id", searchParams.idea).eq("author_id", user.id).maybeSingle();
    if (idea) initialSeed = [idea.title, idea.body].filter(Boolean).join("\n\n").slice(0, 8000);
  }
  return <IdeaStudio key={initialSession?.id || searchParams.idea || "new"} initialSession={initialSession} sessions={(data ?? []) as Session[]} initialSeed={initialSeed} configured={!!process.env.OPENAI_API_KEY} setupError={setupError} />;
}
