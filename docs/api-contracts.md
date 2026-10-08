# Электронный колледж — API-контракты

## Общие соглашения

- Базовый путь: `/api`. Формат тела запроса и ответа: JSON, UTF-8.
- Аутентификация: JWT в httpOnly cookie `session` (SameSite=Lax, Secure). Срок жизни 7 дней.
- Идентификаторы: строки cuid.
- Даты: `YYYY-MM-DD`. Моменты времени: ISO 8601 в UTC. Время пар: `HH:mm`.
- `dayOfWeek`: 1 (понедельник) — 7 (воскресенье). `pairNumber`: 1 — 8.
- Нагрузка: 1 пара = 2 академических часа.
- Учебные периоды хранятся в таблице `Term` (название, полугодие `half` 1 или 2, даты начала и конца). Вне периодов занятий нет.
- Чётность недели считается от понедельника недели, в которую начинается период: первая неделя — ODD.
- Слот активен в дату, если `semester` слота равен `(courseYear группы − 1) × 2 + half` текущего периода.
- Списки с пагинацией принимают `cursor` и `limit` (по умолчанию 50, максимум 200) и возвращают `{ items, nextCursor }`.
- Роли: `STUDENT`, `TEACHER`, `ADMIN`. «Любая» означает любого аутентифицированного пользователя.

### Формат ошибки

```json
{ "error": { "code": "SCHEDULE_CONFLICT", "message": "Аудитория 204 занята", "details": {} } }
```

| HTTP | code | Когда |
| --- | --- | --- |
| 400 | VALIDATION_ERROR | Тело или параметры не прошли валидацию, `details` содержит ошибки по полям |
| 401 | UNAUTHENTICATED | Нет cookie или JWT недействителен |
| 403 | FORBIDDEN | Роль или принадлежность не дают доступа |
| 404 | NOT_FOUND | Сущность не найдена |
| 409 | SCHEDULE_CONFLICT, DUPLICATE | Конфликт расписания или нарушение уникальности |
| 429 | RATE_LIMITED | Превышен лимит запросов (бот, авторизация) |

### Общие типы

```ts
type UserSummary = { id: string; firstName: string; lastName: string; avatarUrl: string | null; role: Role }

type Lesson = {
  scheduleSlotId: string
  date: string
  dayOfWeek: number
  pairNumber: number
  startTime: string
  endTime: string
  subject: { id: string; name: string; code: string }
  group: { id: string; name: string }
  room: { id: string; number: string; building: string }
  teacher: { id: string; fullName: string }
  substitution: null | {
    id: string
    originalTeacher: { id: string; fullName: string }
    substituteTeacher: { id: string; fullName: string }
    reason: 'SICK' | 'VACATION' | 'OTHER'
  }
}

type ScheduleSlot = {
  id: string; groupId: string; subjectId: string; teacherId: string; roomId: string
  dayOfWeek: number; pairNumber: number; startTime: string; endTime: string
  weekType: 'ODD' | 'EVEN' | 'BOTH'; semester: number
}

type ConflictDetails = {
  conflicts: Array<{ kind: 'TEACHER' | 'ROOM' | 'GROUP'; scheduleSlotId?: string; substitutionId?: string; message: string }>
}
```

В `Lesson.teacher` всегда указан тот, кто фактически ведёт занятие в эту дату (с учётом замены).

---

## Auth

| Метод и путь | Назначение | Вход | Выход | Роль |
| --- | --- | --- | --- | --- |
| GET /api/auth/google/url | Ссылка на страницу согласия Google, установка cookie `oauth_state` | — | 200 `{ url }` | Публичный |
| POST /api/auth/google | Обмен OAuth-кода на JWT, установка cookie. `redirectUri` сервер берёт из `APP_URL` | `{ code: string, state: string }` | 200 `{ user: UserSummary & { email } }` + `Set-Cookie`. 403, если email не заведён учебной частью | Публичный |
| POST /api/auth/login | Вход по почте и паролю, до 10 попыток за 10 минут | `{ email, password }` | 200 `{ user }` + `Set-Cookie`, 401 `INVALID_CREDENTIALS` | Публичный |
| POST /api/auth/password | Смена своего пароля. `currentPassword` обязателен, если пароль уже задан | `{ currentPassword?, newPassword }` | 204 | Любая |
| POST /api/auth/logout | Сброс cookie | — | 204 | Любая |
| GET /api/auth/logout | Сброс cookie и переход на `/login` | — | 307 | Любая |
| GET /api/auth/dev-users | Список пользователей для входа без Google. Только при `ALLOW_DEV_LOGIN=true` и не в production, иначе 404 | — | 200 `{ users: Array<{ id, fullName, role, caption }> }` | Публичный |
| POST /api/auth/dev-login | Вход без Google на тех же условиях | `{ userId }` | 200 `{ user }` + `Set-Cookie` | Публичный |
| GET /api/auth/me | Текущий пользователь | — | 200 `{ user: UserSummary & { email }, student: { id, groupId, groupName } \| null, teacher: { id, departmentId, status } \| null }` | Любая |

Учётные записи создаёт учебная часть. Вход через Google разрешён только для email, который уже есть в `User`; при первом входе сохраняются `googleId` и `avatarUrl`.

## Students

| Метод и путь | Назначение | Вход | Выход | Роль |
| --- | --- | --- | --- | --- |
| GET /api/students/me | Дневник | query `semester?` | 200 `{ student: { id, group: { id, name }, enrollmentYear, status }, semester: number \| null, subjects: Array<{ subjectId, name, teacher: { id, fullName }, grades: Array<{ id, value, date, comment }>, averageGrade: number \| null, attendance: { present, absent, late, excused } }>, averageGrade: number \| null }` | STUDENT |
| GET /api/students/me/schedule | Расписание с учётом замен | query `from`, `to` (не более 62 дней) | 200 `{ lessons: Lesson[] }` | STUDENT |
| GET /api/students/me/grades | Лента оценок | query `subjectId?`, `from?`, `to?`, `cursor?`, `limit?` | 200 `{ items: Array<{ id, value, date, comment, subject: { id, name }, teacher: { id, fullName } }>, nextCursor }` | STUDENT |

## Teachers

| Метод и путь | Назначение | Вход | Выход | Роль |
| --- | --- | --- | --- | --- |
| GET /api/teachers/me/schedule | Расписание преподавателя с заменами (и своими, и теми, где он заменяет) | query `from`, `to` | 200 `{ teacherId, lessons: Lesson[] }` | TEACHER |
| GET /api/teachers/me/load | Почасовка и окна | query `weekStart` (понедельник) | 200 `{ weekStart, maxHoursPerWeek, weeklyHours, days: Array<{ date, dayOfWeek, pairs: number[], hours: number, gaps: number[] }> }`, где `gaps` — номера свободных пар между первой и последней занятой | TEACHER |
| POST /api/teachers/me/sick | Отметить себя болеющим | `{ startDate, endDate }` | 201 `{ absenceId, status, affectedLessons: Array<{ scheduleSlotId, date, pairNumber, groupName, subjectName }> }`. Учебной части уходит уведомление | TEACHER |
| GET /api/teachers/me/subjects | Предметы и группы преподавателя | query `semester?` | 200 `{ subjects: Array<{ subjectId, name, code, groups: Array<{ groupId, name, semester }> }> }` | TEACHER |

## Journal

| Метод и путь | Назначение | Вход | Выход | Роль |
| --- | --- | --- | --- | --- |
| POST /api/journal/grade | Выставить оценку | `{ studentId, subjectId, value: 2..5, date, comment?, kind?: 'ANSWER' \| 'SURVEY' \| 'PRACTICAL' \| 'LECTURE' \| 'TEST', planItemId? }` | 201 `{ grade: { id, studentId, subjectId, teacherId, value, date, comment } }`. Событие `grade:created` студенту | TEACHER (ведёт предмет у группы студента по Curriculum или назначен заменой на эту дату), ADMIN |
| PATCH /api/journal/grade/:id | Исправить оценку | `{ value?, comment?, kind?, planItemId? }` | 200 `{ grade }` | TEACHER (автор), ADMIN |
| DELETE /api/journal/grade/:id | Удалить оценку | — | 204 | TEACHER (автор), ADMIN |
| POST /api/journal/attendance | Отметить посещаемость пары, повторный вызов перезаписывает | `{ scheduleSlotId, date, records: Array<{ studentId, status }> }` | 200 `{ saved: number }` | TEACHER (ведёт пару или заменяет в эту дату), ADMIN |
| GET /api/journal/group/:groupId/subject/:subjectId | Журнал группы по предмету | query `from?`, `to?` (по умолчанию последние 30 дней, не более 190) | 200 `{ group: { id, name }, subject: { id, name }, from, to, lessons: Array<{ date, scheduleSlotId, pairNumber }>, dates: string[], students: Array<{ studentId, fullName, grades: Array<{ id, value, date, comment }>, attendance: Array<{ scheduleSlotId, date, status }>, averageGrade: number \| null }> }` | TEACHER (ведёт предмет у группы или куратор группы), ADMIN |

### Журнал, КТП и успеваемость (версия 1.2)

`GET /api/journal/group/:groupId/subject/:subjectId` принимает `scope=mine|all` (по умолчанию `mine`, для учебной части всегда `all`) и по умолчанию отдаёт период с начала текущего семестра. В ответ добавлены:

- `scope`, `teachers` (кто ведёт предмет у группы), `viewerTeacherId`, `canEditPlan`;
- `plan` — КТП: `{ id, semester, items: Array<{ id, kind: 'LECTURE' | 'PRACTICAL', title, position, plannedDate }>, admissionThreshold, autoCreditThreshold, customAdmissionThreshold, customAutoCreditThreshold }`;
- `stats` — `{ medianGradeCount, averageGrade }`;
- у студента `plan` — `{ completed, total, owed, admissionThreshold, autoCreditThreshold, status: 'AUTO_CREDIT' | 'ADMITTED' | 'NOT_ADMITTED', completedItemIds }` и `insight` — `{ flags, isLagging, needsAttention, gradeCount, absences, lessonsHeld, reasons }`;
- у оценки `kind`, `planItemId`, `teacher`; у пары `teacher`.

| Метод и путь | Назначение | Вход | Выход | Роль |
| --- | --- | --- | --- | --- |
| PUT /api/journal/plan | Сохранить КТП текущего семестра целиком | `{ groupId, subjectId, admissionThreshold: number \| null, autoCreditThreshold: number \| null, items: Array<{ id?, kind, title, plannedDate: string \| null }> }` | 200 `{ plan }` | TEACHER (ведёт предмет у группы), ADMIN |

## Schedule

| Метод и путь | Назначение | Вход | Выход | Роль |
| --- | --- | --- | --- | --- |
| GET /api/schedule | Расписание по фильтрам | query `groupId?`, `teacherId?`, `roomId?`, `from`, `to`; нужен хотя бы один фильтр | 200 `{ lessons: Lesson[] }` | Любая |
| GET /api/schedule/slots | Шаблон недели без разворота по датам | query `groupId?`, `teacherId?`, `semester` | 200 `{ slots: ScheduleSlot[] }` | ADMIN |
| POST /api/schedule | Создать слот | `Omit<ScheduleSlot, 'id'>` | 201 `{ slot: ScheduleSlot }`, 409 `ConflictDetails` | ADMIN |
| PATCH /api/schedule/:id | Изменить слот | `Partial<Omit<ScheduleSlot, 'id'>>` | 200 `{ slot: ScheduleSlot }`, 409 `ConflictDetails` | ADMIN |
| DELETE /api/schedule/:id | Удалить слот вместе с заменами и посещаемостью | — | 204 | ADMIN |

При создании и изменении слота в одной транзакции проверяется занятость преподавателя, аудитории и группы в тот же `dayOfWeek` + `pairNumber` + `semester` с пересекающимся `weekType` (BOTH пересекается с любым). Преподаватель должен иметь `TeacherSubject` на этот предмет.

## Substitutions

| Метод и путь | Назначение | Вход | Выход | Роль |
| --- | --- | --- | --- | --- |
| POST /api/substitutions/suggest | Подобрать кандидатов на замену | `{ scheduleSlotId, date, maxConsecutivePairs?: number = 4 }` | 200 `{ slot: Lesson, candidates: Array<{ teacherId, fullName, currentLoadToday, weeklyLoad, maxHoursPerWeek, reason }> }` | ADMIN |
| POST /api/substitutions | Назначить замену | `{ scheduleSlotId, date, substituteTeacherId, reason }` | 201 `{ substitution: { id, scheduleSlotId, date, originalTeacherId, substituteTeacherId, reason, createdByAdminId, createdAt } }`, 409 `ConflictDetails` | ADMIN |
| GET /api/substitutions | Список замен | query `from`, `to`, `groupId?`, `teacherId?` | 200 `{ substitutions: Array<{ id, date, reason, createdAt, lesson: Lesson }> }` | ADMIN — все; TEACHER — свои; STUDENT — своей группы |
| DELETE /api/substitutions/:id | Отменить замену | — | 204 | ADMIN |

### Виды замены (версия 1.1)

`POST /api/substitutions/suggest` возвращает `{ slot, candidates, otherSubjectCandidates, combinedCandidates }`:

- `candidates` — преподаватели по тому же предмету;
- `otherSubjectCandidates` — преподаватели, ведущие у группы другой предмет по учебному плану семестра: те же поля плюс `subject: { id, name }`;
- `combinedCandidates` — пары других групп в это же время по предметам из учебного плана группы: `{ scheduleSlotId, teacherId, fullName, subject, group, room: { id, number, capacity }, studentCount, fitsRoom, isSameSubject }`.

`POST /api/substitutions` принимает `{ scheduleSlotId, date, reason }` и один из вариантов: `substituteTeacherId` (тот же предмет), `substituteTeacherId` + `subjectId` (другой предмет), `combinedWithSlotId` (совмещение: преподаватель, предмет и аудитория берутся из указанной пары). В ответе у замены есть `kind`: `SAME_SUBJECT`, `OTHER_SUBJECT` или `COMBINED`.

В `Lesson` поля `subject`, `teacher` и `room` всегда описывают фактически проводимое занятие; `substitution` дополнен полями `kind`, `originalSubject` и `combinedWithGroupName`. При создании и изменении студента или преподавателя через справочник ответ на создание содержит `generatedPassword`.

### Алгоритм suggest

1. Загрузить `ScheduleSlot`; проверить, что `date` приходится на его `dayOfWeek` и чётность недели соответствует `weekType`, иначе 400.
2. Кандидаты: `Teacher` со `status = ACTIVE`, имеющие `TeacherSubject` на `subjectId` слота и не имеющие `TeacherAbsence`, покрывающей `date`.
3. Исключить оригинального преподавателя слота.
4. Исключить занятых в эту дату и эту пару: собственный слот (с учётом чётности и за вычетом пар, с которых преподаватель снят заменой) либо назначенная на него замена.
5. Исключить тех, у кого вместе с этой парой получится более `maxConsecutivePairs` пар подряд в этот день.
6. Исключить тех, у кого недельная нагрузка с учётом этой пары превысит `maxHoursPerWeek`.
7. Сортировка: `currentLoadToday` по возрастанию, затем `weeklyLoad` по возрастанию, затем фамилия.
8. `currentLoadToday` — пары в эту дату, `weeklyLoad` — часы за неделю этой даты; обе величины считаются с учётом замен. `reason` — текст вида «Ведёт предмет, сегодня 2 пары, 18 из 36 часов в неделю».

### Валидация при POST /api/substitutions

Транзакция с уровнем изоляции Serializable:

- на `(date, scheduleSlotId)` ещё нет замены;
- `substituteTeacherId` имеет `TeacherSubject` на предмет слота и свободен в это время (нет своего действующего слота и нет другой замены);
- аудитория слота свободна в это время;
- группа не занята другим предметом в это время.

При нарушении — 409 `SCHEDULE_CONFLICT` с перечнем конфликтов в `details.conflicts`. После успешной записи отправляются `substitution:created` в комнаты `group:{groupId}` и `user:{userId}` обоих преподавателей, создаются `Notification` и push.

## Admin

Все эндпоинты раздела — роль ADMIN. CRUD раскрывается одинаково:

| Метод и путь | Выход |
| --- | --- |
| GET /api/admin/{resource} | 200 `{ items, nextCursor }`, query `search?`, `cursor?`, `limit?` |
| GET /api/admin/{resource}/:id | 200 `{ item }` |
| POST /api/admin/{resource} | 201 `{ item }`, 409 `DUPLICATE` |
| PATCH /api/admin/{resource}/:id | 200 `{ item }` |
| DELETE /api/admin/{resource}/:id | 204, 409 если есть зависимые записи |

| resource | Поля тела POST (в PATCH все необязательны) | Фильтры GET |
| --- | --- | --- |
| specialties | `{ code, name, departmentId }` | `departmentId?` |
| subjects | `{ name, code, specialtyId, hoursTotal, hoursLecture, hoursPractice }` | `specialtyId?` |
| groups | `{ name, specialtyId, courseYear, curatorTeacherId? }` | `specialtyId?`, `courseYear?` |
| teachers | `{ email, firstName, lastName, departmentId, maxHoursPerWeek, status? }` — создаёт `User` с ролью TEACHER и `Teacher`. Через справочник статус меняется только между ACTIVE и FIRED; SICK и VACATION выставляются автоматически по отсутствиям | `departmentId?`, `status?` |
| students | `{ email, firstName, lastName, groupId, enrollmentYear, status? }` — создаёт `User` с ролью STUDENT и `Student` | `groupId?`, `status?` |
| departments | `{ name, headTeacherId? }` | — |
| rooms | `{ number, building, capacity }` | `building?` |
| curricula | `{ groupId, subjectId, teacherId, semester }` | `groupId?`, `teacherId?`, `semester?` |
| terms | `{ name, half: 1 \| 2, startDate, endDate }`, периоды не пересекаются | — |

| Метод и путь | Назначение | Вход | Выход |
| --- | --- | --- | --- |
| POST /api/admin/teachers/:id/subjects | Задать полный набор предметов, которые преподаватель может вести | `{ subjectIds: string[] }` | 200 `{ teacherId, subjects: Array<{ id, name, code }> }` |
| GET /api/admin/load/heatmap | Тепловая карта нагрузки | query `weekStart` (понедельник), `departmentId?` | 200 `{ weekStart, days: string[], teachers: Array<{ teacherId, fullName, maxHoursPerWeek, weeklyHours, isOverloaded: boolean, pairsByDay: number[] }> }` |
| GET /api/admin/absences | Текущие и будущие отсутствия преподавателей с парами без замены | query `from`, `to` | 200 `{ absences: Array<{ id, teacher: { id, fullName }, reason, startDate, endDate, uncoveredLessons: Lesson[] }> }` |
| POST /api/admin/users/:id/password | Выдать пользователю новый пароль | — | 200 `{ credentials: { email, fullName, password } }` |
| POST /api/admin/students/bulk | Добавить до 100 студентов в группу с паролями | `{ groupId, enrollmentYear, students: Array<{ email, lastName, firstName }> }` | 201 `{ credentials: Array<{ email, fullName, password }> }` |
| POST /api/admin/absences | Отметить отсутствие преподавателя | `{ teacherId, reason, startDate, endDate }` | 201 `{ absence }` |
| DELETE /api/admin/absences/:id | Снять отсутствие | — | 204 |
| POST /api/admin/documents | Загрузить документ в базу знаний бота (pdf, docx, txt, md до 10 МБ) | multipart `file`, `title` | 201 `{ document: { id, title, fileName, chunkCount, createdAt } }` |
| GET /api/admin/documents | Список документов | — | 200 `{ items: Array<{ id, title, fileName, chunkCount, createdAt }> }` |
| DELETE /api/admin/documents/:id | Удалить документ с чанками | — | 204 |

`pairsByDay` — 7 чисел с понедельника по воскресенье, с учётом замен. Раскраска на фронте: 0 — без фона, 1–3 — `#DCFCE7`, 4–5 — `#FEF3C7`, 6 и больше — `#FEE2E2`.

## Announcements

| Метод и путь | Назначение | Вход | Выход | Роль |
| --- | --- | --- | --- | --- |
| GET /api/announcements | Объявления, адресованные пользователю | query `cursor?`, `limit?` | 200 `{ items: Array<{ id, title, body, author: UserSummary, targetRole, targetGroupId, createdAt }>, nextCursor }` | Любая |
| POST /api/announcements | Опубликовать объявление | `{ title, body, targetRole?, targetGroupId? }` | 201 `{ announcement }`. Событие `announcement:created` | ADMIN — любые; TEACHER — только с `targetGroupId` своей группы (куратор или ведёт предмет) |
| DELETE /api/announcements/:id | Удалить | — | 204 | ADMIN, автор |

## Chat

| Метод и путь | Назначение | Вход | Выход | Роль |
| --- | --- | --- | --- | --- |
| GET /api/chats | Чаты пользователя | — | 200 `{ chats: Array<{ id, type, title, groupId, subjectId, lastMessage: { content, createdAt, senderId } \| null, unreadCount }> }` | Любая |
| GET /api/chats/contacts | С кем можно начать личный чат | — | 200 `{ contacts: Array<UserSummary & { caption }> }` | Любая |
| POST /api/chats/private | Найти или создать личный чат | `{ userId }` | 200 `{ chat }` | STUDENT — только с преподавателем своей группы; TEACHER — только со студентом своих групп; ADMIN — с любым |
| GET /api/chats/:id/messages | История | query `cursor?`, `limit?` | 200 `{ items: Array<{ id, chatId, sender: UserSummary, content, createdAt, readAt }>, nextCursor }` | Участник чата |
| POST /api/chats/:id/messages | Отправить сообщение | `{ content: string (1..4000) }` | 201 `{ message }`. Событие `message:new` | Участник чата |
| POST /api/chats/:id/read | Отметить прочитанным до сообщения включительно | `{ lastMessageId }` | 204. Событие `message:read` | Участник чата |

Чаты типа GROUP и SUBJECT создаются и пополняются автоматически: GROUP — при создании группы (студенты и куратор), SUBJECT — при создании записи Curriculum (студенты группы и преподаватель). Произвольных общих чатов нет. Счётчик непрочитанного считается по `ChatMember.lastReadAt`, `Message.readAt` фиксирует первое прочтение собеседником.

## Notifications и Push

| Метод и путь | Назначение | Вход | Выход | Роль |
| --- | --- | --- | --- | --- |
| GET /api/notifications | Уведомления | query `unreadOnly?`, `cursor?`, `limit?` | 200 `{ items: Array<{ id, type, payload, readAt, createdAt }>, nextCursor, unreadCount }` | Любая |
| POST /api/notifications/read | Отметить прочитанными | `{ ids?: string[] }`, без `ids` — все | 200 `{ updated: number }` | Любая |
| GET /api/push/public-key | VAPID-ключ для подписки | — | 200 `{ publicKey }` | Любая |
| POST /api/push/subscribe | Сохранить подписку браузера | `{ endpoint, keys: { p256dh, auth } }` | 204 | Любая |
| POST /api/push/unsubscribe | Удалить подписку | `{ endpoint }` | 204 | Любая |

`payload` по типам:

- `SUBSTITUTION_CREATED`: `{ substitutionId, date, pairNumber, subjectName, groupName, substituteTeacherName }`
- `GRADE_CREATED`: `{ gradeId, subjectName, value, date }`
- `ANNOUNCEMENT_CREATED`: `{ announcementId, title }`
- `ABSENCE_REPORTED`: `{ absenceId, teacherName, startDate, endDate, lessonCount }`

## Calendar

| Метод и путь | Назначение | Вход | Выход | Роль |
| --- | --- | --- | --- | --- |
| GET /api/calendar/feed | Получить или создать персональную ссылку на ics-фид | — | 200 `{ url, isGoogleConnected, isGoogleConfigured }` | STUDENT, TEACHER |
| POST /api/calendar/feed/rotate | Перевыпустить токен фида | — | 200 `{ url }` | STUDENT, TEACHER |
| GET /api/calendar/feed/:token.ics | ics-фид расписания на текущий семестр с заменами | — | 200 `text/calendar` | Публичный, доступ по токену |
| GET /api/calendar/google/url | Ссылка на страницу согласия Google (scope `calendar.app.created`, offline-доступ) | — | 200 `{ url }` | STUDENT, TEACHER |
| POST /api/calendar/google/connect | Подключить Google Calendar, refresh-токен хранится зашифрованным | `{ code, state }` | 204 | STUDENT, TEACHER |
| DELETE /api/calendar/google/connect | Отключить Google Calendar | — | 204 | STUDENT, TEACHER |
| POST /api/calendar/google/sync | Выгрузить расписание в отдельный календарь «Колледж» | `{ from, to }` (не более 62 дней) | 200 `{ created, updated, deleted }` | STUDENT, TEACHER |

## Bot

| Метод и путь | Назначение | Вход | Выход | Роль |
| --- | --- | --- | --- | --- |
| POST /api/bot/ask | Вопрос по документам колледжа | `{ question: string (1..1000) }` | 200 `{ answer, sources: Array<{ documentId, title, excerpt }> }`. Лимит 20 запросов в час на пользователя | STUDENT, TEACHER |

Поиск: эмбеддинг вопроса через Gemini (модель из `GEMINI_EMBEDDING_MODEL`, по умолчанию `gemini-embedding-001`, 768 измерений), топ-6 чанков по косинусной близости (векторы хранятся в колонке `Float[]`, близость считается в приложении), ответ генерирует модель из `GEMINI_CHAT_MODEL` (по умолчанию `gemini-2.5-flash`) строго по найденным фрагментам. Без `GEMINI_API_KEY` эндпоинт отвечает 503 `ASSISTANT_NOT_CONFIGURED`. Лимит запросов хранится в памяти процесса. Если релевантных фрагментов нет, бот отвечает, что в документах колледжа ответа нет.

---

## WebSocket (Socket.io)

Отдельный Node.js-процесс `server/socket-server.ts`. Подключение: handshake читает cookie `session`, проверяет JWT, при ошибке соединение отклоняется с `UNAUTHENTICATED`.

### Комнаты

| Комната | Кто входит | Что получает |
| --- | --- | --- |
| `user:{userId}` | Сам пользователь, автоматически при подключении | Персональные уведомления, оценки |
| `group:{groupId}` | Студенты группы, куратор, преподаватели группы — автоматически | Объявления и замены группы |
| `chat:{chatId}` | Участники чата — автоматически по `ChatMember` | Сообщения и статусы |
| `role:{role}` | Все пользователи роли — автоматически | Объявления для роли или для всех |

API-роуты Next.js публикуют события в WebSocket-сервер через внутренние HTTP-эндпоинты с общим секретом `SOCKET_INTERNAL_SECRET` в заголовке `x-internal-secret`: `POST /internal/emit` `{ rooms, event, payload }` и `POST /internal/join` `{ userIds, room }` (подключает уже открытые соединения к новому чату). `GET /health` — проверка работоспособности.

### Сервер → клиент

| Событие | Payload | Комната |
| --- | --- | --- |
| `substitution:created` | `{ substitution: { id, date, reason }, lesson: Lesson }` | `group:{groupId}`, `user:{userId}` обоих преподавателей |
| `grade:created` | `{ grade: { id, value, date, comment }, subject: { id, name }, teacher: { id, fullName } }` | `user:{userId}` студента |
| `message:new` | `{ message: { id, chatId, sender: UserSummary, content, createdAt } }` | `chat:{chatId}` |
| `message:read` | `{ chatId, userId, lastMessageId, readAt }` | `chat:{chatId}` |
| `typing:start` | `{ chatId, userId }` | `chat:{chatId}`, кроме отправителя |
| `typing:stop` | `{ chatId, userId }` | `chat:{chatId}`, кроме отправителя |
| `announcement:created` | `{ announcement: { id, title, body, author: UserSummary, createdAt } }` | `group:{groupId}`, `role:{role}` либо `user:{userId}` адресатов |
| `notification:new` | `{ notification: { id, type, payload, createdAt } }` | `user:{userId}` |

### Клиент → сервер

| Событие | Payload | Ack |
| --- | --- | --- |
| `message:send` | `{ chatId, content }` | `{ ok: true, message }` или `{ ok: false, error }` |
| `message:read` | `{ chatId, lastMessageId }` | `{ ok: true }` |
| `typing:start` | `{ chatId }` | — |
| `typing:stop` | `{ chatId }` | — |

`message:send` и `POST /api/chats/:id/messages` проходят через одну и ту же сервисную функцию и дают одинаковый результат.

---

## Дерево проекта

```
app/
  (auth)/login/                     вход и OAuth-callback
  (student)/student/                дневник, расписание, оценки
  (teacher)/teacher/                сегодня, расписание, журнал, нагрузка
  (admin)/admin/                    обзор, расписание, замены, нагрузка, журнал, справочники, документы
  (shared)/                         чаты, объявления, уведомления, помощник, настройки
  api/                              auth, students, teachers, journal, schedule, substitutions,
                                    admin, announcements, chats, notifications, push, calendar, bot
components/
  ui/ layout/ schedule/ journal/ chat/ admin/ substitutions/
lib/
  prisma.ts auth.ts socket.ts session-token.ts http.ts dates.ts types.ts
  schedule/                         expand-lessons, week-parity, conflicts, teacher-load, slot-service
  substitutions/                    suggest-candidates, create-substitution
  journal/ chat/ notifications/ calendar/ rag/ admin/ client/ validation/
prisma/
  schema.prisma seed.ts
server/
  socket-server.ts load-env.ts
public/
  service-worker.js
middleware.ts
```
