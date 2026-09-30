import { readAnswer, type AiRequest, type SessionState } from "./schema";
export type ConversationEntry = { role: "user" | "assistant"; text: string; payload?: Record<string, unknown> };
export function messagesForTransition(current: SessionState, next: SessionState, request: AiRequest): ConversationEntry[] {
  let userText = "";
  if (request.action === "start") userText = request.seed;
  else if (request.action === "fork_focus") userText = `이 방향을 구체화하고 싶어요: ${request.direction}`;
  else if (request.action === "answer" && current.question) userText = readAnswer(current.question, request.choices, request.custom).value;
  else if (request.action === "refine") userText = request.feedback;
  else userText = ({ resume: "저장된 메모에서 대화를 이어갈게요.", clarify: "선택하기 어려워요. 더 쉽게 물어봐주세요.", confirm: "확인한 방향으로 정리해주세요.", research: "관련 자료를 찾아주세요.", back: "이전 답변을 수정할게요.", confirm_refinement: "방향을 바꾸고 다시 확인할게요.", cancel_refinement: "기존 방향을 유지할게요." } as Partial<Record<AiRequest["action"],string>>)[request.action] || "";
  const entries: ConversationEntry[] = userText ? [{ role: "user", text: userText }] : [];
  if (next.question && ["start", "fork_focus", "resume", "answer", "clarify", "back", "confirm_refinement"].includes(request.action)) entries.push({ role: "assistant", text: next.question.prompt, payload: { question: next.question } });
  else if (next.draft && (request.action === "confirm" || request.action === "refine")) entries.push({ role: "assistant", text: next.draft.content.summary.overview || next.draft.title, payload: { draft: next.draft, research: next.research } });
  else if (request.action === "research" && next.research) entries.push({ role: "assistant", text: next.research.text, payload: { research: next.research } });
  else if (next.pendingRefinement) entries.push({ role: "assistant", text: "정리 방향이 달라질 수 있어요. 변경하기 전에 의도를 다시 확인할게요." });
  else if (next.phase === "confirm") entries.push({ role: "assistant", text: "선택한 내용을 확인하고 정리본을 만들 수 있어요." });
  return entries;
}
