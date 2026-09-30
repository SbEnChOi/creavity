import type { Draft } from "@/lib/ai/schema";

export default function DraftPreview({ draft }: { draft: Draft }) {
  const c = draft.content;
  const groups = [
    { title: "발견", rows: [["부분", c.step1.kind === "idea" ? "아이디어" : "기술"], ["이름", c.step1.name], ["분야", c.step1.fields.join(" · ")], ["설명", c.step1.description]] },
    { title: "분석", rows: [["내 말로 설명", c.step2.principle], ["강점", c.step2.strengths], ["한계", c.step2.limits]] },
    { title: "확장", rows: [["아이디어 이름", c.step3.idea_name], ["활용 방법", c.step3.application], ["유사한 아이디어", c.step3.similar_ideas], ["실현 가능성", ({ easy: "쉬움", medium: "보통", hard: "어려움", unknown: "판단 보류" })[c.step3.feasibility]], ["이유", c.step3.feasibility_reason]] },
    { title: "한 줄 정리", rows: [["무엇을", c.summary.thing], ["해결하려는 문제", c.summary.problem]] },
    ...(c.execution ? [{ title: "첫 실행 계획", rows: [["대상 사용자", c.execution.audience], ["사용 상황", c.execution.scenario], ["첫 실험", c.execution.first_test], ["성공 기준", c.execution.success_metric]] }] : []),
  ];
  return <div className="space-y-7">
    <h2 className="text-2xl font-semibold tracking-tight">{draft.title}</h2>
    {groups.map((g, i) => <section key={g.title}>
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold"><span className="flex h-5 w-5 items-center justify-center rounded bg-surface text-[11px]">{i + 1}</span>{g.title}</h3>
      <dl className="space-y-3 border-l border-border-default pl-4">
        {g.rows.map(([label, text]) => <div key={label}><dt className="mb-1 text-[11px] text-foreground/50">{label}</dt><dd className="whitespace-pre-wrap break-words text-sm leading-6">{text || "미정"}</dd></div>)}
      </dl>
    </section>)}
    {draft.suggestions.length > 0 && <section className="rounded-xl bg-surface p-4"><h3 className="mb-2 text-xs font-semibold">따로 생각해볼 AI 제안</h3><ul className="list-disc space-y-2 pl-4 text-sm leading-6 text-foreground/70">{draft.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul></section>}
    {draft.open_questions.length > 0 && <section className="rounded-xl border border-border-default p-4"><h3 className="mb-2 text-xs font-semibold">아직 확인할 내용</h3><ul className="list-disc space-y-2 pl-4 text-sm leading-6 text-foreground/70">{draft.open_questions.map((s, i) => <li key={i}>{s}</li>)}</ul></section>}
  </div>;
}
