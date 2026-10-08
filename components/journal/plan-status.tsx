import { planStatusLabels } from '@/components/journal/journal-labels'
import { Badge } from '@/components/ui/badge'
import type { PlanProgress } from '@/lib/types'

const statusTones = { AUTO_CREDIT: 'success', ADMITTED: 'neutral', NOT_ADMITTED: 'danger' } as const

export function PlanStatus({ progress }: { progress: PlanProgress | null }) {
  if (!progress) {
    return <span className="text-muted">—</span>
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 whitespace-nowrap"
      title={`Сдано ${progress.completed} из ${progress.total}. Допуск — ${progress.admissionThreshold}, автомат — ${progress.autoCreditThreshold}`}
    >
      <span className="tabular-nums">
        {progress.completed}/{progress.total}
      </span>
      <Badge tone={statusTones[progress.status]}>{planStatusLabels[progress.status]}</Badge>
    </span>
  )
}
