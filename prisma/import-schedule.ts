import '../server/load-env'
import { readFileSync } from 'node:fs'
import { z } from 'zod'
import { syncGroupChats } from '@/lib/chat/chat-membership'
import { parseDate } from '@/lib/dates'
import { generatePassword, hashPassword } from '@/lib/password'
import { prisma } from '@/lib/prisma'
import { timesForPair } from '@/lib/schedule/pair-times'
import { semesterForCourse } from '@/lib/schedule/week-parity'

const defaultDataPath = 'private/college-schedule.json'
const defaultRoomCapacity = 30
const defaultMaxHoursPerWeek = 40
const autumnHalf = 1

const dataSchema = z.object({
  academicYearStart: z.number().int(),
  departments: z.array(z.string().min(1)),
  specialties: z.array(z.object({ code: z.string(), name: z.string(), department: z.string() })),
  rooms: z.array(z.object({ number: z.string(), building: z.string() })),
  teachers: z.array(z.object({ lastName: z.string().min(1), firstName: z.string(), department: z.string() })),
  subjects: z.array(z.object({ name: z.string().min(1), specialtyCode: z.string() })),
  groups: z.array(
    z.object({ name: z.string().min(1), enrollmentYear: z.number().int(), courseYear: z.number().int(), specialtyCode: z.string() }),
  ),
  lessons: z.array(
    z.object({
      group: z.string(),
      dayOfWeek: z.number().int().min(1).max(7),
      pairNumber: z.number().int().min(1).max(8),
      weekType: z.enum(['ODD', 'EVEN', 'BOTH']),
      subject: z.string(),
      teacher: z.string(),
      room: z.string(),
      building: z.string(),
    }),
  ),
})

const transliteration: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
}

function transliterate(value: string): string {
  return [...value.toLowerCase()].map((character) => transliteration[character] ?? character).join('').replace(/[^a-z0-9]/g, '')
}

function required<Value>(map: Map<string, Value>, key: string, kind: string): Value {
  const value = map.get(key)
  if (value === undefined) {
    throw new Error(`${kind} "${key}" is referenced by a lesson but is not described in the data file`)
  }
  return value
}

async function main(): Promise<void> {
  const dataPath = process.argv[2] ?? defaultDataPath
  const data = dataSchema.parse(JSON.parse(readFileSync(dataPath, 'utf8')))

  if ((await prisma.user.count()) > 0) {
    console.log('Database is not empty. Run "npx prisma db push --force-reset" first, then repeat the import')
    return
  }

  const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? 'admin@example.com').toLowerCase()
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || generatePassword()
  await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: await hashPassword(adminPassword),
      firstName: 'учебной части',
      lastName: 'Администратор',
      role: 'ADMIN',
    },
  })

  const startYear = data.academicYearStart
  await prisma.term.createMany({
    data: [
      {
        name: `Осенний семестр ${startYear}/${startYear + 1}`,
        half: 1,
        startDate: parseDate(`${startYear}-09-01`),
        endDate: parseDate(`${startYear}-12-31`),
      },
      {
        name: `Весенний семестр ${startYear}/${startYear + 1}`,
        half: 2,
        startDate: parseDate(`${startYear + 1}-01-11`),
        endDate: parseDate(`${startYear + 1}-06-30`),
      },
    ],
  })

  const departmentIds = new Map<string, string>()
  for (const name of data.departments) {
    departmentIds.set(name, (await prisma.department.create({ data: { name } })).id)
  }

  const specialtyIds = new Map<string, string>()
  for (const specialty of data.specialties) {
    const created = await prisma.specialty.create({
      data: {
        code: specialty.code,
        name: specialty.name,
        departmentId: required(departmentIds, specialty.department, 'Department'),
      },
    })
    specialtyIds.set(specialty.code, created.id)
  }

  const roomIds = new Map<string, string>()
  for (const room of data.rooms) {
    const created = await prisma.room.create({
      data: { number: room.number, building: room.building, capacity: defaultRoomCapacity },
    })
    roomIds.set(`${room.building}:${room.number}`, created.id)
  }

  const subjectIds = new Map<string, string>()
  for (const [index, subject] of data.subjects.entries()) {
    const created = await prisma.subject.create({
      data: {
        name: subject.name,
        code: `Д-${String(index + 1).padStart(3, '0')}`,
        specialtyId: required(specialtyIds, subject.specialtyCode, 'Specialty'),
        hoursTotal: 0,
        hoursLecture: 0,
        hoursPractice: 0,
      },
    })
    subjectIds.set(subject.name, created.id)
  }

  const subjectNamesByTeacher = new Map<string, Set<string>>()
  for (const lesson of data.lessons) {
    const subjectNames = subjectNamesByTeacher.get(lesson.teacher) ?? new Set<string>()
    subjectNames.add(lesson.subject)
    subjectNamesByTeacher.set(lesson.teacher, subjectNames)
  }

  const teacherIds = new Map<string, string>()
  const usedEmails = new Set<string>([adminEmail])
  for (const teacher of data.teachers) {
    const baseEmail = transliterate(teacher.lastName)
    let email = `${baseEmail}@college.local`
    for (let suffix = 2; usedEmails.has(email); suffix += 1) {
      email = `${baseEmail}${suffix}@college.local`
    }
    usedEmails.add(email)
    const user = await prisma.user.create({
      data: { email, firstName: teacher.firstName, lastName: teacher.lastName, role: 'TEACHER' },
    })
    const created = await prisma.teacher.create({
      data: {
        userId: user.id,
        departmentId: required(departmentIds, teacher.department, 'Department'),
        maxHoursPerWeek: defaultMaxHoursPerWeek,
        teacherSubjects: {
          create: [...(subjectNamesByTeacher.get(teacher.lastName) ?? [])].map((subjectName) => ({
            subjectId: required(subjectIds, subjectName, 'Subject'),
          })),
        },
      },
    })
    teacherIds.set(teacher.lastName, created.id)
  }

  let slotCount = 0
  for (const group of data.groups) {
    const created = await prisma.group.create({
      data: {
        name: group.name,
        courseYear: group.courseYear,
        specialtyId: required(specialtyIds, group.specialtyCode, 'Specialty'),
      },
    })
    const semester = semesterForCourse(group.courseYear, autumnHalf)
    const groupLessons = data.lessons.filter((lesson) => lesson.group === group.name)

    const lessonCountBySubjectTeacher = new Map<string, Map<string, number>>()
    for (const lesson of groupLessons) {
      const countByTeacher = lessonCountBySubjectTeacher.get(lesson.subject) ?? new Map<string, number>()
      countByTeacher.set(lesson.teacher, (countByTeacher.get(lesson.teacher) ?? 0) + 1)
      lessonCountBySubjectTeacher.set(lesson.subject, countByTeacher)
    }
    for (const [subjectName, countByTeacher] of lessonCountBySubjectTeacher) {
      const [mainTeacher] = [...countByTeacher.entries()].sort((first, second) => second[1] - first[1])[0]
      await prisma.curriculum.create({
        data: {
          groupId: created.id,
          subjectId: required(subjectIds, subjectName, 'Subject'),
          teacherId: required(teacherIds, mainTeacher, 'Teacher'),
          semester,
        },
      })
    }

    await prisma.scheduleSlot.createMany({
      data: groupLessons.map((lesson) => ({
        groupId: created.id,
        subjectId: required(subjectIds, lesson.subject, 'Subject'),
        teacherId: required(teacherIds, lesson.teacher, 'Teacher'),
        roomId: required(roomIds, `${lesson.building}:${lesson.room}`, 'Room'),
        dayOfWeek: lesson.dayOfWeek,
        pairNumber: lesson.pairNumber,
        ...timesForPair(lesson.pairNumber),
        weekType: lesson.weekType,
        semester,
      })),
    })
    slotCount += groupLessons.length
    await syncGroupChats(prisma, created.id)
  }

  console.log(`Imported: ${data.groups.length} groups, ${data.teachers.length} teachers, ${data.subjects.length} subjects`)
  console.log(`Imported: ${data.rooms.length} rooms, ${slotCount} weekly lessons`)
  console.log(`Admin login: ${adminEmail}`)
  console.log(`Admin password: ${adminPassword}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
