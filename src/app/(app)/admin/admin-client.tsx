"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Search, Shield, ShieldOff, Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Report } from "@/types/report";

const AVATAR_BG: Record<string, string> = {
  gray: "bg-gray-200 text-gray-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
};

export type AdminMember = {
  id: string;
  display_name: string | null;
  avatar_color: string | null;
  grade: number | null;
  is_admin: boolean | null;
};

export type AdminReport = Report & {
  author: AdminMember | null;
};

type Tab = "reports" | "members";

export default function AdminClient({
  members: initialMembers,
  reports: initialReports,
  currentUserId,
}: {
  members: AdminMember[];
  reports: AdminReport[];
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [tab, setTab] = useState<Tab>("reports");
  const [members, setMembers] = useState(initialMembers);
  const [reports, setReports] = useState(initialReports);
  const [query, setQuery] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);

  const filteredReports = useMemo(() => {
    if (!query.trim()) return reports;
    const q = query.trim().toLowerCase();
    return reports.filter((r) =>
      [r.title, r.field, r.author?.display_name]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [reports, query]);

  const filteredMembers = useMemo(() => {
    if (!query.trim()) return members;
    const q = query.trim().toLowerCase();
    return members.filter((m) =>
      (m.display_name ?? "").toLowerCase().includes(q)
    );
  }, [members, query]);

  const handleDeleteReport = async (id: string) => {
    if (!confirm("이 보고서를 삭제할까요? 되돌릴 수 없습니다.")) return;
    setPendingId(id);
    const { error } = await supabase.from("reports").delete().eq("id", id);
    setPendingId(null);
    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }
    setReports((prev) => prev.filter((r) => r.id !== id));
    router.refresh();
  };

  const toggleAdmin = async (memberId: string, currentValue: boolean) => {
    if (memberId === currentUserId) {
      alert("본인의 관리자 권한은 변경할 수 없습니다.");
      return;
    }
    if (!confirm(currentValue ? "관리자 권한을 해제할까요?" : "관리자로 지정할까요?"))
      return;
    setPendingId(memberId);
    const { error } = await supabase
      .from("profiles")
      .update({ is_admin: !currentValue })
      .eq("id", memberId);
    setPendingId(null);
    if (error) {
      alert("실패: " + error.message);
      return;
    }
    setMembers((prev) =>
      prev.map((m) => (m.id === memberId ? { ...m, is_admin: !currentValue } : m))
    );
    router.refresh();
  };

  return (
    <div className="px-10 py-12 max-w-5xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Shield size={24} strokeWidth={1.75} className="text-accent" />
          관리자
        </h1>
        <p className="text-sm text-foreground/60">
          모든 멤버와 보고서를 관리합니다.
        </p>
      </header>

      {/* 탭 */}
      <div className="flex items-center gap-1 mb-5 border-b border-border-default">
        {(
          [
            { value: "reports", label: `보고서 (${reports.length})` },
            { value: "members", label: `멤버 (${members.length})` },
          ] as { value: Tab; label: string }[]
        ).map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setTab(opt.value)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === opt.value
                ? "border-foreground text-foreground"
                : "border-transparent text-foreground/50 hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* 검색 */}
      <div className="mb-5">
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
            placeholder={tab === "reports" ? "제목·작성자 검색..." : "이름 검색..."}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-md bg-surface border border-border-default focus:outline-none focus:bg-white focus:border-foreground/20 transition-colors"
          />
        </div>
      </div>

      {tab === "reports" && (
        <ReportTable
          reports={filteredReports}
          onDelete={handleDeleteReport}
          pendingId={pendingId}
        />
      )}

      {tab === "members" && (
        <MemberTable
          members={filteredMembers}
          onToggleAdmin={toggleAdmin}
          pendingId={pendingId}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
}

function ReportTable({
  reports,
  onDelete,
  pendingId,
}: {
  reports: AdminReport[];
  onDelete: (id: string) => void;
  pendingId: string | null;
}) {
  if (reports.length === 0) {
    return (
      <div className="border border-border-default rounded-lg p-12 text-center">
        <p className="text-sm text-foreground/50">보고서가 없습니다.</p>
      </div>
    );
  }
  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-surface text-xs text-foreground/60">
          <tr>
            <th className="text-left px-4 py-2.5 font-medium">제목</th>
            <th className="text-left px-4 py-2.5 font-medium w-32">작성자</th>
            <th className="text-left px-4 py-2.5 font-medium w-20">차수</th>
            <th className="text-left px-4 py-2.5 font-medium w-24">상태</th>
            <th className="text-left px-4 py-2.5 font-medium w-28">날짜</th>
            <th className="w-12"></th>
          </tr>
        </thead>
        <tbody>
          {reports.map((r) => {
            const date = new Date(r.updated_at);
            const dateStr = `${date.getFullYear()}.${date.getMonth() + 1}.${date.getDate()}`;
            return (
              <tr
                key={r.id}
                className="border-t border-border-default hover:bg-surface/50"
              >
                <td className="px-4 py-2.5">
                  <Link
                    href={`/reports/${r.id}`}
                    className="text-foreground hover:underline line-clamp-1"
                  >
                    {r.title || "제목 없음"}
                  </Link>
                </td>
                <td className="px-4 py-2.5 text-foreground/70">
                  {r.author?.display_name ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-foreground/70">
                  {r.edition != null ? `${r.edition}차` : "—"}
                </td>
                <td className="px-4 py-2.5">
                  {r.status === "published" ? (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700">
                      발행
                    </span>
                  ) : (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                      작성중
                    </span>
                  )}
                </td>
                <td className="px-4 py-2.5 text-xs text-foreground/50">
                  {dateStr}
                </td>
                <td className="px-2 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => onDelete(r.id)}
                    disabled={pendingId === r.id}
                    title="삭제"
                    className="p-1.5 rounded-md text-foreground/40 hover:text-red-600 hover:bg-red-50 transition-colors disabled:opacity-30"
                  >
                    {pendingId === r.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} strokeWidth={1.75} />
                    )}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function MemberTable({
  members,
  onToggleAdmin,
  pendingId,
  currentUserId,
}: {
  members: AdminMember[];
  onToggleAdmin: (id: string, current: boolean) => void;
  pendingId: string | null;
  currentUserId: string;
}) {
  if (members.length === 0) {
    return (
      <div className="border border-border-default rounded-lg p-12 text-center">
        <p className="text-sm text-foreground/50">멤버가 없습니다.</p>
      </div>
    );
  }
  return (
    <div className="border border-border-default rounded-lg overflow-hidden">
      <ul>
        {members.map((m) => {
          const name = m.display_name ?? "이름 없음";
          const color = m.avatar_color ?? "gray";
          const isMe = m.id === currentUserId;
          const isAdmin = !!m.is_admin;
          return (
            <li
              key={m.id}
              className="flex items-center gap-3 px-4 py-3 border-t border-border-default first:border-t-0 hover:bg-surface/50"
            >
              <Link
                href={`/profile/${m.id}`}
                className="flex items-center gap-3 flex-1 min-w-0"
              >
                <span
                  className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold shrink-0 ${
                    AVATAR_BG[color] ?? AVATAR_BG.gray
                  }`}
                >
                  {name.charAt(0)}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-foreground truncate hover:underline">
                      {name}
                    </span>
                    {isAdmin && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium">
                        관리자
                      </span>
                    )}
                    {isMe && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-foreground/10 text-foreground/60">
                        나
                      </span>
                    )}
                  </div>
                  {m.grade != null && (
                    <div className="text-xs text-foreground/50">{m.grade}학년</div>
                  )}
                </div>
              </Link>
              <button
                type="button"
                onClick={() => onToggleAdmin(m.id, isAdmin)}
                disabled={pendingId === m.id || isMe}
                title={isMe ? "본인은 변경 불가" : isAdmin ? "관리자 해제" : "관리자 지정"}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border-default text-xs font-medium text-foreground/70 hover:bg-white transition-colors disabled:opacity-30"
              >
                {pendingId === m.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : isAdmin ? (
                  <ShieldOff size={12} strokeWidth={1.75} />
                ) : (
                  <Shield size={12} strokeWidth={1.75} />
                )}
                {isAdmin ? "관리자 해제" : "관리자 지정"}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
