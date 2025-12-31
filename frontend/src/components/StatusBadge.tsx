import { Circle, Pause, Archive, CheckCircle, XCircle } from 'lucide-react'
import type { IdeaStatus } from '../types'

interface StatusBadgeProps {
  status: IdeaStatus
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const statusConfig: Record<IdeaStatus, {
  icon: typeof Circle
  color: string
  bgColor: string
  label: string
}> = {
  active: {
    icon: Circle,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
    label: 'Active'
  },
  paused: {
    icon: Pause,
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-100',
    label: 'Paused'
  },
  abandoned: {
    icon: XCircle,
    color: 'text-red-600',
    bgColor: 'bg-red-100',
    label: 'Abandoned'
  },
  completed: {
    icon: CheckCircle,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    label: 'Completed'
  },
  archived: {
    icon: Archive,
    color: 'text-gray-600',
    bgColor: 'bg-gray-100',
    label: 'Archived'
  }
}

const sizeConfig = {
  sm: {
    icon: 'h-3 w-3',
    text: 'text-xs',
    padding: 'px-2 py-0.5'
  },
  md: {
    icon: 'h-4 w-4',
    text: 'text-sm',
    padding: 'px-2.5 py-1'
  },
  lg: {
    icon: 'h-5 w-5',
    text: 'text-base',
    padding: 'px-3 py-1.5'
  }
}

export default function StatusBadge({
  status,
  size = 'md',
  showLabel = true
}: StatusBadgeProps) {
  const config = statusConfig[status]
  const sizes = sizeConfig[size]
  const Icon = config.icon

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${config.bgColor} ${config.color} ${sizes.padding}`}
    >
      <Icon className={sizes.icon} />
      {showLabel && <span className={sizes.text}>{config.label}</span>}
    </span>
  )
}

// Export config for use in other components
export { statusConfig }
