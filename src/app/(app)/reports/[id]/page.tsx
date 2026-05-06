import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import ReportDetail from "./report-detail";

export const dynamic = "force-dynamic";

export default async function ReportPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 보고서 먼저 단독으로 조회 (profiles JOIN 제외 → RLS 간섭 방지)
  const { data: report, error: reportError } = await supabase
    .from("reports")
    .select("*")
    .eq("id", params.id)
    .single();

  if (reportError) console.error("[report fetch]", reportError.message);
  if (!report) notFound();

  // 작성자 프로필 별도 조회
  const { data: author } = await supabase
    .from("profiles")
    .select("display_name, avatar_color, grade")
    .eq("id", report.author_id)
    .maybeSingle();

  // 반응·댓글 병렬 조회
  const [{ data: reactions }, { data: comments }] = await Promise.all([
    supabase
      .from("reactions")
      .select("type, user_id")
      .eq("report_id", params.id),
    supabase
      .from("comments")
      .select("id, body, created_at, author_id")
      .eq("report_id", params.id)
      .order("created_at", { ascending: true }),
  ]);

  // 댓글 작성자 프로필 일괄 조회
  const authorIds = Array.from(new Set((comments ?? []).map((c) => c.author_id)));
  const { data: commentProfiles } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, avatar_color")
        .in("id", authorIds)
    : { data: [] };

  const profileMap = Object.fromEntries(
    (commentProfiles ?? []).map((p) => [p.id, p])
  );

  const commentsWithProfile: CommentRow[] = (comments ?? []).map((c) => ({
    id: c.id,
    body: c.body,
    created_at: c.created_at,
    profiles: profileMap[c.author_id] ?? null,
  }));

  const reactionCounts = (reactions ?? []).reduce(
    (acc, r) => { acc[r.type] = (acc[r.type] ?? 0) + 1; return acc; },
    {} as Record<string, number>
  );

  const myReactions =
    reactions?.filter((r) => r.user_id === user!.id).map((r) => r.type as string) ?? [];

  return (
    <ReportDetail
      report={{ ...report, profiles: author ?? null }}
      reactionCounts={reactionCounts}
      myReactions={myReactions}
      comments={commentsWithProfile}
      currentUserId={user!.id}
    />
  );
}

export type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  profiles: { display_name: string | null; avatar_color: string | null } | null;
};
