import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DollarSign, Calendar, UserPlus, ClipboardCheck } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";

const typeIcons = {
  expense: DollarSign,
  booking: Calendar,
  member: UserPlus,
  attendance: ClipboardCheck,
};

const typeColors = {
  expense: "bg-accent/10 text-accent",
  booking: "bg-primary/10 text-primary",
  member: "bg-info/10 text-info",
  attendance: "bg-success/10 text-success",
};

export function RecentActivity() {
  const { api } = useAuth();

  const { data: expenses = [] } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => api.getExpenses(),
  });

  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api.getBookings(),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => api.getMembers(),
  });

  // Combine and sort activities
  const activities = [
    ...expenses.slice(0, 3).map((expense: any) => ({
      id: expense._id || expense.id,
      type: "expense" as const,
      description: `Added ${expense.category} expense of $${expense.amount.toFixed(2)}`,
      user: { name: expense.paidBy?.name || "Admin" },
      time: formatDistanceToNow(new Date(expense.createdAt || expense.date), { addSuffix: true }),
      createdAt: new Date(expense.createdAt || expense.date),
    })),
    ...bookings
      .filter((b: any) => b.status === "booked" || b.status === "pending")
      .slice(0, 2)
      .map((booking: any) => ({
        id: booking._id || booking.id,
        type: "booking" as const,
        description: `Booked ${booking.court} for ${format(new Date(booking.date), "MMM d")} at ${booking.time}`,
        user: { name: booking.bookedBy?.name || "Unknown" },
        time: formatDistanceToNow(new Date(booking.createdAt || booking.date), { addSuffix: true }),
        createdAt: new Date(booking.createdAt || booking.date),
      })),
    ...members
      .sort((a: any, b: any) => new Date(b.createdAt || b.joinDate).getTime() - new Date(a.createdAt || a.joinDate).getTime())
      .slice(0, 2)
      .map((member: any) => ({
        id: member._id || member.id,
        type: "member" as const,
        description: `New member ${member.name} joined the group`,
        user: { name: member.name },
        time: formatDistanceToNow(new Date(member.createdAt || member.joinDate), { addSuffix: true }),
        createdAt: new Date(member.createdAt || member.joinDate),
      })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
          ) : (
            activities.map((activity) => {
              const Icon = typeIcons[activity.type];
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${typeColors[activity.type]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">{activity.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={activity.user.avatar} />
                        <AvatarFallback className="text-[10px] bg-secondary">
                          {activity.user.name.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">
                        {activity.user.name} · {activity.time}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
