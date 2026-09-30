import { z } from "zod";

export const TOPICS = ["goal", "audience", "problem", "solution", "constraints", "success"] as const;
export type Topic = (typeof TOPICS)[number];
export const TOPIC_LABELS: Record<Topic, string> = {
  goal: "목적", audience: "대상과 상황", problem: "해결할 문제",
  solution: "해결 방식", constraints: "범위와 제약", success: "성공 기준",
};

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
    summary: z.object({ thing: z.string(), problem: z.string() }),
    execution: z.object({ audience: z.string(), scenario: z.string(), first_test: z.string(), success_metric: z.string() }).nullable(),
  }),
  suggestions: z.array(z.string()), open_questions: z.array(z.string()),
});
export type Draft = z.infer<typeof draftSchema>;
export type Answer = { topic: Topic; question: string; value: string };
export type Citation = { title: string; url: string; start: number; end: number };
export type Resource = { title: string; url: string; kind: "web" | "video" | "image"; thumbnail?: string; credit?: string };
export type Research = { text: string; citations: Citation[]; resources: Resource[]; warning?: string; videoSearchUrl?: string };
export type SessionState = {
  seed: string; format: "basic" | "extended"; useResearch: boolean;
  phase: "questions" | "confirm" | "review";
  answers: Answer[]; question: Question | null; clarification: string;
  research: Research | null; draft: Draft | null; confirmed: boolean;
  history?: Answer[];
  pendingAnswer?: Answer | null;
  refinementRequest?: string;
};
export type Session = { id: string; revision: number; state: SessionState; updated_at: string };

export const requestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), seed: z.string().trim().min(5).max(8000), format: z.enum(["basic", "extended"]), useResearch: z.boolean() }),
  z.object({ action: z.literal("answer"), id: z.string().uuid(), revision: z.number().int().nonnegative(), choices: z.array(z.string().max(80)).max(6), custom: z.string().trim().max(2000).default("") }),
  z.object({ action: z.literal("clarify"), id: z.string().uuid(), revision: z.number().int().nonnegative() }),
  z.object({ action: z.literal("back"), id: z.string().uuid(), revision: z.number().int().nonnegative(), topic: z.enum(TOPICS) }),
  z.object({ action: z.literal("confirm"), id: z.string().uuid(), revision: z.number().int().nonnegative() }),
  z.object({ action: z.literal("research"), id: z.string().uuid(), revision: z.number().int().nonnegative() }),
  z.object({ action: z.literal("refine"), id: z.string().uuid(), revision: z.number().int().nonnegative(), feedback: z.string().trim().min(3).max(2000) }),
]);
export type AiRequest = z.infer<typeof requestSchema>;

export function nextTopic(answers: Answer[]): Topic | undefined {
  return TOPICS.find((topic) => !answers.some((a) => a.topic === topic));
}

export function readAnswer(question: Question, choices: string[], custom: string): Answer {
  const unique = Array.from(new Set(choices));
  if (!unique.length || (!question.multiple && unique.length > 1)) throw new Error("선택지를 확인해주세요.");
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
