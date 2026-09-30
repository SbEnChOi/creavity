import type { ReportContent } from "@/types/report";
import { safeUrl } from "@/lib/ai/schema";
import { referenceThumbnail } from "@/lib/images";
import ImagePreview from "../ImagePreview";
import FormattedText from "../FormattedText";

export default function ReportAiNotes({ notes }: { notes?: ReportContent["ai_notes"] }) {
  if (!notes) return null;
  const sources = notes.sources?.filter((s) => safeUrl(s.url)) ?? [];
  const images = sources.filter((s) => s.kind === "image");
  const links = sources.filter((s) => s.kind !== "image");
  return <section className="report-ai-notes mt-8 space-y-6 rounded-xl border border-border-default p-5 text-base leading-7 [overflow-wrap:anywhere] md:p-6">
    <h2 className="text-lg font-semibold">AI 구체화 참고</h2>
    {!!images.length && <div><h3 className="mb-3 text-sm font-semibold text-foreground/75">참고 이미지</h3><div className="grid gap-4 sm:grid-cols-2">{images.map((source) => {
      const thumbnail = referenceThumbnail(source);
      return <figure key={source.url} className="min-w-0">
        {thumbnail && <ImagePreview src={thumbnail} href={source.url} title={source.title} contain />}
        <figcaption className="mt-2"><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-accent hover:underline">{source.title}</a>{source.credit && <p className="mt-1 text-sm leading-6 text-foreground/70">{source.credit}</p>}</figcaption>
      </figure>;
    })}</div></div>}
    {!!links.length && <div><h3 className="mb-3 text-sm font-semibold text-foreground/75">검색 출처</h3><ul className="space-y-3">{links.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">{source.title}</a></li>)}</ul></div>}
    {!!notes.suggestions?.length && <div className="rounded-lg bg-surface p-4"><h3 className="mb-3 text-sm font-semibold text-foreground/75">AI 제안</h3><ul className="list-disc space-y-3 pl-5">{notes.suggestions.map((s,i) => <li key={i}><FormattedText value={s} /></li>)}</ul></div>}
    {!!notes.open_questions?.length && <div><h3 className="mb-3 text-sm font-semibold text-foreground/75">확인할 내용</h3><ul className="list-disc space-y-3 pl-5">{notes.open_questions.map((s,i) => <li key={i}><FormattedText value={s} /></li>)}</ul></div>}
  </section>;
}
