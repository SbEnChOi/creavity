import { createSupabaseServerClient, getServerUser } from "@/lib/supabase/server";
import type { Report } from "@/types/report";
import FeedClient, { type FeedAuthor } from "./feed-client";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = await createSupabaseServerClient();
  const user = await getServerUser();

  // 발행된 보고서 + 작성자 정보 + 내 공유 파트너/나를 연결한 사용자 관계 + 반응수 동시 조회
  const [
    { data: reports, error: reportsError },
    { data: profiles },
    { data: myMentors },
    { data: myMentees },
    { data: colorPreferences },
  ] = await Promise.all([
    supabase
      .from("reports")
      .select("*, reactions(count)")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(200),
    supabase.from("profiles").select("id, display_name, avatar_color, grade"),
    supabase
      .from("mentor_pairings")
      .select("mentor_id")
      .eq("mentee_id", user!.id),
    supabase
      .from("mentor_pairings")
      .select("mentee_id")
      .eq("mentor_id", user!.id),
    supabase.from("report_card_preferences").select("report_id,color").eq("user_id",user!.id),
  ]);

  const rows = (reports ?? []) as (Report & { reactions?: { count: number }[] })[];
  let list = rows.map(({ reactions, ...report }) => { void reactions; return report as Report; });
  const reactionMap: Record<string, number> = {};
  rows.forEach(({ id, reactions }) => { reactionMap[id] = reactions?.[0]?.count ?? 0; });

  if (reportsError) {
    const { data: plain } = await supabase
      .from("reports")
      .select("*")
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(200);
    list = (plain ?? []) as Report[];
    const ids = list.map((r) => r.id);
    const { data: counted } = ids.length
      ? await supabase.from("reactions").select("report_id").in("report_id", ids)
      : { data: [] as { report_id: string }[] };
    for (const id of ids) reactionMap[id] = 0;
    (counted ?? []).forEach((r) => { reactionMap[r.report_id] = (reactionMap[r.report_id] ?? 0) + 1; });
  }

  const authorMap: Record<string, FeedAuthor> = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p as FeedAuthor])
  );

  const mentorIds = (myMentors ?? []).map((m) => m.mentor_id);
  const menteeIds = (myMentees ?? []).map((m) => m.mentee_id);

  return (
    <FeedClient
      reports={list}
      authorMap={authorMap}
      reactionMap={reactionMap}
      currentUserId={user!.id}
      mentorIds={mentorIds}
      menteeIds={menteeIds}
      cardColors={Object.fromEntries((colorPreferences??[]).map(item=>[item.report_id,item.color]))}
    />
  );
}
