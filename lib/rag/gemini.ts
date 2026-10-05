import { ApiError } from '@/lib/http'

export const embeddingDimensions = 768
const embeddingBatchSize = 50

function embeddingModel(): string {
  return process.env.GEMINI_EMBEDDING_MODEL ?? 'gemini-embedding-001'
}

function chatModel(): string {
  return process.env.GEMINI_CHAT_MODEL ?? 'gemini-2.5-flash'
}

async function callGemini<Result>(model: string, method: string, body: unknown): Promise<Result> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new ApiError(503, 'ASSISTANT_NOT_CONFIGURED', 'Помощник не настроен: не задан ключ Gemini API')
  }
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    console.error('Gemini request failed', response.status, await response.text())
    throw new ApiError(502, 'GEMINI_UNAVAILABLE', 'Сервис ответов временно недоступен')
  }
  return (await response.json()) as Result
}

type EmbeddingTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

export async function embedTexts(texts: string[], taskType: EmbeddingTask): Promise<number[][]> {
  const model = embeddingModel()
  const embeddings: number[][] = []
  for (let offset = 0; offset < texts.length; offset += embeddingBatchSize) {
    const batch = texts.slice(offset, offset + embeddingBatchSize)
    const result = await callGemini<{ embeddings: Array<{ values: number[] }> }>(model, 'batchEmbedContents', {
      requests: batch.map((text) => ({
        model: `models/${model}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: embeddingDimensions,
      })),
    })
    embeddings.push(...result.embeddings.map((embedding) => embedding.values))
  }
  return embeddings
}

export async function generateAnswer(systemInstruction: string, prompt: string): Promise<string> {
  const result = await callGemini<{
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  }>(chatModel(), 'generateContent', {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.2 },
  })
  const parts = result.candidates?.[0]?.content?.parts ?? []
  return parts
    .map((part) => part.text ?? '')
    .join('')
    .trim()
}
