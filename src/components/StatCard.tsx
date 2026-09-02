import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  sub: string;
  accent?: "gold" | "green" | "red" | "dark";
}

const accentStyles = {
  gold: "border-t-accent",
  green: "border-t-green-ok",
  red: "border-t-red-alert",
  dark: "bg-primary border-accent/25",
};

export function StatCard({ label, value, sub, accent = "gold" }: StatCardProps) {
  const isDark = accent === "dark";
  return (
    <div
      className={cn(
        "bg-card rounded-xl p-5 border border-border shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all border-t-[3px]",
        accentStyles[accent]
      )}
    >
      <div className={cn("text-[0.7rem] font-bold uppercase tracking-widest mb-2", isDark ? "text-accent/60" : "text-muted-foreground")}>
        {label}
      </div>
      <div className={cn("font-display text-[2.2rem] font-bold leading-none", isDark ? "text-accent" : "text-foreground")}>
        {value}
      </div>
      <div className={cn("text-[0.7rem] mt-1", isDark ? "text-primary-foreground/40" : "text-muted-foreground")}>
        {sub}
      </div>
    </div>
  );
}
