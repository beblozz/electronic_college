const targetChunkLength = 1200
const overlapLength = 200

function splitLongParagraph(paragraph: string): string[] {
  if (paragraph.length <= targetChunkLength) {
    return [paragraph]
  }
  const pieces: string[] = []
  for (let offset = 0; offset < paragraph.length; offset += targetChunkLength - overlapLength) {
    pieces.push(paragraph.slice(offset, offset + targetChunkLength))
  }
  return pieces
}

export function splitIntoChunks(text: string): string[] {
  const paragraphs = text
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/[ \t]+/g, ' ').trim())
    .filter((paragraph) => paragraph.length > 0)
    .flatMap(splitLongParagraph)

  const chunks: string[] = []
  let current = ''
  for (const paragraph of paragraphs) {
    if (current.length > 0 && current.length + paragraph.length + 2 > targetChunkLength) {
      chunks.push(current)
      current = current.slice(-overlapLength)
    }
    current = current.length > 0 ? `${current}\n\n${paragraph}` : paragraph
  }
  if (current.trim().length > 0) {
    chunks.push(current)
  }
  return chunks
}
