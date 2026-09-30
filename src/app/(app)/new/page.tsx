import ReportEditor from "./report-editor";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { draftToReport } from "@/lib/ai/report";
import type { SessionState } from "@/lib/ai/schema";
import { notFound } from "next/navigation";
import { z } from "zod";

export default async function NewReportPage({ searchParams: query }: { searchParams: Promise<{ ai?: string }> }) {
  const searchParams = await query;
  if (!searchParams.ai) return <ReportEditor />;
  if (!z.string().uuid().safeParse(searchParams.ai).success) notFound();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) notFound();
  const { data } = await supabase.from("ai_sessions").select("state").eq("id", searchParams.ai).eq("user_id", user.id).maybeSingle();
  const draft = data ? draftToReport(data.state as SessionState) : null;
  if (!draft) notFound();
  return <ReportEditor initialAiDraft={draft} aiSessionId={searchParams.ai} />;
}
