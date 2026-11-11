"use client";

import React, { cloneElement, useEffect, useId, useRef, useState, type ReactElement } from "react";
import { createPortal } from "react-dom";
import { tooltipPosition } from "./tooltipPosition";

type Props = {
  label: string;
  children: ReactElement;
  side?: "top" | "right";
  mobileOnly?: boolean;
};

const LONG_PRESS_MS = 500;

export default function Tooltip({ label, children, side = "top", mobileOnly = false }: Props) {
  const id = useId();
  const trigger = useRef<HTMLElement | null>(null);
  const bubble = useRef<HTMLSpanElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const touchFocus = useRef(false);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: 0, top: 0 });
  const [inDialog, setInDialog] = useState(false);

  function clearClose() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
  }
  function clearPress() {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = null;
    pressStart.current = null;
  }
  function show() {
    clearClose();
    if (mobileOnly && window.matchMedia("(min-width: 768px)").matches) return;
    setOpen(true);
  }
  function hideLater() {
    clearClose();
    closeTimer.current = setTimeout(() => {
      if (document.activeElement !== trigger.current && !trigger.current?.matches(":hover") && !bubble.current?.matches(":hover")) setOpen(false);
    }, 120);
  }
  useEffect(() => () => { clearClose(); clearPress(); }, []);
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      // Escape closes the tooltip but keeps travelling, so a surrounding dialog closes on the same press.
      if (event.key === "Escape") setOpen(false);
    }
    function onOutsidePointer(event: PointerEvent) {
      const target = event.target as Node | null;
      if (trigger.current?.contains(target) || bubble.current?.contains(target)) return;
      setOpen(false);
    }
    function reposition() {
      if (!trigger.current || !bubble.current) return;
      const rect = trigger.current.getBoundingClientRect();
      const tip = bubble.current.getBoundingClientRect();
      setPosition(tooltipPosition(rect, tip, { width: window.innerWidth, height: window.innerHeight }, side));
    }
    function onViewportChange() {
      if (mobileOnly && window.matchMedia("(min-width: 768px)").matches) setOpen(false);
      else reposition();
    }
    setInDialog(!!trigger.current?.closest("dialog[open]"));
    reposition();
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => !entry.isIntersecting)) setOpen(false);
    });
    if (trigger.current) observer.observe(trigger.current);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onOutsidePointer, true);
    window.addEventListener("resize", onViewportChange);
    window.addEventListener("scroll", reposition, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onOutsidePointer, true);
      window.removeEventListener("resize", onViewportChange);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, side, mobileOnly]);

  const childProps = children.props as { "aria-label"?: string; "aria-describedby"?: string } | undefined;
  // A tooltip that repeats the accessible name adds nothing for assistive tech.
  const described = childProps?.["aria-label"] === label ? children : cloneElement(children as ReactElement<{ "aria-describedby"?: string }>, {
    "aria-describedby": [childProps?.["aria-describedby"], id].filter(Boolean).join(" "),
  });
  const tip = <span ref={bubble} id={id} role="tooltip" hidden={!open} data-side={side} className="creavy-tooltip" style={{ left: position.left, top: position.top }} onPointerEnter={clearClose} onPointerLeave={hideLater}>{label}</span>;
  return <>
    <span
      className="creavy-tooltip-trigger"
      ref={node => { trigger.current = node?.firstElementChild as HTMLElement | null; }}
      onPointerDown={event => {
        touchFocus.current = event.pointerType === "touch";
        if (!touchFocus.current) return;
        clearClose();
        clearPress();
        setOpen(false);
        pressStart.current = { x: event.clientX, y: event.clientY };
        pressTimer.current = setTimeout(() => { pressTimer.current = null; show(); }, LONG_PRESS_MS);
      }}
      onPointerMove={event => {
        if (!pressStart.current) return;
        if (Math.abs(event.clientX - pressStart.current.x) > 8 || Math.abs(event.clientY - pressStart.current.y) > 8) clearPress();
      }}
      onPointerUp={clearPress}
      onPointerCancel={clearPress}
      onPointerEnter={event => { if (event.pointerType !== "touch") show(); }}
      onPointerLeave={event => { if (event.pointerType !== "touch") hideLater(); }}
      onFocus={() => { if (!touchFocus.current) show(); }}
      onKeyDownCapture={event => { if (event.key !== "Escape" && touchFocus.current) { touchFocus.current = false; show(); } }}
      onBlur={() => { touchFocus.current = false; hideLater(); }}
    >
      {described}
      {inDialog && tip}
    </span>
    {!inDialog && (typeof document === "undefined" ? tip : createPortal(tip, document.body))}
  </>;
}
