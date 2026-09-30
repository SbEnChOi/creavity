import { safeUrl } from "./ai/schema";

// Older content may contain Markdown image syntax instead of a bare URL.
export function imageUrl(value: string): string | null {
  const markdown = value.trim().match(/^!\[[^\]]*\]\((https:\/\/[^\s]+?)(?:\s+"[^"]*")?\)$/);
  return safeUrl(markdown?.[1] ?? value.trim());
}

export function referenceThumbnail(source: { kind: string; url: string; thumbnail?: string }): string | null {
  if (source.kind !== "image") return null;
  const thumbnail = source.thumbnail ? safeUrl(source.thumbnail) : null;
  if (thumbnail && ["upload.wikimedia.org", "thumb.wikimedia.org"].includes(new URL(thumbnail).hostname)) return thumbnail;

  // Reports saved before thumbnails were retained can still show the original Commons image.
  const original = safeUrl(source.url);
  if (!original) return null;
  const url = new URL(original);
  if (url.hostname !== "commons.wikimedia.org") return null;
  const filename = url.pathname.match(/^\/wiki\/File:(.+)$/)?.[1];
  if (!filename) return null;
  try {
    return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(decodeURIComponent(filename))}?width=600`;
  } catch { return null; }
}

export type TextPart = { kind: "text" | "bold"; text: string } | { kind: "image" | "link"; text: string; url: string };

// Render only these few Markdown elements. HTML always remains ordinary text.
export function textParts(value: string): TextPart[] {
  const parts: TextPart[] = [];
  const tokens = /!\[([^\]]*)\]\((https:\/\/[^\s]+?)(?:\s+"[^"]*")?\)|\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*\n]+)\*\*|https:\/\/[^\s<>]+/g;
  let cursor = 0;
  for (const match of value.matchAll(tokens)) {
    const at = match.index!;
    if (at > cursor) parts.push({ kind: "text", text: value.slice(cursor, at) });
    if (match[1] !== undefined) {
      const url = imageUrl(match[0]);
      parts.push(url ? { kind: "image", text: match[1] || "첨부 이미지", url } : { kind: "text", text: match[0] });
    } else if (match[3] !== undefined) {
      const url = safeUrl(match[4]);
      parts.push(url ? { kind: "link", text: match[3], url } : { kind: "text", text: match[0] });
    } else if (match[5] !== undefined) parts.push({ kind: "bold", text: match[5] });
    else {
      const trailing = match[0].match(/[.,;!?)]*$/)?.[0] ?? "";
      const url = safeUrl(match[0].slice(0, match[0].length - trailing.length));
      const standalone = !value.slice(value.lastIndexOf("\n", at - 1) + 1, at).trim() && !value.slice(at + match[0].length).split("\n")[0].trim();
      const isImage = url && standalone && /\.(png|jpe?g|webp|gif|avif)$/i.test(new URL(url).pathname);
      parts.push(url ? { kind: isImage ? "image" : "link", text: isImage ? "첨부 이미지" : url, url } : { kind: "text", text: match[0] });
      if (url && trailing) parts.push({ kind: "text", text: trailing });
    }
    cursor = at + match[0].length;
  }
  if (cursor < value.length) parts.push({ kind: "text", text: value.slice(cursor) });
  return parts;
}
