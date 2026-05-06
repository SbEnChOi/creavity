import Link from "next/link";
import { Globe, Users, UserCheck } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Report } from "@/types/report";

export const dynamic = "force-dynamic";

const AVATAR_BG: Record<string, string> = {
  gray: "bg-gray-200 text-gray-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
};

type ProfileLite = { id: string; display_name: string | null; avatar_color: string | null };

export default async function FeedPage() {
  const supabase = createSupabaseServerClient();

  // 발행된 보고서만 (RLS가 권한 필터링: 본인 + public + custom-나에게-공유 + 같은 클럽 등)
  const { data: reports } = await supabase
    .from("reports")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(100);

  const list = (reports ?? []) as Report[];
  const authorIds = Array.from(new Set(list.map((r) => r.author_id)));

  const { data: profiles } = authorIds.length
    ? await supabase
        .from("profiles")
        .select("id, display_name, avatar_color")
        .in("id", authorIds)
    : { data: [] as ProfileLite[] };

  const profileMap: Record<string, ProfileLite> = Object.fromEntries(
    (profiles ?? []).map((p) => [p.id, p as ProfileLite])
  );

  return (
    <div className="px-10 py-12 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-1">동아리 피드</h1>
        <p className="text-sm text-foreground/60">
          동아리원들이 공유한 보고서를 확인하세요.
        </p>
      </header>

      {list.length === 0 ? (
        <div className="border border-border-default rounded-lg p-16 text-center">
          <p className="text-sm text-foreground/50">아직 공유된 보고서가 없습니다.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {list.map((r) => (
            <FeedCard key={r.id} report={r} author={profileMap[r.author_id] ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedCard({
  report,
  author,
}: {
  report: Report;
  author: ProfileLite | null;
}) {
  const description =
    report.content?.step1?.description ?? report.content?.summary?.thing ?? "";
  const date = new Date(report.published_at ?? report.updated_at);
  const dateStr = `${date.getMonth() + 1}월 ${date.getDate()}일`;
  const name = author?.display_name ?? "알 수 없음";
  const color = author?.avatar_color ?? "gray";

  const VisIcon =
    report.visibility === "public" ? Globe : report.visibility === "custom" ? UserCheck : Users;

  return (
    <Link
      href={`/reports/${report.id}`}
      className="group block p-4 rounded-lg border border-border-default hover:bg-surface transition-colors"
    >
      <div className="flex items-center gap-2 mb-2.5 text-xs flex-wrap">
        {report.edition != null && (
          <span className="text-foreground/50 font-medium">{report.edition}차</span>
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
      <p className="text-sm text-foreground/60 line-clamp-2 mb-4 min-h-[2.5rem]">
        {description || "내용이 없습니다."}
      </p>

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span
            className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold ${
              AVATAR_BG[color] ?? AVATAR_BG.gray
            }`}
          >
            {name.charAt(0)}
          </span>
          <span className="text-foreground/70">{name}</span>
        </div>
        <div className="flex items-center gap-2 text-foreground/50">
          <VisIcon size={12} strokeWidth={1.75} />
          <span>{dateStr}</span>
        </div>
      </div>
    </Link>
  );
}
