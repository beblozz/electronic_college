import mammoth from 'mammoth'
import { extractText, getDocumentProxy } from 'unpdf'
import { badRequest } from '@/lib/http'

export const supportedExtensions = ['pdf', 'docx', 'txt', 'md']

export async function extractDocumentText(fileName: string, content: Buffer): Promise<string> {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? ''
  if (extension === 'pdf') {
    const document = await getDocumentProxy(new Uint8Array(content))
    const { text } = await extractText(document, { mergePages: true })
    return text
  }
  if (extension === 'docx') {
    const { value } = await mammoth.extractRawText({ buffer: content })
    return value
  }
  if (extension === 'txt' || extension === 'md') {
    return content.toString('utf8')
  }
  throw badRequest(`Поддерживаются файлы: ${supportedExtensions.join(', ')}`)
}
