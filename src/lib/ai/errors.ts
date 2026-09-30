export class AiError extends Error {
  constructor(message: string, public status = 503) { super(message); }
}
