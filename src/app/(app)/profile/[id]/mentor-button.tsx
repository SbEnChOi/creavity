"use client";

import { useState } from "react";
import { Loader2, UserMinus, UserPlus } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function MentorButton({
  mentorId,
  currentUserId,
  initialIsMentor,
}: {
  mentorId: string;
  currentUserId: string;
  initialIsMentor: boolean;
}) {
  const [isMentor, setIsMentor] = useState(initialIsMentor);
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    setPending(true);
    const supabase = createSupabaseBrowserClient();

    if (isMentor) {
      const { error } = await supabase
        .from("mentor_pairings")
        .delete()
        .eq("mentee_id", currentUserId)
        .eq("mentor_id", mentorId);
      if (!error) setIsMentor(false);
      else alert("실패: " + error.message);
    } else {
      const { error } = await supabase
        .from("mentor_pairings")
        .insert({ mentee_id: currentUserId, mentor_id: mentorId });
      if (!error) setIsMentor(true);
      else alert("실패: " + error.message);
    }
    setPending(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium border transition-colors disabled:opacity-50 ${
        isMentor
          ? "bg-accent/10 border-accent/30 text-accent hover:bg-accent/15"
          : "border-border-default text-foreground/70 hover:bg-surface"
      }`}
    >
      {pending ? (
        <Loader2 size={14} className="animate-spin" />
      ) : isMentor ? (
        <UserMinus size={14} strokeWidth={1.75} />
      ) : (
        <UserPlus size={14} strokeWidth={1.75} />
      )}
      {isMentor ? "멘토 해제" : "멘토 신청"}
    </button>
  );
}
