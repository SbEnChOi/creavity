import type { Appearance } from "./appearance";

export const CARD_COLORS = {
  neutral: { label:"기본", background:"#FFFFFF", border:"#D3D3CF", dot:"#A3A3A3" },
  blue: { label:"파랑", background:"#F3F7FF", border:"#B7CDF1", dot:"#6699D8" },
  green: { label:"초록", background:"#F2F9F5", border:"#AFD1BD", dot:"#66A784" },
  amber: { label:"노랑", background:"#FFFBF0", border:"#E9D49E", dot:"#C8A34C" },
  rose: { label:"분홍", background:"#FFF5F6", border:"#E5BDC4", dot:"#C88795" },
  violet: { label:"보라", background:"#F8F5FD", border:"#CCBFE4", dot:"#A08AC4" },
} as const;
export type CardColor = keyof typeof CARD_COLORS;
export function cardColor(value: string | undefined): CardColor {return value && Object.prototype.hasOwnProperty.call(CARD_COLORS,value) ? value as CardColor : "neutral";}

const DARK_CARD_COLORS: Record<CardColor, { background: string; border: string }> = {
  neutral: { background: "#363636", border: "#656565" },
  blue: { background: "#303d50", border: "#637d9f" },
  green: { background: "#30443b", border: "#5f8c70" },
  amber: { background: "#493f2e", border: "#957e52" },
  rose: { background: "#4b363b", border: "#9a7178" },
  violet: { background: "#40384b", border: "#807095" },
};

export function cardAppearance(color: CardColor, appearance: Appearance) {
  return appearance === "dark" ? { ...CARD_COLORS[color], ...DARK_CARD_COLORS[color] } : CARD_COLORS[color];
}
