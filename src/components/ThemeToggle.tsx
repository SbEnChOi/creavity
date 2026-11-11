"use client";

import { Moon, Sun } from "lucide-react";
import Tooltip from "@/components/Tooltip";
import "@/components/Tooltip.css";
import { useEffect, useState } from "react";
import { APPEARANCE_KEY, preferenceFor, readAppearance, resolveAppearance, saveAppearance, type Appearance } from "@/lib/appearance";

type Props = { className?: string };

export default function ThemeToggle({ className = "" }: Props) {
  const [appearance, setAppearance] = useState<Appearance>("light");

  useEffect(() => {
    let current: Appearance;
    try { current = readAppearance(window.localStorage); }
    catch { current = resolveAppearance(null); }
    setAppearance(current);
    document.documentElement.dataset.theme = current;
  }, []);

  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key === APPEARANCE_KEY || event.key === null) {
        try {
          const next = readAppearance(window.localStorage);
          setAppearance(next);
          document.documentElement.dataset.theme = next;
        } catch {
          const next = resolveAppearance(null);
          setAppearance(next);
          document.documentElement.dataset.theme = next;
        }
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

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
    <Tooltip label={label}><button type="button" onClick={toggle} aria-label={label}
      className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-foreground/75 transition-colors hover:bg-surface hover:text-foreground print:hidden ${className}`}>
      <Icon size={18} strokeWidth={1.75} aria-hidden="true" />
    </button></Tooltip>
  );
}
