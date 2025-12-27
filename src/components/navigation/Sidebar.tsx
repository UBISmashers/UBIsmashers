import { useState } from "react";
import { NavItem } from "./NavItem";
import {
  LayoutDashboard,
  Calendar,
  DollarSign,
  Users,
  ClipboardCheck,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/bookings", icon: Calendar, label: "Court Bookings" },
  { to: "/attendance", icon: ClipboardCheck, label: "Attendance" },
  { to: "/expenses", icon: DollarSign, label: "Expenses" },
  { to: "/members", icon: Users, label: "Members" },
  { to: "/reports", icon: BarChart3, label: "Reports" },
];

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen flex flex-col transition-all duration-300",
        "bg-sidebar border-r border-sidebar-border",
        collapsed ? "w-16" : "w-64",
        className
      )}
      style={{ background: "var(--gradient-sidebar)" }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">TC</span>
            </div>
            <span className="font-display font-semibold text-sidebar-foreground">
              Tennis Club
            </span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <NavItem key={item.to} {...item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Settings at bottom */}
      <div className="px-3 py-4 border-t border-sidebar-border">
        <NavItem to="/settings" icon={Settings} label="Settings" collapsed={collapsed} />
      </div>
    </aside>
  );
}
