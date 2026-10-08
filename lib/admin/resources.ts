import type { Prisma } from '@prisma/client'
import { z } from 'zod'
import { syncGroupChats } from '@/lib/chat/chat-membership'
import { formatDate, parseDate } from '@/lib/dates'
import { badRequest, conflict, notFound } from '@/lib/http'
import { PageRequest, toPage } from '@/lib/pagination'
import { generatePassword, hashPassword } from '@/lib/password'
import { fullName } from '@/lib/people'
import { prisma } from '@/lib/prisma'
import { syncTeacherStatuses } from '@/lib/teacher-status'
import type { Page } from '@/lib/types'
import { dateSchema, idSchema } from '@/lib/validation/common'

type Row = Record<string, unknown> & { id: string }

export type ResourceHandlers = {
  list(params: URLSearchParams, page: PageRequest): Promise<Page<Row>>
  get(id: string): Promise<Row | null>
  create(body: unknown): Promise<Row>
  update(id: string, body: unknown): Promise<Row>
  remove(id: string): Promise<void>
}

const nameSchema = z.string().trim().min(1).max(200)
const emailSchema = z.string().trim().toLowerCase().email()
const optionalIdSchema = idSchema.nullish().transform((value) => value || null)

function searchFilter(params: URLSearchParams): string | undefined {
  const search = params.get('search')?.trim()
  return search && search.length > 0 ? search : undefined
}

function contains(value: string | undefined) {
  return value ? { contains: value, mode: 'insensitive' as const } : undefined
}

async function existing<Result>(promise: Promise<Result | null>): Promise<Result> {
  const result = await promise
  if (!result) {
    throw notFound()
  }
  return result
}

const departmentSchema = z.object({ name: nameSchema, headTeacherId: optionalIdSchema })

const departmentInclude = { headTeacher: { include: { user: true } } } as const

type DepartmentRow = Prisma.DepartmentGetPayload<{ include: typeof departmentInclude }>

function serializeDepartment(department: DepartmentRow): Row {
  return {
    id: department.id,
    name: department.name,
    headTeacherId: department.headTeacherId,
    headTeacherName: department.headTeacher ? fullName(department.headTeacher.user) : null,
  }
}

const departments: ResourceHandlers = {
  async list(params, page) {
    const rows = await prisma.department.findMany({
      where: { name: contains(searchFilter(params)) },
      include: departmentInclude,
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...page.args,
    })
    return toPage(rows, page.limit, serializeDepartment)
  },
  async get(id) {
    const row = await prisma.department.findUnique({ where: { id }, include: departmentInclude })
    return row ? serializeDepartment(row) : null
  },
  async create(body) {
    const data = departmentSchema.parse(body)
    return serializeDepartment(await prisma.department.create({ data, include: departmentInclude }))
  },
  async update(id, body) {
    const data = departmentSchema.partial().parse(body)
    return serializeDepartment(await prisma.department.update({ where: { id }, data, include: departmentInclude }))
  },
  async remove(id) {
    await prisma.department.delete({ where: { id } })
  },
}

const specialtySchema = z.object({ code: nameSchema, name: nameSchema, departmentId: idSchema })

const specialties: ResourceHandlers = {
  async list(params, page) {
    const search = searchFilter(params)
    const rows = await prisma.specialty.findMany({
      where: {
        departmentId: params.get('departmentId') ?? undefined,
        OR: search ? [{ name: contains(search) }, { code: contains(search) }] : undefined,
      },
      include: { department: true },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      ...page.args,
    })
    return toPage(rows, page.limit, ({ department, ...row }) => ({ ...row, departmentName: department.name }))
  },
  async get(id) {
    return prisma.specialty.findUnique({ where: { id } })
  },
  async create(body) {
    return prisma.specialty.create({ data: specialtySchema.parse(body) })
  },
  async update(id, body) {
    return prisma.specialty.update({ where: { id }, data: specialtySchema.partial().parse(body) })
  },
  async remove(id) {
    await prisma.specialty.delete({ where: { id } })
  },
}

const hoursSchema = z.coerce.number().int().min(0).max(2000)

const subjectSchema = z.object({
  name: nameSchema,
  code: nameSchema,
  specialtyId: idSchema,
  hoursTotal: hoursSchema,
  hoursLecture: hoursSchema,
  hoursPractice: hoursSchema,
})

const subjects: ResourceHandlers = {
  async list(params, page) {
    const search = searchFilter(params)
    const rows = await prisma.subject.findMany({
      where: {
        specialtyId: params.get('specialtyId') ?? undefined,
        OR: search ? [{ name: contains(search) }, { code: contains(search) }] : undefined,
      },
      include: { specialty: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...page.args,
    })
    return toPage(rows, page.limit, ({ specialty, ...row }) => ({ ...row, specialtyName: specialty.name }))
  },
  async get(id) {
    return prisma.subject.findUnique({ where: { id } })
  },
  async create(body) {
    return prisma.subject.create({ data: subjectSchema.parse(body) })
  },
  async update(id, body) {
    return prisma.subject.update({ where: { id }, data: subjectSchema.partial().parse(body) })
  },
  async remove(id) {
    await prisma.subject.delete({ where: { id } })
  },
}

const groupSchema = z.object({
  name: nameSchema,
  specialtyId: idSchema,
  courseYear: z.coerce.number().int().min(1).max(6),
  curatorTeacherId: optionalIdSchema,
})

const groups: ResourceHandlers = {
  async list(params, page) {
    const courseYear = params.get('courseYear')
    const rows = await prisma.group.findMany({
      where: {
        name: contains(searchFilter(params)),
        specialtyId: params.get('specialtyId') ?? undefined,
        courseYear: courseYear ? Number(courseYear) : undefined,
      },
      include: { specialty: true, curatorTeacher: { include: { user: true } }, _count: { select: { students: true } } },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      ...page.args,
    })
    return toPage(rows, page.limit, ({ specialty, curatorTeacher, _count, ...row }) => ({
      ...row,
      specialtyName: specialty.name,
      curatorName: curatorTeacher ? fullName(curatorTeacher.user) : null,
      studentCount: _count.students,
    }))
  },
  async get(id) {
    return prisma.group.findUnique({ where: { id } })
  },
  async create(body) {
    const group = await prisma.group.create({ data: groupSchema.parse(body) })
    await syncGroupChats(prisma, group.id)
    return group
  },
  async update(id, body) {
    const group = await prisma.group.update({ where: { id }, data: groupSchema.partial().parse(body) })
    await syncGroupChats(prisma, group.id)
    return group
  },
  async remove(id) {
    await prisma.group.delete({ where: { id } })
  },
}

const personSchema = z.object({ email: emailSchema, firstName: z.string().trim().max(200), lastName: nameSchema })

const teacherSchema = personSchema.extend({
  departmentId: idSchema,
  maxHoursPerWeek: z.coerce.number().int().min(2).max(80),
  status: z.enum(['ACTIVE', 'FIRED']).default('ACTIVE'),
})

const teacherInclude = { user: true, department: true, teacherSubjects: true } as const

type TeacherRow = Prisma.TeacherGetPayload<{ include: typeof teacherInclude }>

function serializeTeacher(teacher: TeacherRow): Row {
  return {
    id: teacher.id,
    userId: teacher.userId,
    email: teacher.user.email,
    firstName: teacher.user.firstName,
    lastName: teacher.user.lastName,
    fullName: fullName(teacher.user),
    departmentId: teacher.departmentId,
    departmentName: teacher.department.name,
    status: teacher.status,
    maxHoursPerWeek: teacher.maxHoursPerWeek,
    subjectIds: teacher.teacherSubjects.map((item) => item.subjectId),
  }
}

const teachers: ResourceHandlers = {
  async list(params, page) {
    await syncTeacherStatuses(prisma)
    const search = searchFilter(params)
    const status = z.enum(['ACTIVE', 'SICK', 'VACATION', 'FIRED']).optional().parse(params.get('status') ?? undefined)
    const rows = await prisma.teacher.findMany({
      where: {
        departmentId: params.get('departmentId') ?? undefined,
        status,
        user: search
          ? { OR: [{ lastName: contains(search) }, { firstName: contains(search) }, { email: contains(search) }] }
          : undefined,
      },
      include: teacherInclude,
      orderBy: [{ user: { lastName: 'asc' } }, { id: 'asc' }],
      ...page.args,
    })
    return toPage(rows, page.limit, serializeTeacher)
  },
  async get(id) {
    const row = await prisma.teacher.findUnique({ where: { id }, include: teacherInclude })
    return row ? serializeTeacher(row) : null
  },
  async create(body) {
    const { email, firstName, lastName, ...profile } = teacherSchema.parse(body)
    const generatedPassword = generatePassword()
    const teacher = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { email, firstName, lastName, role: 'TEACHER', passwordHash: await hashPassword(generatedPassword) },
      })
      return transaction.teacher.create({ data: { ...profile, userId: user.id }, include: teacherInclude })
    })
    return { ...serializeTeacher(teacher), generatedPassword }
  },
  async update(id, body) {
    const { email, firstName, lastName, ...profile } = teacherSchema.partial().parse(body)
    const teacher = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.teacher.update({ where: { id }, data: profile })
      await transaction.user.update({ where: { id: updated.userId }, data: { email, firstName, lastName } })
      return transaction.teacher.findUniqueOrThrow({ where: { id }, include: teacherInclude })
    })
    return serializeTeacher(teacher)
  },
  async remove(id) {
    const teacher = await existing(
      prisma.teacher.findUnique({
        where: { id },
        include: { _count: { select: { scheduleSlots: true, curricula: true, grades: true } } },
      }),
    )
    const usageCount = teacher._count.scheduleSlots + teacher._count.curricula + teacher._count.grades
    if (usageCount > 0) {
      throw conflict(
        'DEPENDENCY',
        'Преподавателя нельзя удалить: за ним числятся пары, учебный план или оценки. Поставьте ему статус «Уволен» или сначала передайте его пары другому',
      )
    }
    await prisma.user.delete({ where: { id: teacher.userId } })
  },
}

const studentSchema = personSchema.extend({
  groupId: idSchema,
  enrollmentYear: z.coerce.number().int().min(2000).max(2100),
  status: z.enum(['ACTIVE', 'EXPELLED', 'GRADUATED']).default('ACTIVE'),
})

const studentInclude = { user: true, group: true } as const

type StudentRow = Prisma.StudentGetPayload<{ include: typeof studentInclude }>

function serializeStudent(student: StudentRow): Row {
  return {
    id: student.id,
    userId: student.userId,
    email: student.user.email,
    firstName: student.user.firstName,
    lastName: student.user.lastName,
    fullName: fullName(student.user),
    groupId: student.groupId,
    groupName: student.group.name,
    enrollmentYear: student.enrollmentYear,
    status: student.status,
  }
}

const students: ResourceHandlers = {
  async list(params, page) {
    const search = searchFilter(params)
    const status = z.enum(['ACTIVE', 'EXPELLED', 'GRADUATED']).optional().parse(params.get('status') ?? undefined)
    const rows = await prisma.student.findMany({
      where: {
        groupId: params.get('groupId') ?? undefined,
        status,
        user: search
          ? { OR: [{ lastName: contains(search) }, { firstName: contains(search) }, { email: contains(search) }] }
          : undefined,
      },
      include: studentInclude,
      orderBy: [{ user: { lastName: 'asc' } }, { id: 'asc' }],
      ...page.args,
    })
    return toPage(rows, page.limit, serializeStudent)
  },
  async get(id) {
    const row = await prisma.student.findUnique({ where: { id }, include: studentInclude })
    return row ? serializeStudent(row) : null
  },
  async create(body) {
    const { email, firstName, lastName, ...profile } = studentSchema.parse(body)
    const generatedPassword = generatePassword()
    const student = await prisma.$transaction(async (transaction) => {
      const user = await transaction.user.create({
        data: { email, firstName, lastName, role: 'STUDENT', passwordHash: await hashPassword(generatedPassword) },
      })
      return transaction.student.create({ data: { ...profile, userId: user.id }, include: studentInclude })
    })
    await syncGroupChats(prisma, student.groupId)
    return { ...serializeStudent(student), generatedPassword }
  },
  async update(id, body) {
    const { email, firstName, lastName, ...profile } = studentSchema.partial().parse(body)
    const previous = await existing(prisma.student.findUnique({ where: { id } }))
    const student = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.student.update({ where: { id }, data: profile })
      await transaction.user.update({ where: { id: updated.userId }, data: { email, firstName, lastName } })
      return transaction.student.findUniqueOrThrow({ where: { id }, include: studentInclude })
    })
    await syncGroupChats(prisma, previous.groupId)
    if (student.groupId !== previous.groupId) {
      await syncGroupChats(prisma, student.groupId)
    }
    return serializeStudent(student)
  },
  async remove(id) {
    const student = await existing(prisma.student.findUnique({ where: { id } }))
    await prisma.user.delete({ where: { id: student.userId } })
  },
}

const roomSchema = z.object({
  number: nameSchema,
  building: nameSchema,
  capacity: z.coerce.number().int().min(1).max(1000),
})

const rooms: ResourceHandlers = {
  async list(params, page) {
    const rows = await prisma.room.findMany({
      where: { number: contains(searchFilter(params)), building: params.get('building') ?? undefined },
      orderBy: [{ building: 'asc' }, { number: 'asc' }, { id: 'asc' }],
      ...page.args,
    })
    return toPage(rows, page.limit, (row) => row)
  },
  async get(id) {
    return prisma.room.findUnique({ where: { id } })
  },
  async create(body) {
    return prisma.room.create({ data: roomSchema.parse(body) })
  },
  async update(id, body) {
    return prisma.room.update({ where: { id }, data: roomSchema.partial().parse(body) })
  },
  async remove(id) {
    await prisma.room.delete({ where: { id } })
  },
}

const curriculumSchema = z.object({
  groupId: idSchema,
  subjectId: idSchema,
  teacherId: idSchema,
  semester: z.coerce.number().int().min(1).max(12),
})

async function assertTeacherQualified(teacherId: string, subjectId: string): Promise<void> {
  const qualification = await prisma.teacherSubject.findUnique({
    where: { teacherId_subjectId: { teacherId, subjectId } },
  })
  if (!qualification) {
    throw badRequest('Преподавателю не назначен этот предмет')
  }
}

const curricula: ResourceHandlers = {
  async list(params, page) {
    const semester = params.get('semester')
    const rows = await prisma.curriculum.findMany({
      where: {
        groupId: params.get('groupId') ?? undefined,
        teacherId: params.get('teacherId') ?? undefined,
        semester: semester ? Number(semester) : undefined,
      },
      include: { group: true, subject: true, teacher: { include: { user: true } } },
      orderBy: [{ group: { name: 'asc' } }, { semester: 'asc' }, { id: 'asc' }],
      ...page.args,
    })
    return toPage(rows, page.limit, ({ group, subject, teacher, ...row }) => ({
      ...row,
      groupName: group.name,
      subjectName: subject.name,
      teacherName: fullName(teacher.user),
    }))
  },
  async get(id) {
    return prisma.curriculum.findUnique({ where: { id } })
  },
  async create(body) {
    const data = curriculumSchema.parse(body)
    await assertTeacherQualified(data.teacherId, data.subjectId)
    const curriculum = await prisma.curriculum.create({ data })
    await syncGroupChats(prisma, curriculum.groupId)
    return curriculum
  },
  async update(id, body) {
    const data = curriculumSchema.partial().parse(body)
    const previous = await existing(prisma.curriculum.findUnique({ where: { id } }))
    await assertTeacherQualified(data.teacherId ?? previous.teacherId, data.subjectId ?? previous.subjectId)
    const curriculum = await prisma.curriculum.update({ where: { id }, data })
    await syncGroupChats(prisma, previous.groupId)
    if (curriculum.groupId !== previous.groupId) {
      await syncGroupChats(prisma, curriculum.groupId)
    }
    return curriculum
  },
  async remove(id) {
    const curriculum = await prisma.curriculum.delete({ where: { id } })
    await syncGroupChats(prisma, curriculum.groupId)
  },
}

const termFields = z.object({
  name: nameSchema,
  half: z.coerce.number().int().min(1).max(2),
  startDate: dateSchema,
  endDate: dateSchema,
})

function serializeTerm(term: { id: string; name: string; half: number; startDate: Date; endDate: Date }): Row {
  return { ...term, startDate: formatDate(term.startDate), endDate: formatDate(term.endDate) }
}

function termDates(data: { startDate?: string; endDate?: string }) {
  return {
    startDate: data.startDate ? parseDate(data.startDate) : undefined,
    endDate: data.endDate ? parseDate(data.endDate) : undefined,
  }
}

async function assertTermIsValid(startDate: Date, endDate: Date, excludedId?: string): Promise<void> {
  if (startDate > endDate) {
    throw badRequest('Начало семестра позже конца')
  }
  const overlapping = await prisma.term.findFirst({
    where: { id: excludedId ? { not: excludedId } : undefined, startDate: { lte: endDate }, endDate: { gte: startDate } },
  })
  if (overlapping) {
    throw badRequest(`Период пересекается с «${overlapping.name}»`)
  }
}

const terms: ResourceHandlers = {
  async list(_params, page) {
    const rows = await prisma.term.findMany({ orderBy: [{ startDate: 'desc' }, { id: 'asc' }], ...page.args })
    return toPage(rows, page.limit, serializeTerm)
  },
  async get(id) {
    const row = await prisma.term.findUnique({ where: { id } })
    return row ? serializeTerm(row) : null
  },
  async create(body) {
    const data = termFields.parse(body)
    const startDate = parseDate(data.startDate)
    const endDate = parseDate(data.endDate)
    await assertTermIsValid(startDate, endDate)
    return serializeTerm(await prisma.term.create({ data: { ...data, startDate, endDate } }))
  },
  async update(id, body) {
    const data = termFields.partial().parse(body)
    const previous = await existing(prisma.term.findUnique({ where: { id } }))
    const dates = termDates(data)
    await assertTermIsValid(dates.startDate ?? previous.startDate, dates.endDate ?? previous.endDate, id)
    return serializeTerm(await prisma.term.update({ where: { id }, data: { ...data, ...dates } }))
  },
  async remove(id) {
    await prisma.term.delete({ where: { id } })
  },
}

const resources: Record<string, ResourceHandlers> = {
  departments,
  specialties,
  subjects,
  groups,
  teachers,
  students,
  rooms,
  curricula,
  terms,
}

export function resolveResource(name: string): ResourceHandlers {
  const handlers = resources[name]
  if (!handlers) {
    throw notFound('Справочник не найден')
  }
  return handlers
}
