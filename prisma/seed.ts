import '../server/load-env'
import type { Curriculum, Department, Room, ScheduleSlot, Specialty, Student } from '@prisma/client'
import { syncGroupChats } from '@/lib/chat/chat-membership'
import { addDays, dayOfWeek, formatDate, parseDate, todayInTimeZone } from '@/lib/dates'
import { collegeTimeZone } from '@/lib/env'
import { generatePassword, hashPassword } from '@/lib/password'
import { prisma } from '@/lib/prisma'
import { timesForPair } from '@/lib/schedule/pair-times'
import { semesterForCourse } from '@/lib/schedule/week-parity'

const departmentNames = ['Кафедра информационных технологий', 'Кафедра общеобразовательных дисциплин']

const specialtySeeds = [
  { code: '09.02.07', name: 'Информационные системы и программирование', departmentIndex: 0 },
  { code: '09.02.06', name: 'Сетевое и системное администрирование', departmentIndex: 0 },
]

const subjectSeeds = [
  { code: 'PRG', name: 'Основы программирования', specialtyIndex: 0 },
  { code: 'DB', name: 'Базы данных', specialtyIndex: 0 },
  { code: 'WEB', name: 'Веб-разработка', specialtyIndex: 0 },
  { code: 'NET', name: 'Компьютерные сети', specialtyIndex: 1 },
  { code: 'OS', name: 'Операционные системы', specialtyIndex: 1 },
  { code: 'MATH', name: 'Математика', specialtyIndex: 0 },
  { code: 'ENG', name: 'Иностранный язык', specialtyIndex: 0 },
  { code: 'HIST', name: 'История', specialtyIndex: 0 },
]

const teacherSeeds = [
  { lastName: 'Соколов', firstName: 'Андрей', departmentIndex: 0, subjectCodes: ['PRG', 'WEB', 'DB'] },
  { lastName: 'Морозова', firstName: 'Елена', departmentIndex: 0, subjectCodes: ['DB', 'PRG'] },
  { lastName: 'Кузнецов', firstName: 'Дмитрий', departmentIndex: 0, subjectCodes: ['NET', 'OS', 'WEB'] },
  { lastName: 'Лебедева', firstName: 'Ольга', departmentIndex: 0, subjectCodes: ['OS', 'NET'] },
  { lastName: 'Васильева', firstName: 'Марина', departmentIndex: 1, subjectCodes: ['MATH'] },
  { lastName: 'Новиков', firstName: 'Сергей', departmentIndex: 1, subjectCodes: ['MATH', 'HIST'] },
  { lastName: 'Павлова', firstName: 'Анна', departmentIndex: 1, subjectCodes: ['ENG', 'HIST'] },
  { lastName: 'Фёдоров', firstName: 'Игорь', departmentIndex: 1, subjectCodes: ['ENG'] },
]

const groupSeeds = [
  { name: 'ИС-11', specialtyIndex: 0, courseYear: 1, curatorIndex: 0, subjectCodes: ['PRG', 'MATH', 'ENG', 'HIST'] },
  { name: 'ИС-21', specialtyIndex: 0, courseYear: 2, curatorIndex: 1, subjectCodes: ['DB', 'WEB', 'MATH', 'ENG'] },
  { name: 'СА-11', specialtyIndex: 1, courseYear: 1, curatorIndex: 2, subjectCodes: ['NET', 'OS', 'MATH', 'HIST'] },
]

const studentLastNames = ['Иванов', 'Петров', 'Сидоров', 'Смирнов', 'Попов', 'Волков', 'Зайцев', 'Орлов']
const studentFirstNames = ['Алексей', 'Мария', 'Никита', 'Дарья', 'Илья', 'София', 'Максим', 'Полина']

const roomSeeds = [
  { number: '101', building: 'Главный корпус', capacity: 30 },
  { number: '102', building: 'Главный корпус', capacity: 30 },
  { number: '204', building: 'Главный корпус', capacity: 25 },
  { number: '305', building: 'Главный корпус', capacity: 25 },
  { number: '12', building: 'Лабораторный корпус', capacity: 16 },
  { number: '14', building: 'Лабораторный корпус', capacity: 16 },
]

const studyDays = [1, 2, 3, 4, 5]
const pairsPerDay = [1, 2, 3]
const possibleGrades = [3, 4, 4, 5, 5, 5, 4, 2]

let randomState = 20260901

function nextRandom(): number {
  randomState = (randomState * 1103515245 + 12345) % 2147483648
  return Math.floor(randomState / 65536)
}

function academicYearStart(today: Date): number {
  return today.getUTCMonth() >= 7 ? today.getUTCFullYear() : today.getUTCFullYear() - 1
}

async function main(): Promise<void> {
  if ((await prisma.user.count()) > 0) {
    console.log('Database already contains users, seed is skipped')
    return
  }

  const today = parseDate(todayInTimeZone(collegeTimeZone()))
  const startYear = academicYearStart(today)

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

  const terms = await Promise.all([
    prisma.term.create({
      data: {
        name: `Осенний семестр ${startYear}/${startYear + 1}`,
        half: 1,
        startDate: parseDate(`${startYear}-09-01`),
        endDate: parseDate(`${startYear}-12-31`),
      },
    }),
    prisma.term.create({
      data: {
        name: `Весенний семестр ${startYear}/${startYear + 1}`,
        half: 2,
        startDate: parseDate(`${startYear + 1}-01-12`),
        endDate: parseDate(`${startYear + 1}-06-30`),
      },
    }),
  ])
  const currentTerm = terms.find((term) => term.startDate <= today && term.endDate >= today) ?? terms[0]

  const departments: Department[] = []
  for (const name of departmentNames) {
    departments.push(await prisma.department.create({ data: { name } }))
  }

  const specialties: Specialty[] = []
  for (const seed of specialtySeeds) {
    specialties.push(
      await prisma.specialty.create({
        data: { code: seed.code, name: seed.name, departmentId: departments[seed.departmentIndex].id },
      }),
    )
  }

  const subjectIdByCode = new Map<string, string>()
  for (const seed of subjectSeeds) {
    const subject = await prisma.subject.create({
      data: {
        code: seed.code,
        name: seed.name,
        specialtyId: specialties[seed.specialtyIndex].id,
        hoursTotal: 120,
        hoursLecture: 60,
        hoursPractice: 60,
      },
    })
    subjectIdByCode.set(seed.code, subject.id)
  }

  const teachers = []
  for (const [index, seed] of teacherSeeds.entries()) {
    const user = await prisma.user.create({
      data: {
        email: `teacher${index + 1}@example.com`,
        firstName: seed.firstName,
        lastName: seed.lastName,
        role: 'TEACHER',
      },
    })
    const teacher = await prisma.teacher.create({
      data: {
        userId: user.id,
        departmentId: departments[seed.departmentIndex].id,
        maxHoursPerWeek: 24,
        teacherSubjects: {
          create: seed.subjectCodes.map((code) => ({ subjectId: subjectIdByCode.get(code) as string })),
        },
      },
    })
    teachers.push({ ...teacher, subjectCodes: seed.subjectCodes })
  }
  await prisma.department.update({ where: { id: departments[0].id }, data: { headTeacherId: teachers[0].id } })
  await prisma.department.update({ where: { id: departments[1].id }, data: { headTeacherId: teachers[4].id } })

  const rooms: Room[] = []
  for (const seed of roomSeeds) {
    rooms.push(await prisma.room.create({ data: seed }))
  }

  const busyTeacherSlots = new Set<string>()
  const busyRoomSlots = new Set<string>()
  let studentCounter = 0

  for (const [groupIndex, seed] of groupSeeds.entries()) {
    const group = await prisma.group.create({
      data: {
        name: seed.name,
        specialtyId: specialties[seed.specialtyIndex].id,
        courseYear: seed.courseYear,
        curatorTeacherId: teachers[seed.curatorIndex].id,
      },
    })
    const semester = semesterForCourse(seed.courseYear, currentTerm.half)

    const students: Student[] = []
    for (const [index, lastName] of studentLastNames.entries()) {
      studentCounter += 1
      const user = await prisma.user.create({
        data: {
          email: `student${studentCounter}@example.com`,
          firstName: studentFirstNames[(index + groupIndex) % studentFirstNames.length],
          lastName,
          role: 'STUDENT',
        },
      })
      students.push(
        await prisma.student.create({
          data: { userId: user.id, groupId: group.id, enrollmentYear: startYear - seed.courseYear + 1 },
        }),
      )
    }

    const curricula: Curriculum[] = []
    for (const [subjectIndex, code] of seed.subjectCodes.entries()) {
      const qualified = teachers.filter((teacher) => teacher.subjectCodes.includes(code))
      const teacher = qualified[(groupIndex + subjectIndex) % qualified.length]
      curricula.push(
        await prisma.curriculum.create({
          data: { groupId: group.id, subjectId: subjectIdByCode.get(code) as string, teacherId: teacher.id, semester },
        }),
      )
    }

    const slots: ScheduleSlot[] = []
    const lessonCountByCurriculum = new Map<string, number>()
    let rotation = groupIndex
    for (const day of studyDays) {
      for (const pairNumber of pairsPerDay) {
        const slotKey = `${day}:${pairNumber}`
        const curriculum = curricula
          .filter((candidate) => !busyTeacherSlots.has(`${candidate.teacherId}:${slotKey}`))
          .sort(
            (first, second) => (lessonCountByCurriculum.get(first.id) ?? 0) - (lessonCountByCurriculum.get(second.id) ?? 0),
          )[0]
        const room = rooms
          .map((_, offset) => rooms[(rotation + offset) % rooms.length])
          .find((candidate) => !busyRoomSlots.has(`${candidate.id}:${slotKey}`))
        rotation += 1
        if (!curriculum || !room) {
          continue
        }
        lessonCountByCurriculum.set(curriculum.id, (lessonCountByCurriculum.get(curriculum.id) ?? 0) + 1)
        busyTeacherSlots.add(`${curriculum.teacherId}:${slotKey}`)
        busyRoomSlots.add(`${room.id}:${slotKey}`)
        slots.push(
          await prisma.scheduleSlot.create({
            data: {
              groupId: group.id,
              subjectId: curriculum.subjectId,
              teacherId: curriculum.teacherId,
              roomId: room.id,
              dayOfWeek: day,
              pairNumber,
              ...timesForPair(pairNumber),
              weekType: 'BOTH',
              semester,
            },
          }),
        )
      }
    }

    for (let daysAgo = 1; daysAgo <= 14; daysAgo += 1) {
      const date = addDays(today, -daysAgo)
      if (date < currentTerm.startDate) {
        break
      }
      for (const slot of slots.filter((candidate) => candidate.dayOfWeek === dayOfWeek(date))) {
        for (const student of students) {
          const isAbsent = nextRandom() % 12 === 0
          await prisma.attendance.create({
            data: {
              studentId: student.id,
              scheduleSlotId: slot.id,
              date,
              status: isAbsent ? 'ABSENT' : 'PRESENT',
              markedByTeacherId: slot.teacherId,
            },
          })
          if (!isAbsent && nextRandom() % 4 === 0) {
            await prisma.grade.create({
              data: {
                studentId: student.id,
                subjectId: slot.subjectId,
                teacherId: slot.teacherId,
                value: possibleGrades[nextRandom() % possibleGrades.length],
                date,
              },
            })
          }
        }
      }
    }

    await syncGroupChats(prisma, group.id)
    console.log(`Group ${group.name}: ${students.length} students, ${slots.length} weekly lessons`)
  }

  console.log(`Seed finished for ${formatDate(today)}`)
  console.log(`Admin login: ${adminEmail}`)
  console.log(`Admin password: ${adminPassword}`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
