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
