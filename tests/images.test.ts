import test from "node:test";
import assert from "node:assert/strict";
import { imageUrl, referenceThumbnail, textParts } from "../src/lib/images";
import { draftToReport } from "../src/lib/ai/report";
import { createDemoTransport, DEMO_SEED } from "../src/lib/ai/demo";

const source = { kind: "image" as const, title: "Umbrella", url: "https://commons.wikimedia.org/wiki/File:Red_umbrella.jpg", thumbnail: "https://upload.wikimedia.org/wikipedia/commons/a/ab/Red_umbrella.jpg", credit: "Artist · CC BY-SA 4.0" };

test("AI import retains image previews and credits through report serialization", async () => {
  const send = createDemoTransport();
  let session = await send({ action: "start", seed: DEMO_SEED, format: "basic", useResearch: false });
  for (let i = 0; i < 6; i++) session = await send({ action: "answer", id: session.id, revision: session.revision, choices: ["option1"], custom: "" });
  session = await send({ action: "confirm", id: session.id, revision: session.revision });
  session.state.research = { text: "Reference", citations: [], resources: [source] };
  const report = JSON.parse(JSON.stringify(draftToReport(session.state)));
  assert.deepEqual(report.content.ai_notes.sources, [source]);
  assert.equal(report.content.step1.images, undefined);
  assert.equal("answers" in report.content, false);
});

test("legacy Commons references recover thumbnails without rewriting stored reports", () => {
  assert.equal(referenceThumbnail({ kind: "image", url: source.url }), "https://commons.wikimedia.org/wiki/Special:FilePath/Red_umbrella.jpg?width=600");
  assert.equal(referenceThumbnail({ kind: "image", url: "https://commons.wikimedia.org/wiki/File:A%20B.jpg" }), "https://commons.wikimedia.org/wiki/Special:FilePath/A%20B.jpg?width=600");
  assert.equal(referenceThumbnail(source), source.thumbnail);
  assert.equal(referenceThumbnail({ ...source, thumbnail: "https://evil.example.com/tracker.jpg" }), referenceThumbnail({ kind: "image", url: source.url }));
  assert.equal(referenceThumbnail({ kind: "image", url: "https://commons.wikimedia.org.evil.com/wiki/File:Image.jpg" }), null);
  assert.equal(referenceThumbnail({ ...source, kind: "web" }), null);
});

test("plain and Markdown image URLs render as images while unsafe URLs stay text", () => {
  assert.equal(imageUrl(`![우산](${source.thumbnail})`), source.thumbnail);
  assert.equal(imageUrl("javascript:alert(1)"), null);
  assert.equal(imageUrl("https://user:password@example.com/file.png"), null);
  const parts = textParts(`**사진 설명**\n![우산](${source.thumbnail})\n${source.thumbnail}\n[원본](${source.url})`);
  assert.equal(parts.filter((p) => p.kind === "image").length, 2);
  assert.equal(parts.filter((p) => p.kind === "bold").length, 1);
  assert.equal(parts.filter((p) => p.kind === "link").length, 1);
  assert.equal(textParts(`[잘못된 주소](javascript:alert(1))`).some((p) => p.kind === "link"), false);
  assert.equal(textParts("<script>alert(1)</script>")[0].kind, "text");
});
