import { textParts } from "@/lib/images";
import ImagePreview from "./ImagePreview";

export default function FormattedText({ value }: { value: string }) {
  return <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">{textParts(value).map((part, i) => {
    if (part.kind === "bold") return <strong key={i} className="font-semibold text-foreground">{part.text}</strong>;
    if (part.kind === "image") return <span key={i} className="my-3 block max-w-xl"><ImagePreview src={part.url} title={part.text} contain /></span>;
    if (part.kind === "link") return <a key={i} href={part.url} title={part.url} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/30 underline-offset-4 hover:decoration-accent">{part.text === part.url ? new URL(part.url).hostname : part.text}</a>;
    return part.text;
  })}</span>;
}
