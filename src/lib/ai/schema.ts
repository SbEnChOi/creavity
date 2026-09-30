import { z } from "zod";

export const TOPICS = ["goal", "audience", "problem", "solution", "constraints", "success"] as const;
export type Topic = (typeof TOPICS)[number];
export type DialogueMode = "explore" | "focus";
export const MODE_LABELS: Record<DialogueMode, string> = { explore: "확장 탐색", focus: "실행 구체화" };
export const REFINEMENT_PRESETS = ["문장을 더 간결하게 첨삭해줘", "장점과 한계를 객관적으로 평가해줘", "원래 방향 안에서 추가 아이디어를 제안해줘"] as const;
export const TOPIC_LABELS: Record<Topic, string> = {
  goal: "목적", audience: "대상과 상황", problem: "해결할 문제",
  solution: "해결 방식", constraints: "범위와 제약", success: "성공 기준",
};
export const EXPLORE_TOPIC_LABELS: Record<Topic, string> = {
  goal: "아이디어의 씨앗", audience: "다양한 활용 장면", problem: "새롭게 풀 문제",
  solution: "파생 기능", constraints: "연결과 변형", success: "나중에 발전시킬 힌트",
};
export function dialogueMode(state: { mode?: DialogueMode }): DialogueMode { return state.mode ?? "focus"; }
export function topicLabels(mode: DialogueMode) { return mode === "explore" ? EXPLORE_TOPIC_LABELS : TOPIC_LABELS; }

export const questionSchema = z.object({
  prompt: z.string(), reason: z.string(),
  options: z.array(z.object({ id: z.string(), label: z.string(), detail: z.string() })),
  multiple: z.boolean(),
});
export type Question = z.infer<typeof questionSchema> & { topic: Topic };

export const draftSchema = z.object({
  title: z.string(),
  content: z.object({
    step1: z.object({
      kind: z.enum(["tech", "idea"]), name: z.string(), fields: z.array(z.string()),
      difficulty: z.enum(["casual", "searched", "deep"]),
      source: z.string(), url: z.string(), description: z.string(),
    }),
    step2: z.object({ principle: z.string(), strengths: z.string(), limits: z.string() }),
    step3: z.object({
      idea_name: z.string(), application: z.string(), similar_ideas: z.string(),
      feasibility: z.enum(["easy", "medium", "hard", "unknown"]), feasibility_reason: z.string(),
    }),
    summary: z.object({ thing: z.string(), problem: z.string(), overview: z.string().optional() }),
    execution: z.object({ audience: z.string(), scenario: z.string(), first_test: z.string(), success_metric: z.string() }).nullable(),
  }),
  suggestions: z.array(z.string()), open_questions: z.array(z.string()),
});
export type Draft = z.infer<typeof draftSchema>;
// Newly generated summaries are self-contained; legacy saved drafts remain readable.
export const draftGenerationSchema = draftSchema.extend({ content: draftSchema.shape.content.extend({
  summary: draftSchema.shape.content.shape.summary.extend({ overview: z.string() }),
}) });
export type Answer = { topic: Topic; question: string; value: string };
export type Citation = { title: string; url: string; start: number; end: number };
export type Resource = { title: string; url: string; kind: "web" | "video" | "image"; thumbnail?: string; credit?: string };
export type Research = { text: string; citations: Citation[]; resources: Resource[]; warning?: string; videoSearchUrl?: string };
export type SessionState = {
  seed: string; format: "basic" | "extended"; useResearch: boolean;
  mode?: DialogueMode;
  sourceSessionId?: string;
  focusDirection?: string;
  explorationContext?: { possibilities: string; suggestions: string[] };
  phase: "questions" | "confirm" | "review";
  answers: Answer[]; question: Question | null; clarification: string;
  research: Research | null; draft: Draft | null; confirmed: boolean;
  history?: Answer[];
  pendingAnswer?: Answer | null;
  refinementRequest?: string;
  pendingRefinement?: { topic: Topic; feedback: string } | null;
};
export type Session = { id: string; revision: number; state: SessionState; updated_at: string; processing_until?: string | null; user_id?: string };

const answerSchema = z.object({ topic: z.enum(TOPICS), question: z.string().max(2000), value: z.string().max(16000) });
export const sessionStateSchema = z.object({
  seed: z.string().min(5).max(8000), format: z.enum(["basic", "extended"]), useResearch: z.boolean(), mode: z.enum(["explore", "focus"]).optional(),
  sourceSessionId: z.string().uuid().optional(), focusDirection: z.string().max(2000).optional(),
  explorationContext: z.object({ possibilities: z.string(), suggestions: z.array(z.string()) }).optional(),
  phase: z.enum(["questions", "confirm", "review"]), answers: z.array(answerSchema).max(6),
  question: questionSchema.extend({ topic: z.enum(TOPICS) }).nullable(), clarification: z.string(),
  research: z.object({ text: z.string(), citations: z.array(z.object({ title: z.string(), url: z.string(), start: z.number(), end: z.number() })), resources: z.array(z.object({ title: z.string(), url: z.string(), kind: z.enum(["web", "video", "image"]), thumbnail: z.string().optional(), credit: z.string().optional() })), warning: z.string().optional(), videoSearchUrl: z.string().optional() }).nullable(),
  draft: draftSchema.nullable(), confirmed: z.boolean(), history: z.array(answerSchema).optional(), pendingAnswer: answerSchema.nullable().optional(),
  refinementRequest: z.string().optional(), pendingRefinement: z.object({ topic: z.enum(TOPICS), feedback: z.string() }).nullable().optional(),
});
export const sessionSchema = z.object({ id: z.string().uuid(), revision: z.number().int().nonnegative(), state: sessionStateSchema, updated_at: z.string(), processing_until: z.string().nullable().optional(), user_id: z.string().uuid().optional() });

export const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), requestId: z.string().uuid().optional(), seed: z.string().trim().min(5).max(8000), format: z.enum(["basic", "extended"]), useResearch: z.boolean(), mode: z.enum(["explore", "focus"]).optional() }),
  z.object({ action: z.literal("resume"), id: z.string().uuid(), revision: z.number().int().nonnegative() }),
  z.object({ action: z.literal("fork_focus"), requestId: z.string().uuid().optional(), id: z.string().uuid(), revision: z.number().int().nonnegative(), direction: z.string().trim().min(3).max(2000) }),
  z.object({ action: z.literal("answer"), id: z.string().uuid(), revision: z.number().int().nonnegative(), choices: z.array(z.string().max(80)).max(6), custom: z.string().trim().max(2000).default("") }),
  z.object({ action: z.literal("clarify"), id: z.string().uuid(), revision: z.number().int().nonnegative() }),
  z.object({ action: z.literal("back"), id: z.string().uuid(), revision: z.number().int().nonnegative(), topic: z.enum(TOPICS) }),
  z.object({ action: z.literal("confirm"), id: z.string().uuid(), revision: z.number().int().nonnegative() }),
  z.object({ action: z.literal("research"), id: z.string().uuid(), revision: z.number().int().nonnegative() }),
  z.object({ action: z.literal("refine"), id: z.string().uuid(), revision: z.number().int().nonnegative(), feedback: z.string().trim().min(3).max(2000) }),
  z.object({ action: z.literal("confirm_refinement"), id: z.string().uuid(), revision: z.number().int().nonnegative() }),
  z.object({ action: z.literal("cancel_refinement"), id: z.string().uuid(), revision: z.number().int().nonnegative() }),
]);
export type AiRequest = z.infer<typeof requestSchema>;

export function nextTopic(answers: Answer[]): Topic | undefined {
  return TOPICS.find((topic) => !answers.some((a) => a.topic === topic));
}

export function readAnswer(question: Question, choices: string[], custom: string): Answer {
  const unique = Array.from(new Set(choices));
  if (!unique.length) throw new Error("선택지를 확인해주세요.");
  const values = unique.map((id) => {
    if (id === "other") {
      if (!custom.trim()) throw new Error("기타 항목에 생각을 적어주세요.");
      return custom.trim();
    }
    const option = question.options.find((o) => o.id === id);
    if (!option) throw new Error("현재 질문에 없는 선택지입니다.");
    return `${option.label}${option.detail ? ` — ${option.detail}` : ""}`;
  });
  return { topic: question.topic, question: question.prompt, value: values.join(" / ") };
}

export function safeUrl(input: string): string | null {
  try {
    const url = new URL(input);
    if (url.protocol !== "https:" || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (!host.includes(".") || host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || /^[\d.]+$/.test(host) || host.includes(":")) return null;
    return url.href;
  } catch { return null; }
}

export function videoId(input: string): string | null {
  const safe = safeUrl(input);
  if (!safe) return null;
  const url = new URL(safe);
  let id: string | null = null;
  if (["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)) {
    id = url.pathname === "/watch" ? url.searchParams.get("v") : url.pathname.match(/^\/shorts\/([\w-]+)/)?.[1] ?? null;
  } else if (url.hostname === "youtu.be") id = url.pathname.slice(1);
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}
