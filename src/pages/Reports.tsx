import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Download, TrendingUp, TrendingDown, Calendar, Loader2 } from "lucide-react";
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, eachWeekOfInterval, startOfWeek, endOfWeek } from "date-fns";
import { toast } from "sonner";

export default function Reports() {
  const { api, user } = useAuth();
  const [selectedPeriod, setSelectedPeriod] = useState<string>("current");
  const [reportType, setReportType] = useState<string>("financial");

  // Calculate date range based on selected period
  const getDateRange = () => {
    const now = new Date();
    if (selectedPeriod === "current") {
      return {
        start: format(startOfMonth(now), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    } else if (selectedPeriod === "last") {
      const lastMonth = subMonths(now, 1);
      return {
        start: format(startOfMonth(lastMonth), "yyyy-MM-dd"),
        end: format(endOfMonth(lastMonth), "yyyy-MM-dd"),
      };
    } else {
      // Last 3 months
      const threeMonthsAgo = subMonths(now, 3);
      return {
        start: format(startOfMonth(threeMonthsAgo), "yyyy-MM-dd"),
        end: format(endOfMonth(now), "yyyy-MM-dd"),
      };
    }
  };

  const dateRange = getDateRange();

  // Fetch expenses
  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses", dateRange],
    queryFn: () => api.getExpenses({ startDate: dateRange.start, endDate: dateRange.end }),
  });

  // Fetch members
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => api.getMembers(),
  });

  // Fetch attendance
  const { data: attendance = [] } = useQuery({
    queryKey: ["attendance", dateRange],
    queryFn: () => api.getAttendance({ startDate: dateRange.start, endDate: dateRange.end }),
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: (data: { type: string; startDate: string; endDate: string }) =>
      api.generateReport({
        type: data.type,
        period: {
          start: data.startDate,
          end: data.endDate,
        },
      }),
    onSuccess: () => {
      toast.success("Report generated successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to generate report", {
        description: error.response?.data?.error || error.message || "An error occurred",
      });
    },
  });

  // Calculate stats from real data
  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
  const activeMembers = members.filter((m: any) => m.status === "active").length;
  const perMemberAvg = activeMembers > 0 ? totalExpenses / activeMembers : 0;

  // Monthly expenses data (last 6 months)
  const monthlyExpenses = (() => {
    const months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date(),
    });

    return months.map((month) => {
      const monthExpenses = expenses.filter((e: any) => {
        const expenseDate = new Date(e.date);
        return (
          expenseDate.getMonth() === month.getMonth() &&
          expenseDate.getFullYear() === month.getFullYear()
        );
      });
      return {
        month: format(month, "MMM"),
        amount: monthExpenses.reduce((sum: number, e: any) => sum + e.amount, 0),
      };
    });
  })();

  // Category breakdown
  const categoryBreakdown = [
    {
      name: "Court Fees",
      value: expenses
        .filter((e: any) => e.category === "court")
        .reduce((sum: number, e: any) => sum + e.amount, 0),
      color: "hsl(152, 58%, 38%)",
    },
    {
      name: "Equipment",
      value: expenses
        .filter((e: any) => e.category === "equipment")
        .reduce((sum: number, e: any) => sum + e.amount, 0),
      color: "hsl(28, 85%, 55%)",
    },
    {
      name: "Refreshments",
      value: expenses
        .filter((e: any) => e.category === "refreshments")
        .reduce((sum: number, e: any) => sum + e.amount, 0),
      color: "hsl(199, 89%, 48%)",
    },
    {
      name: "Other",
      value: expenses
        .filter((e: any) => e.category === "other")
        .reduce((sum: number, e: any) => sum + e.amount, 0),
      color: "hsl(160, 15%, 45%)",
    },
  ].filter((item) => item.value > 0);

  // Member balances breakdown
  const memberBalances = (() => {
    const settled = members.filter((m: any) => Math.abs(m.balance || 0) < 0.01).length;
    const owes = members.filter((m: any) => (m.balance || 0) < -0.01).length;
    const owed = members.filter((m: any) => (m.balance || 0) > 0.01).length;

    return [
      { name: "Settled", value: settled, color: "hsl(145, 63%, 42%)" },
      { name: "Owes Money", value: owes, color: "hsl(0, 72%, 51%)" },
      { name: "Owed Money", value: owed, color: "hsl(199, 89%, 48%)" },
    ];
  })();

  const handleGenerateReport = () => {
    if (user?.role !== "admin") {
      toast.error("Only admins can generate reports");
      return;
    }
    generateReportMutation.mutate({
      type: reportType,
      startDate: dateRange.start,
      endDate: dateRange.end,
    });
  };
  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Reports</h1>
            <p className="text-muted-foreground mt-1">
              View expense summaries, attendance patterns, and financial insights
            </p>
          </div>
          <div className="flex gap-2">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">This Month</SelectItem>
                <SelectItem value="last">Last Month</SelectItem>
                <SelectItem value="last3">Last 3 Months</SelectItem>
              </SelectContent>
            </Select>
            {user?.role === "admin" && (
              <>
                <Select value={reportType} onValueChange={setReportType}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="financial">Financial</SelectItem>
                    <SelectItem value="attendance">Attendance</SelectItem>
                    <SelectItem value="booking">Booking</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  onClick={handleGenerateReport}
                  disabled={generateReportMutation.isPending}
                >
                  {generateReportMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Generate Report
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="gradient-primary text-primary-foreground border-0">
            <CardContent className="p-6">
              <p className="text-sm opacity-80">Total Expenses</p>
              <p className="text-3xl font-bold font-display">${totalExpenses.toFixed(2)}</p>
              <div className="flex items-center gap-1 mt-2">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">
                  {format(new Date(dateRange.start), "MMM d")} -{" "}
                  {format(new Date(dateRange.end), "MMM d")}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Per Member Avg</p>
              <p className="text-3xl font-bold font-display">${perMemberAvg.toFixed(2)}</p>
              <div className="flex items-center gap-1 mt-2 text-destructive">
                <TrendingDown className="h-4 w-4" />
                <span className="text-sm">-5% vs last month</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Active Members</p>
              <p className="text-3xl font-bold font-display">{activeMembers}</p>
              <Badge variant="secondary" className="mt-2">
                {members.length} total
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Pending Expenses</p>
              <p className="text-3xl font-bold font-display text-warning">
                $
                {expenses
                  .filter((e: any) => e.status === "pending")
                  .reduce((sum: number, e: any) => sum + e.amount, 0)
                  .toFixed(2)}
              </p>
              <Badge variant="outline" className="mt-2 border-warning/30 text-warning">
                {expenses.filter((e: any) => e.status === "pending").length} items
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Monthly Expenses Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Expenses Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyExpenses}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar
                      dataKey="amount"
                      fill="hsl(152, 58%, 38%)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Category Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Expense Categories</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px] flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryBreakdown}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3">
                  {categoryBreakdown.map((cat) => (
                    <div key={cat.name} className="flex items-center gap-3">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      <div>
                        <p className="text-sm font-medium">{cat.name}</p>
                        <p className="text-xs text-muted-foreground">
                          ${cat.value}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Attendance Trend */}
          <Card>
            <CardHeader>
              <CardTitle>Attendance Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                {(() => {
                  // Calculate weekly attendance for the selected period
                  const weeks = eachWeekOfInterval(
                    {
                      start: new Date(dateRange.start),
                      end: new Date(dateRange.end),
                    },
                    { weekStartsOn: 1 }
                  );

                  const attendanceTrend = weeks.map((weekStart) => {
                    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
                    const weekAttendance = attendance.filter((a: any) => {
                      const attDate = new Date(a.date);
                      return attDate >= weekStart && attDate <= weekEnd;
                    });
                    const present = weekAttendance.filter((a: any) => a.isPresent).length;
                    const total = weekAttendance.length;
                    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

                    return {
                      date: format(weekStart, "MMM d"),
                      attendance: percentage,
                    };
                  });

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={attendanceTrend}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="date" className="text-xs" />
                        <YAxis className="text-xs" unit="%" />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="attendance"
                          stroke="hsl(28, 85%, 55%)"
                          strokeWidth={3}
                          dot={{ fill: "hsl(28, 85%, 55%)", strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Member Balances */}
          <Card>
            <CardHeader>
              <CardTitle>Member Payment Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] flex items-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={memberBalances}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {memberBalances.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Contributors */}
        <Card>
          <CardHeader>
            <CardTitle>Top Attendance This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-5">
              {[
                { name: "David Brown", rate: 98, sessions: 23 },
                { name: "Sarah Lee", rate: 95, sessions: 22 },
                { name: "John Doe", rate: 92, sessions: 22 },
                { name: "Emily Chen", rate: 90, sessions: 21 },
                { name: "Mike Smith", rate: 88, sessions: 21 },
              ].map((member, i) => (
                <div
                  key={member.name}
                  className="text-center p-4 rounded-lg bg-secondary/30"
                >
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full gradient-primary flex items-center justify-center text-primary-foreground font-bold">
                    #{i + 1}
                  </div>
                  <p className="font-medium text-sm">{member.name}</p>
                  <p className="text-2xl font-bold text-primary">{member.rate}%</p>
                  <p className="text-xs text-muted-foreground">
                    {member.sessions} sessions
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
