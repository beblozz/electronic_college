import { badRequest } from '@/lib/http'
import { prisma } from '@/lib/prisma'
import { splitIntoChunks } from '@/lib/rag/chunk'
import { extractDocumentText } from '@/lib/rag/extract-text'
import { embedTexts, generateAnswer } from '@/lib/rag/gemini'
import type { BotAnswer, KnowledgeDocumentDto } from '@/lib/types'

const retrievedChunkCount = 6
const minimumSimilarity = 0.45
const excerptLength = 240

const systemInstruction = [
  'Ты помощник колледжа. Отвечай только на основе приведённых фрагментов документов.',
  'Если во фрагментах нет ответа, прямо скажи, что в документах колледжа этого нет.',
  'Отвечай по-русски, кратко и по делу, без вступлений.',
].join(' ')

type IngestOptions = { title: string; fileName: string; content: Buffer; uploadedById: string }

export async function ingestDocument(options: IngestOptions): Promise<KnowledgeDocumentDto> {
  const text = await extractDocumentText(options.fileName, options.content)
  const chunks = splitIntoChunks(text)
  if (chunks.length === 0) {
    throw badRequest('В документе не найден текст')
  }
  const embeddings = await embedTexts(chunks, 'RETRIEVAL_DOCUMENT')

  const document = await prisma.knowledgeDocument.create({
    data: {
      title: options.title,
      fileName: options.fileName,
      uploadedById: options.uploadedById,
      chunks: {
        create: chunks.map((content, chunkIndex) => ({ chunkIndex, content, embedding: embeddings[chunkIndex] })),
      },
    },
  })

  return {
    id: document.id,
    title: document.title,
    fileName: document.fileName,
    chunkCount: chunks.length,
    createdAt: document.createdAt.toISOString(),
  }
}

type RetrievedChunk = { documentId: string; title: string; content: string; similarity: number }

function cosineSimilarity(first: number[], second: number[]): number {
  let dotProduct = 0
  let firstNorm = 0
  let secondNorm = 0
  for (let index = 0; index < first.length; index += 1) {
    dotProduct += first[index] * second[index]
    firstNorm += first[index] * first[index]
    secondNorm += second[index] * second[index]
  }
  const denominator = Math.sqrt(firstNorm) * Math.sqrt(secondNorm)
  return denominator === 0 ? 0 : dotProduct / denominator
}

async function retrieveChunks(question: string): Promise<RetrievedChunk[]> {
  const [questionEmbedding] = await embedTexts([question], 'RETRIEVAL_QUERY')
  const chunks = await prisma.knowledgeChunk.findMany({ include: { document: { select: { title: true } } } })
  return chunks
    .filter((chunk) => chunk.embedding.length === questionEmbedding.length)
    .map((chunk) => ({
      documentId: chunk.documentId,
      title: chunk.document.title,
      content: chunk.content,
      similarity: cosineSimilarity(questionEmbedding, chunk.embedding),
    }))
    .filter((chunk) => chunk.similarity >= minimumSimilarity)
    .sort((first, second) => second.similarity - first.similarity)
    .slice(0, retrievedChunkCount)
}

export async function answerQuestion(question: string): Promise<BotAnswer> {
  const chunks = await retrieveChunks(question)
  if (chunks.length === 0) {
    return { answer: 'В документах колледжа нет ответа на этот вопрос.', sources: [] }
  }
  const context = chunks
    .map((chunk, index) => `Фрагмент ${index + 1} (документ «${chunk.title}»):\n${chunk.content}`)
    .join('\n\n')
  const answer = await generateAnswer(systemInstruction, `${context}\n\nВопрос: ${question}`)

  const sourcesByDocument = new Map<string, BotAnswer['sources'][number]>()
  for (const chunk of chunks) {
    if (!sourcesByDocument.has(chunk.documentId)) {
      sourcesByDocument.set(chunk.documentId, {
        documentId: chunk.documentId,
        title: chunk.title,
        excerpt: chunk.content.slice(0, excerptLength),
      })
    }
  }
  return {
    answer: answer.length > 0 ? answer : 'Не удалось сформулировать ответ, переформулируйте вопрос.',
    sources: [...sourcesByDocument.values()],
  }
}

export async function listDocuments(): Promise<KnowledgeDocumentDto[]> {
  const documents = await prisma.knowledgeDocument.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { chunks: true } } },
  })
  return documents.map((document) => ({
    id: document.id,
    title: document.title,
    fileName: document.fileName,
    chunkCount: document._count.chunks,
    createdAt: document.createdAt.toISOString(),
  }))
}
