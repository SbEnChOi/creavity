import test from "node:test";
import assert from "node:assert/strict";
import { createDemoTransport, DEMO_SEED } from "../src/lib/ai/demo";
import { draftToReport } from "../src/lib/ai/report";
import { transition, assessFeedback } from "../src/lib/ai/engine";
import { TOPICS, REFINEMENT_PRESETS, nextTopic, readAnswer, safeUrl, videoId, requestSchema, type Question } from "../src/lib/ai/schema";
import { commonsImages, extractCitations, extractVideoResources, searchCommonsImages } from "../src/lib/ai/research";
import { AiError, response } from "../src/lib/ai/provider";

const start = { action: "start" as const, seed: DEMO_SEED, format: "extended" as const, useResearch: true };

test("all directions and explicit confirmation are required before drafting; revisions preserve the seed", async () => {
  const send = createDemoTransport();
  let session = await send(start);
  assert.equal(session.state.draft, null);
  await assert.rejects(send({ action: "confirm", id: session.id, revision: session.revision }), /먼저/);
  for (const topic of TOPICS) {
    assert.equal(session.state.question?.topic, topic);
    session = await send({ action: "answer", id: session.id, revision: session.revision, choices: ["option1"], custom: "" });
    assert.equal(session.state.draft, null);
    assert.equal(session.state.seed, DEMO_SEED);
  }
  assert.equal(nextTopic(session.state.answers), undefined);
  assert.equal(session.state.phase, "confirm");
  session = await send({ action: "confirm", id: session.id, revision: session.revision });
  assert.equal(session.state.phase, "review");
  assert.equal(session.state.confirmed, true);
  assert.ok(session.state.research);
  const report = draftToReport(session.state)!;
  assert.ok(report.content.execution);
  assert.equal("seed" in report.content, false);
  assert.equal("answers" in report.content, false);
  session = await send({ action: "back", id: session.id, revision: session.revision, topic: "problem" });
  assert.equal(session.state.answers.length, 2);
  assert.equal(session.state.confirmed, false);
  assert.equal(session.state.draft, null);
  assert.equal(session.state.research, null);
  assert.equal(draftToReport(session.state), null);
});

test("other answers are recorded literally; empty and unknown selections are rejected", () => {
  const q: Question = { topic: "goal", prompt: "목적?", reason: "", multiple: false, options: [{ id: "option1", label: "첫 선택", detail: "설명" }] };
  assert.equal(readAnswer(q, ["other"], "앱 만들기 말고 종이로 시작할래").value, "앱 만들기 말고 종이로 시작할래");
  assert.throws(() => readAnswer(q, ["other"], " "), /기타/);
  assert.throws(() => readAnswer(q, ["tampered"], ""), /없는 선택지/);
  assert.equal(readAnswer(q, ["option1", "other", "option1"], "내용").value, "첫 선택 — 설명 / 내용");
  assert.throws(() => readAnswer(q, [], ""), /확인/);
});

test("every topic supports multiple selections and other text, including older single-choice questions", async () => {
  const send = createDemoTransport();
  let session = await send(start);
  for (const topic of TOPICS) {
    assert.equal(session.state.question?.multiple, true);
    const oldQuestion = { ...session.state.question!, multiple: false };
    const selected = readAnswer(oldQuestion, ["option1", "option2", "other"], `${topic}의 추가 조건`);
    assert.ok(selected.value.includes(oldQuestion.options[0].label));
    assert.ok(selected.value.includes(oldQuestion.options[1].label));
    assert.ok(selected.value.includes(`${topic}의 추가 조건`));
    session = await send({ action: "answer", id: session.id, revision: session.revision, choices: ["option1", "option2", "other"], custom: `${topic}의 추가 조건` });
    assert.equal(session.state.answers.at(-1)?.value, selected.value);
  }
  assert.equal(session.state.phase, "confirm");
});

test("clarification does not turn an uncertain response into a confirmed direction; basic format stays compatible", async () => {
  const send = createDemoTransport();
  let s = await send({ ...start, format: "basic", useResearch: false });
  s = await send({ action: "clarify", id: s.id, revision: s.revision });
  assert.equal(s.state.answers.length, 0);
  assert.equal(s.state.question?.topic, "goal");
  for (const topic of TOPICS) {
    s = await send({ action: "answer", id: s.id, revision: s.revision, choices: ["other"], custom: `${topic}에 관한 나의 실제 답변` });
  }
  s = await send({ action: "confirm", id: s.id, revision: s.revision });
  assert.equal(s.state.research, null);
  assert.equal(s.state.draft?.content.execution, null);
  assert.equal(draftToReport(s.state)?.content.execution, undefined);
});

test("failed provider calls leave original conversation untouched", async () => {
  const send = createDemoTransport();
  const s = await send(start);
  const before = structuredClone(s.state);
  const failing = { askQuestion: async () => { throw new Error("timeout"); }, makeDraft: async () => { throw new Error("unexpected"); }, researchIdea: async () => { throw new Error("unexpected"); } };
  await assert.rejects(transition(s.state, { action: "answer", id: s.id, revision: s.revision, choices: ["option1"], custom: "" }, failing), /timeout/);
  assert.deepEqual(s.state, before);
});

test("ambiguous answers trigger further questions without silently confirming a direction", async () => {
  const send = createDemoTransport();
  const s = await send(start);
  const q = s.state.question!;
  const next = await transition(s.state, { action: "answer", id: s.id, revision: 0, choices: ["other"], custom: "그냥 좋은 거" }, {
    askQuestion: async (state, topic) => ({ ...q, topic, prompt: "좋다는 것은 어떤 변화를 뜻하나요?", reason: state.clarification }),
    makeDraft: async () => { throw new Error("must not draft"); },
    researchIdea: async () => { throw new Error("must not research"); },
    assessAnswer: async () => ({ sufficient: false, clarification: "좋다는 기준을 확인해야 합니다." }),
  });
  assert.equal(next.answers.length, 0);
  assert.equal(next.phase, "questions");
  assert.equal(next.pendingAnswer?.value, "그냥 좋은 거");
  assert.equal(next.history?.length, 1);
  assert.equal(next.question?.topic, "goal");
  assert.equal(s.state.answers.length, 0);
});

test("follow-up answers preserve the literal earlier answer in the confirmed direction", async () => {
  const send = createDemoTransport();
  const s = await send(start);
  const pending = { ...s.state, pendingAnswer: { topic: "goal" as const, question: "목적?", value: "학교 안에서 작은 나눔으로 시작하고 싶어" } };
  const next = await transition(pending, { action: "answer", id: s.id, revision: 0, choices: ["other"], custom: "먼저 우산 없이 귀가하는 불편을 줄일래" }, {
    askQuestion: async (_, topic) => ({ ...s.state.question!, topic }),
    makeDraft: async () => { throw new Error("must not draft"); },
    researchIdea: async () => { throw new Error("must not research"); },
    assessAnswer: async () => ({ sufficient: true, clarification: "" }),
  });
  assert.match(next.answers[0].value, /학교 안에서 작은 나눔/);
  assert.match(next.answers[0].value, /추가 확인 답변: 먼저 우산 없이 귀가하는 불편/);
  assert.equal(next.pendingAnswer, null);
  assert.equal(next.question?.topic, "audience");
});

test("direction-changing refinement asks again; ordinary editing keeps the confirmed direction", async () => {
  const send = createDemoTransport();
  let s = await send(start);
  for (const topic of TOPICS) {
    assert.equal(s.state.question?.topic, topic);
    s = await send({ action: "answer", id: s.id, revision: s.revision, choices: ["option1"], custom: "" });
  }
  s = await send({ action: "confirm", id: s.id, revision: s.revision });
  let drafts = 0;
  const deps = {
    askQuestion: async (_: unknown, topic: (typeof TOPICS)[number]) => ({ topic, prompt: "새로운 대상을 확인할까요?", reason: "", multiple: false, options: [] }),
    makeDraft: async () => { drafts++; return s.state.draft!; },
    researchIdea: async () => { throw new Error("must not research"); },
    assessFeedback: async () => "audience" as const,
  };
  const pending = await transition(s.state, { action: "refine", id: s.id, revision: s.revision, feedback: "학생 대신 교직원을 대상으로 바꿔줘" }, deps);
  assert.deepEqual(pending.answers, s.state.answers);
  assert.deepEqual(pending.draft, s.state.draft);
  assert.equal(pending.confirmed, true);
  assert.equal(pending.pendingRefinement?.topic, "audience");
  const cancelled = await transition(pending, { action: "cancel_refinement", id: s.id, revision: s.revision }, deps);
  assert.deepEqual(cancelled.answers, s.state.answers);
  assert.deepEqual(cancelled.draft, s.state.draft);
  assert.equal(cancelled.pendingRefinement, null);
  const changed = await transition(pending, { action: "confirm_refinement", id: s.id, revision: s.revision }, deps);
  assert.equal(drafts, 0);
  assert.equal(changed.answers.length, 1);
  assert.equal(changed.question?.topic, "audience");
  assert.equal(changed.confirmed, false);
  assert.equal(changed.draft, null);
  assert.equal(changed.research, null);
  assert.equal(changed.refinementRequest, "학생 대신 교직원을 대상으로 바꿔줘");
  await assert.rejects(transition(changed, { action: "confirm", id: s.id, revision: s.revision }, deps), /먼저/);
  const edited = await transition(s.state, { action: "refine", id: s.id, revision: s.revision, feedback: "문장을 간결하게 첨삭해줘" }, { ...deps, assessFeedback: async () => null });
  assert.equal(drafts, 1);
  assert.equal(edited.phase, "review");
  assert.deepEqual(edited.answers, s.state.answers);
});

test("built-in editing presets preserve intent without a model direction classification", async () => {
  const send = createDemoTransport();
  const s = await send(start);
  for (const feedback of REFINEMENT_PRESETS) assert.equal(await assessFeedback(s.state, feedback), null);
});

test("research refresh preserves source links already used by a draft", async () => {
  const send = createDemoTransport();
  const s = await send(start);
  s.state.research = { text: "previous", citations: [], resources: [{ kind: "web", title: "Original", url: "https://example.com/old" }] };
  const refreshed = await transition(s.state, { action: "research", id: s.id, revision: s.revision }, {
    askQuestion: async () => { throw new Error("must not ask"); },
    makeDraft: async () => { throw new Error("must not draft"); },
    researchIdea: async () => ({ text: "new result", citations: [], resources: [{ kind: "web", title: "New", url: "https://example.com/new" }] }),
  });
  assert.equal(refreshed.research?.text, "new result");
  assert.deepEqual(refreshed.research?.resources.map((r) => r.url), ["https://example.com/old", "https://example.com/new"]);
});

test("public https citations and real YouTube IDs only; no javascript, credentials or local URLs", () => {
  for (const url of ["javascript:alert(1)", "http://example.com", "https://user:pass@example.com", "https://127.0.0.1/x", "https://localhost/x", "https://host.internal/x"]) assert.equal(safeUrl(url), null);
  assert.equal(videoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(videoId("https://youtube.com.evil.org/watch?v=dQw4w9WgXcQ"), null);
  assert.equal(videoId("https://youtu.be/invalid"), null);
  const citations = extractCitations({ output: [{ type: "message", content: [{ type: "output_text", text: "some source", annotations: [
    { type: "url_citation", url: "https://example.com", title: "Source", start_index: 5, end_index: 11 },
    { type: "url_citation", url: "javascript:alert(1)", start_index: 0, end_index: 4 },
  ] }] }] });
  assert.equal(citations.length, 1);
  assert.equal(citations[0].url, "https://example.com/");
});

test("request schema rejects too-long seeds, malformed IDs and client-supplied conversation state", () => {
  assert.equal(requestSchema.safeParse({ ...start, seed: "a".repeat(8001) }).success, false);
  assert.equal(requestSchema.safeParse({ action: "confirm", id: "other", revision: 0 }).success, false);
  const parsed = requestSchema.parse({ ...start, user_id: "someone-else", confirmed: true, state: {} });
  assert.equal("user_id" in parsed, false);
  assert.equal("confirmed" in parsed, false);
});

test("provider handles missing keys, rate limits and incomplete output without leaking details", async () => {
  const previous = process.env.OPENAI_API_KEY;
  try {
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(response({}), /OPENAI_API_KEY/);
    process.env.OPENAI_API_KEY = "test-only-not-a-key";
    const rateLimited = (async () => new Response("secret-provider-detail", { status: 429 })) as typeof fetch;
    await assert.rejects(response({}, rateLimited), (e: unknown) => e instanceof AiError && e.status === 429 && !e.message.includes("secret"));
    const incomplete = (async () => Response.json({ status: "incomplete", output: [] })) as typeof fetch;
    await assert.rejects(response({}, incomplete), /마치지/);
  } finally {
    if (previous === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = previous;
  }
});

test("Commons thumbnail host and attribution are accepted; external thumbnail injection is rejected", async () => {
  const stub = (async () => Response.json({ query: { pages: {
    "1": { title: "File:Umbrella.jpg", index: 1, imageinfo: [{ thumburl: "https://thumb.wikimedia.org/umbrella.jpg?width=600", descriptionurl: "https://commons.wikimedia.org/wiki/File:Umbrella.jpg", extmetadata: { Artist: { value: "<a>Artist</a>" }, LicenseShortName: { value: "CC BY-SA 4.0" } } }] },
    "2": { title: "Injected", index: 2, imageinfo: [{ thumburl: "https://evil.example.com/tracker.jpg", descriptionurl: "https://commons.wikimedia.org/wiki/File:Umbrella.jpg" }] },
  } } })) as typeof fetch;
  const resources = await commonsImages("umbrella", stub);
  assert.equal(resources.length, 1);
  assert.equal(resources[0].kind, "image");
  assert.equal(resources[0].credit, "Artist · CC BY-SA 4.0");
});

test("empty compound image searches retry the visual object once", async () => {
  const queries: string[] = [];
  const stub = (async (url: string | URL | Request) => {
    queries.push(new URL(String(url)).searchParams.get("gsrsearch")!);
    return Response.json({ query: { pages: queries.length === 1 ? {} : {
      "1": { title: "File:Umbrella.jpg", imageinfo: [{ thumburl: "https://upload.wikimedia.org/umbrella.jpg", descriptionurl: "https://commons.wikimedia.org/wiki/File:Umbrella.jpg" }] },
    } } });
  }) as typeof fetch;
  assert.equal((await searchCommonsImages("umbrella rain", stub)).length, 1);
  assert.deepEqual(queries, ["intitle:umbrella rain filetype:bitmap", "intitle:umbrella filetype:bitmap"]);
});

test("video resources use actual search sources, never URLs invented in model text", () => {
  const data = { output: [
    { type: "message", content: [{ type: "output_text", text: "https://youtu.be/fakefake123" }] },
    { type: "web_search_call", action: { sources: [
      { title: "Real source", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
      { url: "https://youtube.com.evil.org/watch?v=dQw4w9WgXcQ" },
      { url: "https://youtu.be/invalid" },
    ] } },
  ] };
  const resources = extractVideoResources(data);
  assert.equal(resources.length, 1);
  assert.equal(resources[0].title, "Real source");
  assert.equal(resources[0].kind, "video");
});
