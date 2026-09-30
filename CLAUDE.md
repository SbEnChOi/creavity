# Creavy — 아이디어 기록·공유 플랫폼

## 프로젝트 개요
일상에서 떠오른 아이디어를 탐색하고 기록·공유하는 플랫폼.
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
RLS로 데이터 접근을 제한하며, 서버 API에서도 소유권과 관리자 권한을 확인한다.
AI 관련 테이블: ai_sessions, ai_usage, ai_session_messages, ai_shares, admin_ai_events.
report_card_preferences는 사용자별 카드 색을 저장한다. 기존 clubs/club_id/mentor 키는 호환용으로 유지하며 화면에서는 공유 공간·공유 파트너로 표현한다.

## 디자인 원칙
- 배경: 흰색(#FFFFFF) + 연회색(#F7F7F5), 피드 카드에는 선택 가능한 옅은 색 사용
- 테두리: #E9E9E7 기본, 피드 카드는 #D3D3CF 또는 선택 색에 맞는 명확한 테두리
- 폰트: Pretendard Variable
- 강조색: #2563EB (파란색, 최소한으로)
- 그림자 거의 없음, 호버 시 배경색만 살짝

## 화면 목록
1. 로그인 (이메일/비밀번호·게스트)
2. 내 보고서 대시보드 (카드 그리드 + 검색 + 필터)
3. 새 보고서 작성 (3단계 양식 + 자동저장)
4. 공유 피드 (개인별 카드 색 설정)
5. 보고서 상세 + 반응/댓글
6. 환경설정 (공유 파트너, 사용자 목록)
7. AI 구체화 (/ai): 선택형 질문 → 사용자 방향 확인 → 리서치/초안 → 새로 작성
8. 아이디어 보관함 (/ai/archive), 정리본 공유 (/ai-share/[id]), 관리자 대화 관리 (/admin/ai)

## AI 구현
- 서버 전용 OpenAI Responses API. 설정은 `.env.example` 참고.
- `supabase/migrations/202609300001_ai_studio.sql`로 ai_sessions/ai_usage와 RLS·quota·lock 함수 적용.
- `202609300002_report_view_privacy.sql`로 기존 조회 뷰의 RLS와 작성자의 문서 수정 권한 적용.
- `202609300003_optional_report_edition.sql`로 선택 항목인 차수를 비워도 저장 가능.
- `npm run ai:check`로 운영 연결 점검. AI 요청은 회원 계정만 허용하며 키는 서버에만 설정.
- 대화는 본인과 관리자만 접근. 사용자 확인 전 초안 생성 금지. 기존 양식이 기본이며 execution/ai_notes는 선택 확장.
- `202609300004_ai_management_sharing.sql`로 대화 원문 기록·정리본 공유·관리자 수정/이동/권한 부여·개인 카드 색을 적용한다. 관리자 변경은 감사 기록을 남기며 소유권 이동 시 기존 공유를 비공개로 전환한다.
- 처음 메모는 AI 요청 전에 서버에 저장한다. 상태와 대화 원문은 하나의 트랜잭션으로 저장하며 revision/lock으로 동시 수정을 막는다. 실패한 첫 질문은 resume으로 이어간다.
- 작성 중 메모·다중 선택·기타 답변은 사용자별 브라우저 저장소에 보관한다. 운영 /ai는 최근 대화를 이어가고 /ai?new=1은 새 메모를 연다. 브라우저 저장 실패나 네트워크 오류를 화면에 표시한다.
- 공유는 확인한 정리본과 참고 자료의 스냅샷만 공개하며 원문 대화는 포함하지 않는다. private/custom/public을 지원하고 수정 후 다시 공유해야 반영된다.
- 질문과 안내는 자연스러운 해요체, 문서는 명확한 서술형을 사용한다. 새 초안의 summary.overview는 배경·핵심 기능·기대 효과를 2~4문장으로 설명한다. 기존 문서의 overview 누락은 thing/problem으로 호환한다.
- 질문 방식은 확장 탐색(explore, 신규 대화의 기본)과 실행 구체화(focus). 탐색에서는 여러 가능성과 발전 힌트를 보관하며 실행을 확정하지 않는다. 기존 mode 없는 대화는 focus로 호환한다.
- 탐색에서 fork_focus로 실행 구체화에 이어갈 때 원래 대화와 초안은 보존하고 본인 소유의 새 대화를 만든다. 모든 질문은 다중 선택과 기타 답변을 함께 허용한다.
- 개발용 `/ai-preview`는 예시 응답만 사용하고 운영 환경에서 열리지 않음. 브라우저에 대화와 작성 중 답변을 저장한다.
- 테스트/검증: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## 보고서 양식 구조 (content JSON)
Step1: 부분(기술/아이디어), 이름, 분야, 발견난이도, 발견경로, 출처/링크, 설명
Step2: 내 말로 설명, 강점, 한계
Step3: 아이디어이름, 활용방법, 유사아이디어, 실현가능성(easy/medium/hard), 이유
Summary: 아이디어 요약 (overview, thing, problem)

## 공개 범위
private / custom / club / public 4단계
custom일 때는 report_shares 테이블 활용
