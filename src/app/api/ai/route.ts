import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requestSchema, type Session, type AiRequest } from "@/lib/ai/schema";
import { initialState, focusedState } from "@/lib/ai/flow";
import { transition } from "@/lib/ai/engine";
import { AiError } from "@/lib/ai/provider";
import { messagesForTransition } from "@/lib/ai/messages";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
const projection = "id, user_id, revision, state, updated_at, processing_until";
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
const respond = (session: Session) => NextResponse.json({ session }, { headers: { "Cache-Control": "no-store" } });

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  if (!z.string().uuid().safeParse(id).success) return fail("대화 주소를 확인해주세요.", 400);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return fail("회원 계정으로 로그인해주세요.", 401);
  const { data, error } = await supabase.from("ai_sessions").select(projection).eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error) return fail("저장된 대화를 불러오지 못했어요. 잠시 후 다시 시도해주세요.", 503);
  if (!data) return fail("이 계정에서 볼 수 있는 대화가 없어요.", 404);
  if (new URL(req.url).searchParams.get("history") === "1") {
    const { data: messages, error: messageError } = await supabase.from("ai_session_messages").select("id,role,text,payload,created_at").eq("session_id", id).order("revision").order("entry_number");
    if (messageError) return fail("대화 기록을 불러오지 못했어요.", 503);
    return NextResponse.json({ session: data, messages: messages ?? [] }, { headers: { "Cache-Control": "no-store" } });
  }
  return respond(data as Session);
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return fail("허용되지 않은 요청입니다.", 403);
  const bytes = await req.text();
  if (bytes.length > 16000) return fail("입력 내용이 너무 깁니다.", 413);
  let parsed;
  try { parsed = requestSchema.safeParse(JSON.parse(bytes)); } catch { return fail("요청 형식을 확인해주세요.", 400); }
  if (!parsed.success) return fail("입력 항목을 확인해주세요. 메모는 5~8,000자까지 가능합니다.", 400);
  const input = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return fail("회원 계정으로 로그인한 뒤 이용해주세요.", 401);
  if (!process.env.OPENAI_API_KEY) return fail("AI 연결을 준비하고 있어요. 운영자가 API 키를 설정해야 합니다.", 503);
  const locks: { id: string; revision: number }[] = [];
  async function read(id: string) {
    const { data, error } = await supabase.from("ai_sessions").select(projection).eq("id", id).eq("user_id", user!.id).maybeSingle();
    if (error) throw new AiError("저장된 대화를 불러오지 못했어요.", 503);
    return data as Session | null;
  }
  async function lock(session: Session, revision: number) {
    if (session.revision !== revision) throw new AiError("다른 화면에서 수정된 대화예요. 최신 기록을 불러와 이어갈 수 있어요.", 409);
    const { data, error } = await supabase.rpc("lock_ai_session", { session_id: session.id, expected_revision: revision });
    if (error) throw new AiError("대화 저장소 연결을 확인해주세요.", 503);
    if (!data) throw new AiError("이 대화의 답변을 아직 처리하고 있어요. 저장된 기록을 불러와주세요.", 409);
    locks.push({ id: session.id, revision });
  }
  try {
    let target: Session;
    let operation: AiRequest = input;
    if (input.action === "start" || input.action === "fork_focus") {
      const id = input.requestId ?? crypto.randomUUID();
      const existing = await read(id);
      // Replays reuse the persisted conversation instead of creating another one.
      if (existing && (existing.state.question || existing.state.phase !== "questions")) return respond(existing);
      let seedState;
      if (input.action === "fork_focus") {
        const source = await read(input.id);
        if (!source) throw new AiError("원래 대화를 찾을 수 없어요.", 404);
        await lock(source, input.revision);
        seedState = focusedState(source.state, source.id, input.direction);
      } else seedState = initialState(input);
      if (existing) target = existing;
      else {
        // Save the original memo before invoking the external AI provider.
        const { data, error } = await supabase.from("ai_sessions").insert({ id, user_id: user.id, state: seedState }).select(projection).single();
        if (error?.code === "23505") {
          const replay = await read(id);
          if (!replay) throw new AiError("대화를 시작하지 못했어요. 다시 시도해주세요.", 409);
          if (replay.state.question || replay.state.phase !== "questions") return respond(replay);
          target = replay;
        } else {
          if (error || !data) throw new AiError("메모를 저장하지 못했어요. 작성한 내용을 유지하고 다시 시도해주세요.");
          target = data as Session;
        }
      }
      operation = { action: "resume", id: target.id, revision: target.revision };
    } else {
      const stored = await read(input.id);
      if (!stored) throw new AiError("이 계정에서 볼 수 있는 대화가 없어요.", 404);
      target = stored;
    }
    await lock(target, operation.action === "start" ? target.revision : operation.revision);
    const { data: allowed, error: quotaError } = await supabase.rpc("claim_ai_request");
    if (quotaError) throw new AiError("AI 저장소 연결을 확인해주세요.", 503);
    if (!allowed) throw new AiError("시간당 40회 이용 한도에 도달했어요. 대화는 저장되어 있으니 다음 시간에 이어갈 수 있어요.", 429);
    const state = await transition(target.state, operation);
    const { data, error } = await supabase.rpc("save_ai_session", { session_id: target.id, expected_revision: target.revision, new_state: state, entries: messagesForTransition(target.state, state, input) });
    if (error) throw new AiError("답변을 저장하지 못했어요. 작성한 답변을 유지하고 다시 시도해주세요.");
    if (!data) throw new AiError("대화가 변경되어 최신 기록을 확인해야 해요.", 409);
    return respond(data as Session);
  } catch (e) {
    return fail(e instanceof AiError ? e.message : "연결이 끊겼어요. 작성한 내용은 그대로 두고 다시 시도해주세요.", e instanceof AiError ? e.status : 500);
  } finally {
    for (const held of locks) await supabase.from("ai_sessions").update({ processing_until: null }).eq("id", held.id).eq("user_id", user.id).eq("revision", held.revision);
  }
}
