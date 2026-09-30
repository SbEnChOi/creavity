import type { ReportContent } from "@/types/report";
import { safeUrl } from "@/lib/ai/schema";

export default function ReportAiNotes({ notes }: { notes?: ReportContent["ai_notes"] }) {
  if (!notes) return null;
  return <section className="mt-8 rounded-lg border border-border-default p-4 text-sm"><h2 className="mb-4 text-xs font-semibold text-foreground/60">AI 구체화 참고</h2>
    {!!notes.sources?.length && <div className="mb-4"><h3 className="mb-2 text-xs text-foreground/50">검색 출처</h3><ul className="space-y-2">{notes.sources.filter((s) => safeUrl(s.url)).map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{s.title}</a>{s.credit && <p className="text-[11px] text-foreground/50">{s.credit}</p>}</li>)}</ul></div>}
    {!!notes.suggestions?.length && <div className="mb-4"><h3 className="mb-2 text-xs text-foreground/50">AI 제안</h3><ul className="list-disc space-y-2 pl-4 text-foreground/70">{notes.suggestions.map((s,i) => <li key={i}>{s}</li>)}</ul></div>}
    {!!notes.open_questions?.length && <div><h3 className="mb-2 text-xs text-foreground/50">확인할 내용</h3><ul className="list-disc space-y-2 pl-4 text-foreground/70">{notes.open_questions.map((s,i) => <li key={i}>{s}</li>)}</ul></div>}
  </section>;
}
