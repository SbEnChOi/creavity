"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, Globe, UserCheck, Users, Heart, X } from "lucide-react";
import type { Report } from "@/types/report";

const AVATAR_BG: Record<string, string> = {
  gray: "bg-gray-200 text-gray-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
};

export type FeedAuthor = {
  id: string;
  display_name: string | null;
  avatar_color: string | null;
  grade: number | null;
};

type MemberFilter = "all" | "mentor" | "mentee" | "others";
type DateFilter = "all" | "7d" | "30d" | "90d";

export default function FeedClient({
  reports,
  authorMap,
  reactionMap,
  currentUserId,
  mentorIds,
  menteeIds,
}: {
  reports: Report[];
  authorMap: Record<string, FeedAuthor>;
  reactionMap: Record<string, number>;
  currentUserId: string;
  mentorIds: string[];
  menteeIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [memberFilter, setMemberFilter] = useState<MemberFilter>("all");
  const [editionFilter, setEditionFilter] = useState<number | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const editions = useMemo(() => {
    const set = new Set<number>();
    reports.forEach((r) => r.edition != null && set.add(r.edition));
    return Array.from(set).sort((a, b) => b - a);
  }, [reports]);

  const filtered = useMemo(() => {
    const mentorSet = new Set(mentorIds);
    const menteeSet = new Set(menteeIds);
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const dateLimit =
      dateFilter === "7d"
        ? now - 7 * dayMs
        : dateFilter === "30d"
        ? now - 30 * dayMs
        : dateFilter === "90d"
        ? now - 90 * dayMs
        : null;

    return reports.filter((r) => {
      if (memberFilter === "mentor" && !mentorSet.has(r.author_id)) return false;
      if (memberFilter === "mentee" && !menteeSet.has(r.author_id)) return false;
      if (memberFilter === "others") {
        if (
          mentorSet.has(r.author_id) ||
          menteeSet.has(r.author_id) ||
          r.author_id === currentUserId
        )
          return false;
      }
      if (editionFilter != null && r.edition !== editionFilter) return false;

      if (dateLimit != null) {
        const t = new Date(r.published_at ?? r.updated_at).getTime();
        if (t < dateLimit) return false;
      }

      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const author = authorMap[r.author_id];
        const haystack = [
          r.title,
          r.field,
          r.content?.step1?.name,
          r.content?.step1?.description,
          r.content?.step2?.principle,
          r.content?.summary?.thing,
          author?.display_name,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    reports,
    memberFilter,
    editionFilter,
    dateFilter,
    query,
    mentorIds,
    menteeIds,
    currentUserId,
    authorMap,
  ]);

  const hasFilter =
    query.trim() !== "" ||
    memberFilter !== "all" ||
    editionFilter !== null ||
    dateFilter !== "all";

  return (
    <div className="px-10 py-12 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-1">동아리 피드</h1>
        <p className="text-sm text-foreground/60">
          동아리원들이 공유한 보고서를 확인하세요.
        </p>
      </header>

      {/* 검색 */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search
            size={15}
            strokeWidth={1.75}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40 pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="제목, 작성자, 키워드 검색..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md bg-surface border border-border-default focus:outline-none focus:bg-white focus:border-foreground/20 transition-colors"
          />
        </div>
      </div>

      {/* 멤버 필터 */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-xs text-foreground/40 mr-0.5">멤버</span>
        {(
          [
            { value: "all", label: "전체" },
            { value: "mentor", label: `멘토 (${mentorIds.length})` },
            { value: "mentee", label: `멘티 (${menteeIds.length})` },
            { value: "others", label: "그 외" },
          ] as { value: MemberFilter; label: string }[]
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setMemberFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              memberFilter === opt.value
                ? "bg-foreground text-white"
                : "bg-surface text-foreground/70 hover:bg-black/[0.06]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 날짜 필터 */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <span className="text-xs text-foreground/40 mr-0.5">기간</span>
        {(
          [
            { value: "all", label: "전체" },
            { value: "7d", label: "최근 7일" },
            { value: "30d", label: "최근 30일" },
            { value: "90d", label: "최근 90일" },
          ] as { value: DateFilter; label: string }[]
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setDateFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              dateFilter === opt.value
                ? "bg-foreground text-white"
                : "bg-surface text-foreground/70 hover:bg-black/[0.06]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 차수 필터 */}
      {editions.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          <span className="text-xs text-foreground/40 mr-0.5">차수</span>
          {editions.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setEditionFilter((prev) => (prev === e ? null : e))}
              className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                editionFilter === e
                  ? "bg-accent/10 border-accent/30 text-accent font-medium"
                  : "border-border-default text-foreground/60 hover:bg-surface"
              }`}
            >
              {e}차
            </button>
          ))}
        </div>
      )}

      {hasFilter && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setMemberFilter("all");
            setEditionFilter(null);
            setDateFilter("all");
          }}
          className="inline-flex items-center gap-1 text-xs text-foreground/50 hover:text-foreground mb-4 transition-colors"
        >
          <X size={12} />
          필터 초기화
        </button>
      )}

      {filtered.length === 0 ? (
        <div className="border border-border-default rounded-lg p-16 text-center">
          <p className="text-sm text-foreground/50">
            {reports.length === 0
              ? "아직 공유된 보고서가 없습니다."
              : "조건에 맞는 보고서가 없습니다."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((r) => {
            const isMentor = mentorIds.includes(r.author_id);
            const isMentee = menteeIds.includes(r.author_id);
            const relation = isMentor ? "mentor" : isMentee ? "mentee" : null;
            return (
              <FeedCard
                key={r.id}
                report={r}
                author={authorMap[r.author_id] ?? null}
                reactionCount={reactionMap[r.id] ?? 0}
                relation={relation}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function FeedCard({
  report,
  author,
  reactionCount,
  relation,
}: {
  report: Report;
  author: FeedAuthor | null;
  reactionCount: number;
  relation: "mentor" | "mentee" | null;
}) {
  const description =
    report.content?.step1?.description ?? report.content?.summary?.thing ?? "";
  const date = new Date(report.published_at ?? report.updated_at);
  const dateStr = `${date.getMonth() + 1}월 ${date.getDate()}일`;
  const name = author?.display_name ?? "알 수 없음";
  const color = author?.avatar_color ?? "gray";
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
        <img src={firstImage} alt="" className="w-full aspect-video object-cover bg-surface" />
      )}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2 text-xs flex-wrap">
          {report.edition != null && (
            <span className="text-foreground/50 font-medium">{report.edition}차</span>
          )}
          {report.field && (
            <span className="px-1.5 py-0.5 rounded bg-surface group-hover:bg-white text-foreground/70 transition-colors">
              {report.field}
            </span>
          )}
          {relation === "mentor" && (
            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">멘토</span>
          )}
          {relation === "mentee" && (
            <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700">멘티</span>
          )}
        </div>

        <h3 className="text-base font-semibold text-foreground mb-1.5 line-clamp-1">
          {report.title || "제목 없음"}
        </h3>
        <p className="text-sm text-foreground/60 line-clamp-2 mb-3 min-h-[2.5rem]">
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
            <span className="flex items-center gap-1">
              <Heart size={12} strokeWidth={1.75} />
              {reactionCount}
            </span>
            <VisIcon size={12} strokeWidth={1.75} />
            <span>{dateStr}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
