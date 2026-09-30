import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sessionStateSchema } from "@/lib/ai/schema";
export const dynamic = "force-dynamic";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("edit"), id: z.string().uuid(), revision: z.number().int().nonnegative(), state: sessionStateSchema }),
  z.object({ action: z.literal("transfer"), id: z.string().uuid(), revision: z.number().int().nonnegative(), recipient: z.string().uuid() }),
]);
const send = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return send({ error: "허용되지 않은 요청입니다." }, 403);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return send({ error: "로그인해주세요." }, 401);
  const { data: profile } = await supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
  if (!profile?.is_admin) return send({ error: "관리자 계정만 사용할 수 있어요." }, 403);
  const text = await req.text();
  if (text.length > 200000) return send({ error: "수정 내용이 너무 길어요." }, 413);
  let input;
  try { input = schema.safeParse(JSON.parse(text)); } catch { return send({ error: "수정 내용을 확인해주세요." }, 400); }
  if (!input.success) return send({ error: "대화 내용의 형식을 확인해주세요." }, 400);
  const value = input.data;
  const result = value.action === "edit"
    ? await supabase.rpc("admin_edit_ai_session", { session_id: value.id, expected_revision: value.revision, new_state: value.state })
    : await supabase.rpc("admin_move_ai_session", { session_id: value.id, expected_revision: value.revision, recipient_id: value.recipient });
  if (result.error) return send({ error: result.error.code === "40001" ? "대화가 변경됐거나 답변을 처리 중이에요. 최신 기록을 불러온 뒤 다시 시도해주세요." : "변경하지 못했어요. 권한과 선택한 사용자를 확인해주세요." }, result.error.code === "40001" ? 409 : 400);
  return send({ session: result.data });
}
