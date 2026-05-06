"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FileText, PenSquare, Users, Settings, LogOut, Shield, Info, Lightbulb } from "lucide-react";
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const menuItems = [
  { href: "/dashboard", label: "내 보고서", icon: FileText },
  { href: "/new", label: "새로 작성", icon: PenSquare },
  { href: "/feed", label: "동아리 피드", icon: Users },
  { href: "/ideas", label: "아이디어 공유", icon: Lightbulb },
  { href: "/settings", label: "환경설정", icon: Settings },
  { href: "/about", label: "정보", icon: Info },
];

// avatar_color: 스키마 기반 색상 문자열 (gray, blue, green …)
const avatarBg: Record<string, string> = {
  gray:   "bg-gray-200 text-gray-700",
  blue:   "bg-blue-100 text-blue-700",
  green:  "bg-green-100 text-green-700",
  yellow: "bg-yellow-100 text-yellow-700",
  red:    "bg-red-100 text-red-700",
  purple: "bg-purple-100 text-purple-700",
};

type ClubRel = { name: string | null } | { name: string | null }[] | null;

type Profile = {
  id: string;
  display_name: string | null;
  avatar_color: string | null;
  is_admin?: boolean | null;
  club_id: string | null;
  clubs?: ClubRel;
} | null;

export default function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const name = profile?.display_name ?? "이름 없음";
  const initial = name.charAt(0);
  const color = profile?.avatar_color ?? "gray";
  const clubName = Array.isArray(profile?.clubs)
    ? profile?.clubs[0]?.name
    : profile?.clubs?.name;

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <aside className="w-60 shrink-0 h-screen sticky top-0 flex flex-col bg-surface border-r border-border-default print:hidden">
      <div className="px-5 pt-6 pb-4">
        <Link href="/dashboard" className="inline-flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-md bg-foreground text-white text-sm font-bold">
            C
          </span>
          <span className="text-sm font-semibold text-foreground">Creavy</span>
        </Link>
      </div>

      <nav className="flex-1 px-2 py-2">
        <ul className="space-y-0.5">
          {[
            ...menuItems,
            ...(profile?.is_admin
              ? [{ href: "/admin", label: "관리자", icon: Shield }]
              : []),
          ].map(({ href, label, icon: Icon }) => {
            const active =
              href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                    active
                      ? "bg-black/[0.06] text-foreground font-medium"
                      : "text-foreground/70 hover:bg-black/[0.04] hover:text-foreground"
                  }`}
                >
                  <Icon size={16} strokeWidth={1.75} />
                  <span>{label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="px-2 pb-3 relative">
        {menuOpen && (
          <div className="absolute bottom-full left-2 right-2 mb-1 bg-white border border-border-default rounded-md py-1 shadow-sm">
            <button
              type="button"
              onClick={handleSignOut}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-foreground/70 hover:bg-black/[0.04] hover:text-foreground"
            >
              <LogOut size={14} strokeWidth={1.75} />
              로그아웃
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md hover:bg-black/[0.04] transition-colors text-left"
        >
          <span
            className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-semibold shrink-0 ${avatarBg[color] ?? avatarBg.gray}`}
          >
            {initial}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-foreground truncate">
              {name}
            </span>
            <span className="block text-xs text-foreground/50 truncate">
              {clubName ?? "동아리 미지정"}
            </span>
          </span>
        </button>
      </div>
    </aside>
  );
}
