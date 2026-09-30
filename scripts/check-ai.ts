import { askQuestion } from "../src/lib/ai/engine";
import type { SessionState } from "../src/lib/ai/schema";

async function main() {
  const key = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key || !url || !publicKey || url.includes("YOUR_PROJECT")) throw new Error(".env.local에 OpenAI API 키와 Supabase 연결 값을 설정해주세요.");
  const settings = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: publicKey }, signal: AbortSignal.timeout(15000) });
  if (!settings.ok) throw new Error(`Supabase 연결을 확인해주세요. HTTP ${settings.status}`);
  const sessions = await fetch(`${url}/rest/v1/ai_sessions?select=id&limit=0`, { headers: { apikey: publicKey, Authorization: `Bearer ${publicKey}` }, signal: AbortSignal.timeout(15000) });
  if (!sessions.ok) throw new Error("Supabase에 AI 마이그레이션을 적용해주세요.");
  const available = await fetch(`https://api.openai.com/v1/models/${encodeURIComponent(model)}`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(15000) });
  if (!available.ok) throw new Error(`OpenAI API 키·모델 접근 권한을 확인해주세요. HTTP ${available.status}`);
  console.log(`Supabase 연결·AI 테이블·OpenAI 모델(${model}) 접근 확인 완료.`);
  if (process.argv.includes("--live")) {
    const state: SessionState = { seed: "학교에서 우산을 빌리고 돌려주는 과정을 종이 기록으로 쉽게 만들고 싶다.", format: "basic", useResearch: false, phase: "questions", answers: [], question: null, clarification: "", research: null, draft: null, confirmed: false };
    const question = await askQuestion(state, "goal");
    console.log(`실제 질문 생성 완료: ${question.prompt} (${question.options.length}개 선택지 + 기타)`);
  }
}

main().catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
