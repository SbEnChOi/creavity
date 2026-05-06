import { Code2, Clock, User, Target } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="px-10 py-12 max-w-2xl">
      <header className="mb-10">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-foreground text-white text-xl font-bold mb-4">
          C
        </div>
        <h1 className="text-3xl font-bold text-foreground mb-1">Creavy · 크래비</h1>
        <p className="text-sm text-foreground/60">
          동아리원과 함께 생각을 나누는 보고서 플랫폼
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-xs font-medium text-foreground/40 mb-3">정보</h2>
        <ul className="space-y-3">
          <InfoRow Icon={User} label="제작자" value="20625 최승빈" />
          <InfoRow Icon={Code2} label="개발 도구" value="with Claude Code" />
          <InfoRow Icon={Clock} label="개발 시간" value="5 hours" />
        </ul>
      </section>

      <section>
        <h2 className="text-xs font-medium text-foreground/40 mb-3 flex items-center gap-1.5">
          <Target size={12} strokeWidth={1.75} />
          만든 목적
        </h2>
        <div className="px-5 py-4 rounded-lg bg-surface text-sm text-foreground/85 leading-relaxed">
          <p className="mb-3">
            창의적인 아이디어를 내놓으려면 창의적인 사고력이 필요하다.
            이를 위해선 뒷받침하는 배경지식이 필수적이다.
          </p>
          <p className="mb-3">
            같은 공간, 같은 일상의 반복인 디미고 환경에서는
            평소에 주변을 둘러보며 이러한 지식을 쌓는 것이 어렵다.
          </p>
          <p>
            매주 새롭게 알게된 아이디어나 기술을 분석하며
            창의적인 사고력을 길러보자.
          </p>
        </div>
      </section>
    </div>
  );
}

function InfoRow({
  Icon,
  label,
  value,
}: {
  Icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="flex items-center justify-center w-8 h-8 rounded-md bg-surface text-foreground/60 shrink-0">
        <Icon size={14} strokeWidth={1.75} />
      </span>
      <span className="text-foreground/50 w-20 shrink-0">{label}</span>
      <span className="text-foreground">{value}</span>
    </li>
  );
}
