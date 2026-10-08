import { randomBytes, randomInt, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const deriveKey = promisify(scrypt) as (password: string, salt: Buffer, keyLength: number) => Promise<Buffer>

const keyLength = 64
const generatedPasswordLength = 10
const passwordAlphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export const minimumPasswordLength = 8

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await deriveKey(password, salt, keyLength)
  return `scrypt.${salt.toString('base64url')}.${key.toString('base64url')}`
}

export async function verifyPassword(password: string, storedHash: string | null): Promise<boolean> {
  const [scheme, salt, key] = (storedHash ?? '').split('.')
  if (scheme !== 'scrypt' || !salt || !key) {
    return false
  }
  const expectedKey = Buffer.from(key, 'base64url')
  const actualKey = await deriveKey(password, Buffer.from(salt, 'base64url'), expectedKey.length)
  return timingSafeEqual(expectedKey, actualKey)
}

export function generatePassword(): string {
  return Array.from({ length: generatedPasswordLength }, () => passwordAlphabet[randomInt(passwordAlphabet.length)]).join('')
}
