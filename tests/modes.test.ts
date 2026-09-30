import test from "node:test";
import assert from "node:assert/strict";
import { createDemoTransport, DEMO_SEED } from "../src/lib/ai/demo";
import { dialogueMode, requestSchema, topicLabels, type DialogueMode } from "../src/lib/ai/schema";
import { draftToReport } from "../src/lib/ai/report";

async function completed(mode: DialogueMode = "explore") {
  const send = createDemoTransport();
  let session = await send({ action: "start", seed: DEMO_SEED, format: "extended", useResearch: false, mode });
  for (let i = 0; i < 6; i++) session = await send({ action: "answer", id: session.id, revision: session.revision, choices: ["option1", "option2"], custom: "" });
  session = await send({ action: "confirm", id: session.id, revision: session.revision });
  return { send, session };
}

test("new conversations default to exploration; legacy conversations keep focus semantics", async () => {
  const send = createDemoTransport();
  const session = await send({ action: "start", seed: DEMO_SEED, format: "extended", useResearch: false });
  assert.equal(session.state.mode, "explore");
  assert.equal(session.state.format, "basic");
  assert.equal(dialogueMode({}), "focus");
  assert.notEqual(topicLabels("focus").constraints, topicLabels("explore").constraints);
  assert.equal(requestSchema.safeParse({ action: "start", seed: DEMO_SEED, format: "basic", useResearch: false, mode: "invalid" }).success, false);
});

test("exploration archives multiple possibilities without requiring execution commitments", async () => {
  const { session } = await completed();
  const report = draftToReport(session.state)!;
  assert.equal(session.state.draft?.content.execution, null);
  assert.equal(report.content.execution, undefined);
  assert.equal(report.content.ai_notes?.mode, "explore");
  const functions = session.state.answers.find(a => a.topic === "solution")!.value;
  assert.ok(session.state.draft?.content.step3.application.includes(functions));
  assert.ok(report.content.ai_notes?.open_questions?.length);
});

test("focus follow-up preserves the original exploration and requires new answers and confirmation", async () => {
  const { send, session } = await completed();
  const before = structuredClone(session);
  const direction = "물건의 사연 기록과 반납 안내를 함께 구체화";
  const focus = await send({ action: "fork_focus", id: session.id, revision: session.revision, direction });
  assert.notEqual(focus.id, session.id);
  assert.equal(focus.revision, 0);
  assert.deepEqual(session, before);
  assert.equal(focus.state.sourceSessionId, session.id);
  assert.equal(focus.state.focusDirection, direction);
  assert.equal(focus.state.seed, session.state.seed);
  assert.equal(focus.state.mode, "focus");
  assert.equal(focus.state.confirmed, false);
  assert.equal(focus.state.answers.length, 0);
  assert.equal(focus.state.draft, null);
  assert.equal(draftToReport(focus.state), null);
  await assert.rejects(send({ action: "confirm", id: focus.id, revision: focus.revision }), /먼저/);
  const original = await send({ action: "research", id: session.id, revision: session.revision });
  assert.deepEqual(original.state.answers, before.state.answers);
  assert.deepEqual(original.state.draft, before.state.draft);
});

test("focus forks are rejected before an exploration record is confirmed or from focus sessions", async () => {
  const send = createDemoTransport();
  const pending = await send({ action: "start", seed: DEMO_SEED, format: "basic", useResearch: false });
  await assert.rejects(send({ action: "fork_focus", id: pending.id, revision: pending.revision, direction: "기록 기능" }), /확장 탐색/);
  const { send: focusSend, session } = await completed("focus");
  await assert.rejects(focusSend({ action: "fork_focus", id: session.id, revision: session.revision, direction: "기록 기능" }), /확장 탐색/);
  assert.equal(requestSchema.safeParse({ action: "fork_focus", id: session.id, revision: session.revision, direction: " " }).success, false);
});
