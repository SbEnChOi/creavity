import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { dialogueMode, sessionStateSchema } from "@/lib/ai/schema";
import { draftToReport } from "@/lib/ai/report";

export const dynamic = "force-dynamic";
const send = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
const schema = z.object({ id: z.string().uuid(), revision: z.number().int().nonnegative(), visibility: z.enum(["private", "custom", "public"]), recipients: z.array(z.string().uuid()).max(100).default([]) });
export async function GET(req: Request) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return send({ error: "회원 계정으로 로그인해주세요." }, 401);
  const id = new URL(req.url).searchParams.get("id");
  if (!z.string().uuid().safeParse(id).success) return send({ error: "대화 주소를 확인해주세요." }, 400);
  const { data, error } = await supabase.from("ai_shares").select("id, visibility, recipient_ids, updated_at").eq("session_id", id).eq("user_id", user.id).maybeSingle();
  return error ? send({ error: "공유 설정을 불러오지 못했어요." }, 503) : send({ share: data });
}
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return send({ error: "허용되지 않은 요청입니다." }, 403);
  const text = await req.text();
  if (text.length > 20000) return send({ error: "입력 내용이 너무 길어요." }, 413);
  let parsed;
  try { parsed = schema.safeParse(JSON.parse(text)); } catch { return send({ error: "입력 내용을 확인해주세요." }, 400); }
  if (!parsed.success) return send({ error: "공유 설정을 확인해주세요." }, 400);
  const input = parsed.data;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return send({ error: "회원 계정으로 로그인해주세요." }, 401);
  const { data: session, error } = await supabase.from("ai_sessions").select("state,revision,processing_until").eq("id", input.id).eq("user_id", user.id).maybeSingle();
  if (error) return send({ error: "대화를 불러오지 못했어요." }, 503);
  if (!session) return send({ error: "이 계정에서 공유할 수 있는 대화가 없어요." }, 404);
  if (session.revision !== input.revision || session.processing_until && new Date(session.processing_until).getTime() > Date.now()) return send({ error: "대화가 변경되었거나 처리 중이에요. 최신 기록을 확인해주세요." }, 409);
  const state = sessionStateSchema.safeParse(session.state);
  if (!state.success || state.data.pendingRefinement || !draftToReport(state.data)) return send({ error: "정리본을 완성한 뒤 공유할 수 있어요." }, 400);
  const recipients = input.visibility === "custom" ? [...new Set(input.recipients)].filter(id => id !== user.id) : [];
  if (input.visibility === "custom" && !recipients.length) return send({ error: "공유할 사용자를 골라주세요." }, 400);
  if (recipients.length) {
    const { data: people } = await supabase.from("profiles").select("id").in("id", recipients);
    if (people?.length !== recipients.length) return send({ error: "공유 대상 사용자를 확인해주세요." }, 400);
  }
  const notes = draftToReport(state.data)!.content.ai_notes;
  // Only the reviewed document and safe references are published, never the private conversation state.
  const { data, error: saveError } = await supabase.from("ai_shares").upsert({
    session_id: input.id, user_id: user.id, visibility: input.visibility, recipient_ids: recipients,
    document: state.data.draft, resources: notes?.sources ?? [], mode: dialogueMode(state.data), updated_at: new Date().toISOString(),
  }, { onConflict: "session_id" }).select("id,visibility,recipient_ids,updated_at").single();
  if (saveError) return send({ error: "공유 설정을 저장하지 못했어요. 다시 시도해주세요." }, 503);
  return send({ share: data });
}
