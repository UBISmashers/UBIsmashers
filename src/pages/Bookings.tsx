import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Plus, Clock, Users, Loader2 } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { toast } from "sonner";

interface TimeSlot {
  id: string;
  time: string;
  court: string;
  status: "available" | "booked" | "pending";
  bookedBy?: string;
  players?: number;
}

const courts = ["Court 1", "Court 2", "Court 3"];
const timeSlots = [
  "6:00 AM", "7:00 AM", "8:00 AM", "9:00 AM", "10:00 AM", "11:00 AM",
  "4:00 PM", "5:00 PM", "6:00 PM", "7:00 PM", "8:00 PM"
];

export default function Bookings() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [players, setPlayers] = useState<number>(4);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dateKey = format(selectedDate, "yyyy-MM-dd");

  // Fetch bookings for selected date
  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", dateKey],
    queryFn: () => api.getBookings({ date: dateKey }),
  });

  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: (data: any) => api.createBooking(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bookings"] });
      setIsBookingOpen(false);
      setSelectedCourt("");
      setSelectedTime("");
      setPlayers(4);
      toast.success("Booking created successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to create booking", {
        description: error.message || "This time slot may already be booked",
      });
    },
  });

  // Convert API bookings to TimeSlot format
  const dayBookings: TimeSlot[] = bookings.map((booking: any) => ({
    id: booking._id || booking.id,
    time: booking.time,
    court: booking.court,
    status: booking.status,
    bookedBy: booking.bookedBy?.name || "Unknown",
    players: booking.players,
  }));

  const getSlotStatus = (court: string, time: string): TimeSlot => {
    const booking = dayBookings.find(
      (b) => b.court === court && b.time === time
    );
    return booking || { id: `${court}-${time}`, time, court, status: "available" };
  };

  const handleCreateBooking = () => {
    if (!selectedCourt || !selectedTime) {
      toast.error("Please select a court and time");
      return;
    }

    createBookingMutation.mutate({
      date: dateKey,
      court: selectedCourt,
      time: selectedTime,
      players: players,
      status: "booked",
    });
  };

  const statusStyles = {
    available: "bg-secondary/50 hover:bg-primary/10 hover:border-primary/30 cursor-pointer border-2 border-transparent",
    booked: "bg-primary/10 border-2 border-primary/30",
    pending: "bg-warning/10 border-2 border-warning/30",
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Court Bookings</h1>
            <p className="text-muted-foreground mt-1">
              View availability and book courts for your games
            </p>
          </div>
          <Dialog open={isBookingOpen} onOpenChange={setIsBookingOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Booking
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Book a Court</DialogTitle>
                <DialogDescription>
                  Select a court and time slot for your booking
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <p className="text-sm text-muted-foreground">
                    {format(selectedDate, "EEEE, MMMM d, yyyy")}
                  </p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Court</label>
                  <Select value={selectedCourt} onValueChange={setSelectedCourt}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a court" />
                    </SelectTrigger>
                    <SelectContent>
                      {courts.map((court) => (
                        <SelectItem key={court} value={court}>
                          {court}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Time Slot</Label>
                  <Select value={selectedTime} onValueChange={setSelectedTime}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Number of Players</Label>
                  <Input
                    type="number"
                    min="1"
                    value={players}
                    onChange={(e) => setPlayers(parseInt(e.target.value) || 4)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsBookingOpen(false)}
                  disabled={createBookingMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateBooking}
                  disabled={createBookingMutation.isPending || !selectedCourt || !selectedTime}
                >
                  {createBookingMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Booking...
                    </>
                  ) : (
                    "Confirm Booking"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 lg:grid-cols-4">
          {/* Calendar Sidebar */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Select Date</CardTitle>
            </CardHeader>
            <CardContent>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md"
              />
              
              {/* Legend */}
              <div className="mt-6 space-y-2">
                <h4 className="text-sm font-medium mb-3">Legend</h4>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-secondary/50 border"></div>
                  <span className="text-sm text-muted-foreground">Available</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-primary/10 border-2 border-primary/30"></div>
                  <span className="text-sm text-muted-foreground">Booked</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-warning/10 border-2 border-warning/30"></div>
                  <span className="text-sm text-muted-foreground">Pending</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule Grid */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {format(selectedDate, "EEEE, MMMM d, yyyy")}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSelectedDate((d) => addDays(d, -1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedDate(new Date())}
                  >
                    Today
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setSelectedDate((d) => addDays(d, 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  {/* Week View Tabs */}
                  <div className="flex gap-1 mb-6 overflow-x-auto pb-2">
                    {weekDays.map((day) => (
                      <button
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`flex flex-col items-center px-4 py-2 rounded-lg transition-all min-w-[70px] ${
                          isSameDay(day, selectedDate)
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-secondary"
                        }`}
                      >
                        <span className="text-xs font-medium">{format(day, "EEE")}</span>
                        <span className="text-lg font-bold">{format(day, "d")}</span>
                      </button>
                    ))}
                  </div>

                  {/* Court Schedule Grid */}
                  <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left p-3 text-sm font-medium text-muted-foreground w-24">
                        Time
                      </th>
                      {courts.map((court) => (
                        <th
                          key={court}
                          className="text-center p-3 text-sm font-medium"
                        >
                          {court}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlots.map((time) => (
                      <tr key={time} className="border-t">
                        <td className="p-3 text-sm text-muted-foreground font-medium">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {time}
                          </div>
                        </td>
                        {courts.map((court) => {
                          const slot = getSlotStatus(court, time);
                          return (
                            <td key={`${court}-${time}`} className="p-2">
                              <div
                                className={`p-3 rounded-lg text-center transition-all ${
                                  statusStyles[slot.status]
                                }`}
                                onClick={() => {
                                  if (slot.status === "available") {
                                    setSelectedCourt(court);
                                    setSelectedTime(time);
                                    setIsBookingOpen(true);
                                  }
                                }}
                              >
                                {slot.status === "available" ? (
                                  <span className="text-xs text-muted-foreground">
                                    Available
                                  </span>
                                ) : (
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium">
                                      {slot.bookedBy}
                                    </p>
                                    <div className="flex items-center justify-center gap-1">
                                      <Users className="h-3 w-3" />
                                      <span className="text-xs">{slot.players}</span>
                                    </div>
                                    <Badge
                                      variant="outline"
                                      className={`text-[10px] ${
                                        slot.status === "booked"
                                          ? "border-primary/30 text-primary"
                                          : "border-warning/30 text-warning"
                                      }`}
                                    >
                                      {slot.status}
                                    </Badge>
                                  </div>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
