"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureProfile } from "@/lib/auth-helpers";

type Mode = "login" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createSupabaseBrowserClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name } },
      });
      if (error) {
        setError(translateError(error.message));
        setLoading(false);
        return;
      }
      if (data.user) {
        await ensureProfile(supabase, data.user, name || email.split("@")[0]);
      }
      // 이메일 확인이 꺼져있으면 세션이 바로 발급됨
      if (data.session) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError("이메일로 보낸 확인 링크를 클릭한 뒤 로그인해주세요.");
        setLoading(false);
      }
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(translateError(error.message));
        setLoading(false);
        return;
      }
      if (data.user) {
        await ensureProfile(supabase, data.user, email.split("@")[0]);
      }
      router.push("/dashboard");
      router.refresh();
    }
  };

  const handleGuest = async () => {
    setError(null);
    setLoading(true);
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      setError(
        "게스트 로그인이 비활성화되어 있습니다. Supabase 대시보드에서 익명 로그인을 켜주세요."
      );
      setLoading(false);
      return;
    }
    if (data.user) {
      const guestName = `게스트-${data.user.id.slice(0, 4)}`;
      await ensureProfile(supabase, data.user, guestName);
    }
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-foreground text-white text-xl font-bold mb-5">
            창
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-1.5">창의력</h1>
          <p className="text-sm text-foreground/60">
            동아리 사고력 플랫폼에 오신 것을 환영합니다
          </p>
        </div>

        <div className="flex items-center gap-1 p-0.5 bg-surface rounded-md mb-5">
          {(["login", "signup"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError(null);
              }}
              className={`flex-1 py-1.5 text-sm rounded transition-colors ${
                mode === m
                  ? "bg-white text-foreground font-medium"
                  : "text-foreground/60 hover:text-foreground"
              }`}
            >
              {m === "login" ? "로그인" : "회원가입"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === "signup" && (
            <FormInput
              label="이름"
              type="text"
              value={name}
              onChange={setName}
              placeholder="홍길동"
              required
            />
          )}
          <FormInput
            label="이메일"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="you@example.com"
            required
          />
          <FormInput
            label="비밀번호"
            type="password"
            value={password}
            onChange={setPassword}
            placeholder="6자 이상"
            required
            minLength={6}
          />

          {error && (
            <div className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-md">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-md bg-foreground text-white text-sm font-medium hover:bg-foreground/90 disabled:opacity-50 transition-colors"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {mode === "login" ? "로그인" : "가입하고 시작하기"}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-foreground/40">
          <div className="flex-1 h-px bg-border-default" />
          또는
          <div className="flex-1 h-px bg-border-default" />
        </div>

        <button
          type="button"
          onClick={handleGuest}
          disabled={loading}
          className="w-full py-2.5 rounded-md border border-border-default text-sm text-foreground hover:bg-surface disabled:opacity-50 transition-colors"
        >
          게스트로 둘러보기
        </button>

        <p className="mt-6 text-center text-xs text-foreground/40">
          가입하면 동아리 멤버로 등록됩니다.
        </p>
      </div>
    </div>
  );
}

function FormInput({
  label,
  value,
  onChange,
  ...rest
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-foreground/60 mb-1">
        {label}
      </span>
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 text-sm rounded-md bg-white border border-border-default focus:outline-none focus:border-foreground/30 transition-colors"
      />
    </label>
  );
}

function translateError(msg: string): string {
  if (msg.includes("Invalid login credentials"))
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  if (msg.includes("User already registered"))
    return "이미 가입된 이메일입니다. 로그인해주세요.";
  if (msg.includes("Password should be at least"))
    return "비밀번호는 6자 이상이어야 합니다.";
  if (msg.includes("Email not confirmed"))
    return "이메일 확인이 필요합니다. 받은 메일의 링크를 클릭해주세요.";
  return msg;
}
