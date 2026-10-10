export type FieldConfig =
  | { name: string; label: string; type: 'text' | 'number' | 'date' | 'email'; isOptional?: boolean }
  | { name: string; label: string; type: 'select'; options: Array<{ value: string; label: string }> }
  | { name: string; label: string; type: 'reference'; resource: string; labelKey: string; isOptional?: boolean }

export type ColumnConfig = { key: string; label: string; labels?: Record<string, string> }

export type ResourceConfig = {
  key: string
  title: string
  hasSearch: boolean
  columns: ColumnConfig[]
  fields: FieldConfig[]
}

const teacherStatusLabels = { ACTIVE: 'Работает', SICK: 'Болеет', VACATION: 'В отпуске', FIRED: 'Уволен' }
const studentStatusLabels = { ACTIVE: 'Учится', EXPELLED: 'Отчислен', GRADUATED: 'Выпущен' }
const termHalfLabels = { '1': 'Осенний', '2': 'Весенний' }

function toOptions(labels: Record<string, string>): Array<{ value: string; label: string }> {
  return Object.entries(labels).map(([value, label]) => ({ value, label }))
}

export const resourceConfigs: ResourceConfig[] = [
  {
    key: 'groups',
    title: 'Группы',
    hasSearch: true,
    columns: [
      { key: 'name', label: 'Группа' },
      { key: 'specialtyName', label: 'Специальность' },
      { key: 'courseYear', label: 'Курс' },
      { key: 'curatorName', label: 'Куратор' },
      { key: 'studentCount', label: 'Студентов' },
    ],
    fields: [
      { name: 'name', label: 'Название', type: 'text' },
      { name: 'specialtyId', label: 'Специальность', type: 'reference', resource: 'specialties', labelKey: 'name' },
      { name: 'courseYear', label: 'Курс', type: 'number' },
      {
        name: 'curatorTeacherId',
        label: 'Куратор',
        type: 'reference',
        resource: 'teachers',
        labelKey: 'fullName',
        isOptional: true,
      },
    ],
  },
  {
    key: 'students',
    title: 'Студенты',
    hasSearch: true,
    columns: [
      { key: 'fullName', label: 'Студент' },
      { key: 'email', label: 'Почта' },
      { key: 'groupName', label: 'Группа' },
      { key: 'enrollmentYear', label: 'Год поступления' },
      { key: 'status', label: 'Статус', labels: studentStatusLabels },
    ],
    fields: [
      { name: 'lastName', label: 'Фамилия', type: 'text' },
      { name: 'firstName', label: 'Имя', type: 'text', isOptional: true },
      { name: 'email', label: 'Почта Google', type: 'email' },
      { name: 'groupId', label: 'Группа', type: 'reference', resource: 'groups', labelKey: 'name' },
      { name: 'enrollmentYear', label: 'Год поступления', type: 'number' },
      { name: 'status', label: 'Статус', type: 'select', options: toOptions(studentStatusLabels) },
    ],
  },
  {
    key: 'teachers',
    title: 'Преподаватели',
    hasSearch: true,
    columns: [
      { key: 'fullName', label: 'Преподаватель' },
      { key: 'email', label: 'Почта' },
      { key: 'departmentName', label: 'Кафедра' },
      { key: 'maxHoursPerWeek', label: 'Часов в неделю' },
      { key: 'status', label: 'Статус', labels: teacherStatusLabels },
    ],
    fields: [
      { name: 'lastName', label: 'Фамилия', type: 'text' },
      { name: 'firstName', label: 'Имя', type: 'text', isOptional: true },
      { name: 'email', label: 'Почта Google', type: 'email' },
      { name: 'departmentId', label: 'Кафедра', type: 'reference', resource: 'departments', labelKey: 'name' },
      { name: 'maxHoursPerWeek', label: 'Максимум часов в неделю', type: 'number' },
      {
        name: 'status',
        label: 'Статус',
        type: 'select',
        options: [
          { value: 'ACTIVE', label: 'Работает' },
          { value: 'FIRED', label: 'Уволен' },
        ],
      },
    ],
  },
  {
    key: 'subjects',
    title: 'Предметы',
    hasSearch: true,
    columns: [
      { key: 'name', label: 'Предмет' },
      { key: 'code', label: 'Код' },
      { key: 'specialtyName', label: 'Специальность' },
      { key: 'hoursTotal', label: 'Часов' },
      { key: 'hoursLecture', label: 'Лекции' },
      { key: 'hoursPractice', label: 'Практика' },
    ],
    fields: [
      { name: 'name', label: 'Название', type: 'text' },
      { name: 'code', label: 'Код', type: 'text' },
      { name: 'specialtyId', label: 'Специальность', type: 'reference', resource: 'specialties', labelKey: 'name' },
      { name: 'hoursTotal', label: 'Часов всего', type: 'number' },
      { name: 'hoursLecture', label: 'Лекции', type: 'number' },
      { name: 'hoursPractice', label: 'Практика', type: 'number' },
    ],
  },
  {
    key: 'curricula',
    title: 'Учебный план',
    hasSearch: false,
    columns: [
      { key: 'groupName', label: 'Группа' },
      { key: 'subjectName', label: 'Предмет' },
      { key: 'teacherName', label: 'Преподаватель' },
      { key: 'semester', label: 'Семестр' },
      { key: 'plannedHours', label: 'Часов на семестр' },
    ],
    fields: [
      { name: 'groupId', label: 'Группа', type: 'reference', resource: 'groups', labelKey: 'name' },
      { name: 'subjectId', label: 'Предмет', type: 'reference', resource: 'subjects', labelKey: 'name' },
      { name: 'teacherId', label: 'Преподаватель', type: 'reference', resource: 'teachers', labelKey: 'fullName' },
      { name: 'semester', label: 'Семестр', type: 'number' },
      { name: 'plannedHours', label: 'Часов на семестр (пусто — по сетке)', type: 'number', isOptional: true },
    ],
  },
  {
    key: 'specialties',
    title: 'Специальности',
    hasSearch: true,
    columns: [
      { key: 'code', label: 'Код' },
      { key: 'name', label: 'Специальность' },
      { key: 'departmentName', label: 'Кафедра' },
    ],
    fields: [
      { name: 'code', label: 'Код', type: 'text' },
      { name: 'name', label: 'Название', type: 'text' },
      { name: 'departmentId', label: 'Кафедра', type: 'reference', resource: 'departments', labelKey: 'name' },
    ],
  },
  {
    key: 'departments',
    title: 'Кафедры',
    hasSearch: true,
    columns: [
      { key: 'name', label: 'Кафедра' },
      { key: 'headTeacherName', label: 'Заведующий' },
    ],
    fields: [
      { name: 'name', label: 'Название', type: 'text' },
      {
        name: 'headTeacherId',
        label: 'Заведующий',
        type: 'reference',
        resource: 'teachers',
        labelKey: 'fullName',
        isOptional: true,
      },
    ],
  },
  {
    key: 'rooms',
    title: 'Аудитории',
    hasSearch: true,
    columns: [
      { key: 'number', label: 'Номер' },
      { key: 'building', label: 'Корпус' },
      { key: 'capacity', label: 'Мест' },
    ],
    fields: [
      { name: 'number', label: 'Номер', type: 'text' },
      { name: 'building', label: 'Корпус', type: 'text' },
      { name: 'capacity', label: 'Мест', type: 'number' },
    ],
  },
  {
    key: 'terms',
    title: 'Семестры',
    hasSearch: false,
    columns: [
      { key: 'name', label: 'Название' },
      { key: 'half', label: 'Полугодие', labels: termHalfLabels },
      { key: 'startDate', label: 'Начало' },
      { key: 'endDate', label: 'Конец' },
    ],
    fields: [
      { name: 'name', label: 'Название', type: 'text' },
      { name: 'half', label: 'Полугодие', type: 'select', options: toOptions(termHalfLabels) },
      { name: 'startDate', label: 'Начало', type: 'date' },
      { name: 'endDate', label: 'Конец', type: 'date' },
    ],
  },
]

export function findResourceConfig(key: string): ResourceConfig | undefined {
  return resourceConfigs.find((config) => config.key === key)
}
