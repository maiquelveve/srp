export interface ChatRequest {
  /** Regras fixas: papel, formato e limites da resposta. */
  systemPrompt: string;
  /** A pergunta do usuário junto dos trechos de contexto. */
  userPrompt: string;
}

/** Gera a resposta final em texto a partir de um prompt. */
export interface ChatProvider {
  /** Identificador do modelo, ex.: "ollama:qwen2.5:7b-instruct". */
  readonly modelId: string;
  /** Resposta completa (sem streaming). Lança `AiProviderError`. */
  generate(request: ChatRequest): Promise<{ text: string }>;
}
