import { clsx } from 'clsx'

interface Props {
  className?: string
}

/** Generic pulsing skeleton block. Combine with layout classes for specific shapes. */
export function Skeleton({ className }: Props) {
  return <div className={clsx('animate-pulse bg-white/8 rounded-xl', className)} />
}

/** Dashboard: 3 KPI cards + chart + category rows */
export function DashboardSkeleton() {
  return (
    <div className="px-4 space-y-3">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2 py-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
      </div>
      {/* Chart */}
      <Skeleton className="h-52 mx-0" />
      {/* Category rows */}
      <div className="space-y-2 pt-2">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}
      </div>
    </div>
  )
}

/** Transactions: day header + rows */
export function TransactionsSkeleton() {
  return (
    <div className="px-4 space-y-4 pt-4">
      {[...Array(2)].map((_, g) => (
        <div key={g} className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <div className="space-y-px bg-surface rounded-xl overflow-hidden">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16 rounded-none" />)}
          </div>
        </div>
      ))}
    </div>
  )
}

/** Accounts: total card + account cards */
export function AccountsSkeleton() {
  return (
    <div className="px-4 space-y-3 pt-4">
      <Skeleton className="h-16" />
      {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
    </div>
  )
}

/** Categories: two sections with grids */
export function CategoriesSkeleton() {
  return (
    <div className="px-4 space-y-6 pt-4">
      {[...Array(2)].map((_, s) => (
        <div key={s} className="space-y-3">
          <Skeleton className="h-4 w-16" />
          <div className="grid grid-cols-4 gap-2">
            {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-20" />)}
          </div>
        </div>
      ))}
    </div>
  )
}
