"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowLeft, Globe, Lock, Users, UserCheck,
  Edit2, Lightbulb, HelpCircle, HandMetal, Microscope,
} from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Report, ReportContent, Visibility } from "@/types/report";
import type { CommentRow } from "./page";

// ─── 반응 타입 정의 ────────────────────────────────────────────────
const REACTIONS = [
  { type: "inspiration", emoji: "💡", label: "영감받음",   Icon: Lightbulb  },
  { type: "curious",     emoji: "🤔", label: "흥미로움",   Icon: HelpCircle },
  { type: "applause",    emoji: "👏", label: "잘했어요",   Icon: HandMetal  },
  { type: "learn_more",  emoji: "🔬", label: "더 알고 싶음", Icon: Microscope },
] as const;

type ReactionType = (typeof REACTIONS)[number]["type"];

const VISIBILITY_MAP: Record<Visibility, { Icon: typeof Globe; label: string }> = {
  private: { Icon: Lock,      label: "비공개"    },
  custom:  { Icon: UserCheck, label: "지정 공유" },
  club:    { Icon: Users,     label: "동아리"    },
  public:  { Icon: Globe,     label: "전체 공개" },
};

const DIFFICULTY_LABEL: Record<string, string> = {
  casual: "우연히", searched: "찾다가", deep: "깊이 파다가",
};
const FEASIBILITY_LABEL: Record<string, string> = {
  easy: "쉬움", medium: "보통", hard: "어려움",
};
const KIND_LABEL: Record<string, string> = {
  tech: "기술", idea: "아이디어",
};

const AVATAR_BG: Record<string, string> = {
  gray:   "bg-gray-200 text-gray-700",
  blue:   "bg-blue-100 text-blue-700",
  green:  "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red:    "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
};

type ProfileRel = { display_name: string | null; avatar_color: string | null; grade?: number | null } | null;

type ReportWithProfile = Report & { profiles: ProfileRel };

export default function ReportDetail({
  report,
  reactionCounts: initialCounts,
  myReactions: initialMine,
  comments: initialComments,
  currentUserId,
}: {
  report: ReportWithProfile;
  reactionCounts: Record<string, number>;
  myReactions: string[];
  comments: CommentRow[];
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [counts, setCounts]   = useState(initialCounts);
  const [mine, setMine]       = useState<Set<string>>(new Set(initialMine));
  const [comments, setComments] = useState(initialComments);
  const [commentBody, setCommentBody] = useState("");
  const [submitting, setSubmitting]   = useState(false);

  const isOwner = report.author_id === currentUserId;
  const c = report.content as ReportContent ?? {};
  const vis = VISIBILITY_MAP[report.visibility] ?? VISIBILITY_MAP.private;
  const date = new Date(report.created_at);
  const dateStr = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;

  // ─── 반응 토글 ──────────────────────────────────────────────────
  const handleReaction = async (type: ReactionType) => {
    const has = mine.has(type);
    // 낙관적 업데이트
    setMine((prev) => {
      const next = new Set(prev);
      if (has) { next.delete(type); } else { next.add(type); }
      return next;
    });
    setCounts((prev) => ({
      ...prev,
      [type]: Math.max(0, (prev[type] ?? 0) + (has ? -1 : 1)),
    }));

    if (has) {
      await supabase.from("reactions").delete()
        .eq("report_id", report.id)
        .eq("user_id", currentUserId)
        .eq("type", type);
    } else {
      await supabase.from("reactions").insert({
        report_id: report.id,
        user_id: currentUserId,
        type,
      });
    }
  };

  // ─── 댓글 추가 ──────────────────────────────────────────────────
  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim() || submitting) return;
    setSubmitting(true);

    const { data, error } = await supabase
      .from("comments")
      .insert({ report_id: report.id, author_id: currentUserId, body: commentBody.trim() })
      .select("id, body, created_at, profiles(display_name, avatar_color)")
      .single();

    setSubmitting(false);
    if (error || !data) return;
    setComments((prev) => [...prev, data as unknown as CommentRow]);
    setCommentBody("");
  };

  return (
    <div className="px-10 py-10 max-w-3xl">
      {/* 뒤로가기 */}
      <div className="flex items-center justify-between mb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-foreground/50 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={15} strokeWidth={1.75} />
          뒤로
        </button>
        {isOwner && (
          <Link
            href={`/reports/${report.id}/edit`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border-default text-sm hover:bg-surface transition-colors"
          >
            <Edit2 size={14} strokeWidth={1.75} />
            수정
          </Link>
        )}
      </div>

      {/* 헤더 */}
      <header className="mb-10">
        <div className="flex flex-wrap items-center gap-2 mb-3 text-xs text-foreground/50">
          {report.edition != null && (
            <span className="font-medium">{report.edition}차</span>
          )}
          {c.step1?.field && (
            <span className="px-1.5 py-0.5 rounded bg-surface">{c.step1.field}</span>
          )}
          <span className="flex items-center gap-1">
            <vis.Icon size={12} strokeWidth={1.75} />
            {vis.label}
          </span>
        </div>

        <h1 className="text-3xl font-bold text-foreground mb-4">
          {report.title || "제목 없음"}
        </h1>

        <div className="flex items-center gap-2.5">
          <AuthorAvatar profile={report.profiles} />
          <div className="text-sm text-foreground/60">
            <span className="font-medium text-foreground">
              {report.profiles?.display_name ?? "알 수 없음"}
            </span>
            {report.profiles?.grade && <span className="ml-1">{report.profiles.grade}학년</span>}
            <span className="mx-1.5">·</span>
            {dateStr}
          </div>
        </div>
      </header>

      {/* ─── Step 1: 발견 ─── */}
      <ContentSection number={1} label="발견">
        <Row label="부분"       value={KIND_LABEL[c.step1?.kind ?? ""] || c.step1?.kind} />
        <Row label="이름"       value={c.step1?.name} />
        <Row label="발견 난이도" value={DIFFICULTY_LABEL[c.step1?.difficulty ?? ""] || c.step1?.difficulty} />
        <Row label="출처"       value={c.step1?.source} />
        {c.step1?.url && (
          <Row label="링크">
            <a href={c.step1.url} target="_blank" rel="noopener noreferrer"
              className="text-accent hover:underline break-all">{c.step1.url}</a>
          </Row>
        )}
        <ImageGallery images={c.step1?.images} />
        <Prose label="설명" value={c.step1?.description} />
      </ContentSection>

      {/* ─── Step 2: 분석 ─── */}
      <ContentSection number={2} label="분석">
        <Prose label="내 말로 설명" value={c.step2?.principle} />
        <Prose label="강점"        value={c.step2?.strengths} />
        <Prose label="한계"        value={c.step2?.limits} />
      </ContentSection>

      {/* ─── Step 3: 확장 ─── */}
      <ContentSection number={3} label="확장">
        <Row label="아이디어 이름"  value={c.step3?.idea_name} />
        <Prose label="활용 방법"    value={c.step3?.application} />
        <Prose label="유사한 아이디어" value={c.step3?.similar_ideas} />
        <Row label="실현 가능성"    value={FEASIBILITY_LABEL[c.step3?.feasibility ?? ""] || c.step3?.feasibility} />
        <Prose label="이유"         value={c.step3?.feasibility_reason} />
      </ContentSection>

      {/* ─── Step 4: 한 줄 정리 ─── */}
      {(c.summary?.thing || c.summary?.problem) && (
        <ContentSection number={4} label="한 줄 정리">
          <Row label="무엇을"        value={c.summary?.thing} />
          <Row label="해결하려는 문제" value={c.summary?.problem} />
        </ContentSection>
      )}

      {/* ─── 반응 ─── */}
      <div className="mt-12 pt-8 border-t border-border-default">
        <p className="text-xs font-medium text-foreground/50 mb-3">반응</p>
        <div className="flex flex-wrap gap-2">
          {REACTIONS.map(({ type, emoji, label }) => {
            const active = mine.has(type);
            const count  = counts[type] ?? 0;
            return (
              <button
                key={type}
                type="button"
                onClick={() => handleReaction(type)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  active
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "border-border-default hover:bg-surface text-foreground/70"
                }`}
              >
                <span>{emoji}</span>
                <span>{label}</span>
                {count > 0 && (
                  <span className={`text-xs font-medium ${active ? "text-accent" : "text-foreground/50"}`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── 댓글 ─── */}
      <div className="mt-10 pb-16">
        <p className="text-xs font-medium text-foreground/50 mb-4">
          댓글 {comments.length > 0 && <span>({comments.length})</span>}
        </p>

        {comments.length > 0 && (
          <ul className="space-y-4 mb-6">
            {comments.map((cm) => (
              <li key={cm.id} className="flex gap-3">
                <AuthorAvatar profile={cm.profiles} size="sm" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-sm font-medium text-foreground">
                      {cm.profiles?.display_name ?? "알 수 없음"}
                    </span>
                    <span className="text-xs text-foreground/40">
                      {formatCommentDate(cm.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap">{cm.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleComment} className="flex gap-3">
          <div className="flex-1">
            <input
              type="text"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder="댓글을 입력하세요..."
              className="w-full px-3 py-2 text-sm rounded-md bg-surface border border-border-default focus:outline-none focus:bg-white focus:border-foreground/20 transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={!commentBody.trim() || submitting}
            className="px-4 py-2 rounded-md bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            등록
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── 서브 컴포넌트 ────────────────────────────────────────────────

function ContentSection({
  number, label, children,
}: { number: number; label: string; children: React.ReactNode }) {
  const items = Array.isArray(children)
    ? children.filter(Boolean)
    : children ? [children] : [];
  if (items.length === 0) return null;
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-5 pb-2 border-b border-border-default">
        <span className="flex items-center justify-center w-5 h-5 rounded bg-foreground/10 text-foreground text-xs font-semibold">
          {number}
        </span>
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Row({
  label, value, children,
}: { label: string; value?: string | null; children?: React.ReactNode }) {
  if (!value && !children) return null;
  return (
    <div className="text-sm">
      <p className="text-xs font-medium text-foreground/40 mb-1">{label}</p>
      <div className="px-3 py-2 rounded-md bg-surface text-foreground">
        {children ?? value}
      </div>
    </div>
  );
}

function Prose({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="text-sm">
      <p className="text-xs font-medium text-foreground/40 mb-1">{label}</p>
      <div className="px-4 py-3 rounded-md bg-surface text-foreground/85 leading-relaxed prose prose-sm max-w-none prose-p:my-2 prose-headings:mt-3 prose-headings:mb-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0 prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-code:bg-black/5 prose-code:px-1 prose-code:rounded prose-pre:bg-black/5">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{value}</ReactMarkdown>
      </div>
    </div>
  );
}

function ImageGallery({ images }: { images?: string[] }) {
  if (!images || images.length === 0) return null;
  return (
    <div className="text-sm">
      <p className="text-xs font-medium text-foreground/40 mb-1">사진</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {images.map((url) => (
          <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-video overflow-hidden rounded-md bg-surface border border-border-default">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
          </a>
        ))}
      </div>
    </div>
  );
}

function AuthorAvatar({
  profile,
  size = "md",
}: {
  profile: { display_name?: string | null; avatar_color?: string | null } | null;
  size?: "sm" | "md";
}) {
  const name = profile?.display_name ?? "?";
  const color = profile?.avatar_color ?? "gray";
  const cls = size === "sm" ? "w-6 h-6 text-xs" : "w-8 h-8 text-sm";
  return (
    <span className={`flex items-center justify-center rounded-full shrink-0 font-semibold ${cls} ${AVATAR_BG[color] ?? AVATAR_BG.gray}`}>
      {name.charAt(0)}
    </span>
  );
}

function formatCommentDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
