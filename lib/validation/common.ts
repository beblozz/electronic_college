import { z } from 'zod'
import { daysBetween, parseDate } from '@/lib/dates'

export const idSchema = z.string().min(1).max(64)

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Дата в формате ГГГГ-ММ-ДД')
  .refine((value) => !Number.isNaN(parseDate(value).getTime()), 'Некорректная дата')

export const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Время в формате ЧЧ:ММ')

export const maxRangeDays = 62

export const dateRangeSchema = z
  .object({ from: dateSchema, to: dateSchema })
  .refine((range) => range.from <= range.to, 'Начало периода позже конца')
  .refine(
    (range) => daysBetween(parseDate(range.from), parseDate(range.to)) < maxRangeDays,
    `Период не длиннее ${maxRangeDays} дней`,
  )

export const weekStartSchema = dateSchema.refine(
  (value) => parseDate(value).getUTCDay() === 1,
  'Неделя должна начинаться с понедельника',
)
