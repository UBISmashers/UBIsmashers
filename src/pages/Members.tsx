import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  Search,
  Mail,
  Phone,
  MoreHorizontal,
  Edit,
  Trash2,
  UserCheck,
  UserX,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "member";
  status: "active" | "inactive";
  joinDate: string;
  balance: number;
  attendanceRate: number;
}

const mockMembers: Member[] = [
  { id: "1", name: "John Doe", email: "john@email.com", phone: "+1 234-567-8901", role: "admin", status: "active", joinDate: "2024-01-15", balance: 0, attendanceRate: 92 },
  { id: "2", name: "Mike Smith", email: "mike@email.com", phone: "+1 234-567-8902", role: "member", status: "active", joinDate: "2024-02-20", balance: -45, attendanceRate: 88 },
  { id: "3", name: "Sarah Lee", email: "sarah@email.com", phone: "+1 234-567-8903", role: "member", status: "active", joinDate: "2024-01-10", balance: 32, attendanceRate: 95 },
  { id: "4", name: "Tom Wilson", email: "tom@email.com", phone: "+1 234-567-8904", role: "member", status: "active", joinDate: "2024-03-05", balance: -28, attendanceRate: 75 },
  { id: "5", name: "Anna Kumar", email: "anna@email.com", phone: "+1 234-567-8905", role: "member", status: "active", joinDate: "2024-02-12", balance: 0, attendanceRate: 85 },
  { id: "6", name: "Chris Park", email: "chris@email.com", phone: "+1 234-567-8906", role: "member", status: "inactive", joinDate: "2024-01-25", balance: -15, attendanceRate: 60 },
  { id: "7", name: "Emily Chen", email: "emily@email.com", phone: "+1 234-567-8907", role: "member", status: "active", joinDate: "2024-04-01", balance: 12, attendanceRate: 90 },
  { id: "8", name: "David Brown", email: "david@email.com", phone: "+1 234-567-8908", role: "admin", status: "active", joinDate: "2024-01-05", balance: 0, attendanceRate: 98 },
];

export default function Members() {
  const [members] = useState<Member[]>(mockMembers);
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);

  const filteredMembers = members.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeMembers = members.filter((m) => m.status === "active").length;
  const adminCount = members.filter((m) => m.role === "admin").length;

  const handleAddMember = () => {
    setIsAddOpen(false);
    toast.success("Member added successfully!");
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Members</h1>
            <p className="text-muted-foreground mt-1">
              Manage your tennis group members and their roles
            </p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
                <DialogDescription>
                  Add a new member to your tennis group
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Full Name</Label>
                  <Input placeholder="Enter member name" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" placeholder="email@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input type="tel" placeholder="+1 234-567-8900" />
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select defaultValue="member">
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddMember}>Add Member</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Total Members</p>
              <p className="text-3xl font-bold font-display">{members.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Active Members</p>
              <p className="text-3xl font-bold font-display text-success">
                {activeMembers}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Administrators</p>
              <p className="text-3xl font-bold font-display text-primary">
                {adminCount}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Avg Attendance</p>
              <p className="text-3xl font-bold font-display">
                {Math.round(
                  members.reduce((sum, m) => sum + m.attendanceRate, 0) /
                    members.length
                )}
                %
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Members Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>All Members</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {member.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{member.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Joined {new Date(member.joinDate).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3 text-muted-foreground" />
                          {member.email}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {member.phone}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={member.role === "admin" ? "default" : "secondary"}
                      >
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        {member.status === "active" ? (
                          <UserCheck className="h-4 w-4 text-success" />
                        ) : (
                          <UserX className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span
                          className={
                            member.status === "active"
                              ? "text-success"
                              : "text-muted-foreground"
                          }
                        >
                          {member.status}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${member.attendanceRate}%` }}
                          />
                        </div>
                        <span className="text-sm">{member.attendanceRate}%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span
                        className={`font-medium ${
                          member.balance < 0
                            ? "text-destructive"
                            : member.balance > 0
                            ? "text-success"
                            : "text-muted-foreground"
                        }`}
                      >
                        {member.balance < 0 ? "-" : member.balance > 0 ? "+" : ""}$
                        {Math.abs(member.balance)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Remove
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
