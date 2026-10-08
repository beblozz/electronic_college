import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'
import { requireEnv } from '@/lib/env'

function encryptionKey(): Buffer {
  return createHash('sha256').update(requireEnv('SESSION_SECRET')).digest()
}

export function encryptSecret(plainText: string): string {
  const initializationVector = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), initializationVector)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  return [initializationVector, cipher.getAuthTag(), encrypted].map((part) => part.toString('base64url')).join('.')
}

export function decryptSecret(cipherText: string): string {
  const [initializationVector, authTag, encrypted] = cipherText
    .split('.')
    .map((part) => Buffer.from(part, 'base64url'))
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), initializationVector)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function randomToken(byteLength = 32): string {
  return randomBytes(byteLength).toString('base64url')
}
