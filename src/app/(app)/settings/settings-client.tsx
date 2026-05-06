"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, UserPlus, UserMinus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const AVATAR_BG: Record<string, string> = {
  gray: "bg-gray-200 text-gray-700",
  blue: "bg-blue-100 text-blue-700",
  green: "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red: "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
};

const COLOR_OPTIONS = ["gray", "blue", "green", "yellow", "red", "purple"];

type Member = {
  id: string;
  display_name: string | null;
  avatar_color: string | null;
  grade: number | null;
};

export default function SettingsClient({
  currentUserId,
  me,
  members,
  mentorIds: initialMentorIds,
}: {
  currentUserId: string;
  me: Member;
  members: Member[];
  mentorIds: string[];
}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [displayName, setDisplayName] = useState(me.display_name ?? "");
  const [avatarColor, setAvatarColor] = useState(me.avatar_color ?? "gray");
  const [grade, setGrade] = useState<number | "">(me.grade ?? "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [mentorIds, setMentorIds] = useState<Set<string>>(new Set(initialMentorIds));
  const [pendingId, setPendingId] = useState<string | null>(null);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileSaved(false);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        avatar_color: avatarColor,
        grade: grade === "" ? null : Number(grade),
      })
      .eq("id", currentUserId);
    setSavingProfile(false);
    if (error) {
      alert("프로필 저장 실패: " + error.message);
      return;
    }
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
    router.refresh();
  };

  const toggleMentor = async (memberId: string) => {
    const has = mentorIds.has(memberId);
    setPendingId(memberId);

    if (has) {
      const { error } = await supabase
        .from("mentor_pairings")
        .delete()
        .eq("mentee_id", currentUserId)
        .eq("mentor_id", memberId);
      if (!error) {
        setMentorIds((prev) => {
          const next = new Set(prev);
          next.delete(memberId);
          return next;
        });
      } else {
        alert("실패: " + error.message);
      }
    } else {
      const { error } = await supabase
        .from("mentor_pairings")
        .insert({ mentee_id: currentUserId, mentor_id: memberId });
      if (!error) {
        setMentorIds((prev) => new Set(prev).add(memberId));
      } else {
        alert("실패: " + error.message);
      }
    }
    setPendingId(null);
  };

  return (
    <div className="px-10 py-12 max-w-3xl">
      <header className="mb-10">
        <h1 className="text-3xl font-bold text-foreground mb-1">환경설정</h1>
        <p className="text-sm text-foreground/60">
          내 프로필과 멘토를 관리합니다.
        </p>
      </header>

      {/* 프로필 편집 */}
      <section className="mb-12">
        <h2 className="text-sm font-semibold text-foreground mb-4 pb-2 border-b border-border-default">
          내 프로필
        </h2>

        <div className="space-y-5">
          <div>
            <label className="block text-xs font-medium text-foreground/60 mb-1.5">
              이름
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="이름을 입력하세요"
              className="w-full px-3 py-2 text-sm bg-surface rounded-md border border-transparent focus:border-foreground/20 focus:bg-white outline-none placeholder:text-foreground/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground/60 mb-1.5">
              학년
            </label>
            <input
              type="number"
              min={1}
              max={3}
              value={grade}
              onChange={(e) =>
                setGrade(e.target.value === "" ? "" : Number(e.target.value))
              }
              placeholder="1~3"
              className="w-24 px-3 py-2 text-sm bg-surface rounded-md border border-transparent focus:border-foreground/20 focus:bg-white outline-none placeholder:text-foreground/30"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground/60 mb-2">
              아바타 색상
            </label>
            <div className="flex items-center gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setAvatarColor(c)}
                  className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold transition-all ${
                    AVATAR_BG[c]
                  } ${
                    avatarColor === c
                      ? "ring-2 ring-offset-2 ring-foreground"
                      : ""
                  }`}
                >
                  {(displayName || "?").charAt(0)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="px-4 py-2 rounded-md bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-40 transition-colors"
            >
              {savingProfile ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 size={14} className="animate-spin" />
                  저장 중...
                </span>
              ) : (
                "저장"
              )}
            </button>
            {profileSaved && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <Check size={12} />
                저장됨
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 멤버 / 멘토 */}
      <section>
        <div className="flex items-baseline justify-between mb-4 pb-2 border-b border-border-default">
          <h2 className="text-sm font-semibold text-foreground">동아리 멤버</h2>
          <span className="text-xs text-foreground/50">
            멘토 {mentorIds.size}명
          </span>
        </div>

        {members.length === 0 ? (
          <p className="text-sm text-foreground/50 text-center py-10">
            아직 다른 멤버가 없습니다.
          </p>
        ) : (
          <ul className="space-y-1">
            {members.map((m) => {
              const isMentor = mentorIds.has(m.id);
              const isPending = pendingId === m.id;
              const name = m.display_name ?? "이름 없음";
              const color = m.avatar_color ?? "gray";
              return (
                <li
                  key={m.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-surface transition-colors"
                >
                  <span
                    className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold shrink-0 ${
                      AVATAR_BG[color] ?? AVATAR_BG.gray
                    }`}
                  >
                    {name.charAt(0)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {name}
                    </div>
                    {m.grade != null && (
                      <div className="text-xs text-foreground/50">
                        {m.grade}학년
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleMentor(m.id)}
                    disabled={isPending}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors disabled:opacity-50 ${
                      isMentor
                        ? "bg-accent/10 border-accent/30 text-accent hover:bg-accent/15"
                        : "border-border-default text-foreground/70 hover:bg-white"
                    }`}
                  >
                    {isPending ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : isMentor ? (
                      <UserMinus size={12} strokeWidth={1.75} />
                    ) : (
                      <UserPlus size={12} strokeWidth={1.75} />
                    )}
                    {isMentor ? "멘토 해제" : "멘토 신청"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
