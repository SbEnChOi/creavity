import test from "node:test";
import assert from "node:assert/strict";
import { draftSeedSchema, memoRequestSchema, newMemoState, savePrivateMemo } from "../src/lib/ai/memo";
import { requestSchema, sessionStateSchema } from "../src/lib/ai/schema";
import { transition } from "../src/lib/ai/flow";
import { messagesForTransition } from "../src/lib/ai/messages";

const start = {action:"start" as const, seed:"책을 읽다가 떠오른 생각을 나중에 볼 수 있게 저장하고 싶어요.", mode:"explore" as const, format:"basic" as const, useResearch:false};

test("a private memo validates independently of AI and keeps its full input", () => {
  assert.equal(draftSeedSchema.parse("  생각 한 가지  "), "생각 한 가지");
  assert.equal(draftSeedSchema.safeParse("  ").success, false);
  assert.equal(draftSeedSchema.safeParse("x".repeat(8000)).success, true);
  assert.equal(draftSeedSchema.safeParse("x".repeat(8001)).success, false);
  const memo = newMemoState(start);
  assert.equal(memo.seed, start.seed);
  assert.equal(memo.phase, "memo");
  assert.equal(memo.question, null);
  assert.equal(sessionStateSchema.safeParse(memo).success, true);
  const oneChar = newMemoState({...start,seed:"가"});
  assert.equal(sessionStateSchema.safeParse(oneChar).success, true);
});

test("memo cannot reach the AI or discard original before explicit action", async () => {
  const memo = newMemoState(start);
  let called = 0;
  const deps = { askQuestion: async () => { called++; return {topic:"goal" as const,prompt:"무엇을 해볼까요?",reason:"방향",multiple:true,options:[]}; }, makeDraft:async()=>{throw new Error("unreachable");}, researchIdea:async()=>{throw new Error("unreachable");} };
  assert.equal(called, 0);
  assert.equal(requestSchema.safeParse({action:"begin_memo",id:"10000000-0000-4000-8000-000000000001",revision:0,format:"basic",mode:"explore",useResearch:false}).success, true);
  const next = await transition(memo, {action:"begin_memo",id:"10000000-0000-4000-8000-000000000001",revision:0,format:"basic",mode:"explore",useResearch:false}, deps);
  assert.equal(called, 1);
  assert.equal(next.phase, "questions");
  const history = messagesForTransition(memo, next, {action:"begin_memo",id:"10000000-0000-4000-8000-000000000001",revision:0,format:"basic",mode:"explore",useResearch:false});
  assert.deepEqual(history.map(item=>item.role), ["user", "assistant"]);
  assert.equal(history[0].text, start.seed);
  assert.equal(next.seed, start.seed);
  assert.equal(memo.phase, "memo");
  await assert.rejects(transition(memo, {action:"begin_memo",id:"10000000-0000-4000-8000-000000000001",revision:0,format:"basic",mode:"explore",useResearch:false}, {...deps,askQuestion:async()=>{throw new Error("provider failure");}}), /provider failure/);
  assert.equal(memo.phase, "memo");
  assert.equal(memo.seed, start.seed);
  await assert.rejects(transition(next, {action:"begin_memo",id:"10000000-0000-4000-8000-000000000001",revision:0,format:"basic",mode:"explore",useResearch:false}, deps));
  const shortMemo = newMemoState({...start,seed:"가"});
  await assert.rejects(transition(shortMemo, {action:"begin_memo",id:"10000000-0000-4000-8000-000000000001",revision:0,format:"basic",mode:"explore",useResearch:false}, deps), /5자 이상/);
  assert.equal(shortMemo.seed, "가");
});

test("memo save uses authenticated owner, rejects visibility and is safe to retry", async () => {
  const requestId="10000000-0000-4000-8000-000000000001";
  const userId="10000000-0000-4000-8000-000000000002";
  assert.equal(memoRequestSchema.safeParse({seed:start.seed,requestId,visibility:"public"}).success,false);
  const input=memoRequestSchema.parse({seed:start.seed,requestId});
  let saved: import("../src/lib/ai/schema").Session | null = null;
  let count=0;
  const store={
    read: async (id:string, owner:string) => ({data:saved && saved.id===id && saved.user_id===owner ? saved : null,error:null}),
    insert: async (id:string, owner:string, state:import("../src/lib/ai/schema").SessionState) => {
      count++; saved={id,user_id:owner,state,revision:0,updated_at:new Date().toISOString()}; return {data:saved,error:null};
    },
  };
  const first=await savePrivateMemo(userId,input,store);
  const again=await savePrivateMemo(userId,input,store);
  assert.equal(count,1);
  assert.equal(first.user_id,userId);
  assert.equal(first.state.phase,"memo");
  assert.equal(again.id,first.id);
  await assert.rejects(savePrivateMemo(userId,{...input,seed:"다른 메모"},store));
});
