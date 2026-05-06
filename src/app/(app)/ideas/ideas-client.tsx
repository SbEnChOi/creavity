"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const AVATAR_BG: Record<string, string> = {
  gray: "bg-gray-200 text-gray-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
};

export type IdeaRow = {
  id: string;
  author_id: string;
  title: string;
  body: string | null;
  created_at: string;
};

export type IdeaAuthor = {
  id: string;
  display_name: string | null;
  avatar_color: string | null;
};

export default function IdeasClient({
  ideas: initialIdeas,
  authorMap,
  currentUserId,
}: {
  ideas: IdeaRow[];
  authorMap: Record<string, IdeaAuthor>;
  currentUserId: string;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [ideas, setIdeas] = useState(initialIdeas);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || submitting) return;
    setSubmitting(true);
    setError(null);

    const { data, error } = await supabase
      .from("ideas")
      .insert({
        author_id: currentUserId,
        title: title.trim(),
        body: body.trim() || null,
      })
      .select("id, author_id, title, body, created_at")
      .single();

    setSubmitting(false);
    if (error || !data) {
      setError(error?.message ?? "등록 실패");
      return;
    }
    setIdeas((prev) => [data as IdeaRow, ...prev]);
    setTitle("");
    setBody("");
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("이 아이디어를 삭제할까요?")) return;
    setPendingId(id);
    const { error } = await supabase.from("ideas").delete().eq("id", id);
    setPendingId(null);
    if (error) {
      alert("삭제 실패: " + error.message);
      return;
    }
    setIdeas((prev) => prev.filter((i) => i.id !== id));
    router.refresh();
  };

  return (
    <div className="px-10 py-12 max-w-3xl">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-1 flex items-center gap-2">
          <Lightbulb size={24} strokeWidth={1.75} className="text-amber-500" />
          아이디어 공유
        </h1>
        <p className="text-sm text-foreground/60">
          갑자기 떠오른 생각을 가볍게 적어두세요. 정리는 나중에.
        </p>
      </header>

      {/* 작성 폼 */}
      <form
        onSubmit={handleSubmit}
        className="mb-10 p-5 rounded-lg border border-border-default bg-surface space-y-3"
      >
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="주제 (예: 책상 전체가 무선 충전 패드라면?)"
          className="w-full px-3 py-2 text-sm bg-white rounded-md border border-transparent focus:border-foreground/20 outline-none placeholder:text-foreground/30"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="내용 (생각나는 대로 자유롭게)"
          className="w-full px-3 py-2 text-sm bg-white rounded-md border border-transparent focus:border-foreground/20 outline-none placeholder:text-foreground/30 resize-none"
        />

        {error && (
          <div className="text-xs text-red-600 px-3 py-2 rounded-md bg-red-50 border border-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-foreground/40 inline-flex items-center gap-1">
            <Sparkles size={11} strokeWidth={1.75} />
            추후 AI로 자동 정리 예정
          </span>
          <button
            type="submit"
            disabled={!title.trim() || submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-40 transition-colors"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} strokeWidth={1.75} />
            )}
            등록
          </button>
        </div>
      </form>

      {/* 리스트 */}
      <section>
        <h2 className="text-xs font-medium text-foreground/40 mb-3">
          최근 아이디어 {ideas.length > 0 && <span>({ideas.length})</span>}
        </h2>

        {ideas.length === 0 ? (
          <div className="border border-border-default rounded-lg p-12 text-center">
            <p className="text-sm text-foreground/50">
              아직 등록된 아이디어가 없습니다. 첫 번째 생각을 적어보세요!
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {ideas.map((idea) => {
              const author = authorMap[idea.author_id];
              const name = author?.display_name ?? "알 수 없음";
              const color = author?.avatar_color ?? "gray";
              const isMine = idea.author_id === currentUserId;
              const date = new Date(idea.created_at);
              const dateStr = formatDate(date);

              return (
                <li
                  key={idea.id}
                  className="group relative p-4 rounded-lg border border-border-default hover:bg-surface/50 transition-colors"
                >
                  {isMine && (
                    <button
                      type="button"
                      onClick={() => handleDelete(idea.id)}
                      disabled={pendingId === idea.id}
                      title="삭제"
                      className="absolute top-3 right-3 p-1.5 rounded-md text-foreground/40 hover:text-red-600 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30"
                    >
                      {pendingId === idea.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <Trash2 size={13} strokeWidth={1.75} />
                      )}
                    </button>
                  )}

                  <h3 className="text-base font-semibold text-foreground mb-1.5 pr-8">
                    {idea.title}
                  </h3>
                  {idea.body && (
                    <p className="text-sm text-foreground/70 whitespace-pre-wrap mb-3 leading-relaxed">
                      {idea.body}
                    </p>
                  )}

                  <div className="flex items-center gap-1.5 text-xs text-foreground/50">
                    <Link
                      href={`/profile/${idea.author_id}`}
                      className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                    >
                      <span
                        className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold ${
                          AVATAR_BG[color] ?? AVATAR_BG.gray
                        }`}
                      >
                        {name.charAt(0)}
                      </span>
                      <span className="hover:underline">{name}</span>
                    </Link>
                    <span className="mx-1">·</span>
                    <span>{dateStr}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function formatDate(d: Date) {
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return "방금 전";
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
  if (diff < 7 * 86400) return `${Math.floor(diff / 86400)}일 전`;
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}
