import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "창의력",
  description: "동아리 후배들의 창의적 사고력을 키우기 위한 활동지 작성·공유 플랫폼",
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
