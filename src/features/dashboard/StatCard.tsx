import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'

interface StatCardProps {
  label: string
  value: number
  format: (value: number) => string
  icon: LucideIcon
  delay?: number
  /** A line of context shown under the number. */
  footer?: ReactNode
}

export function StatCard({ label, value, format, icon: Icon, delay = 0, footer }: StatCardProps) {
  return (
    <Card
      className="p-5 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl"
      data-aos="fade-up"
      data-aos-delay={delay}
    >
      <div className="flex min-h-10 items-center justify-between gap-2">
        <p className="text-sm font-medium leading-5 text-slate-500">{label}</p>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700`}>
          <Icon className="h-5 w-5" aria-hidden />
        </div>
      </div>
      <p className="mt-3 whitespace-nowrap text-[1.7rem] font-medium tracking-tight text-slate-900 tabular-nums">
        <AnimatedNumber value={value} format={format} />
      </p>
      {footer && <div className="mt-3 min-h-9 text-xs text-slate-500">{footer}</div>}
    </Card>
  )
}
