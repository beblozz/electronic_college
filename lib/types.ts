export type Role = 'STUDENT' | 'TEACHER' | 'ADMIN'
export type WeekType = 'ODD' | 'EVEN' | 'BOTH'
export type AbsenceReason = 'SICK' | 'VACATION' | 'OTHER'
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'
export type ChatType = 'GROUP' | 'SUBJECT' | 'PRIVATE'
export type NotificationType =
  | 'SUBSTITUTION_CREATED'
  | 'GRADE_CREATED'
  | 'ANNOUNCEMENT_CREATED'
  | 'ABSENCE_REPORTED'

export type PersonRef = { id: string; fullName: string }

export type UserSummary = {
  id: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  role: Role
}

export type SessionUser = UserSummary & {
  email: string
  student: { id: string; groupId: string; groupName: string } | null
  teacher: { id: string; departmentId: string; status: string } | null
}

export type SubstitutionKind = 'SAME_SUBJECT' | 'OTHER_SUBJECT' | 'COMBINED'

export type LessonSubstitution = {
  id: string
  kind: SubstitutionKind
  originalTeacher: PersonRef
  substituteTeacher: PersonRef
  originalSubject: { id: string; name: string }
  combinedWithGroupName: string | null
  reason: AbsenceReason
}

export type Lesson = {
  scheduleSlotId: string
  date: string
  dayOfWeek: number
  pairNumber: number
  startTime: string
  endTime: string
  subject: { id: string; name: string; code: string }
  group: { id: string; name: string }
  room: { id: string; number: string; building: string }
  teacher: PersonRef
  substitution: LessonSubstitution | null
}

export type ScheduleSlotDto = {
  id: string
  groupId: string
  subjectId: string
  teacherId: string
  roomId: string
  dayOfWeek: number
  pairNumber: number
  startTime: string
  endTime: string
  weekType: WeekType
  semester: number
}

export type ScheduleSlotView = ScheduleSlotDto & {
  groupName: string
  subjectName: string
  teacherName: string
  roomLabel: string
}

export type ScheduleConflict = {
  kind: 'TEACHER' | 'ROOM' | 'GROUP' | 'DUPLICATE'
  scheduleSlotId?: string
  substitutionId?: string
  message: string
}

export type SubstitutionCandidate = {
  teacherId: string
  fullName: string
  currentLoadToday: number
  weeklyLoad: number
  maxHoursPerWeek: number
  reason: string
}

export type OtherSubjectCandidate = SubstitutionCandidate & { subject: { id: string; name: string } }

export type CombinedCandidate = {
  scheduleSlotId: string
  teacherId: string
  fullName: string
  subject: { id: string; name: string }
  group: { id: string; name: string }
  room: { id: string; number: string; capacity: number }
  studentCount: number
  fitsRoom: boolean
  isSameSubject: boolean
}

export type SubstitutionSuggestions = {
  slot: Lesson
  candidates: SubstitutionCandidate[]
  otherSubjectCandidates: OtherSubjectCandidate[]
  combinedCandidates: CombinedCandidate[]
}

export type GeneratedCredentials = { email: string; fullName: string; password: string }

export type GradeKind = 'ANSWER' | 'SURVEY' | 'PRACTICAL' | 'LECTURE' | 'TEST'
export type PlanItemKind = 'LECTURE' | 'PRACTICAL'

export type GradeDto = {
  id: string
  value: number
  date: string
  comment: string | null
  kind: GradeKind
  planItemId: string | null
  teacher: PersonRef
}

export type StudyPlanItemDto = {
  id: string
  kind: PlanItemKind
  title: string
  position: number
  plannedDate: string | null
}

export type StudyPlanDto = {
  id: string | null
  semester: number
  items: StudyPlanItemDto[]
  admissionThreshold: number
  autoCreditThreshold: number
  customAdmissionThreshold: number | null
  customAutoCreditThreshold: number | null
}

export type PlanStatus = 'AUTO_CREDIT' | 'ADMITTED' | 'NOT_ADMITTED'

export type PlanProgress = {
  completed: number
  total: number
  owed: number
  admissionThreshold: number
  autoCreditThreshold: number
  status: PlanStatus
  completedItemIds: string[]
}

export type StudentFlag = 'LOW_AVERAGE' | 'MANY_ABSENCES' | 'BEHIND_PLAN' | 'FEW_GRADES'

export type StudentInsight = {
  flags: StudentFlag[]
  isLagging: boolean
  needsAttention: boolean
  gradeCount: number
  absences: number
  lessonsHeld: number
  reasons: string[]
}

export type JournalScope = 'mine' | 'all'

export type DiarySubject = {
  subjectId: string
  name: string
  teacher: PersonRef
  grades: GradeDto[]
  averageGrade: number | null
  attendance: { present: number; absent: number; late: number; excused: number }
  plan: PlanProgress | null
}

export type Diary = {
  student: {
    id: string
    group: { id: string; name: string }
    enrollmentYear: number
    status: string
  }
  semester: number | null
  subjects: DiarySubject[]
  averageGrade: number | null
}

export type GradeFeedItem = GradeDto & {
  subject: { id: string; name: string }
  teacher: PersonRef
}

export type TeacherLoadDay = {
  date: string
  dayOfWeek: number
  pairs: number[]
  hours: number
  gaps: number[]
}

export type TeacherLoad = {
  weekStart: string
  maxHoursPerWeek: number
  weeklyHours: number
  days: TeacherLoadDay[]
}

export type TeacherSubjectGroups = {
  subjectId: string
  name: string
  code: string
  groups: Array<{ groupId: string; name: string; semester: number }>
}

export type JournalLessonColumn = {
  date: string
  scheduleSlotId: string
  pairNumber: number
  teacher: PersonRef
}

export type JournalStudentRow = {
  studentId: string
  fullName: string
  grades: GradeDto[]
  attendance: Array<{ scheduleSlotId: string; date: string; status: AttendanceStatus }>
  averageGrade: number | null
  plan: PlanProgress | null
  insight: StudentInsight
}

export type Journal = {
  group: { id: string; name: string }
  subject: { id: string; name: string }
  from: string
  to: string
  lessons: JournalLessonColumn[]
  dates: string[]
  students: JournalStudentRow[]
  scope: JournalScope
  teachers: PersonRef[]
  viewerTeacherId: string | null
  canEditPlan: boolean
  plan: StudyPlanDto
  stats: { medianGradeCount: number; averageGrade: number | null }
}

export type HeatmapRow = {
  teacherId: string
  fullName: string
  maxHoursPerWeek: number
  weeklyHours: number
  isOverloaded: boolean
  pairsByDay: number[]
}

export type Heatmap = {
  weekStart: string
  days: string[]
  teachers: HeatmapRow[]
}

export type AbsenceView = {
  id: string
  teacher: PersonRef
  reason: AbsenceReason
  startDate: string
  endDate: string
  uncoveredLessons: Lesson[]
}

export type SubstitutionView = {
  id: string
  date: string
  reason: AbsenceReason
  createdAt: string
  lesson: Lesson
}

export type ChatSummary = {
  id: string
  type: ChatType
  title: string
  groupId: string | null
  subjectId: string | null
  lastMessage: { content: string; createdAt: string; senderId: string } | null
  unreadCount: number
}

export type ChatMessage = {
  id: string
  chatId: string
  sender: UserSummary
  content: string
  createdAt: string
  readAt: string | null
}

export type ChatContact = UserSummary & { caption: string }

export type NotificationDto = {
  id: string
  type: NotificationType
  payload: Record<string, unknown>
  readAt: string | null
  createdAt: string
}

export type AnnouncementDto = {
  id: string
  title: string
  body: string
  author: UserSummary
  targetRole: Role | null
  targetGroupId: string | null
  targetGroupName: string | null
  createdAt: string
}

export type BotAnswer = {
  answer: string
  sources: Array<{ documentId: string; title: string; excerpt: string }>
}

export type KnowledgeDocumentDto = {
  id: string
  title: string
  fileName: string
  chunkCount: number
  createdAt: string
}

export type Page<T> = { items: T[]; nextCursor: string | null }
