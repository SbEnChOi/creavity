import { z } from "zod";

import { AiError } from "./errors";
export { AiError } from "./errors";

export type ResponseOutput = {
  status?: string;
  output?: Array<{ type: string; action?: { sources?: Array<{ url?: string; title?: string }> }; content?: Array<{ type: string; text?: string; annotations?: Array<{ type: string; url?: string; title?: string; start_index?: number; end_index?: number }> }> }>;
};

// Always called on the server. No browser-supplied keys or provider URLs.
export async function response(body: Record<string, unknown>, fetcher: typeof fetch = fetch): Promise<ResponseOutput> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new AiError("AI 연결 준비 중입니다. 운영자가 서버에 OPENAI_API_KEY를 설정해야 합니다.");
  let res: Response;
  try {
    res = await fetcher("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-5.4-mini", store: false, ...body }),
      signal: AbortSignal.timeout(45000), cache: "no-store",
    });
  } catch { throw new AiError("AI 응답이 지연되고 있습니다. 답변은 유지되니 다시 시도해주세요.", 504); }
  if (!res.ok) {
    if (res.status === 429) throw new AiError("AI 이용량이 많습니다. 잠시 후 다시 시도해주세요.", 429);
    throw new AiError("AI 연결에 문제가 있습니다. 운영자가 API 키와 모델 설정을 확인해야 합니다.");
  }
  let data: ResponseOutput;
  try { data = await res.json(); } catch { throw new AiError("AI 응답을 읽지 못했습니다. 다시 시도해주세요."); }
  if (data.status !== "completed") throw new AiError("AI가 응답을 마치지 못했습니다. 다시 시도해주세요.");
  if (data.output?.some((o) => o.content?.some((c) => c.type === "refusal"))) {
    throw new AiError("이 내용은 AI가 도와주기 어렵습니다. 메모를 다시 살펴봐주세요.", 422);
  }
  return data;
}

export function outputText(data: ResponseOutput): string {
  return (data.output ?? []).flatMap((o) => o.content ?? []).filter((c) => c.type === "output_text").map((c) => c.text ?? "").join("\n");
}

export async function structured<T extends z.ZodType>(name: string, schema: T, instructions: string, input: unknown): Promise<z.infer<T>> {
  const { $schema, ...jsonSchema } = z.toJSONSchema(schema);
  void $schema;
  const data = await response({ instructions, input: JSON.stringify(input), max_output_tokens: 5500,
    text: { format: { type: "json_schema", name, strict: true, schema: jsonSchema } },
  });
  try { return schema.parse(JSON.parse(outputText(data))); }
  catch { throw new AiError("AI 응답 형식이 맞지 않습니다. 다시 시도해주세요."); }
}
