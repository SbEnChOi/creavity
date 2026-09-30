import { transition } from "./flow";
import { dialogueMode, type Draft, type Question, type Session, type SessionState, type AiRequest, type Topic } from "./schema";

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

const exploreQuestions: Record<Topic, Omit<Question, "topic">> = {
  goal: { prompt: "우산 공유라는 생각에서 어떤 가능성을 더 넓혀보고 싶은가?", reason: "한 가지 용도로 정하지 않고 관심 있는 씨앗을 모은다.", multiple: true, options: [
    { id: "option1", label: "필요한 물건을 서로 나누는 경험", detail: "우산에서 다른 생활 물품으로 연결" },
    { id: "option2", label: "비 오는 날을 재미있게 만드는 경험", detail: "불편 해결을 넘어 놀이와 기록으로 확장" },
    { id: "option3", label: "학교에서 작은 연결을 만드는 경험", detail: "친구 사이의 교류와 도움으로 확장" },
    { id: "option4", label: "아직 정하지 않음", detail: "여러 가능성을 열어둠" }] },
  audience: { prompt: "이 생각을 어떤 다른 장면으로 넓혀볼까?", reason: "지금 사용할 사람을 하나로 좁히지 않는다.", multiple: true, options: [
    { id: "option1", label: "친구들과 물건을 나누는 일상", detail: "우산·필기구·생활 물품의 공유" },
    { id: "option2", label: "비 오는 날의 학교 활동", detail: "작은 행사나 즐거운 경험" },
    { id: "option3", label: "지역의 도움과 교류", detail: "학교 밖에서도 적용할 가능성 탐색" },
    { id: "option4", label: "아직 정하지 않음", detail: "활용 장면은 미정" }] },
  problem: { prompt: "이 아이디어를 통해 새롭게 풀어볼 문제는 무엇인가?", reason: "처음 떠올린 불편 밖의 문제도 살펴본다.", multiple: true, options: [
    { id: "option1", label: "필요한 물건을 서로 찾기 어려움", detail: "누가 어떤 도움을 줄 수 있는지 연결" },
    { id: "option2", label: "쓰지 않는 물건이 쌓임", detail: "공유와 다시 사용하기로 연결" },
    { id: "option3", label: "도움을 주고받을 기회가 적음", detail: "작은 교류를 만드는 경험" },
    { id: "option4", label: "아직 정하지 않음", detail: "문제도 탐색하며 발견" }] },
  solution: { prompt: "원래 생각에 어떤 파생 기능을 더해볼까?", reason: "함께 관심 있는 기능을 모두 기록한다.", multiple: true, options: [
    { id: "option1", label: "물건의 사연을 남기는 기록", detail: "누가 어떤 순간에 사용했는지 작은 이야기로 보관" },
    { id: "option2", label: "반납을 돕는 표시와 안내", detail: "종이 표식이나 눈에 보이는 안내로 도움" },
    { id: "option3", label: "고친 물건을 다시 나누기", detail: "수리와 재사용 활동으로 연결" },
    { id: "option4", label: "아직 정하지 않음", detail: "새 기능을 더 생각해보기" }] },
  constraints: { prompt: "어떤 다른 원리나 활동과 연결해볼까?", reason: "예산을 정하기보다 연결과 변형을 살펴본다.", multiple: true, options: [
    { id: "option1", label: "도서관처럼 빌리고 돌려주는 원리", detail: "다른 생활 물품에도 적용할 가능성" },
    { id: "option2", label: "교환과 감사 표현", detail: "도움을 주고받는 재미와 관계" },
    { id: "option3", label: "기록을 모아 발견하는 전시", detail: "사용 경험을 작은 이야기나 전시로 변형" },
    { id: "option4", label: "아직 정하지 않음", detail: "연결할 원리는 더 찾아보기" }] },
  success: { prompt: "나중에 다시 발전시킬 때 어떤 힌트를 남겨둘까?", reason: "지금 실행 계획을 확정하지 않아도 기록할 수 있다.", multiple: true, options: [
    { id: "option1", label: "관심 있는 기능을 묶어 보관", detail: "다음에 꺼내 볼 여러 후보를 남김" },
    { id: "option2", label: "비슷한 사례와 참고 자료", detail: "다른 프로젝트와 연결할 재료" },
    { id: "option3", label: "다음에 생각해볼 질문", detail: "미정인 부분과 새 궁금증을 남김" },
    { id: "option4", label: "아직 정하지 않음", detail: "생각 자체를 보관" }] },
};

function exampleDraft(state: SessionState): Draft {
  const value = (topic: Topic) => state.answers.find((a) => a.topic === topic)?.value || "미정";
  if (dialogueMode(state) === "explore") return { title: "우산 공유에서 넓혀본 가능성", content: {
    step1: { kind: "idea", name: "우산 공유에서 시작한 아이디어", fields: ["소셜/커뮤니티"], difficulty: "casual", source: "사용자 메모", url: "", description: state.seed },
    step2: { principle: `아이디어의 씨앗: ${value("goal")}`, strengths: "[AI 제안 · 데모] 물건 나눔에서 교류·기록·재사용으로 확장할 가능성이 있다.", limits: "[검증 필요 · 데모] 각 가능성의 실제 효과와 운영 방법은 나중에 확인할 수 있다." },
    step3: { idea_name: "공유에서 교류와 기록으로", application: `관심 있는 활용 장면: ${value("audience")}\n파생 기능: ${value("solution")}\n연결과 변형: ${value("constraints")}`, similar_ideas: "실제 검색 연결 후 확인 필요", feasibility: "unknown", feasibility_reason: "실행 범위를 정하기 전이므로 판단 보류다." },
    summary: { thing: "우산 공유에서 출발한 여러 가능성", problem: value("problem") }, execution: null,
  }, suggestions: ["[AI 제안 · 데모] 물건에 얽힌 사연을 작은 기록이나 전시로 연결하기", "[AI 제안 · 데모] 수리와 나눔을 함께 하는 활동으로 연결하기"], open_questions: [value("success"), "어떤 가능성을 다음에 발전시킬지 미정이다."] };
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
  const sessions = new Map<string, Session>();
  let count = 0;
  return async (request: AiRequest): Promise<Session> => {
    const session = request.action === "start" ? null : sessions.get(request.id) ?? null;
    const state = await transition(session?.state ?? null, request, {
      askQuestion: async (s, topic) => {
        const q = (dialogueMode(s) === "explore" ? exploreQuestions : questions)[topic];
        return { ...q, topic, multiple: true, reason: s.clarification ? "기타에 직접 적거나 미정으로 남길 수 있다." : q.reason };
      },
      makeDraft: async (s) => exampleDraft(s),
      researchIdea: async () => ({ text: "미리보기에서는 실제 검색을 실행하지 않습니다. AI 연결 후 관련 글·사진·영상과 출처가 여기에 표시됩니다.", citations: [], resources: [] }),
    });
    const isNew = request.action === "start" || request.action === "fork_focus";
    const next: Session = { id: isNew ? `00000000-0000-4000-8000-${String(++count).padStart(12, "0")}` : session!.id, revision: isNew ? 0 : session!.revision + 1, state, updated_at: new Date().toISOString() };
    sessions.set(next.id, next);
    return next;
  };
}
