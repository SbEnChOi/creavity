import type { ReportContent } from "@/types/report";
import { safeUrl, type SessionState } from "./schema";
import { referenceThumbnail } from "../images";

export function draftToReport(state: SessionState): { title: string; content: ReportContent } | null {
  if (state.phase !== "review" || !state.confirmed || !state.draft) return null;
  const { execution, ...content } = state.draft.content;
  return {
    title: state.draft.title,
    content: {
      ...content,
      ...(execution ? { execution } : {}),
      ai_notes: {
        // Raw conversation metadata is not separately attached to shared reports.
        sources: (state.research?.resources ?? []).filter((r) => safeUrl(r.url)).map((source) => {
          const { title, url, kind, credit } = source;
          const thumbnail = referenceThumbnail(source);
          return { title, url, kind, ...(thumbnail ? { thumbnail } : {}), ...(credit ? { credit } : {}) };
        }),
        suggestions: state.draft.suggestions,
        open_questions: state.draft.open_questions,
      },
    },
  };
}
