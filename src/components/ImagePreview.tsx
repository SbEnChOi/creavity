"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";

export default function ImagePreview({ src, title = "첨부 이미지", href = src, className = "aspect-video", contain = false }: {
  src: string; title?: string; href?: string; className?: string; contain?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = failedSrc === src;
  return <a href={href} target="_blank" rel="noopener noreferrer" className={`relative block overflow-hidden rounded-lg border border-border-default bg-surface ${className}`} aria-label={`${title} 원본 보기`}>
    {failed ? <span className="flex h-full min-h-32 flex-col items-center justify-center gap-2 p-4 text-center text-sm leading-6 text-foreground/70"><ImageOff size={24} /><span>이미지를 불러오지 못했다.</span><span className="text-accent underline">원본 열기</span></span> :
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={title} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedSrc(src)} className={`h-full w-full ${contain ? "object-contain" : "object-cover"}`} />}
  </a>;
}
