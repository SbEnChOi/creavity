export type Visibility = "private" | "custom" | "club" | "public";
export type ReportStatus = "draft" | "published";

export type ReportContent = {
  step1?: {
    kind?: "tech" | "idea" | string;       // 기술 | 아이디어
    name?: string;
    field?: string;            // legacy: 단일 분야 (구 보고서 호환)
    fields?: string[];         // 복수 분야 (현재 사용)
    difficulty?: "casual" | "searched" | "deep" | string;
    source?: string;                        // 출처 이름 (유튜브, 논문 등)
    url?: string;                           // 출처 링크
    images?: string[];                      // 첨부 이미지 URL 배열
    description?: string;
  };
  step2?: {
    principle?: string;                     // 내 말로 설명
    strengths?: string;
    limits?: string;
  };
  step3?: {
    idea_name?: string;
    application?: string;                   // 활용 방법
    similar_ideas?: string;
    feasibility?: "easy" | "medium" | "hard" | string;
    feasibility_reason?: string;
  };
  summary?: {
    thing?: string;
    problem?: string;
  };
};

// 보고서의 분야 배열 추출 (신규 fields 우선, 없으면 legacy field 단일)
export function getReportFields(report: { field?: string | null; content?: ReportContent | null }): string[] {
  const fields = report.content?.step1?.fields;
  if (fields && fields.length > 0) return fields;
  const single = report.content?.step1?.field ?? report.field;
  return single ? [single] : [];
}

export type Report = {
  id: string;
  author_id: string;
  club_id: string | null;
  title: string | null;
  edition: number | null;       // 차수 (1차, 2차 …)
  field: string | null;
  content: ReportContent | null;
  status: ReportStatus;
  visibility: Visibility;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  reactions?: { count: number }[];
};
