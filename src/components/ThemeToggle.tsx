"use client";

import { Moon, Sun } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { APPEARANCE_KEY, preferenceFor, readAppearance, resolveAppearance, saveAppearance, type Appearance } from "@/lib/appearance";

type Props = { className?: string };

export default function ThemeToggle({ className = "" }: Props) {
  const [appearance, setAppearance] = useState<Appearance>("light");
  const pathname = usePathname();

  useEffect(() => {
    let current: Appearance;
    try { current = readAppearance(window.localStorage, pathname); }
    catch { current = resolveAppearance(null, pathname); }
    setAppearance(current);
    document.documentElement.dataset.theme = current;
  }, [pathname]);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === APPEARANCE_KEY || event.key === null) {
        try {
          const next = readAppearance(window.localStorage, pathname);
          setAppearance(next);
          document.documentElement.dataset.theme = next;
        } catch {
          const next = resolveAppearance(null, pathname);
          setAppearance(next);
          document.documentElement.dataset.theme = next;
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, [pathname]);

  function toggle() {
    const next = preferenceFor(appearance);
    setAppearance(next);
    document.documentElement.dataset.theme = next;
    try { saveAppearance(window.localStorage, next); }
    catch { /* The appearance still applies for this page. */ }
  }

  const label = appearance === "light" ? "다크 모드로 전환" : "라이트 모드로 전환";
  const Icon = appearance === "light" ? Moon : Sun;
  return (
    <button type="button" onClick={toggle} aria-label={label} title={label}
      className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-foreground/75 transition-colors hover:bg-surface hover:text-foreground print:hidden ${className}`}>
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
}
