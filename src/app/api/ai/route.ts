import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requestSchema, type SessionState } from "@/lib/ai/schema";
import { transition } from "@/lib/ai/engine";
import { AiError } from "@/lib/ai/provider";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
const projection = "id, revision, state, updated_at";
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  // Only the same-origin app may invoke paid AI operations with a cookie session.
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return fail("허용되지 않은 요청입니다.", 403);
  const bytes = await req.text();
  if (bytes.length > 16000) return fail("입력 내용이 너무 깁니다.", 413);
  let parsed;
  try { parsed = requestSchema.safeParse(JSON.parse(bytes)); }
  catch { return fail("요청 형식을 확인해주세요.", 400); }
  if (!parsed.success) return fail("입력 항목을 확인해주세요. 메모는 5~8,000자까지 가능합니다.", 400);
  const input = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return fail("로그인 후 다시 시도해주세요.", 401);
  if (user.is_anonymous) return fail("AI 구체화는 회원 계정으로 이용할 수 있습니다. 로그아웃한 뒤 회원가입 또는 회원 로그인을 해주세요.", 403);
  if (!process.env.OPENAI_API_KEY) return fail("AI 연결 준비 중입니다. 운영자가 서버에 OPENAI_API_KEY를 설정해야 합니다.", 503);
  let current: SessionState | null = null;
  let locked = false;
  try {
    if (input.action !== "start") {
      const { data, error } = await supabase.from("ai_sessions").select(projection).eq("id", input.id).eq("user_id", user.id).maybeSingle();
      if (error) throw new AiError("AI 저장소 연결을 확인해주세요. Supabase AI 마이그레이션이 필요합니다.");
      if (!data) return fail("대화를 찾을 수 없습니다.", 404);
      if (data.revision !== input.revision) return fail("다른 화면에서 대화가 변경되었습니다. 대화를 다시 열어주세요.", 409);
      const { data: lock, error: lockError } = await supabase.rpc("lock_ai_session", { session_id: input.id, expected_revision: input.revision });
      if (lockError) throw new AiError("AI 저장소 설정을 확인해주세요.");
      if (!lock) return fail("답변을 처리 중입니다. 잠시 후 대화를 다시 열어주세요.", 409);
      locked = true;
      current = data.state as SessionState;
    }
    const { data: allowed, error: quotaError } = await supabase.rpc("claim_ai_request");
    if (quotaError) throw new AiError("AI 저장소 연결을 확인해주세요. Supabase AI 마이그레이션이 필요합니다.");
    if (!allowed) throw new AiError("시간당 40회 이용 한도에 도달했습니다. 다음 시간에 다시 이용해주세요.", 429);
    const state = await transition(current, input);
    const result = input.action === "start" || input.action === "fork_focus"
      ? await supabase.from("ai_sessions").insert({ user_id: user.id, state }).select(projection).single()
      : await supabase.from("ai_sessions").update({ state, revision: input.revision + 1, updated_at: new Date().toISOString(), processing_until: null })
        .eq("id", input.id).eq("user_id", user.id).eq("revision", input.revision).select(projection).maybeSingle();
    if (result.error) throw new AiError("대화를 저장하지 못했습니다. 다시 시도해주세요.");
    if (!result.data) throw new AiError("대화가 변경되었습니다. 다시 열어주세요.", 409);
    // Forks create a new session; finally releases the original session's lock.
    if (input.action !== "fork_focus") locked = false;
    return NextResponse.json({ session: result.data }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return fail(e instanceof AiError ? e.message : "처리 중 문제가 생겼습니다. 다시 시도해주세요.", e instanceof AiError ? e.status : 500);
  } finally {
    if (locked && input.action !== "start") {
      await supabase.from("ai_sessions").update({ processing_until: null }).eq("id", input.id).eq("user_id", user.id).eq("revision", input.revision);
    }
  }
}
