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
          떠오른 생각을 정리하고 함께 나누는 아이디어 플랫폼
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
            일상에서 문득 떠오른 생각은 짧은 메모로 시작해도 좋아요.
            Creavy는 그 생각을 나중에 다시 꺼내 쓸 수 있는 아이디어로 정리해요.
          </p>
          <p className="mb-3">
            AI와 대화하며 다양한 활용 장면과 파생 기능을 탐색하고,
            마음에 드는 방향은 실제로 써볼 방법까지 구체화할 수 있어요.
          </p>
          <p>
            정리한 아이디어와 참고 자료를 보관하고 함께 나눠보세요.
            지금 실행하지 않아도 가능성을 기록해두는 것만으로 의미가 있어요.
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
