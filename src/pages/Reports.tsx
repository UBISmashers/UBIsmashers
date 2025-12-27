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
} from "recharts";
import { Download, TrendingUp, TrendingDown, Calendar } from "lucide-react";

const monthlyExpenses = [
  { month: "Jul", amount: 1850 },
  { month: "Aug", amount: 2100 },
  { month: "Sep", amount: 1920 },
  { month: "Oct", amount: 2280 },
  { month: "Nov", amount: 2050 },
  { month: "Dec", amount: 2450 },
];

const categoryBreakdown = [
  { name: "Court Fees", value: 1800, color: "hsl(152, 58%, 38%)" },
  { name: "Equipment", value: 350, color: "hsl(28, 85%, 55%)" },
  { name: "Refreshments", value: 300, color: "hsl(199, 89%, 48%)" },
];

const attendanceTrend = [
  { date: "Week 1", attendance: 65 },
  { date: "Week 2", attendance: 72 },
  { date: "Week 3", attendance: 58 },
  { date: "Week 4", attendance: 75 },
];

const memberBalances = [
  { name: "Settled", value: 22, color: "hsl(145, 63%, 42%)" },
  { name: "Owes Money", value: 12, color: "hsl(0, 72%, 51%)" },
  { name: "Owed Money", value: 6, color: "hsl(199, 89%, 48%)" },
];

export default function Reports() {
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
            <Select defaultValue="dec2024">
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dec2024">December 2024</SelectItem>
                <SelectItem value="nov2024">November 2024</SelectItem>
                <SelectItem value="oct2024">October 2024</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="gradient-primary text-primary-foreground border-0">
            <CardContent className="p-6">
              <p className="text-sm opacity-80">Total Expenses</p>
              <p className="text-3xl font-bold font-display">$2,450</p>
              <div className="flex items-center gap-1 mt-2">
                <TrendingUp className="h-4 w-4" />
                <span className="text-sm">+12% vs last month</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Per Member Avg</p>
              <p className="text-3xl font-bold font-display">$61.25</p>
              <div className="flex items-center gap-1 mt-2 text-destructive">
                <TrendingDown className="h-4 w-4" />
                <span className="text-sm">-5% vs last month</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Avg Attendance</p>
              <p className="text-3xl font-bold font-display">68%</p>
              <Badge variant="secondary" className="mt-2">
                27 of 40 members
              </Badge>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Court Sessions</p>
              <p className="text-3xl font-bold font-display">24</p>
              <div className="flex items-center gap-1 mt-2 text-success">
                <Calendar className="h-4 w-4" />
                <span className="text-sm">This month</span>
              </div>
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
              <CardTitle>Attendance Trend (December)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
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
