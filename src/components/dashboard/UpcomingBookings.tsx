import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin } from "lucide-react";

interface Booking {
  id: string;
  court: string;
  date: string;
  time: string;
  players: string[];
  status: "confirmed" | "pending" | "cancelled";
}

const upcomingBookings: Booking[] = [
  {
    id: "1",
    court: "Court 1",
    date: "Today",
    time: "6:00 PM - 8:00 PM",
    players: ["John D.", "Mike S.", "Sarah L.", "Tom W."],
    status: "confirmed",
  },
  {
    id: "2",
    court: "Court 2",
    date: "Tomorrow",
    time: "7:00 AM - 9:00 AM",
    players: ["Anna K.", "Bob R."],
    status: "confirmed",
  },
  {
    id: "3",
    court: "Court 1",
    date: "Dec 29",
    time: "5:00 PM - 7:00 PM",
    players: ["Chris P.", "David M.", "Emma W."],
    status: "pending",
  },
];

const statusColors = {
  confirmed: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
};

export function UpcomingBookings() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Upcoming Bookings</CardTitle>
        <Badge variant="secondary" className="font-normal">
          {upcomingBookings.length} scheduled
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {upcomingBookings.map((booking) => (
          <div
            key={booking.id}
            className="flex items-start gap-4 p-4 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors"
          >
            <div className="flex-shrink-0 w-12 h-12 rounded-lg gradient-primary flex items-center justify-center">
              <Calendar className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <h4 className="font-semibold text-sm">{booking.court}</h4>
                <Badge className={statusColors[booking.status]} variant="outline">
                  {booking.status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {booking.date}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {booking.time}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Players: {booking.players.join(", ")}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
