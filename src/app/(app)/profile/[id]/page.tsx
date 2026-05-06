import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe, UserCheck, Users, Heart } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Report } from "@/types/report";
import MentorButton from "./mentor-button";

export const dynamic = "force-dynamic";

const AVATAR_BG: Record<string, string> = {
  gray: "bg-gray-200 text-gray-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
};

export default async function ProfilePage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_color, grade")
    .eq("id", params.id)
    .maybeSingle();

  if (!profile) notFound();

  const isMe = user!.id === profile.id;

  // 이 사용자의 발행된 보고서들 (RLS가 자동으로 권한 필터)
  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .eq("author_id", profile.id)
    .eq("status", "published")
    .order("published_at", { ascending: false });

  const list = (reports ?? []) as Report[];
  const reportIds = list.map((r) => r.id);

  // 반응 수 집계
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

  // 멘토 관계 확인
  const { data: pairing } = !isMe
    ? await supabase
        .from("mentor_pairings")
        .select("mentor_id")
        .eq("mentee_id", user!.id)
        .eq("mentor_id", profile.id)
        .maybeSingle()
    : { data: null };

  const name = profile.display_name ?? "이름 없음";
  const color = profile.avatar_color ?? "gray";

  return (
    <div className="px-10 py-10 max-w-4xl">
      {/* 뒤로가기 */}
      <Link
        href="/feed"
        className="inline-flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft size={15} strokeWidth={1.75} />
        뒤로
      </Link>

      {/* 프로필 헤더 */}
      <header className="flex items-start gap-5 mb-12 pb-8 border-b border-border-default">
        <span
          className={`flex items-center justify-center w-20 h-20 rounded-full text-3xl font-semibold shrink-0 ${
            AVATAR_BG[color] ?? AVATAR_BG.gray
          }`}
        >
          {name.charAt(0)}
        </span>
        <div className="flex-1 min-w-0 pt-2">
          <h1 className="text-2xl font-bold text-foreground mb-1">{name}</h1>
          <div className="flex items-center gap-2 text-sm text-foreground/60 mb-4">
            {profile.grade != null && <span>{profile.grade}학년</span>}
            <span>·</span>
            <span>발행 {list.length}편</span>
          </div>

          {isMe ? (
            <Link
              href="/settings"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border-default text-sm text-foreground/70 hover:bg-surface transition-colors"
            >
              프로필 편집
            </Link>
          ) : (
            <MentorButton
              mentorId={profile.id}
              currentUserId={user!.id}
              initialIsMentor={!!pairing}
            />
          )}
        </div>
      </header>

      {/* 발행한 보고서 목록 */}
      <section>
        <h2 className="text-sm font-semibold text-foreground mb-4">
          발행한 보고서
        </h2>

        {list.length === 0 ? (
          <div className="border border-border-default rounded-lg p-12 text-center">
            <p className="text-sm text-foreground/50">
              아직 공개된 보고서가 없습니다.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {list.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                reactionCount={reactionMap[r.id] ?? 0}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReportCard({
  report,
  reactionCount,
}: {
  report: Report;
  reactionCount: number;
}) {
  const description =
    report.content?.step1?.description ?? report.content?.summary?.thing ?? "";
  const date = new Date(report.published_at ?? report.updated_at);
  const dateStr = `${date.getMonth() + 1}월 ${date.getDate()}일`;
  const firstImage = report.content?.step1?.images?.[0];

  const VisIcon =
    report.visibility === "public"
      ? Globe
      : report.visibility === "custom"
      ? UserCheck
      : Users;

  return (
    <Link
      href={`/reports/${report.id}`}
      className="group block rounded-lg border border-border-default hover:bg-surface transition-colors overflow-hidden"
    >
      {firstImage && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={firstImage}
          alt=""
          className="w-full aspect-video object-cover bg-surface"
        />
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2 text-xs flex-wrap">
          {report.edition != null && (
            <span className="text-foreground/50 font-medium">
              {report.edition}차
            </span>
          )}
          {report.field && (
            <span className="px-1.5 py-0.5 rounded bg-surface group-hover:bg-white text-foreground/70 transition-colors">
              {report.field}
            </span>
          )}
        </div>

        <h3 className="text-base font-semibold text-foreground mb-1.5 line-clamp-1">
          {report.title || "제목 없음"}
        </h3>
        <p className="text-sm text-foreground/60 line-clamp-2 mb-3 min-h-[2.5rem]">
          {description || "내용이 없습니다."}
        </p>

        <div className="flex items-center justify-between text-xs text-foreground/50">
          <span>{dateStr}</span>
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <Heart size={12} strokeWidth={1.75} />
              {reactionCount}
            </span>
            <VisIcon size={12} strokeWidth={1.75} />
          </div>
        </div>
      </div>
    </Link>
  );
}
