import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin } from "lucide-react";
import { format, isToday, isTomorrow, addDays, isAfter, isBefore } from "date-fns";
import { Loader2 } from "lucide-react";

const statusColors: Record<string, string> = {
  booked: "bg-success/10 text-success border-success/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  available: "bg-muted/10 text-muted-foreground border-muted/20",
};

export function UpcomingBookings() {
  const { api } = useAuth();

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings"],
    queryFn: () => api.getBookings(),
  });

  // Get upcoming bookings (from today onwards, status booked or pending)
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcomingBookings = bookings
    .filter((b: any) => {
      const bookingDate = new Date(b.date);
      bookingDate.setHours(0, 0, 0, 0);
      return (
        (bookingDate.getTime() >= now.getTime()) &&
        (b.status === "booked" || b.status === "pending")
      );
    })
    .sort((a: any, b: any) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return a.time.localeCompare(b.time);
    })
    .slice(0, 5)
    .map((booking: any) => {
      const bookingDate = new Date(booking.date);
      let dateLabel = format(bookingDate, "MMM d");
      if (isToday(bookingDate)) dateLabel = "Today";
      else if (isTomorrow(bookingDate)) dateLabel = "Tomorrow";

      return {
        id: booking._id || booking.id,
        court: booking.court,
        date: dateLabel,
        time: booking.time,
        players: booking.players || 0,
        status: booking.status === "booked" ? "confirmed" : booking.status,
        bookedBy: booking.bookedBy?.name || "Unknown",
      };
    });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Bookings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Upcoming Bookings</CardTitle>
        <Badge variant="secondary" className="font-normal">
          {upcomingBookings.length} scheduled
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        {upcomingBookings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No upcoming bookings</p>
        ) : (
          upcomingBookings.map((booking) => (
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
                  {typeof booking.players === "number" 
                    ? `${booking.players} player${booking.players !== 1 ? "s" : ""}`
                    : `Booked by: ${booking.bookedBy}`}
                </p>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
