import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Report } from "@/types/report";
import FeedClient, { type FeedAuthor } from "./feed-client";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 발행된 보고서 + 작성자 정보 + 멘토/멘티 관계 + 반응수 동시 조회
  const [
    { data: reports },
    { data: profiles },
    { data: myMentors },
    { data: myMentees },
  ] = await Promise.all([
    supabase
      .from("reports")
      .select("*")
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
  ]);

  const list = (reports ?? []) as Report[];

  // 반응 수 집계
  const reportIds = list.map((r) => r.id);
  const { data: reactions } = reportIds.length
    ? await supabase
        .from("reactions")
        .select("report_id")
        .in("report_id", reportIds)
    : { data: [] };

  const reactionMap: Record<string, number> = {};
  (reactions ?? []).forEach((r) => {
    reactionMap[r.report_id] = (reactionMap[r.report_id] ?? 0) + 1;
  });

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
    />
  );
}
