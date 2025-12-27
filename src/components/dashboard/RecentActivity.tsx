import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DollarSign, Calendar, UserPlus, ClipboardCheck } from "lucide-react";

interface Activity {
  id: string;
  type: "expense" | "booking" | "member" | "attendance";
  description: string;
  user: {
    name: string;
    avatar?: string;
  };
  time: string;
}

const activities: Activity[] = [
  {
    id: "1",
    type: "expense",
    description: "Added court fee expense of $120",
    user: { name: "John Doe" },
    time: "2 hours ago",
  },
  {
    id: "2",
    type: "attendance",
    description: "Marked 12 members present for today",
    user: { name: "Admin" },
    time: "4 hours ago",
  },
  {
    id: "3",
    type: "booking",
    description: "Booked Court 1 for tomorrow",
    user: { name: "Mike Smith" },
    time: "5 hours ago",
  },
  {
    id: "4",
    type: "member",
    description: "New member Emily joined the group",
    user: { name: "Emily Chen" },
    time: "1 day ago",
  },
  {
    id: "5",
    type: "expense",
    description: "Added refreshments expense of $45",
    user: { name: "Sarah Lee" },
    time: "1 day ago",
  },
];

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
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => {
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
          })}
        </div>
      </CardContent>
    </Card>
  );
}
