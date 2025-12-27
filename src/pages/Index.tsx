import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { UpcomingBookings } from "@/components/dashboard/UpcomingBookings";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import { MemberBalances } from "@/components/dashboard/MemberBalances";
import {
  Users,
  DollarSign,
  Calendar,
  ClipboardCheck,
} from "lucide-react";

const Index = () => {
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-display font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back! Here's what's happening with your tennis group.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Members"
            value={40}
            description="Active members this month"
            icon={Users}
            variant="primary"
          />
          <StatCard
            title="Monthly Expenses"
            value="$2,450"
            description="Court fees, equipment, refreshments"
            icon={DollarSign}
            trend={{ value: 12, positive: false }}
          />
          <StatCard
            title="This Month's Bookings"
            value={24}
            description="12 courts booked this week"
            icon={Calendar}
            trend={{ value: 8, positive: true }}
          />
          <StatCard
            title="Today's Attendance"
            value="18/40"
            description="Members marked present"
            icon={ClipboardCheck}
            variant="accent"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Bookings */}
          <div className="lg:col-span-2">
            <UpcomingBookings />
          </div>

          {/* Right Column - Balances */}
          <div>
            <MemberBalances />
          </div>
        </div>

        {/* Activity Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentActivity />
          
          {/* Quick Actions Card */}
          <div className="space-y-4">
            <div className="p-6 rounded-xl border bg-gradient-to-br from-secondary/50 to-secondary/30">
              <h3 className="font-display font-semibold text-lg mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 gap-3">
                <QuickActionButton
                  icon={Calendar}
                  label="Book Court"
                  href="/bookings"
                />
                <QuickActionButton
                  icon={ClipboardCheck}
                  label="Mark Attendance"
                  href="/attendance"
                />
                <QuickActionButton
                  icon={DollarSign}
                  label="Add Expense"
                  href="/expenses"
                />
                <QuickActionButton
                  icon={Users}
                  label="View Members"
                  href="/members"
                />
              </div>
            </div>
            
            {/* Monthly Summary */}
            <div className="p-6 rounded-xl border bg-card">
              <h3 className="font-display font-semibold text-lg mb-4">December Summary</h3>
              <div className="space-y-3">
                <SummaryRow label="Total Court Fees" value="$1,800" />
                <SummaryRow label="Equipment (Shuttlecocks)" value="$350" />
                <SummaryRow label="Refreshments" value="$300" />
                <div className="border-t pt-3 mt-3">
                  <SummaryRow label="Per Member Average" value="$61.25" highlight />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

function QuickActionButton({
  icon: Icon,
  label,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="flex flex-col items-center justify-center p-4 rounded-lg bg-card border hover:border-primary/30 hover:shadow-md transition-all duration-200 group"
    >
      <Icon className="h-6 w-6 text-primary mb-2 group-hover:scale-110 transition-transform" />
      <span className="text-sm font-medium">{label}</span>
    </a>
  );
}

function SummaryRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={highlight ? "font-medium" : "text-muted-foreground text-sm"}>
        {label}
      </span>
      <span className={highlight ? "font-bold text-primary" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}

export default Index;
