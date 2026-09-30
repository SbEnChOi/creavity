import { AiError } from "./errors";
import { nextTopic, readAnswer, type AiRequest, type Answer, type Draft, type Question, type Research, type SessionState, type Topic } from "./schema";

export type FlowDependencies = {
  askQuestion: (state: SessionState, topic: Topic) => Promise<Question>;
  makeDraft: (state: SessionState, feedback?: string) => Promise<Draft>;
  researchIdea: (state: SessionState) => Promise<Research>;
  assessAnswer?: (state: SessionState, answer: Answer) => Promise<{ sufficient: boolean; clarification: string }>;
  assessFeedback?: (state: SessionState, feedback: string) => Promise<Topic | null>;
};

export async function transition(current: SessionState | null, request: AiRequest, deps: FlowDependencies): Promise<SessionState> {
  if (request.action === "start") {
    const state: SessionState = { seed: request.seed, format: request.format, useResearch: request.useResearch,
      phase: "questions", answers: [], question: null, clarification: "", research: null, draft: null, confirmed: false };
    state.question = await deps.askQuestion(state, "goal");
    return state;
  }
  if (!current) throw new AiError("대화를 찾을 수 없습니다.", 404);
  const state = structuredClone(current);
  switch (request.action) {
    case "answer": {
      if (state.phase !== "questions" || !state.question) throw new AiError("현재 질문에 답해주세요.", 400);
      let answer;
      try { answer = readAnswer(state.question, request.choices, request.custom); }
      catch (e) { throw new AiError((e as Error).message, 400); }
      state.history = [...(state.history ?? []), answer];
      if (state.pendingAnswer?.topic === answer.topic) {
        answer = { ...answer, value: `${state.pendingAnswer.value}\n추가 확인 답변: ${answer.value}` };
      }
      const assessment = deps.assessAnswer ? await deps.assessAnswer(state, answer) : { sufficient: true, clarification: "" };
      if (!assessment.sufficient) {
        state.pendingAnswer = answer;
        state.clarification = `${assessment.clarification}\n실제 사용자 답변: ${answer.value}`;
        state.question = await deps.askQuestion(state, answer.topic);
        break;
      }
      state.pendingAnswer = null;
      state.research = null;
      state.answers = [...state.answers.filter((a) => a.topic !== answer.topic), answer];
      state.clarification = "";
      const topic = nextTopic(state.answers);
      state.question = topic ? await deps.askQuestion(state, topic) : null;
      state.phase = topic ? "questions" : "confirm";
      break;
    }
    case "clarify":
      if (state.phase !== "questions" || !state.question) throw new AiError("진행 중인 질문이 없습니다.", 400);
      state.clarification = "선택하기 어려워요. 원문에 맞는 더 쉬운 선택지와 구체적인 예를 보여주세요.";
      state.question = await deps.askQuestion(state, state.question.topic);
      break;
    case "back": {
      if (!state.answers.some((a) => a.topic === request.topic)) throw new AiError("수정할 답변이 없습니다.", 400);
      const index = state.answers.findIndex((a) => a.topic === request.topic);
      state.answers = state.answers.slice(0, index);
      state.pendingAnswer = null; state.clarification = "";
      state.refinementRequest = "";
      state.confirmed = false; state.phase = "questions"; state.draft = null; state.research = null;
      state.question = await deps.askQuestion(state, request.topic);
      break;
    }
    case "research": {
      const previous = state.research?.resources ?? [];
      const research = await deps.researchIdea(state);
      state.research = { ...research, resources: Array.from(new Map([...previous, ...research.resources].map((r) => [r.url, r])).values()) };
      break;
    }
    case "confirm":
      if (state.phase !== "confirm" || nextTopic(state.answers)) throw new AiError("먼저 필요한 답변을 모두 확인해주세요.", 400);
      state.confirmed = true;
      if (state.useResearch && !state.research) state.research = await deps.researchIdea(state);
      state.draft = await deps.makeDraft(state);
      state.refinementRequest = "";
      state.phase = "review";
      break;
    case "refine": {
      if (state.phase !== "review" || !state.confirmed || !state.draft) throw new AiError("검토할 초안이 없습니다.", 400);
      const topic = deps.assessFeedback ? await deps.assessFeedback(state, request.feedback) : null;
      if (topic) {
        state.answers = state.answers.slice(0, state.answers.findIndex((a) => a.topic === topic));
        state.refinementRequest = request.feedback;
        state.clarification = `첨삭 요청이 기존 방향과 달라 다시 확인해야 합니다. 실제 사용자 요청: ${request.feedback}`;
        state.pendingAnswer = null; state.confirmed = false; state.phase = "questions"; state.draft = null; state.research = null;
        state.question = await deps.askQuestion(state, topic);
      } else {
        state.draft = await deps.makeDraft(state, request.feedback);
      }
      break;
    }
  }
  return state;
}
