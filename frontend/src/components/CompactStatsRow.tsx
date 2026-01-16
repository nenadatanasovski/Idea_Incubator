import clsx from "clsx";

interface Stat {
  label: string;
  value: string | number;
  icon?: React.ComponentType<{ className?: string }>;
  color?: string;
}

interface CompactStatsRowProps {
  stats: Stat[];
  className?: string;
}

export default function CompactStatsRow({
  stats,
  className,
}: CompactStatsRowProps) {
  return (
    <div className={clsx("flex flex-wrap items-center gap-4 py-2", className)}>
      {stats.map((stat, idx) => (
        <div key={idx} className="flex items-center gap-2">
          {stat.icon && (
            <stat.icon
              className={clsx("h-4 w-4", stat.color || "text-gray-400")}
            />
          )}
          <span className="text-sm text-gray-500">{stat.label}:</span>
          <span className="font-semibold text-gray-900">{stat.value}</span>
        </div>
      ))}
    </div>
  );
}
