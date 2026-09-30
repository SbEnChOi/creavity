import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { draftSchema, MODE_LABELS, type DialogueMode } from "@/lib/ai/schema";
import DraftPreview from "@/components/ai/DraftPreview";
import ReportAiNotes from "@/components/ai/ReportAiNotes";

export const dynamic = "force-dynamic";
export default async function SharedIdea({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("ai_shares").select("document,resources,mode,updated_at").eq("id", id).maybeSingle();
  if (!data) return <main className="mx-auto max-w-xl px-6 py-24"><Link href="/" className="font-semibold">Creavy</Link><h1 className="mt-8 text-2xl font-semibold">공유된 아이디어를 볼 수 없어요</h1><p className="mt-4 text-base leading-7 text-foreground/70">공유가 해제됐거나 접근 권한이 필요한 링크일 수 있어요. 선택한 사용자에게 공유한 아이디어라면 해당 계정으로 로그인해주세요.</p><Link href={`/login?next=${encodeURIComponent(`/ai-share/${id}`)}`} className="ai-primary mt-6">로그인하기</Link></main>;
  const parsed = draftSchema.safeParse(data.document);
  if (!parsed.success) notFound();
  const mode: DialogueMode = data.mode === "explore" ? "explore" : "focus";
  const resources=z.array(z.object({title:z.string(),url:z.string(),kind:z.enum(["web","video","image"]),thumbnail:z.string().optional(),credit:z.string().optional()})).safeParse(data.resources);
  return <main className="mx-auto max-w-3xl px-5 py-10 md:px-10 md:py-14"><header className="mb-9 flex flex-wrap items-start justify-between gap-4"><Link href="/ai" className="text-lg font-semibold">Creavy</Link><span className="rounded-full bg-accent/5 px-3 py-1 text-sm text-accent">{MODE_LABELS[mode]} · 공유된 정리본</span></header><DraftPreview draft={parsed.data}/><ReportAiNotes notes={{ mode, sources:resources.success?resources.data:[] }}/><footer className="mt-10 border-t border-border-default pt-5 text-sm leading-6 text-foreground/70">{new Date(data.updated_at).toLocaleDateString("ko-KR",{timeZone:"Asia/Seoul"})}에 공유한 정리본이에요. {mode === "explore" ? "탐색한 가능성이며 실행을 확정한 계획은 아니에요." : "AI와 함께 정리한 아이디어로, 실제 효과는 확인이 필요해요."}</footer></main>;
}
