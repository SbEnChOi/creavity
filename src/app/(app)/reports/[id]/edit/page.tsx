import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import ReportEditor from "@/app/(app)/new/report-editor";
import type { Report } from "@/types/report";

export const dynamic = "force-dynamic";

export default async function EditReportPage({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const params = await paramsPromise;
  const supabase = await createSupabaseServerClient();
  const user = await getServerUser();

  const { data: report } = await supabase
    .from("reports")
    .select("*")
    .eq("id", params.id)
    .single();

  if (!report) notFound();
  if (report.author_id !== user!.id) redirect(`/reports/${params.id}`);

  return <ReportEditor initialReport={report as Report} />;
}
