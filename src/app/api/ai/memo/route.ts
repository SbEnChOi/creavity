import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { memoRequestSchema, savePrivateMemo } from "@/lib/ai/memo";
import type { Session } from "@/lib/ai/schema";

export const dynamic = "force-dynamic";
const projection = "id, user_id, revision, state, updated_at, processing_until";
const respond = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  if (origin && origin !== new URL(req.url).origin) return respond({ error: "허용되지 않은 요청입니다." }, 403);
  const text = await req.text();
  if (text.length > 16000) return respond({ error: "메모가 너무 길어요." }, 413);
  let parsed;
  try { parsed = memoRequestSchema.safeParse(JSON.parse(text)); }
  catch { return respond({ error: "입력 내용을 확인해주세요." }, 400); }
  if (!parsed.success) return respond({ error: "메모는 1~8,000자까지 저장할 수 있어요." }, 400);
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return respond({ error: "메모 보관은 회원 계정으로 이용할 수 있어요." }, 401);
  try {
    const session = await savePrivateMemo(user.id, parsed.data, {
      async read(id, userId) {
        const result = await supabase.from("ai_sessions").select(projection).eq("id", id).eq("user_id", userId).maybeSingle();
        return { data: result.data as Session | null, error: result.error };
      },
      async insert(id, userId, state) {
        const result = await supabase.from("ai_sessions").insert({ id, user_id: userId, state }).select(projection).single();
        return { data: result.data as Session | null, error: result.error };
      },
    });
    return respond({ session });
  } catch (error) {
    return respond({ error: error instanceof Error ? error.message : "메모를 저장하지 못했어요." }, 503);
  }
}
