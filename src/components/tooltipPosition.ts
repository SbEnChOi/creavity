type Rect = { left: number; right: number; top: number; bottom: number };
type Size = { width: number; height: number };

export function tooltipPosition(trigger: Rect, tooltip: Size, viewport: Size, side: "right" | "top") {
  const gap = 8;
  const margin = 8;
  let left = side === "right" ? trigger.right + gap : (trigger.left + trigger.right - tooltip.width) / 2;
  let top = side === "right" ? (trigger.top + trigger.bottom - tooltip.height) / 2 : trigger.top - tooltip.height - gap;
  if (side === "right" && left + tooltip.width > viewport.width - margin) left = trigger.left - tooltip.width - gap;
  if (side === "top" && top < margin) top = trigger.bottom + gap;
  left = Math.max(margin, Math.min(left, viewport.width - tooltip.width - margin));
  top = Math.max(margin, Math.min(top, viewport.height - tooltip.height - margin));
  return { left, top };
}
