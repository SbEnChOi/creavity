"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Globe, Lock, UserCheck } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { FIELD_OPTIONS } from "@/lib/constants";
import ImageUploadBox from "@/components/ImageUploadBox";
import type { Report, ReportContent, Visibility } from "@/types/report";

type SaveState = "idle" | "saving" | "saved" | "error";

const visibilityOptions: { value: Visibility; label: string; Icon: typeof Globe }[] = [
  { value: "private", label: "비공개", Icon: Lock },
  { value: "custom", label: "멘토만", Icon: UserCheck },
  { value: "public", label: "전체 공개", Icon: Globe },
];

export default function ReportEditor({ initialReport }: { initialReport?: Report } = {}) {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [reportId, setReportId] = useState<string | null>(initialReport?.id ?? null);
  const [title, setTitle] = useState(initialReport?.title ?? "");
  const [edition, setEdition] = useState<number | "">(initialReport?.edition ?? "");
  const [content, setContent] = useState<ReportContent>(
    initialReport?.content ?? { step1: {}, step2: {}, step3: {}, summary: {} }
  );
  const [visibility, setVisibility] = useState<Visibility>(
    (initialReport?.visibility ?? "private") as Visibility
  );
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, [supabase]);

  const reportIdRef = useRef<string | null>(null);
  const firstRenderRef = useRef(true);
  const statusRef = useRef<"draft" | "published">(initialReport?.status ?? "draft");

  useEffect(() => { reportIdRef.current = reportId; }, [reportId]);

  // 2초 debounce 자동저장
  useEffect(() => {
    if (firstRenderRef.current) { firstRenderRef.current = false; return; }
    const timer = setTimeout(() => doSave({ asDraft: true }), 2000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, edition, content, visibility]);

  const buildPayload = (extra?: Record<string, unknown>) => ({
    title: title || "제목 없음",
    content,
    visibility,
    edition: edition === "" ? null : Number(edition),
    field: (content.step1?.fields?.[0] ?? content.step1?.field) ?? null, // 첫 번째 분야를 필터용 컬럼에 저장
    ...extra,
  });

  const doSave = async ({ asDraft }: { asDraft: boolean }): Promise<string | null> => {
    if (!title.trim() && !hasContent(content)) return null;
    setSaveState("saving");
    setSaveError(null);

    // 자동저장은 현재 status 유지, 명시적 발행은 published
    const status = asDraft ? statusRef.current : "published";
    const payload = buildPayload({ status });
    const currentId = reportIdRef.current;

    if (currentId) {
      const { error } = await supabase.from("reports").update(payload).eq("id", currentId);
      if (error) { setSaveState("error"); setSaveError(error.message); return null; }
      setSaveState("saved"); setSavedAt(new Date());
      return currentId;
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaveState("error"); setSaveError("로그인이 필요합니다."); return null; }

      const { data, error } = await supabase
        .from("reports")
        .insert({ ...payload, author_id: user.id })
        .select("id")
        .single();

      if (error || !data) {
        setSaveState("error");
        setSaveError(error?.message ?? "알 수 없는 오류");
        return null;
      }
      setReportId(data.id);
      reportIdRef.current = data.id;
      setSaveState("saved"); setSavedAt(new Date());
      return data.id;
    }
  };

  const handlePublish = async () => {
    if (!title.trim() && !hasContent(content)) return;
    setPublishing(true);
    setSaveError(null);

    const id = reportIdRef.current ?? (await doSave({ asDraft: false }));
    if (!id) { setPublishing(false); return; }

    const { error } = await supabase
      .from("reports")
      .update({ status: "published", published_at: new Date().toISOString(), visibility })
      .eq("id", id);

    if (error) { setPublishing(false); setSaveError(error.message); return; }

    // 자동저장이 다시 draft로 덮어쓰지 않도록 현재 status 갱신
    statusRef.current = "published";

    // 멘토만(custom)인 경우 report_shares 동기화
    if (visibility === "custom") {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: mentors } = await supabase
          .from("mentor_pairings")
          .select("mentor_id")
          .eq("mentee_id", user.id);

        // 기존 공유 정리 후 다시 추가
        await supabase.from("report_shares").delete().eq("report_id", id);
        const rows = (mentors ?? []).map((m) => ({
          report_id: id,
          user_id: m.mentor_id,
        }));
        if (rows.length > 0) {
          await supabase.from("report_shares").insert(rows);
        }
      }
    }

    setPublishing(false);
    router.refresh();
    router.push("/dashboard");
  };

  const updateStep = <K extends keyof ReportContent>(
    key: K,
    patch: Partial<NonNullable<ReportContent[K]>>
  ) => setContent((prev) => ({ ...prev, [key]: { ...(prev[key] ?? {}), ...patch } }));

  return (
    <div className="px-10 py-10 max-w-3xl">
      <div className="mb-6 flex items-center justify-between text-xs text-foreground/50">
        <SaveIndicator state={saveState} savedAt={savedAt} />
      </div>

      {saveError && (
        <div className="mb-6 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-mono break-all">
          <span className="font-semibold">저장 오류: </span>{saveError}
        </div>
      )}

      <div className="flex items-baseline gap-3 mb-2">
        <input
          type="number"
          min={1}
          value={edition}
          onChange={(e) => setEdition(e.target.value === "" ? "" : Number(e.target.value))}
          placeholder="차수"
          className="w-20 text-sm bg-transparent border-b border-border-default focus:border-foreground/40 outline-none placeholder:text-foreground/30 py-1"
        />
        <span className="text-xs text-foreground/40">차수 (선택)</span>
      </div>

      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="제목 없음"
        className="w-full text-4xl font-bold text-foreground bg-transparent border-none outline-none placeholder:text-foreground/20 mb-10"
      />

      <Section number={1} label="발견">
        <Field label="부분">
          <Segmented
            value={content.step1?.kind ?? ""}
            options={[{ value: "tech", label: "기술" }, { value: "idea", label: "아이디어" }]}
            onChange={(v) => updateStep("step1", { kind: v })}
          />
        </Field>
        <Field label="이름">
          <Input value={content.step1?.name ?? ""} onChange={(v) => updateStep("step1", { name: v })} placeholder="기술/아이디어 이름" />
        </Field>
        <Field label="분야">
          <FieldSelect
            values={content.step1?.fields ?? (content.step1?.field ? [content.step1.field] : [])}
            onChange={(v) => updateStep("step1", { fields: v, field: v[0] })}
          />
        </Field>
        <Field label="발견 난이도">
          <Segmented
            value={content.step1?.difficulty ?? ""}
            options={[{ value: "casual", label: "우연히" }, { value: "searched", label: "찾다가" }, { value: "deep", label: "깊이 파다가" }]}
            onChange={(v) => updateStep("step1", { difficulty: v })}
          />
        </Field>
        <Field label="출처 이름">
          <Input value={content.step1?.source ?? ""} onChange={(v) => updateStep("step1", { source: v })} placeholder="유튜브, 논문, 뉴스 등" />
        </Field>
        <Field label="출처 링크">
          <Input value={content.step1?.url ?? ""} onChange={(v) => updateStep("step1", { url: v })} placeholder="https://..." />
        </Field>
        <Field label="사진">
          {userId ? (
            <ImageUploadBox
              userId={userId}
              images={content.step1?.images ?? []}
              onChange={(imgs) => updateStep("step1", { images: imgs })}
            />
          ) : (
            <div className="text-xs text-foreground/40 px-3 py-2">로그인 정보를 불러오는 중...</div>
          )}
        </Field>
        <Field label="설명">
          <Textarea value={content.step1?.description ?? ""} onChange={(v) => updateStep("step1", { description: v })} placeholder="이 기술/아이디어를 한두 문단으로 설명해주세요" />
        </Field>
      </Section>

      <Section number={2} label="분석">
        <Field label="내 말로 설명">
          <Textarea value={content.step2?.principle ?? ""} onChange={(v) => updateStep("step2", { principle: v })} placeholder="다른 사람에게 설명한다면?" />
        </Field>
        <Field label="강점">
          <Textarea value={content.step2?.strengths ?? ""} onChange={(v) => updateStep("step2", { strengths: v })} placeholder="어떤 점이 좋은가요?" />
        </Field>
        <Field label="한계">
          <Textarea value={content.step2?.limits ?? ""} onChange={(v) => updateStep("step2", { limits: v })} placeholder="어떤 점이 부족하거나 위험한가요?" />
        </Field>
      </Section>

      <Section number={3} label="확장">
        <Field label="아이디어 이름">
          <Input value={content.step3?.idea_name ?? ""} onChange={(v) => updateStep("step3", { idea_name: v })} placeholder="새로운 아이디어의 이름" />
        </Field>
        <Field label="활용 방법">
          <Textarea value={content.step3?.application ?? ""} onChange={(v) => updateStep("step3", { application: v })} placeholder="어떻게 활용할 수 있을까요?" />
        </Field>
        <Field label="유사한 아이디어">
          <Textarea value={content.step3?.similar_ideas ?? ""} onChange={(v) => updateStep("step3", { similar_ideas: v })} placeholder="비슷한 사례가 있나요?" />
        </Field>
        <Field label="실현 가능성">
          <Segmented
            value={content.step3?.feasibility ?? ""}
            options={[{ value: "easy", label: "쉬움" }, { value: "medium", label: "보통" }, { value: "hard", label: "어려움" }]}
            onChange={(v) => updateStep("step3", { feasibility: v })}
          />
        </Field>
        <Field label="이유">
          <Textarea value={content.step3?.feasibility_reason ?? ""} onChange={(v) => updateStep("step3", { feasibility_reason: v })} placeholder="왜 그렇게 생각하나요?" />
        </Field>
      </Section>

      <Section number={4} label="한 줄 정리">
        <Field label="무엇을">
          <Input
            value={content.summary?.thing ?? ""}
            onChange={(v) => setContent((p) => ({ ...p, summary: { ...(p.summary ?? {}), thing: v } }))}
            placeholder="무엇에 대한 보고서인가요?"
          />
        </Field>
        <Field label="해결하려는 문제">
          <Input
            value={content.summary?.problem ?? ""}
            onChange={(v) => setContent((p) => ({ ...p, summary: { ...(p.summary ?? {}), problem: v } }))}
            placeholder="어떤 문제를 풀고자 하나요?"
          />
        </Field>
      </Section>

      <div className="mt-12 pt-6 border-t border-border-default space-y-4">
        <VisibilityChips value={visibility} onChange={setVisibility} />

        <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={handlePublish}
          disabled={(!title.trim() && !hasContent(content)) || publishing}
          className="px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {publishing ? (
            <span className="flex items-center gap-1.5"><Loader2 size={14} className="animate-spin" />발행 중...</span>
          ) : "발행하기"}
        </button>
        </div>
      </div>
    </div>
  );
}

// ─── 분야 선택 ────────────────────────────────────────────────────────────────

function FieldSelect({ values, onChange }: { values: string[]; onChange: (v: string[]) => void }) {
  const presetValues = values.filter((v) => (FIELD_OPTIONS as readonly string[]).includes(v));
  const customValues = values.filter((v) => !(FIELD_OPTIONS as readonly string[]).includes(v));
  const [customInput, setCustomInput] = useState("");
  const valueSet = new Set(values);

  const togglePreset = (opt: string) => {
    if (valueSet.has(opt)) {
      onChange(values.filter((v) => v !== opt));
    } else {
      onChange([...values, opt]);
    }
  };

  const addCustom = () => {
    const v = customInput.trim();
    if (!v || valueSet.has(v)) { setCustomInput(""); return; }
    onChange([...values, v]);
    setCustomInput("");
  };

  const removeCustom = (v: string) => {
    onChange(values.filter((x) => x !== v));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {FIELD_OPTIONS.map((opt) => {
          const active = presetValues.includes(opt);
          return (
            <button key={opt} type="button" onClick={() => togglePreset(opt)}
              className={`px-2.5 py-1 rounded-full text-xs transition-colors ${
                active ? "bg-foreground text-white" : "bg-surface text-foreground/70 hover:bg-black/[0.06]"
              }`}>
              {opt}
            </button>
          );
        })}
      </div>

      {customValues.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {customValues.map((v) => (
            <button key={v} type="button" onClick={() => removeCustom(v)}
              title="클릭해서 제거"
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-foreground text-white hover:bg-foreground/85"
            >
              {v} <span className="opacity-60">×</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); addCustom(); }
          }}
          placeholder="기타 직접 입력 후 Enter 또는 추가"
          className="flex-1 px-0 py-1.5 text-sm bg-transparent border-b border-border-default focus:border-foreground/40 outline-none placeholder:text-foreground/30"
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customInput.trim()}
          className="text-xs text-foreground/60 hover:text-foreground disabled:opacity-30"
        >
          + 추가
        </button>
      </div>
    </div>
  );
}

// ─── 공통 UI ──────────────────────────────────────────────────────────────────

function SaveIndicator({ state, savedAt }: { state: SaveState; savedAt: Date | null }) {
  if (state === "saving") return <span className="flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" />저장 중...</span>;
  if (state === "saved") return (
    <span className="flex items-center gap-1.5">
      <Check size={12} />저장됨
      {savedAt && <span className="text-foreground/30">· {savedAt.getHours().toString().padStart(2,"0")}:{savedAt.getMinutes().toString().padStart(2,"0")}</span>}
    </span>
  );
  if (state === "error") return <span className="text-red-500">저장 실패</span>;
  return <span className="text-foreground/30">자동저장</span>;
}

function Section({ number, label, children }: { number: number; label: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border-default">
        <span className="flex items-center justify-center w-5 h-5 rounded bg-foreground/10 text-foreground text-xs font-semibold">{number}</span>
        <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      </div>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-foreground/60 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="w-full px-0 py-1.5 text-sm bg-transparent border-b border-border-default focus:border-foreground/40 outline-none placeholder:text-foreground/30" />
  );
}

function Textarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3}
      className="w-full px-3 py-2 text-sm bg-surface rounded-md border border-transparent focus:border-foreground/20 focus:bg-white outline-none placeholder:text-foreground/30 resize-none transition-colors" />
  );
}

type SegOpt = string | { value: string; label: string };

function Segmented({ value, options, onChange }: { value: string; options: SegOpt[]; onChange: (v: string) => void }) {
  return (
    <div className="inline-flex items-center gap-1 p-0.5 bg-surface rounded-md">
      {options.map((opt) => {
        const v = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        return (
          <button key={v} type="button" onClick={() => onChange(value === v ? "" : v)}
            className={`px-2.5 py-1 text-xs rounded transition-colors ${value === v ? "bg-white text-foreground font-medium" : "text-foreground/60 hover:text-foreground"}`}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

function VisibilityChips({ value, onChange }: { value: Visibility; onChange: (v: Visibility) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-foreground/40 mr-1">공개 범위</span>
      {visibilityOptions.map(({ value: v, label, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs transition-colors ${
            value === v
              ? "bg-foreground text-white"
              : "bg-surface text-foreground/70 hover:bg-black/[0.06]"
          }`}
        >
          <Icon size={11} strokeWidth={1.75} />
          {label}
        </button>
      ))}
    </div>
  );
}

function hasContent(c: ReportContent): boolean {
  return JSON.stringify(c) !== JSON.stringify({ step1: {}, step2: {}, step3: {}, summary: {} });
}
