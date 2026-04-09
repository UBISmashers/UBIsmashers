import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/dashboard/StatCard";
import { UpcomingBookings } from "@/components/dashboard/UpcomingBookings";
import { RecentActivity } from "@/components/dashboard/RecentActivity";
import {
  Users,
  DollarSign,
  Calendar,
  ClipboardCheck,
  CheckCircle2,
  XCircle,
  BarChart3,
  BadgeDollarSign,
  Settings,
  ReceiptText,
  UserPlus,
  Trophy,
} from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type PeriodFilter = "all" | "custom" | "this_month" | "last_week" | "last_month" | "last_6_months" | "last_year";

const periodLabel: Record<PeriodFilter, string> = {
  all: "All Time",
  custom: "Custom Range",
  this_month: "This Month",
  last_week: "Last Week",
  last_month: "Last Month",
  last_6_months: "Last 6 Months",
  last_year: "Last Year",
};

interface MemberLite {
  name: string;
  status: string;
}

interface ExpenseLite {
  amount: number;
  date: string;
  category?: string;
  isInventory?: boolean;
  isCourtAdvanceBooking?: boolean;
}

interface BookingLite {
  date: string;
}

interface EquipmentPurchaseLite {
  date?: string;
  amount?: number;
  quantityPurchased?: number;
  quantityUsed?: number;
}

interface CourtAdvanceBookingLite {
  date?: string;
  courtBookedDate?: string;
  amount?: number;
  courtsBooked?: number;
}

interface AttendanceLite {
  date: string;
  isPresent: boolean;
}

interface MemberExpenseShare {
  _id?: string;
  id?: string;
  amount: number;
  paidStatus: boolean;
  expenseId?: {
    description?: string;
    date?: string;
  };
}

interface MemberPaymentsResponse {
  summary?: {
    totalShare: number;
    totalPaid: number;
    totalUnpaid: number;
  };
  expenseShares?: MemberExpenseShare[];
}

const Index = () => {
  const { api, user, member } = useAuth();
  const navigate = useNavigate();
  const todayString = format(new Date(), "yyyy-MM-dd");
  const [period, setPeriod] = useState<PeriodFilter>("this_month");
  const [customStartDate, setCustomStartDate] = useState(todayString);
  const [customEndDate, setCustomEndDate] = useState(todayString);

  // Fetch members
  const { data: members = [] } = useQuery<MemberLite[]>({
    queryKey: ["members"],
    queryFn: () => api.getMembers(),
  });

  // Fetch bookings
  const { data: bookings = [] } = useQuery<BookingLite[]>({
    queryKey: ["bookings"],
    queryFn: () => api.getBookings(),
  });

  const { data: publicBillsSummary } = useQuery({
    queryKey: ["publicBills", period, customStartDate, customEndDate],
    queryFn: () =>
      api.getPublicBills(
        period,
        period === "custom" ? { customStartDate, customEndDate } : undefined
      ),
    enabled:
      user?.role === "admin" &&
      (period !== "custom" || (Boolean(customStartDate) && Boolean(customEndDate))),
  });

  const { data: equipmentPurchases = [] } = useQuery<EquipmentPurchaseLite[]>({
    queryKey: ["equipment"],
    queryFn: () => api.getEquipmentPurchases(),
  });

  const { data: courtAdvanceBookings = [] } = useQuery<CourtAdvanceBookingLite[]>({
    queryKey: ["court-advance-bookings"],
    queryFn: () => api.getCourtAdvanceBookings(),
  });

  // Fetch member's own attendance history (for members only)
  const memberId = member?._id || member?.id;
  const { data: memberAttendance = [] } = useQuery<AttendanceLite[]>({
    queryKey: ["memberAttendance", memberId],
    queryFn: () => api.getAttendance({ memberId: memberId }),
    enabled: !!memberId && user?.role === "member",
  });

  // Fetch member's payment data (for members only)
  const { data: memberPayments } = useQuery<MemberPaymentsResponse>({
    queryKey: ["memberPayments", memberId],
    queryFn: () => api.getMemberPayments(memberId!),
    enabled: !!memberId && user?.role === "member",
  });

  // Calculate stats
  const activeMembers = members.filter((m) => m.status === "active").length;
  const totalMembers = members.length;
  const monthlyCourtBookingCost = courtAdvanceBookings
    .filter((booking) => {
      const expenseDate = new Date(booking.date || "");
      const now = new Date();
      return (
        !Number.isNaN(expenseDate.getTime()) &&
        expenseDate.getMonth() === now.getMonth() &&
        expenseDate.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, booking) => sum + Number(booking.amount || 0), 0);

  const monthlyShuttlePurchaseCost = equipmentPurchases
    .filter((purchase) => {
      const purchaseDate = new Date(purchase.date || "");
      const now = new Date();
      return (
        !Number.isNaN(purchaseDate.getTime()) &&
        purchaseDate.getMonth() === now.getMonth() &&
        purchaseDate.getFullYear() === now.getFullYear()
      );
    })
    .reduce((sum, purchase) => sum + Number(purchase.amount || 0), 0);

  const monthlyExpenses = monthlyCourtBookingCost + monthlyShuttlePurchaseCost;
  const totalSessionExpense = ((publicBillsSummary?.sessionHistory as Array<{ amount?: number }> | undefined) || [])
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalEquipmentExpense =
    (((publicBillsSummary?.equipment as Array<{ amount?: number }> | undefined) || [])
      .reduce((sum, item) => sum + Number(item.amount || 0), 0)) +
    (((publicBillsSummary?.courtAdvanceBookings as Array<{ amount?: number }> | undefined) || [])
      .reduce((sum, item) => sum + Number(item.amount || 0), 0));
  const remainingAdvanceAmount =
    Number(publicBillsSummary?.summary?.totalAdvancePaid || 0) - monthlyExpenses;
  
  const thisMonthCourtAdvanceBookings = courtAdvanceBookings.filter((b) => {
    const bookingDate = new Date(b.courtBookedDate || b.date || "");
    const now = new Date();
    return (
      !Number.isNaN(bookingDate.getTime()) &&
      bookingDate.getMonth() === now.getMonth() &&
      bookingDate.getFullYear() === now.getFullYear()
    );
  }).length;

  const totalShuttlesPurchased = equipmentPurchases.reduce(
    (sum: number, purchase: EquipmentPurchaseLite) => sum + Number(purchase.quantityPurchased || 0),
    0
  );
  const totalShuttlesUsed = equipmentPurchases.reduce(
    (sum: number, purchase: EquipmentPurchaseLite) => sum + Number(purchase.quantityUsed || 0),
    0
  );
  const remainingShuttles = Math.max(0, totalShuttlesPurchased - totalShuttlesUsed);

  // Member-specific dashboard
  if (user?.role === "member" && member) {
    const attendanceCount = memberAttendance.filter((a) => a.isPresent).length;
    const totalSessions = memberAttendance.length;
    const attendanceRate = totalSessions > 0 ? (attendanceCount / totalSessions) * 100 : 0;

    // Prepare attendance chart data (last 7 sessions)
    const recentAttendance = memberAttendance
      .slice(0, 7)
      .reverse()
      .map((a) => ({
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
                    {memberPayments.expenseShares.slice(0, 5).map((share) => (
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back! Here's what's happening with our club.
            </p>
          </div>
          <Select value={period} onValueChange={(value) => setPeriod(value as PeriodFilter)}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{periodLabel.all}</SelectItem>
              <SelectItem value="custom">{periodLabel.custom}</SelectItem>
              <SelectItem value="this_month">{periodLabel.this_month}</SelectItem>
              <SelectItem value="last_week">{periodLabel.last_week}</SelectItem>
              <SelectItem value="last_month">{periodLabel.last_month}</SelectItem>
              <SelectItem value="last_6_months">{periodLabel.last_6_months}</SelectItem>
              <SelectItem value="last_year">{periodLabel.last_year}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {period === "custom" && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
            <Input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="w-full sm:w-44"
            />
            <Input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="w-full sm:w-44"
            />
            <span className="text-xs text-muted-foreground">
              Applied: {customStartDate || "-"} to {customEndDate || "-"}
            </span>
          </div>
        )}

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
            description="Court booking cost and shuttle stock cost"
            icon={DollarSign}
          />
          <StatCard
            title="Court Advance Bookings"
            value={thisMonthCourtAdvanceBookings}
            description="Advance bookings this month"
            icon={Calendar}
          />
          <StatCard
            title="Remaining Shuttle"
            value={remainingShuttles}
            description={`${totalShuttlesUsed} used from ${totalShuttlesPurchased} purchased`}
            icon={ClipboardCheck}
            variant="accent"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Billing Overview</h2>
            <span className="text-xs text-muted-foreground">{periodLabel[period]}</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard
              title="Advance Paid"
              value={`$${(publicBillsSummary?.summary?.totalAdvancePaid || 0).toFixed(2)}`}
              description={`${periodLabel[period]} advances collected`}
              icon={BadgeDollarSign}
            />
            <StatCard
              title="Total Equipment Expense"
              value={`$${totalEquipmentExpense.toFixed(2)}`}
              description={`${periodLabel[period]} equipment and advance bookings`}
              icon={ReceiptText}
            />
            <StatCard
              title="Remaining Advance Amount"
              value={`$${remainingAdvanceAmount.toFixed(2)}`}
              description="Total advance minus this month equipment expense"
              icon={BadgeDollarSign}
              variant="accent"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title="Total Session Expense"
              value={`$${totalSessionExpense.toFixed(2)}`}
              description={`${periodLabel[period]} session expenses`}
              icon={DollarSign}
            />
            <StatCard
              title="Total Paid"
              value={`$${(publicBillsSummary?.summary?.totalPaid || 0).toFixed(2)}`}
              description={`${periodLabel[period]} payments received`}
              icon={CheckCircle2}
              variant="accent"
            />
            <StatCard
              title="Outstanding"
              value={`$${(publicBillsSummary?.summary?.totalOutstanding || 0).toFixed(2)}`}
              description={`${periodLabel[period]} unpaid balance`}
              icon={XCircle}
              variant="destructive"
            />
          </div>
        </div>

        <UpcomingBookings />

        {/* Activity Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          <RecentActivity />
          
          {/* Quick Actions Card */}
          <div className="space-y-4">
            <div className="p-6 rounded-xl border bg-gradient-to-br from-secondary/50 to-secondary/30">
              <h3 className="font-display font-semibold text-lg mb-4">Quick Actions</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                <QuickActionButton
                  icon={BarChart3}
                  label="Reports"
                  href="/reports"
                />
                <QuickActionButton
                  icon={BadgeDollarSign}
                  label="Advance"
                  href="/joining-fees"
                />
                <QuickActionButton
                  icon={ReceiptText}
                  label="Bills"
                  href="/bills"
                />
                <QuickActionButton
                  icon={UserPlus}
                  label="Join Requests"
                  href="/joining-requests"
                />
                <QuickActionButton
                  icon={Trophy}
                  label="Tournaments"
                  href="/tournaments"
                />
                <QuickActionButton
                  icon={Settings}
                  label="Settings"
                  href="/settings"
                />
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
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  href: string;
  onClick?: () => void;
}) {
  const navigate = useNavigate();
  
  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(href);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex flex-col items-center justify-center p-4 rounded-lg bg-card border hover:border-primary/30 hover:shadow-md transition-all duration-200 group cursor-pointer"
    >
      <Icon className="h-6 w-6 text-primary mb-2 group-hover:scale-110 transition-transform" />
      <span className="text-sm font-medium">{label}</span>
    </button>
  );
}


export default Index;
