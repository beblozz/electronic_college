import type { DismissalReason, StaffMember } from '@/lib/types'

export const dismissalReasonLabels: Record<DismissalReason, string> = {
  RETIREMENT: 'Выход на пенсию',
  OWN_WISH: 'По собственному желанию',
  DISMISSED: 'Уволен по решению колледжа',
  DEATH: 'В связи со смертью',
  TRANSFER: 'Перевод в другую организацию',
  OTHER: 'Другая причина',
}

export const dismissalReasonOrder = Object.keys(dismissalReasonLabels) as DismissalReason[]

export const staffStatusLabels: Record<StaffMember['status'], string> = {
  ACTIVE: 'Работает',
  SICK: 'Болеет',
  VACATION: 'В отпуске',
  FIRED: 'В архиве',
}
