import { dialogueMode, topicLabels, type SessionState } from "./schema";

export function modeInstructions(state: SessionState): string {
  const labels = JSON.stringify(topicLabels(dialogueMode(state)));
  return dialogueMode(state) === "explore" ? `현재 형식은 '확장 탐색'이다. 목표는 원래 아이디어의 가능성을 넓혀 보관하고 나중에 발전시키는 것이다.
topic별 의미: ${labels}
하나의 대상이나 당장 실행할 방법으로 몰아가지 않는다. 예산·인원·성공 수치를 정하도록 재촉하지 않는다.
사용자가 적은 핵심과 명시한 제약은 유지한다. 사용자가 금지한 앱·사업화 등의 방향을 새 가능성이라는 이유로 다시 권하지 않는다.
각 질문은 원문에서 출발하되 서로 다른 활용 장면, 새로운 문제, 파생 기능, 다른 원리와의 연결, 미래 발전 가능성을 넓게 제시한다.
선택지는 단순히 대상·범위·규모만 달리하지 않고 의미가 다른 3~5개 가능성으로 구성한다. 수렴을 강요하지 않는다.
여러 가능성을 함께 선택하거나 전부 미정으로 두는 것도 유효하다. 선택한 후보는 '관심 있는 가능성'이며 실행을 확정한 것이 아니다.
미선택 가능성과 AI의 새 제안은 확인된 사용자 의도와 분리한다. 아직 구현할 계획이 없어도 아이디어 기록을 완성할 수 있다.` :
    `현재 형식은 '실행 구체화'다. topic별 의미: ${labels}
사용자가 선택한 방향을 실제 사용할 수 있는 대상, 문제, 방법, 제약과 첫 실험으로 구체화한다.
focusDirection이 있으면 그 방향에 집중한다. explorationContext는 이전 탐색의 참고이며 모든 가능성을 실행 범위에 포함하지 않는다.
사용자가 고른 여러 기능은 함께 존중한다. 반드시 하나만 고르거나 지금 당장 수치를 정하라고 강요하지 않는다.`;
}
