# 창의력 — 동아리 사고력 플랫폼

## 프로젝트 개요
동아리 후배들의 창의적 사고력을 키우기 위한 활동지 작성·공유 플랫폼.
노션(Notion) 스타일의 미니멀한 디자인.

## 기술 스택
- Next.js 14 (App Router) + TypeScript
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
1. 로그인 (Google OAuth)
2. 내 보고서 대시보드 (카드 그리드 + 검색 + 필터)
3. 새 보고서 작성 (3단계 양식 + 자동저장)
4. 동아리 피드
5. 보고서 상세 + 반응/댓글
6. 환경설정 (짝선배/짝후배, 멤버 목록)

## 보고서 양식 구조 (content JSON)
Step1: 부분(기술/아이디어), 이름, 분야, 발견난이도, 발견경로, 출처/링크, 설명
Step2: 내 말로 설명, 강점, 한계
Step3: 아이디어이름, 활용방법, 유사아이디어, 실현가능성(easy/medium/hard), 이유
Summary: 한 줄 정리 (thing, problem)

## 공개 범위
private / custom / club / public 4단계
custom일 때는 report_shares 테이블 활용