import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sub: string;
  accent?: "gold" | "green" | "red" | "dark";
  icon?: React.ReactNode;
  onClick?: () => void;
}

const accentStyles = {
  gold: "border-t-accent",
  green: "border-t-green-ok",
  red: "border-t-red-alert",
  dark: "bg-primary border-accent/25",
};

export function StatCard({ label, value, sub, accent = "gold", icon, onClick }: StatCardProps) {
  const isDark = accent === "dark";
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      } : undefined}
      className={cn(
        "group bg-card rounded-xl p-5 border border-border shadow-panel transition-[border-color,box-shadow,transform] duration-200 border-t-[3px]",
        onClick && "cursor-pointer hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-panel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        accentStyles[accent]
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className={cn("text-xs font-bold uppercase tracking-[0.12em]", isDark ? "text-accent/70" : "text-muted-foreground")}>
          {label}
        </div>
        {icon && (
          <div className={cn("rounded-lg p-2", isDark ? "bg-white/5 text-accent" : "bg-muted/70 text-foreground/70")}>
            {icon}
          </div>
        )}
      </div>
      <div className={cn("font-display text-3xl font-bold leading-none tracking-tight", isDark ? "text-accent" : "text-foreground")}>
        {value}
      </div>
      <div className={cn("mt-2 text-xs leading-relaxed", isDark ? "text-primary-foreground/55" : "text-muted-foreground")}>
        {sub}
      </div>
    </div>
  );
}
