import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import {
  CheckCircle2,
  XCircle,
  Users,
  Calendar as CalendarIcon,
  Save,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface Member {
  id: string;
  name: string;
  email: string;
  isPresent: boolean;
}

const initialMembers: Member[] = [
  { id: "1", name: "John Doe", email: "john@email.com", isPresent: true },
  { id: "2", name: "Mike Smith", email: "mike@email.com", isPresent: true },
  { id: "3", name: "Sarah Lee", email: "sarah@email.com", isPresent: true },
  { id: "4", name: "Tom Wilson", email: "tom@email.com", isPresent: false },
  { id: "5", name: "Anna Kumar", email: "anna@email.com", isPresent: true },
  { id: "6", name: "Chris Park", email: "chris@email.com", isPresent: true },
  { id: "7", name: "Emily Chen", email: "emily@email.com", isPresent: false },
  { id: "8", name: "David Brown", email: "david@email.com", isPresent: true },
  { id: "9", name: "Lisa Wang", email: "lisa@email.com", isPresent: true },
  { id: "10", name: "James Miller", email: "james@email.com", isPresent: false },
  { id: "11", name: "Rachel Green", email: "rachel@email.com", isPresent: true },
  { id: "12", name: "Kevin Hart", email: "kevin@email.com", isPresent: true },
];

interface AttendanceHistory {
  date: string;
  present: number;
  total: number;
}

const attendanceHistory: AttendanceHistory[] = [
  { date: "2024-12-26", present: 18, total: 40 },
  { date: "2024-12-25", present: 22, total: 40 },
  { date: "2024-12-24", present: 15, total: 40 },
  { date: "2024-12-23", present: 20, total: 40 },
  { date: "2024-12-22", present: 25, total: 40 },
];

export default function Attendance() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [isSaving, setIsSaving] = useState(false);

  const presentCount = members.filter((m) => m.isPresent).length;
  const totalMembers = members.length;

  const toggleAttendance = (memberId: string) => {
    setMembers((prev) =>
      prev.map((m) =>
        m.id === memberId ? { ...m, isPresent: !m.isPresent } : m
      )
    );
  };

  const markAllPresent = () => {
    setMembers((prev) => prev.map((m) => ({ ...m, isPresent: true })));
  };

  const markAllAbsent = () => {
    setMembers((prev) => prev.map((m) => ({ ...m, isPresent: false })));
  };

  const saveAttendance = async () => {
    setIsSaving(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsSaving(false);
    toast.success("Attendance saved successfully!", {
      description: `${presentCount} members marked present for ${format(selectedDate, "MMMM d, yyyy")}`,
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Attendance</h1>
            <p className="text-muted-foreground mt-1">
              Mark daily attendance for expense calculations
            </p>
          </div>
          <Button onClick={saveAttendance} disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? "Saving..." : "Save Attendance"}
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="gradient-primary text-primary-foreground border-0">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Present Today</p>
                  <p className="text-3xl font-bold font-display">
                    {presentCount}/{totalMembers}
                  </p>
                </div>
                <CheckCircle2 className="h-10 w-10 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Absent Today</p>
                  <p className="text-3xl font-bold font-display text-destructive">
                    {totalMembers - presentCount}
                  </p>
                </div>
                <XCircle className="h-10 w-10 text-destructive/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Per-Member Share
                  </p>
                  <p className="text-3xl font-bold font-display">
                    ${presentCount > 0 ? (120 / presentCount).toFixed(2) : "0"}
                  </p>
                </div>
                <Users className="h-10 w-10 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar & History */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5" />
                  Select Date
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  className="rounded-md"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Recent History
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {attendanceHistory.map((record) => (
                  <div
                    key={record.date}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <span className="text-sm">
                      {format(new Date(record.date), "MMM d, yyyy")}
                    </span>
                    <Badge
                      variant="outline"
                      className={
                        record.present / record.total > 0.5
                          ? "border-success/30 text-success"
                          : "border-warning/30 text-warning"
                      }
                    >
                      {record.present}/{record.total}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Member List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <CardTitle className="text-lg">
                  {format(selectedDate, "EEEE, MMMM d, yyyy")}
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={markAllPresent}>
                    <CheckCircle2 className="h-4 w-4 mr-1" />
                    All Present
                  </Button>
                  <Button variant="outline" size="sm" onClick={markAllAbsent}>
                    <XCircle className="h-4 w-4 mr-1" />
                    All Absent
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2">
                {members.map((member) => (
                  <div
                    key={member.id}
                    onClick={() => toggleAttendance(member.id)}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                      member.isPresent
                        ? "bg-success/10 border-2 border-success/30"
                        : "bg-secondary/30 border-2 border-transparent hover:border-muted-foreground/20"
                    }`}
                  >
                    <Checkbox
                      checked={member.isPresent}
                      onCheckedChange={() => toggleAttendance(member.id)}
                      className="pointer-events-none"
                    />
                    <Avatar className="h-9 w-9">
                      <AvatarFallback
                        className={
                          member.isPresent
                            ? "bg-success/20 text-success"
                            : "bg-secondary text-muted-foreground"
                        }
                      >
                        {member.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">
                        {member.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {member.email}
                      </p>
                    </div>
                    {member.isPresent ? (
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    ) : (
                      <XCircle className="h-5 w-5 text-muted-foreground/40 shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
