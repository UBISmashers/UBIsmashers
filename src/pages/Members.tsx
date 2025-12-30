import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
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
  Loader2,
  CheckCircle2,
  DollarSign,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Member {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: "admin" | "member";
  status: "active" | "inactive";
  joinDate: string;
  balance: number;
  attendanceRate: number;
}

export default function Members() {
  const { api, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    phone: "",
    temporaryPassword: "",
    role: "member" as "admin" | "member",
  });
  const [createdMemberPassword, setCreatedMemberPassword] = useState<string | null>(null);
  const [selectedMemberForPayments, setSelectedMemberForPayments] = useState<Member | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);

  // Fetch members
  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => api.getMembers(),
  });

  // Fetch payment data for all members (Admin only)
  const { data: paymentData } = useQuery({
    queryKey: ["allPayments"],
    queryFn: () => api.getAllPayments(),
    enabled: user?.role === "admin",
  });

  // Fetch individual member payments when dialog is open
  const { data: memberPayments } = useQuery({
    queryKey: ["memberPayments", selectedMemberForPayments?._id],
    queryFn: () => api.getMemberPayments(selectedMemberForPayments!._id),
    enabled: !!selectedMemberForPayments && isPaymentDialogOpen,
  });

  // Create member mutation
  const createMemberMutation = useMutation({
    mutationFn: (data: any) => api.createMember(data),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      if (response.temporaryPassword) {
        setCreatedMemberPassword(response.temporaryPassword);
      }
      setNewMember({ name: "", email: "", phone: "", temporaryPassword: "", role: "member" });
      toast.success("Member added successfully! Temporary password: " + response.temporaryPassword);
    },
    onError: (error: any) => {
      toast.error("Failed to add member", {
        description: error.message || "An error occurred",
      });
    },
  });

  // Mark payment as paid mutation
  const markPaidMutation = useMutation({
    mutationFn: (data: { expenseId: string; memberId: string }) => api.markPaymentPaid(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allPayments"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Payment marked as paid!");
    },
    onError: (error: any) => {
      toast.error("Failed to mark payment", {
        description: error.message || "An error occurred",
      });
    },
  });

  // Delete member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: (id: string) => api.deleteMember(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Member deleted successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to delete member", {
        description: error.message || "An error occurred",
      });
    },
  });

  const filteredMembers = members.filter(
    (m: Member) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const activeMembers = members.filter((m: Member) => m.status === "active").length;
  const adminCount = members.filter((m: Member) => m.role === "admin").length;

  const handleAddMember = () => {
    if (!newMember.name || !newMember.email || !newMember.phone || !newMember.temporaryPassword) {
      toast.error("Please fill in all fields including temporary password");
      return;
    }
    if (newMember.temporaryPassword.length < 6) {
      toast.error("Temporary password must be at least 6 characters");
      return;
    }
    createMemberMutation.mutate(newMember);
  };

  const handleMarkPaid = (expenseId: string, memberId: string) => {
    markPaidMutation.mutate({ expenseId, memberId });
  };

  const handleViewPayments = (member: Member) => {
    setSelectedMemberForPayments(member);
    setIsPaymentDialogOpen(true);
  };

  // Get payment summary for a member
  const getMemberPaymentSummary = (memberId: string) => {
    if (!paymentData?.memberPayments) return null;
    const memberPayment = paymentData.memberPayments.find(
      (mp: any) => {
        const mpId = mp.member?._id || mp.member?.id;
        return mpId === memberId || mpId?.toString() === memberId;
      }
    );
    return memberPayment || null;
  };

  const handleDeleteMember = (id: string) => {
    if (confirm("Are you sure you want to delete this member?")) {
      deleteMemberMutation.mutate(id);
    }
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
          {user?.role === "admin" && (
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
                  <Input
                    placeholder="Enter member name"
                    value={newMember.name}
                    onChange={(e) =>
                      setNewMember({ ...newMember, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={newMember.email}
                    onChange={(e) =>
                      setNewMember({ ...newMember, email: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    type="tel"
                    placeholder="+1 234-567-8900"
                    value={newMember.phone}
                    onChange={(e) =>
                      setNewMember({ ...newMember, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Temporary Password</Label>
                  <Input
                    type="password"
                    placeholder="Enter temporary password (min 6 characters)"
                    value={newMember.temporaryPassword}
                    onChange={(e) =>
                      setNewMember({ ...newMember, temporaryPassword: e.target.value })
                    }
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground">
                    Member will be required to change this on first login
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Role</Label>
                  <Select
                    value={newMember.role}
                    onValueChange={(value) =>
                      setNewMember({
                        ...newMember,
                        role: value as "admin" | "member",
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="admin" disabled>Admin (Only one allowed)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {createdMemberPassword && (
                  <div className="p-3 bg-primary/10 rounded-md">
                    <p className="text-sm font-medium">Temporary Password Created:</p>
                    <p className="text-sm font-mono mt-1">{createdMemberPassword}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Share this with the member. They must change it on first login.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => {
                        setCreatedMemberPassword(null);
                        setIsAddOpen(false);
                      }}
                    >
                      Close
                    </Button>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  disabled={createMemberMutation.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddMember}
                  disabled={createMemberMutation.isPending}
                >
                  {createMemberMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Member"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          )}
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
                  <TableHead>Expense Share</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredMembers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No members found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((member: Member) => (
                    <TableRow key={member._id}>
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
                              Joined{" "}
                              {new Date(member.joinDate).toLocaleDateString()}
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
                          variant={
                            member.role === "admin" ? "default" : "secondary"
                          }
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
                        {(() => {
                          const paymentSummary = getMemberPaymentSummary(member._id);
                          if (!paymentSummary) return <span className="text-muted-foreground">$0.00</span>;
                          return (
                            <span className="font-medium">
                              ${paymentSummary.totalShare.toFixed(2)}
                            </span>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const paymentSummary = getMemberPaymentSummary(member._id);
                          if (!paymentSummary) {
                            return <Badge variant="secondary">No expenses</Badge>;
                          }
                          const unpaidCount = paymentSummary.totalUnpaid > 0 ? paymentSummary.unpaidCount : 0;
                          if (unpaidCount === 0) {
                            return <Badge className="bg-green-500">All Paid</Badge>;
                          }
                          return (
                            <div className="space-y-1">
                              <Badge variant="destructive">
                                ${paymentSummary.totalUnpaid.toFixed(2)} Unpaid
                              </Badge>
                              <div className="text-xs text-muted-foreground">
                                {unpaidCount} expense{unpaidCount > 1 ? 's' : ''} pending
                              </div>
                            </div>
                          );
                        })()}
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
                          {Math.abs(member.balance).toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {user?.role === "admin" && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleViewPayments(member)}>
                                <DollarSign className="h-4 w-4 mr-2" />
                                View Payments
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteMember(member._id)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Remove
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Payment Details Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Payment Details - {selectedMemberForPayments?.name}
              </DialogTitle>
              <DialogDescription>
                View and manage expense payments for this member
              </DialogDescription>
            </DialogHeader>
            {memberPayments && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Share</p>
                      <p className="text-2xl font-bold">${memberPayments.summary.totalShare.toFixed(2)}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Paid</p>
                      <p className="text-2xl font-bold text-green-600">
                        ${memberPayments.summary.totalPaid.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Total Unpaid</p>
                      <p className="text-2xl font-bold text-red-600">
                        ${memberPayments.summary.totalUnpaid.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Expense Shares List */}
                <div className="space-y-2">
                  <h3 className="font-semibold">Expense Shares</h3>
                  {memberPayments.expenseShares.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No expenses found</p>
                  ) : (
                    <div className="space-y-2">
                      {memberPayments.expenseShares.map((share: any) => (
                        <Card key={share._id || share.id}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium">
                                  {share.expenseId?.description || 'Expense'}
                                </p>
                                <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                                  <span>
                                    ${share.amount.toFixed(2)}
                                  </span>
                                  <span>
                                    {share.expenseId?.date
                                      ? new Date(share.expenseId.date).toLocaleDateString()
                                      : ''}
                                  </span>
                                  <Badge
                                    variant={share.paidStatus ? 'default' : 'destructive'}
                                    className={share.paidStatus ? 'bg-green-500' : ''}
                                  >
                                    {share.paidStatus ? 'Paid' : 'Unpaid'}
                                  </Badge>
                                </div>
                              </div>
                              {!share.paidStatus && user?.role === 'admin' && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    handleMarkPaid(
                                      share.expenseId?._id || share.expenseId?.id,
                                      selectedMemberForPayments!._id
                                    );
                                  }}
                                  disabled={markPaidMutation.isPending}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Mark Paid
                                </Button>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
