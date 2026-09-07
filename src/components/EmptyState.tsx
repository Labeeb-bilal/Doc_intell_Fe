import { Link } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; href: string }
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-16 text-center">
      <Icon className="h-8 w-8 text-muted-foreground" aria-hidden="true" />
      <p className="mt-2 text-sm font-medium">{title}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <Link
          to={action.href}
          className="mt-3 text-sm font-medium text-primary underline underline-offset-4 hover:no-underline"
        >
          {action.label}
        </Link>
      )}
    </div>
  )
}
