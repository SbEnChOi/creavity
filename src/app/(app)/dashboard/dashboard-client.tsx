"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, Heart, Globe, Lock, Users, UserCheck, X, Trash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { getReportFields, type Report, type Visibility } from "@/types/report";

type StatusFilter = "all" | "published" | "draft" | "private";

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "전체" },
  { value: "published", label: "발행됨" },
  { value: "draft", label: "작성중" },
  { value: "private", label: "비공개" },
];

export default function DashboardClient({ reports: initialReports }: { reports: Report[] }) {
  const router = useRouter();
  const [reports, setReports] = useState(initialReports);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [fieldFilter, setFieldFilter] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    if (!confirm("이 보고서를 삭제할까요? 되돌릴 수 없습니다.")) return;
    setDeletingId(id);
    const supabase = createSupabaseBrowserClient();
    const { error } = await supabase.from("reports").delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }
    setReports((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
  };

  // 실제 보고서들에서 분야 목록 추출 (중복 제거, 복수 분야 지원)
  const availableFields = useMemo(() => {
    const all = reports.flatMap((r) => getReportFields(r));
    return Array.from(new Set(all)).sort();
  }, [reports]);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter === "published" && r.status !== "published") return false;
      if (statusFilter === "draft" && r.status !== "draft") return false;
      if (statusFilter === "private" && r.visibility !== "private") return false;
      if (fieldFilter && !getReportFields(r).includes(fieldFilter)) return false;

      if (query.trim()) {
        const q = query.trim().toLowerCase();
        const haystack = [
          r.title,
          ...getReportFields(r),
          r.content?.step1?.description,
          r.content?.summary?.thing,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [reports, query, statusFilter, fieldFilter]);

  const hasActiveFilter = statusFilter !== "all" || fieldFilter !== null || query.trim() !== "";

  return (
    <div className="px-10 py-12 max-w-6xl">
      <header className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-1">내 보고서</h1>
          <p className="text-sm text-foreground/60">
            작성한 보고서를 한 곳에서 관리하세요.
          </p>
        </div>
        <Link
          href="/new"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-foreground text-white text-sm font-medium hover:bg-foreground/90 transition-colors"
        >
          <Plus size={16} strokeWidth={2} />
          새로 작성
        </Link>
      </header>

      {/* 검색창 */}
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
            placeholder="제목, 분야, 설명 검색..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md bg-surface border border-border-default focus:outline-none focus:bg-white focus:border-foreground/20 transition-colors"
          />
        </div>
      </div>

      {/* 상태 필터 칩 */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        {statusOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1 rounded-full text-xs transition-colors ${
              statusFilter === opt.value
                ? "bg-foreground text-white"
                : "bg-surface text-foreground/70 hover:bg-black/[0.06]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 분야 필터 칩 (보고서에 분야가 있을 때만 노출) */}
      {availableFields.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          <span className="text-xs text-foreground/40 mr-0.5">분야</span>
          {availableFields.map((field) => (
            <button
              key={field}
              type="button"
              onClick={() =>
                setFieldFilter((prev) => (prev === field ? null : field))
              }
              className={`px-2.5 py-0.5 rounded-full text-xs border transition-colors ${
                fieldFilter === field
                  ? "bg-accent/10 border-accent/30 text-accent font-medium"
                  : "border-border-default text-foreground/60 hover:bg-surface"
              }`}
            >
              {field}
            </button>
          ))}
        </div>
      )}

      {/* 활성 필터 초기화 */}
      {hasActiveFilter && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setStatusFilter("all");
            setFieldFilter(null);
          }}
          className="inline-flex items-center gap-1 text-xs text-foreground/50 hover:text-foreground mb-4 transition-colors"
        >
          <X size={12} />
          필터 초기화
        </button>
      )}

      {filtered.length === 0 ? (
        <div className="border border-border-default rounded-lg p-16 text-center">
          <p className="text-sm text-foreground/50 mb-4">
            {reports.length === 0
              ? "아직 작성한 보고서가 없습니다."
              : "조건에 맞는 보고서가 없습니다."}
          </p>
          {reports.length === 0 && (
            <Link
              href="/new"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border-default text-sm hover:bg-surface transition-colors"
            >
              <Plus size={14} />
              첫 보고서 작성하기
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              onDelete={handleDelete}
              deleting={deletingId === r.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ReportCard({
  report,
  onDelete,
  deleting,
}: {
  report: Report;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const reactionCount = 0;
  const description = report.content?.step1?.description ?? report.content?.summary?.thing ?? "";
  const date = new Date(report.updated_at);
  const dateStr = `${date.getMonth() + 1}월 ${date.getDate()}일`;

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(report.id); }}
        disabled={deleting}
        title="삭제"
        className="absolute top-2 right-2 z-10 p-1.5 rounded-md text-foreground/40 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
      >
        <Trash2 size={14} strokeWidth={1.75} />
      </button>
      <Link
        href={`/reports/${report.id}`}
        className="block p-4 rounded-lg border border-border-default hover:bg-surface transition-colors"
      >
      <div className="flex items-center gap-2 mb-2.5 text-xs flex-wrap pr-6">
        {report.edition != null && (
          <span className="text-foreground/50 font-medium">{report.edition}차</span>
        )}
        {getReportFields(report).map((f) => (
          <span key={f} className="px-1.5 py-0.5 rounded bg-surface group-hover:bg-white text-foreground/70 transition-colors">
            {f}
          </span>
        ))}
        {report.status === "draft" && (
          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">작성중</span>
        )}
      </div>

      <h3 className="text-base font-semibold text-foreground mb-1.5 line-clamp-1">
        {report.title || "제목 없음"}
      </h3>

      <p className="text-sm text-foreground/60 line-clamp-2 mb-4 min-h-[2.5rem]">
        {description || "내용이 없습니다."}
      </p>

      <div className="flex items-center justify-between text-xs text-foreground/50">
        <span>{dateStr}</span>
        <div className="flex items-center gap-2.5">
          <VisibilityBadge visibility={report.visibility} />
          <span className="flex items-center gap-1">
            <Heart size={12} strokeWidth={1.75} />
            {reactionCount}
          </span>
        </div>
      </div>
      </Link>
    </div>
  );
}

function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const map = {
    private: { Icon: Lock, label: "비공개" },
    custom: { Icon: UserCheck, label: "멘토" },
    club: { Icon: Users, label: "동아리" },
    public: { Icon: Globe, label: "전체" },
  } as const;
  const { Icon, label } = map[visibility] ?? map.private;
  return (
    <span className="flex items-center gap-1">
      <Icon size={12} strokeWidth={1.75} />
      {label}
    </span>
  );
}
