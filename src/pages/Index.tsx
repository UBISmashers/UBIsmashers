import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
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
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const Index = () => {
  const { api, user, member } = useAuth();

  // Fetch members
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => api.getMembers(),
  });

  // Fetch expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => api.getExpenses(),
  });

  // Fetch bookings
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api.getBookings(),
  });

  // Fetch today's attendance
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: todayAttendance = [] } = useQuery({
    queryKey: ["attendance", today],
    queryFn: () => api.getAttendanceByDate(today),
  });

  // Fetch member's own attendance history (for members only)
  const memberId = member?._id || member?.id;
  const { data: memberAttendance = [] } = useQuery({
    queryKey: ["memberAttendance", memberId],
    queryFn: () => api.getAttendance({ memberId: memberId }),
    enabled: !!memberId && user?.role === "member",
  });

  // Fetch member's payment data (for members only)
  const { data: memberPayments } = useQuery({
    queryKey: ["memberPayments", memberId],
    queryFn: () => api.getMemberPayments(memberId!),
    enabled: !!memberId && user?.role === "member",
  });

  // Calculate stats
  const activeMembers = members.filter((m: any) => m.status === "active").length;
  const totalMembers = members.length;
  const monthlyExpenses = expenses
    .filter((e: any) => {
      const expenseDate = new Date(e.date);
      const now = new Date();
      return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum: number, e: any) => sum + e.amount, 0);
  
  const thisMonthBookings = bookings.filter((b: any) => {
    const bookingDate = new Date(b.date);
    const now = new Date();
    return bookingDate.getMonth() === now.getMonth() && bookingDate.getFullYear() === now.getFullYear();
  }).length;

  const todayPresent = todayAttendance.filter((a: any) => a.isPresent).length;
  const todayTotal = todayAttendance.length;

  // Member-specific dashboard
  if (user?.role === "member" && member) {
    const attendanceCount = memberAttendance.filter((a: any) => a.isPresent).length;
    const totalSessions = memberAttendance.length;
    const attendanceRate = totalSessions > 0 ? (attendanceCount / totalSessions) * 100 : 0;

    // Prepare attendance chart data (last 7 sessions)
    const recentAttendance = memberAttendance
      .slice(0, 7)
      .reverse()
      .map((a: any) => ({
        date: format(new Date(a.date), "MMM dd"),
        present: a.isPresent ? 1 : 0,
      }));

    return (
      <MainLayout>
        <div className="space-y-6 animate-fade-in">
          {/* Page Header */}
          <div>
            <h1 className="text-3xl font-display font-bold">My Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {member.name}! Here's your activity summary.
            </p>
          </div>

          {/* Member Stats Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Attendance Rate"
              value={`${attendanceRate.toFixed(0)}%`}
              description={`${attendanceCount} of ${totalSessions} sessions`}
              icon={ClipboardCheck}
              variant="primary"
            />
            <StatCard
              title="Total Expense Share"
              value={`$${memberPayments?.summary?.totalShare.toFixed(2) || "0.00"}`}
              description="Your share of all expenses"
              icon={DollarSign}
            />
            <StatCard
              title="Total Paid"
              value={`$${memberPayments?.summary?.totalPaid.toFixed(2) || "0.00"}`}
              description="Amount you've paid"
              icon={CheckCircle2}
              variant="accent"
            />
            <StatCard
              title="Outstanding"
              value={`$${memberPayments?.summary?.totalUnpaid.toFixed(2) || "0.00"}`}
              description="Amount still owed"
              icon={XCircle}
              variant={memberPayments?.summary?.totalUnpaid > 0 ? "destructive" : "accent"}
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Attendance Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Attendance</CardTitle>
              </CardHeader>
              <CardContent>
                {recentAttendance.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={recentAttendance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 1]} />
                      <Tooltip />
                      <Bar dataKey="present" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-sm">No attendance data yet</p>
                )}
              </CardContent>
            </Card>

            {/* Payment Status */}
            <Card>
              <CardHeader>
                <CardTitle>Payment Status</CardTitle>
              </CardHeader>
              <CardContent>
                {memberPayments?.expenseShares && memberPayments.expenseShares.length > 0 ? (
                  <div className="space-y-3">
                    {memberPayments.expenseShares.slice(0, 5).map((share: any) => (
                      <div
                        key={share._id || share.id}
                        className="flex items-center justify-between p-3 border rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {share.expenseId?.description || "Expense"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {share.expenseId?.date
                              ? format(new Date(share.expenseId.date), "MMM dd, yyyy")
                              : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${share.amount.toFixed(2)}</p>
                          <Badge
                            variant={share.paidStatus ? "default" : "destructive"}
                            className={share.paidStatus ? "bg-green-500" : ""}
                          >
                            {share.paidStatus ? "Paid" : "Unpaid"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    {memberPayments.expenseShares.length > 5 && (
                      <p className="text-sm text-muted-foreground text-center">
                        +{memberPayments.expenseShares.length - 5} more expenses
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-sm">No expenses yet</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Bookings */}
          <UpcomingBookings />
        </div>
      </MainLayout>
    );
  }

  // Admin dashboard (existing code)
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
            value={totalMembers}
            description={`${activeMembers} active members`}
            icon={Users}
            variant="primary"
          />
          <StatCard
            title="Monthly Expenses"
            value={`$${monthlyExpenses.toFixed(2)}`}
            description="Court fees, equipment, refreshments"
            icon={DollarSign}
          />
          <StatCard
            title="This Month's Bookings"
            value={thisMonthBookings}
            description="Bookings this month"
            icon={Calendar}
          />
          <StatCard
            title="Today's Attendance"
            value={todayTotal > 0 ? `${todayPresent}/${todayTotal}` : "0/0"}
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
              <h3 className="font-display font-semibold text-lg mb-4">
                {format(new Date(), "MMMM")} Summary
              </h3>
              <div className="space-y-3">
                {(() => {
                  const monthlyExpensesByCategory = expenses
                    .filter((e: any) => {
                      const expenseDate = new Date(e.date);
                      const now = new Date();
                      return expenseDate.getMonth() === now.getMonth() && expenseDate.getFullYear() === now.getFullYear();
                    })
                    .reduce((acc: any, e: any) => {
                      acc[e.category] = (acc[e.category] || 0) + e.amount;
                      return acc;
                    }, {});

                  const categoryLabels: Record<string, string> = {
                    court: "Total Court Fees",
                    equipment: "Equipment",
                    refreshments: "Refreshments",
                    other: "Other Expenses",
                  };

                  const totalMonthly = Object.values(monthlyExpensesByCategory).reduce((sum: number, val: any) => sum + val, 0);
                  const avgPerMember = totalMonthly > 0 && totalMembers > 0 ? totalMonthly / totalMembers : 0;

                  return (
                    <>
                      {Object.entries(monthlyExpensesByCategory).map(([category, amount]: [string, any]) => (
                        <SummaryRow
                          key={category}
                          label={categoryLabels[category] || category}
                          value={`$${amount.toFixed(2)}`}
                        />
                      ))}
                      {Object.keys(monthlyExpensesByCategory).length === 0 && (
                        <p className="text-sm text-muted-foreground">No expenses this month</p>
                      )}
                      {totalMonthly > 0 && (
                        <div className="border-t pt-3 mt-3">
                          <SummaryRow
                            label="Per Member Average"
                            value={`$${avgPerMember.toFixed(2)}`}
                            highlight
                          />
                        </div>
                      )}
                    </>
                  );
                })()}
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
