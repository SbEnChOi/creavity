import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import type { Report } from "@/types/report";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getServerUser();
  const supabase = await createSupabaseServerClient();

  // RLS가 author_id 필터링하지만 명시적으로도 걸어둠
  // 반응 수는 별도 왕복 없이 한 번에 가져온다.
  const { data: reports, error } = await supabase
    .from("reports")
    .select("*, reactions(count)")
    .eq("author_id", user!.id)
    .order("updated_at", { ascending: false });

  if (error) console.error("reports fetch error:", error.message);

  const rows = (reports ?? []) as (Report & { reactions?: { count: number }[] })[];
  const reactionMap: Record<string, number> = {};
  const list = rows.map((row) => {
    const { reactions, ...report } = row;
    reactionMap[row.id] = reactions?.[0]?.count ?? 0;
    return report as Report;
  });

  if (error) {
    // 임베디드 집계가 실패하면 예전처럼 두 번 조회해 개수를 센다.
    const ids = list.map((r) => r.id);
    const { data: plain } = ids.length
      ? await supabase.from("reactions").select("report_id").in("report_id", ids)
      : { data: [] as { report_id: string }[] };
    for (const id of ids) reactionMap[id] = 0;
    (plain ?? []).forEach((r) => { reactionMap[r.report_id] = (reactionMap[r.report_id] ?? 0) + 1; });
  }

  return <DashboardClient reports={list} reactionMap={reactionMap} />;
}
