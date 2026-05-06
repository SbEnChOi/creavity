export const FIELD_OPTIONS = [
  "AI/기계학습",
  "앱/웹 개발",
  "환경/지속가능성",
  "교육/에듀테크",
  "헬스케어/바이오",
  "소셜/커뮤니티",
  "비즈니스/창업",
  "하드웨어/IoT",
  "디자인/UX",
  "데이터/통계",
] as const;

export type FieldOption = (typeof FIELD_OPTIONS)[number] | string;
