import { useState } from "react";
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
import { ChevronLeft, ChevronRight, Plus, Clock, Users } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";

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

// Mock bookings data
const mockBookings: Record<string, TimeSlot[]> = {
  "2024-12-27": [
    { id: "1", time: "6:00 AM", court: "Court 1", status: "booked", bookedBy: "John D.", players: 4 },
    { id: "2", time: "6:00 AM", court: "Court 2", status: "available" },
    { id: "3", time: "7:00 AM", court: "Court 1", status: "pending", bookedBy: "Mike S.", players: 2 },
    { id: "4", time: "5:00 PM", court: "Court 1", status: "booked", bookedBy: "Sarah L.", players: 6 },
    { id: "5", time: "6:00 PM", court: "Court 2", status: "booked", bookedBy: "Anna K.", players: 4 },
  ],
};

export default function Bookings() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [selectedCourt, setSelectedCourt] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dateKey = format(selectedDate, "yyyy-MM-dd");
  const dayBookings = mockBookings[dateKey] || [];

  const getSlotStatus = (court: string, time: string): TimeSlot => {
    const booking = dayBookings.find(
      (b) => b.court === court && b.time === time
    );
    return booking || { id: `${court}-${time}`, time, court, status: "available" };
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
                  <label className="text-sm font-medium">Time Slot</label>
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsBookingOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={() => setIsBookingOpen(false)}>
                  Confirm Booking
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
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
