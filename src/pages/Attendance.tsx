import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
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
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface Member {
  _id?: string;
  id: string;
  name: string;
  email: string;
  isPresent: boolean;
}

export default function Attendance() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [members, setMembers] = useState<Member[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const dateKey = format(selectedDate, "yyyy-MM-dd");

  // Fetch all members
  const { data: allMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => api.getMembers(),
  });

  // Fetch attendance for selected date
  const { data: attendanceData = [] } = useQuery({
    queryKey: ["attendance", dateKey],
    queryFn: () => api.getAttendanceByDate(dateKey),
  });

  // Create/update attendance mutation
  const saveAttendanceMutation = useMutation({
    mutationFn: (data: any[]) => api.createAttendance(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      setIsSaving(false);
      toast.success("Attendance saved successfully!", {
        description: `${members.filter((m) => m.isPresent).length} members marked present for ${format(selectedDate, "MMMM d, yyyy")}`,
      });
    },
    onError: (error: any) => {
      setIsSaving(false);
      toast.error("Failed to save attendance", {
        description: error.message || "An error occurred",
      });
    },
  });

  // Initialize members with attendance data
  useEffect(() => {
    if (allMembers.length > 0) {
      const membersWithAttendance = allMembers.map((member: any) => {
        const attendance = attendanceData.find(
          (a: any) => a.memberId?._id === member._id || a.memberId?._id === member.id
        );
        return {
          _id: member._id,
          id: member._id || member.id,
          name: member.name,
          email: member.email,
          isPresent: attendance?.isPresent || false,
        };
      });
      setMembers(membersWithAttendance);
    }
  }, [allMembers, attendanceData, dateKey]);

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
    const attendanceData = members.map((member) => ({
      date: dateKey,
      memberId: member._id || member.id,
      isPresent: member.isPresent,
    }));
    saveAttendanceMutation.mutate(attendanceData);
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
            {isSaving || saveAttendanceMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Attendance
              </>
            )}
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
                {(() => {
                  // Get last 7 days of attendance
                  const last7Days = Array.from({ length: 7 }, (_, i) => {
                    const date = new Date();
                    date.setDate(date.getDate() - i);
                    return format(date, "yyyy-MM-dd");
                  });

                  return last7Days.map((date) => {
                    const dayAttendance = attendanceData.filter((a: any) => {
                      const attDate = format(new Date(a.date), "yyyy-MM-dd");
                      return attDate === date;
                    });
                    const present = dayAttendance.filter((a: any) => a.isPresent).length;
                    const total = dayAttendance.length || totalMembers;

                    return (
                      <div
                        key={date}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <span className="text-sm">
                          {format(new Date(date), "MMM d, yyyy")}
                        </span>
                        <Badge
                          variant="outline"
                          className={
                            total > 0 && present / total > 0.5
                              ? "border-success/30 text-success"
                              : "border-warning/30 text-warning"
                          }
                        >
                          {present}/{total}
                        </Badge>
                      </div>
                    );
                  });
                })()}
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
              {membersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : members.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No members found. Add members first.
                </p>
              ) : (
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
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
