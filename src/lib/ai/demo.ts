import { transition } from "./flow";
import { type Draft, type Question, type Session, type SessionState, type AiRequest, type Topic } from "./schema";

export const DEMO_SEED = "비 오는 날 학교에서 우산을 빌릴 수 있으면 좋겠다.\n빌리고 돌려주는 과정을 간단하게 만들고 싶어. 앱보다는 학교 안에서 작게 시작해보고 싶다.";
const questions: Record<Topic, Omit<Question, "topic">> = {
  goal: { prompt: "이 아이디어로 먼저 바꾸고 싶은 것은 무엇인가?", reason: "먼저 해결할 불편에 따라 시작점이 달라진다.", multiple: false, options: [
    { id: "option1", label: "우산 없이 귀가하는 불편 줄이기", detail: "갑자기 비가 와도 학생이 편하게 집에 갈 수 있도록" },
    { id: "option2", label: "학교에서 나눔 문화 만들기", detail: "서로 빌리고 돌려주는 작은 나눔 경험" },
    { id: "option3", label: "아직 정하지 않음", detail: "목적은 미정" }] },
  audience: { prompt: "누가, 어떤 상황에서 우산을 빌리면 좋을까?", reason: "대상을 정하면 작게 시험할 수 있다.", multiple: false, options: [
    { id: "option1", label: "우산을 잊은 우리 반 친구들", detail: "같은 반에서 먼저 시험" },
    { id: "option2", label: "하교할 때 우산이 없는 학생들", detail: "학교 현관에서 이용" },
    { id: "option3", label: "아직 정하지 않음", detail: "누구부터 도울지는 미정" }] },
  problem: { prompt: "대여와 반납에서 먼저 해결할 불편은 무엇인가?", reason: "먼저 해결할 불편을 고른다.", multiple: false, options: [
    { id: "option1", label: "필요할 때 우산을 구하기 어려움", detail: "우산이 있는 장소를 알기 쉽게" },
    { id: "option2", label: "빌린 우산을 돌려주기 번거로움", detail: "반납 장소와 규칙을 간단하게" },
    { id: "option3", label: "아직 정하지 않음", detail: "친구들에게 먼저 물어보기" }] },
  solution: { prompt: "첫 시도는 어떤 방식으로 할까?", reason: "앱 없이 작게 시작할 방법을 고른다.", multiple: false, options: [
    { id: "option1", label: "우산함 + 종이 대여 기록", detail: "학교 현관에서 별도 앱 없이" },
    { id: "option2", label: "우산함 + QR 간단 기록", detail: "휴대폰으로 대여·반납 표시" },
    { id: "option3", label: "아직 정하지 않음", detail: "관리할 방법부터 더 알아보기" }] },
  constraints: { prompt: "처음 시작할 때 지킬 조건은 무엇인가?", reason: "실제 가능한 범위를 확인한다.", multiple: true, options: [
    { id: "option1", label: "기존 우산을 활용해 작게 시작", detail: "새로 구매하기 전 학교 허락과 우산 확보 확인" },
    { id: "option2", label: "학생이 관리하기 쉬워야 함", detail: "복잡한 가입이나 개인정보 수집 최소화" },
    { id: "option3", label: "아직 정하지 않음", detail: "예산과 운영 인원은 미정" }] },
  success: { prompt: "어떤 변화로 성공을 판단할까?", reason: "목표 수치는 미정으로 두고 확인할 변화를 고른다.", multiple: false, options: [
    { id: "option1", label: "친구들이 필요할 때 실제로 빌림", detail: "빌린 사람에게 불편이 줄었는지 물어보기" },
    { id: "option2", label: "우산이 잘 돌아오고 관리가 쉬움", detail: "반납 과정과 관리 부담 확인" },
    { id: "option3", label: "아직 정하지 않음", detail: "시험하면서 판단 기준을 찾기" }] },
};

function exampleDraft(state: SessionState): Draft {
  const value = (topic: Topic) => state.answers.find((a) => a.topic === topic)?.value || "미정";
  return { title: "비 오는 날, 학교 우산 공유", content: {
    step1: { kind: "idea", name: "학교 우산 공유", fields: ["소셜/커뮤니티"], difficulty: "casual", source: "사용자 메모", url: "", description: state.seed },
    step2: { principle: `필요한 학생이 우산을 빌리고 다시 돌려주는 방식.\n해결할 문제: ${value("problem")}`, strengths: "[AI 제안 · 데모] 학교 안에서 작게 시작해 불편을 확인할 수 있다.", limits: "[검증 필요 · 데모] 우산 확보, 학교 허락과 반납 관리를 확인해야 한다." },
    step3: { idea_name: "학교 우산 공유", application: value("solution"), similar_ideas: "실제 검색 연결 후 확인 필요", feasibility: "unknown", feasibility_reason: `운영 조건과 학교 허락 확인 전 판단 보류.\n확인한 제약: ${value("constraints")}` },
    summary: { thing: "학교 우산 공유", problem: value("problem") },
    execution: state.format === "extended" ? { audience: value("audience"), scenario: "비 오는 날 학교에서 우산이 필요할 때", first_test: "[AI 제안 · 데모] 학교 허락을 받은 후 한 장소에서 작은 우산함을 시험해보기", success_metric: value("success") } : null,
  }, suggestions: ["[데모 제안] 먼저 친구들에게 우산을 빌리는 상황을 물어보기"], open_questions: ["학교의 운영 허락과 우산 확보 방법", "수량, 예산, 담당 인원은 아직 미정"] };
}

// Only the development preview imports this example transport. Production calls /api/ai.
export function createDemoTransport() {
  let session: Session | null = null;
  return async (request: AiRequest): Promise<Session> => {
    const state = await transition(session?.state ?? null, request, {
      askQuestion: async (s, topic) => ({ ...questions[topic], topic, multiple: true, reason: s.clarification ? "기타에 직접 적거나 미정으로 남길 수 있다." : questions[topic].reason }),
      makeDraft: async (s) => exampleDraft(s),
      researchIdea: async () => ({ text: "미리보기에서는 실제 검색을 실행하지 않습니다. AI 연결 후 관련 글·사진·영상과 출처가 여기에 표시됩니다.", citations: [], resources: [] }),
    });
    session = { id: "00000000-0000-4000-8000-000000000001", revision: (session?.revision ?? -1) + 1, state, updated_at: new Date().toISOString() };
    return session;
  };
}
