import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creavy · 크래비",
  description: "동아리원들의 창의적 사고력을 함께 키우는 보고서 작성·공유 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
