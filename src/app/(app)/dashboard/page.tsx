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
  let list = rows.map(({ reactions, ...report }) => { void reactions; return report as Report; });
  const reactionMap: Record<string, number> = {};
  rows.forEach(({ id, reactions }) => { reactionMap[id] = reactions?.[0]?.count ?? 0; });

  if (error) {
    // 임베디드 집계가 실패하면 목록부터 다시 받아오고, 개수는 한 번 더 조회해 센다.
    const { data: plain } = await supabase
      .from("reports")
      .select("*")
      .eq("author_id", user!.id)
      .order("updated_at", { ascending: false });
    list = (plain ?? []) as Report[];
    const ids = list.map((r) => r.id);
    const { data: counted } = ids.length
      ? await supabase.from("reactions").select("report_id").in("report_id", ids)
      : { data: [] as { report_id: string }[] };
    for (const id of ids) reactionMap[id] = 0;
    (counted ?? []).forEach((r) => { reactionMap[r.report_id] = (reactionMap[r.report_id] ?? 0) + 1; });
  }

  return <DashboardClient reports={list} reactionMap={reactionMap} />;
}
