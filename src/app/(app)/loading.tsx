/**
 * (app) 그룹 공통 로딩 스켈레톤.
 * 사이드바는 layout이 유지하므로 본문 영역만 중립적인 회색 블록으로 채운다.
 * 모든 블록은 고정 높이를 써서 로딩 중 레이아웃 시프트가 생기지 않게 한다.
 */
export default function AppLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="불러오는 중"
      className="mx-auto w-full max-w-6xl px-5 py-12 md:px-10"
    >
      <span className="sr-only">불러오는 중…</span>
      <div
        aria-hidden="true"
        className="motion-safe:animate-pulse motion-reduce:animate-none"
      >
        {/* 헤더 */}
        <div className="h-4 w-24 rounded bg-foreground/10" />
        <div className="mt-4 h-9 w-56 max-w-full rounded-lg bg-foreground/10" />
        <div className="mt-3 h-4 w-full max-w-sm rounded bg-foreground/10" />

        {/* 필터/검색 바 */}
        <div className="mt-8 flex flex-wrap gap-3">
          <div className="h-10 w-full max-w-xs rounded-lg bg-foreground/[0.07]" />
          <div className="h-10 w-24 rounded-lg bg-foreground/[0.07]" />
        </div>

        {/* 목록 카드 */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="h-40 rounded-xl border border-border-default bg-panel p-5"
            >
              <div className="h-4 w-16 rounded bg-foreground/10" />
              <div className="mt-3 h-5 w-3/4 rounded bg-foreground/10" />
              <div className="mt-3 h-4 w-full rounded bg-foreground/[0.07]" />
              <div className="mt-2 h-4 w-5/6 rounded bg-foreground/[0.07]" />
              <div className="mt-5 h-3 w-20 rounded bg-foreground/[0.07]" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
