# 창의력 — 동아리 사고력 플랫폼

## 프로젝트 개요
동아리 후배들의 창의적 사고력을 키우기 위한 활동지 작성·공유 플랫폼.
노션(Notion) 스타일의 미니멀한 디자인.

## 기술 스택
- Next.js 15 (App Router) + React 19 + TypeScript
- Tailwind CSS
- Supabase (DB + Auth + RLS)
- Pretendard Variable 폰트
- 배포: Vercel

## DB
Supabase 프로젝트 연결 완료.
테이블: clubs, profiles, reports, report_shares, reactions, comments, notifications
RLS 정책 적용됨 — 프론트에서 권한 체크 불필요.

## 디자인 원칙
- 배경: 흰색(#FFFFFF) + 연회색(#F7F7F5)만 사용
- 테두리: #E9E9E7 (아주 연하게)
- 폰트: Pretendard Variable
- 강조색: #2563EB (파란색, 최소한으로)
- 그림자 거의 없음, 호버 시 배경색만 살짝

## 화면 목록
1. 로그인 (이메일/비밀번호·게스트)
2. 내 보고서 대시보드 (카드 그리드 + 검색 + 필터)
3. 새 보고서 작성 (3단계 양식 + 자동저장)
4. 동아리 피드
5. 보고서 상세 + 반응/댓글
6. 환경설정 (짝선배/짝후배, 멤버 목록)
7. AI 구체화 (/ai): 선택형 질문 → 사용자 방향 확인 → 리서치/초안 → 새로 작성

## AI 구현
- 서버 전용 OpenAI Responses API. 설정은 `.env.example` 참고.
- `supabase/migrations/202609300001_ai_studio.sql`로 ai_sessions/ai_usage와 RLS·quota·lock 함수 적용.
- `202609300002_report_view_privacy.sql`로 기존 조회 뷰의 RLS와 작성자의 문서 수정 권한 적용.
- `202609300003_optional_report_edition.sql`로 선택 항목인 차수를 비워도 저장 가능.
- `npm run ai:check`로 운영 연결 점검. AI 요청은 회원 계정만 허용하며 키는 서버에만 설정.
- 대화는 본인만 접근. 사용자 확인 전 초안 생성 금지. 기존 양식이 기본이며 execution/ai_notes는 선택 확장.
- 질문 방식은 확장 탐색(explore, 신규 대화의 기본)과 실행 구체화(focus). 탐색에서는 여러 가능성과 발전 힌트를 보관하며 실행을 확정하지 않는다. 기존 mode 없는 대화는 focus로 호환한다.
- 탐색에서 fork_focus로 실행 구체화에 이어갈 때 원래 대화와 초안은 보존하고 본인 소유의 새 대화를 만든다. 모든 질문은 다중 선택과 기타 답변을 함께 허용한다.
- 개발용 `/ai-preview`는 예시 응답만 사용하고 운영 환경에서 열리지 않음.
- 테스트/검증: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## 보고서 양식 구조 (content JSON)
Step1: 부분(기술/아이디어), 이름, 분야, 발견난이도, 발견경로, 출처/링크, 설명
Step2: 내 말로 설명, 강점, 한계
Step3: 아이디어이름, 활용방법, 유사아이디어, 실현가능성(easy/medium/hard), 이유
Summary: 한 줄 정리 (thing, problem)

## 공개 범위
private / custom / club / public 4단계
custom일 때는 report_shares 테이블 활용
