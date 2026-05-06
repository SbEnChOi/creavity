import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ReportEditor from "@/app/(app)/new/report-editor";
import type { Report } from "@/types/report";

export const dynamic = "force-dynamic";

export default async function EditReportPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: report } = await supabase
    .from("reports")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!report) notFound();
  if (report.author_id !== user!.id) redirect(`/reports/${params.id}`);

  return <ReportEditor initialReport={report as Report} />;
}
