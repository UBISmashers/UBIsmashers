import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    positive: boolean;
  };
  variant?: "default" | "primary" | "accent";
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  variant = "default",
}: StatCardProps) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden",
        variant === "primary" && "gradient-primary text-primary-foreground border-0",
        variant === "accent" && "gradient-accent text-accent-foreground border-0"
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle
          className={cn(
            "text-sm font-medium",
            variant === "default" && "text-muted-foreground"
          )}
        >
          {title}
        </CardTitle>
        <Icon
          className={cn(
            "h-5 w-5",
            variant === "default" ? "text-muted-foreground" : "opacity-80"
          )}
        />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold font-display">{value}</div>
        {description && (
          <p
            className={cn(
              "text-xs mt-1",
              variant === "default" ? "text-muted-foreground" : "opacity-80"
            )}
          >
            {description}
          </p>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            <span
              className={cn(
                "text-xs font-medium",
                trend.positive ? "text-success" : "text-destructive",
                variant !== "default" && "opacity-90"
              )}
            >
              {trend.positive ? "+" : ""}{trend.value}%
            </span>
            <span
              className={cn(
                "text-xs",
                variant === "default" ? "text-muted-foreground" : "opacity-70"
              )}
            >
              vs last month
            </span>
          </div>
        )}
      </CardContent>
      {variant !== "default" && (
        <div className="absolute -right-4 -bottom-4 opacity-10">
          <Icon className="h-24 w-24" />
        </div>
      )}
    </Card>
  );
}
