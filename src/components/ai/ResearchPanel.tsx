"use client";

import { useState } from "react";
import { ExternalLink, Film, ImageIcon, Search } from "lucide-react";
import { safeUrl, videoId, type Research } from "@/lib/ai/schema";
import { referenceThumbnail } from "@/lib/images";
import ImagePreview from "../ImagePreview";
import FormattedText from "../FormattedText";

export default function ResearchPanel({ research }: { research: Research | null }) {
  const [tab, setTab] = useState<"all" | "web" | "image" | "video">("all");
  const [playing, setPlaying] = useState<string | null>(null);
  if (!research) return <div className="rounded-xl bg-surface p-5 text-sm leading-7 text-foreground/85"><Search size={17} className="mb-3" />방향 확인 후 비슷한 사례와 글·사진·영상 자료를 찾는다.</div>;
  const citations = [...research.citations].sort((a, b) => a.start - b.start);
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  citations.forEach((c, i) => {
    if (c.start < cursor || !safeUrl(c.url)) return;
    parts.push(<FormattedText key={`text-${i}`} value={research.text.slice(cursor, c.start)} />);
    parts.push(<a key={`${c.url}-${i}`} href={c.url} target="_blank" rel="noopener noreferrer" className="mx-1 text-accent underline" title={c.title}>[{i + 1}]</a>);
    cursor = c.end;
  });
  parts.push(<FormattedText key="last-text" value={research.text.slice(cursor)} />);
  const resources = research.resources.filter((r) => safeUrl(r.url) && (tab === "all" || r.kind === tab));
  return <section aria-label="검색 자료" className="space-y-4">
    <div className="text-sm leading-7 text-foreground/85 whitespace-pre-wrap">{parts}</div>
    {research.warning && <p className="text-sm text-foreground/75 bg-surface rounded-lg p-3">{research.warning}</p>}
    <div className="flex gap-1 border-b border-border-default pb-2" aria-label="자료 종류">
      {([ ["all", "전체"], ["web", "글"], ["image", "사진"], ["video", "영상"] ] as const).map(([value, label]) =>
        <button type="button" key={value} aria-pressed={tab === value} onClick={() => setTab(value)} className={`rounded-md px-3 py-1.5 text-sm ${tab === value ? "bg-foreground text-white" : "hover:bg-surface text-foreground/75"}`}>{label}</button>)}
    </div>
    <div className="grid gap-4">
      {resources.map((r) => {
        const id = videoId(r.url);
        const thumbnail = referenceThumbnail(r);
        return <article key={r.url} className="overflow-hidden rounded-lg border border-border-default">
          {thumbnail && <ImagePreview src={thumbnail} href={r.url} title={r.title} />}
          {id && (playing === id
            ? <iframe title={r.title} src={`https://www.youtube-nocookie.com/embed/${id}`} className="aspect-video w-full" sandbox="allow-scripts allow-same-origin allow-presentation" allow="fullscreen" allowFullScreen />
            : <button type="button" onClick={() => setPlaying(id)} className="flex w-full items-center justify-center gap-2 bg-surface py-6 text-sm"><Film size={17} />영상 미리보기</button>)}
          <a href={r.url} target="_blank" rel="noopener noreferrer" className="block p-3 hover:bg-surface">
            <span className="mb-2 flex items-center gap-1.5 text-sm text-foreground/70">{r.kind === "image" ? <ImageIcon size={12} /> : <ExternalLink size={12} />}{new URL(r.url).hostname}</span>
            <p className="text-base font-medium line-clamp-2">{r.title}</p>
            {r.credit && <p className="mt-2 text-sm leading-6 text-foreground/70">{r.credit}</p>}
          </a>
        </article>;
      })}
    </div>
    {!resources.length && <p className="text-sm text-foreground/70">이 종류의 자료는 아직 찾지 못했습니다.</p>}
    {tab === "video" && research.videoSearchUrl && safeUrl(research.videoSearchUrl) && <a href={research.videoSearchUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm text-accent hover:underline"><Film size={14} />YouTube에서 관련 영상 직접 검색</a>}
    <p className="text-sm leading-5 text-foreground/70">검색 자료는 참고용입니다. 이미지의 제작자·이용 조건은 원본에서 확인할 수 있습니다.</p>
  </section>;
}
