import Link from "next/link";

type Props = { href?: string; className?: string; animated?: boolean };

export default function Wordmark({ href = "/", className = "", animated = false }: Props) {
  return <Link href={href} aria-label="Creavy 홈" className={`${className} creavy-wordmark${animated ? " creavy-wordmark-intro" : ""}`}>
    <span>creavy</span><i aria-hidden="true" />
  </Link>;
}
