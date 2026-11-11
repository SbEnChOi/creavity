import { z } from "zod";
import type { AiRequest, Session, SessionState } from "./schema";

export const draftSeedSchema = z.string().trim().min(1).max(8000);
export const memoRequestSchema = z.object({ seed: draftSeedSchema, requestId: z.string().uuid() }).strict();
type QueryResult = { data: Session | null; error: { code?: string } | null };
type MemoStore = { read(id: string, userId: string): Promise<QueryResult>; insert(id: string, userId: string, state: SessionState): Promise<QueryResult> };

export function newMemoState(input: Extract<AiRequest, { action: "start" }>): SessionState {
  return { seed: input.seed, mode: input.mode ?? "explore", format: "basic", useResearch: false,
    phase: "memo", answers: [], question: null, clarification: "", research: null, draft: null, confirmed: false };
}

export async function savePrivateMemo(userId: string, input: z.infer<typeof memoRequestSchema>, store: MemoStore): Promise<Session> {
  const existing = await store.read(input.requestId, userId);
  if (existing.error) throw new Error("메모를 확인하지 못했어요. 다시 시도해주세요.");
  if (existing.data) {
    if (existing.data.state.seed !== input.seed) throw new Error("다른 메모와 저장 요청이 겹쳤어요. 다시 시도해주세요.");
    return existing.data;
  }
  const state = newMemoState({ action: "start", seed: input.seed, mode: "explore", format: "basic", useResearch: false });
  const inserted = await store.insert(input.requestId, userId, state);
  if (!inserted.error && inserted.data) return inserted.data;
  if (inserted.error?.code === "23505") {
    const retry = await store.read(input.requestId, userId);
    if (!retry.error && retry.data?.state.seed === input.seed) return retry.data;
  }
  throw new Error("메모를 저장하지 못했어요. 입력한 내용을 유지하고 다시 시도해주세요.");
}
