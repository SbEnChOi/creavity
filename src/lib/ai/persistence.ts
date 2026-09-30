import { z } from "zod";
import { sessionSchema, type Session } from "./schema";

export type LocalStorageLike = Pick<Storage, "getItem" | "setItem">;
const composerSchema = z.object({ seed: z.string().max(8000), mode: z.enum(["explore", "focus"]), format: z.enum(["basic", "extended"]), useResearch: z.boolean(), sessionId: z.string().uuid().nullable(), revision: z.number().int().nonnegative().nullable(), choices: z.array(z.string()).max(6), custom: z.string().max(2000), feedback: z.string().max(2000), focusDirection: z.string().max(2000) });
export type Composer = z.infer<typeof composerSchema>;
export function composerKey(userId: string) { return `creavy.ai.composer.v1:${userId}`; }
export function readComposer(storage: LocalStorageLike, key: string): Composer | null {
  try { const value = composerSchema.safeParse(JSON.parse(storage.getItem(key) || "null")); return value.success ? value.data : null; } catch { return null; }
}
export function saveComposer(storage: LocalStorageLike, key: string, value: Composer): boolean {
  try { storage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}
export const DEMO_STORAGE_KEY = "creavy.ai.preview.v1";
export function readDemo(storage: LocalStorageLike): { sessions: Session[]; lastId: string | null } {
  try {
    const parsed = z.object({ sessions: z.array(sessionSchema).max(50), lastId: z.string().uuid().nullable() }).safeParse(JSON.parse(storage.getItem(DEMO_STORAGE_KEY) || "null"));
    if (parsed.success) return parsed.data;
  } catch { /* Corrupt or unavailable storage falls back to an empty preview. */ }
  return { sessions: [], lastId: null };
}
export function saveDemo(storage: LocalStorageLike, sessions: Session[], lastId: string | null): boolean {
  try { storage.setItem(DEMO_STORAGE_KEY, JSON.stringify({ sessions: sessions.slice(-50), lastId })); return true; } catch { return false; }
}
