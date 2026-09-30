import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Creavy · 크래비",
  description: "일상의 아이디어를 발견하고 정리하며 함께 나누는 플랫폼",
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
