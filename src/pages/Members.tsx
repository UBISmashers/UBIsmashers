import { useMemo, useState } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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
  DollarSign,
  Pencil,
  CheckCheck,
  SlidersHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

type MemberSortOption =
  | "name_asc"
  | "name_desc"
  | "recent"
  | "oldest"
  | "expense_low"
  | "expense_high"
  | "attendance_high"
  | "attendance_low";
type MemberStatusFilter = "all" | "active" | "inactive";
type BillsFilter = "all" | "visible" | "hidden";
type PaymentStatusFilter = "all" | "fully_paid" | "pending" | "partial" | "outstanding";
type RoleFilter = "all" | "admin" | "member";
type AttendanceFilter = "all" | "above_75" | "below_50";
type DerivedPaymentStatus = "fully_paid" | "pending" | "partial" | "outstanding";

const normalizeSearchText = (value: string | number | null | undefined) =>
  String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");

interface Member {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  role: "admin" | "member";
  status: "active" | "inactive";
  hiddenFromPublicBills?: boolean;
  joinDate: string;
  balance: number;
  attendanceRate: number;
}

interface JoiningFeeItem {
  _id?: string;
  id?: string;
  memberId?: string | { _id?: string; id?: string; name?: string };
  amount?: number;
  sourceType?: string;
  excludeFromAdvanceTotals?: boolean;
}

export default function Members() {
  const { api, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<MemberSortOption>("name_asc");
  const [statusFilter, setStatusFilter] = useState<MemberStatusFilter>("all");
  const [billsFilter, setBillsFilter] = useState<BillsFilter>("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<PaymentStatusFilter>("all");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [attendanceFilter, setAttendanceFilter] = useState<AttendanceFilter>("all");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newMember, setNewMember] = useState({
    name: "",
    email: "",
    phone: "",
    role: "member" as "admin" | "member",
    joiningFeeAmount: 0,
    joiningFeeNote: "",
  });
  const [selectedMemberForPayments, setSelectedMemberForPayments] = useState<Member | null>(null);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [isPaymentEditMode, setIsPaymentEditMode] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [subtractAdvanceFromTotals, setSubtractAdvanceFromTotals] = useState(true);

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
      setNewMember({ name: "", email: "", phone: "", role: "member", joiningFeeAmount: 0, joiningFeeNote: "" });
      toast.success("Member added successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to add member", {
        description: error.message || "An error occurred",
      });
    },
  });

  // Update payment status mutation
  const updatePaymentStatusMutation = useMutation({
    mutationFn: (data: { expenseId: string; memberId: string; paidStatus: boolean }) =>
      api.updatePaymentStatus(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["allPayments"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["memberPayments"] });
      toast.success("Payment status updated!");
    },
    onError: (error: any) => {
      toast.error("Failed to update payment", {
        description: error.message || "An error occurred",
      });
    },
  });

  const { data: joiningFees = [] } = useQuery<JoiningFeeItem[]>({
    queryKey: ["joining-fees"],
    queryFn: () => api.getJoiningFees(),
    enabled: user?.role === "admin",
  });

  const markAllMemberPaidMutation = useMutation({
    mutationFn: (memberId: string) => api.markAllMemberPaymentsPaid(memberId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ["allPayments"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["memberPayments"] });

      if (response?.updatedCount > 0) {
        toast.success(`Marked ${response.updatedCount} split expense(s) as paid`);
      } else {
        toast.info("All expenses are already paid for this member");
      }
    },
    onError: (error: any) => {
      toast.error("Failed to mark all payments", {
        description: error.message || "An error occurred",
      });
    },
  });

  // Update member status mutation
  const updateMemberStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "inactive" }) =>
      api.updateMember(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      toast.success("Member status updated successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to update member status", {
        description: error.message || "An error occurred",
      });
    },
  });

  const toggleMemberBillsVisibilityMutation = useMutation({
    mutationFn: ({ id, hiddenFromPublicBills }: { id: string; hiddenFromPublicBills: boolean }) =>
      api.updateMember(id, { hiddenFromPublicBills }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["publicBills"] });
      toast.success(
        variables.hiddenFromPublicBills
          ? "Member hidden from public bills successfully!"
          : "Member unhidden from public bills successfully!"
      );
    },
    onError: (error: any) => {
      toast.error("Failed to update member bills visibility", {
        description: error.message || "An error occurred",
      });
    },
  });

  // Delete member mutation
  const deleteMemberMutation = useMutation({
    mutationFn: (data: { id: string; subtractAdvanceFromTotals: boolean }) =>
      api.deleteMember(data.id, {
        subtractAdvanceFromTotals: data.subtractAdvanceFromTotals,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["joining-fees"] });
      queryClient.invalidateQueries({ queryKey: ["publicBills"] });
      queryClient.invalidateQueries({ queryKey: ["allPayments"] });
      setIsDeleteDialogOpen(false);
      setMemberToDelete(null);
      toast.success("Member deleted successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to delete member", {
        description: error.message || "An error occurred",
      });
    },
  });

  const activeMembers = members.filter((m: Member) => m.status === "active").length;
  const adminCount = members.filter((m: Member) => m.role === "admin").length;

  const handleAddMember = () => {
    if (!newMember.name) {
      toast.error("Please enter name");
      return;
    }
    createMemberMutation.mutate(newMember);
  };

  const handlePaymentStatusUpdate = (expenseId: string, memberId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    const actionLabel = nextStatus ? "paid" : "unpaid";
    const confirmed = confirm(`Mark this expense as ${actionLabel} for this member?`);
    if (!confirmed) return;

    updatePaymentStatusMutation.mutate({
      expenseId,
      memberId,
      paidStatus: nextStatus,
    });
  };

  const handleViewPayments = (member: Member) => {
    setSelectedMemberForPayments(member);
    setIsPaymentEditMode(false);
    setIsPaymentDialogOpen(true);
  };

  const handleMarkAllPaidForMember = () => {
    if (!selectedMemberForPayments?._id) return;
    const confirmed = confirm(`Mark all unpaid split expenses as paid for ${selectedMemberForPayments.name}?`);
    if (!confirmed) return;
    markAllMemberPaidMutation.mutate(selectedMemberForPayments._id);
  };

  const paymentByMemberId = useMemo(() => {
    const map = new Map<string, any>();
    paymentData?.memberPayments?.forEach((memberPayment: any) => {
      const memberId = memberPayment.member?._id || memberPayment.member?.id;
      if (memberId) map.set(memberId.toString(), memberPayment);
    });
    return map;
  }, [paymentData]);

  // Get payment summary for a member
  const getMemberPaymentSummary = (memberId: string) => {
    return paymentByMemberId.get(memberId) || null;
  };

  const getExpenseShare = (memberId: string) => Number(getMemberPaymentSummary(memberId)?.totalShare || 0);

  const getDerivedPaymentStatus = (member: Member): DerivedPaymentStatus => {
    const paymentSummary = getMemberPaymentSummary(member._id);
    const totalShare = Number(paymentSummary?.totalShare || 0);
    const totalPaid = Number(paymentSummary?.totalPaid || 0);
    const totalUnpaid = Number(paymentSummary?.totalUnpaid ?? Math.max(Number(member.balance || 0), 0));

    if (totalUnpaid <= 0) return "fully_paid";
    if (totalPaid > 0 && totalUnpaid > 0) return "partial";
    if (totalShare > 0 && totalPaid <= 0 && totalUnpaid > 0) return "outstanding";
    return "pending";
  };

  const filteredMembers = useMemo(() => {
    const normalizedQuery = normalizeSearchText(searchQuery);

    const matchesPaymentFilter = (member: Member) => {
      if (paymentStatusFilter === "all") return true;
      const derivedStatus = getDerivedPaymentStatus(member);
      if (paymentStatusFilter === "pending") {
        return ["pending", "partial", "outstanding"].includes(derivedStatus);
      }
      return derivedStatus === paymentStatusFilter;
    };

    return [...members]
      .filter((member: Member) => {
        const searchable = normalizeSearchText(
          `${member.name} ${member.email || ""} ${member.phone || ""} ${member._id}`
        );

        return (
          (!normalizedQuery || searchable.includes(normalizedQuery)) &&
          (statusFilter === "all" || member.status === statusFilter) &&
          (billsFilter === "all" ||
            (billsFilter === "visible" && !member.hiddenFromPublicBills) ||
            (billsFilter === "hidden" && member.hiddenFromPublicBills)) &&
          (roleFilter === "all" || member.role === roleFilter) &&
          (attendanceFilter === "all" ||
            (attendanceFilter === "above_75" && Number(member.attendanceRate || 0) > 75) ||
            (attendanceFilter === "below_50" && Number(member.attendanceRate || 0) < 50)) &&
          matchesPaymentFilter(member)
        );
      })
      .sort((a: Member, b: Member) => {
        if (sortBy === "name_asc" || sortBy === "name_desc") {
          const direction = sortBy === "name_asc" ? 1 : -1;
          return normalizeSearchText(a.name).localeCompare(normalizeSearchText(b.name)) * direction;
        }
        if (sortBy === "recent" || sortBy === "oldest") {
          const direction = sortBy === "recent" ? -1 : 1;
          return (new Date(a.joinDate).getTime() - new Date(b.joinDate).getTime()) * direction;
        }
        if (sortBy === "expense_low" || sortBy === "expense_high") {
          const direction = sortBy === "expense_low" ? 1 : -1;
          return (getExpenseShare(a._id) - getExpenseShare(b._id)) * direction;
        }
        if (sortBy === "attendance_high" || sortBy === "attendance_low") {
          const direction = sortBy === "attendance_high" ? -1 : 1;
          return (Number(a.attendanceRate || 0) - Number(b.attendanceRate || 0)) * direction;
        }
        return 0;
      });
  }, [
    attendanceFilter,
    billsFilter,
    members,
    paymentByMemberId,
    paymentStatusFilter,
    roleFilter,
    searchQuery,
    sortBy,
    statusFilter,
  ]);

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    sortBy !== "name_asc" ||
    statusFilter !== "all" ||
    billsFilter !== "all" ||
    paymentStatusFilter !== "all" ||
    roleFilter !== "all" ||
    attendanceFilter !== "all";

  const clearFilters = () => {
    setSearchQuery("");
    setSortBy("name_asc");
    setStatusFilter("all");
    setBillsFilter("all");
    setPaymentStatusFilter("all");
    setRoleFilter("all");
    setAttendanceFilter("all");
  };

  const getMemberAdvanceAmount = (memberId: string) => {
    return joiningFees.reduce((sum, fee) => {
      const feeMemberId =
        typeof fee.memberId === "string"
          ? fee.memberId
          : fee.memberId?._id || fee.memberId?.id || "";
      const isDirectAdvance = fee.sourceType !== "expense_share_payment";
      if (!feeMemberId || feeMemberId !== memberId || !isDirectAdvance) return sum;
      if (fee.excludeFromAdvanceTotals) return sum;
      return sum + Number(fee.amount || 0);
    }, 0);
  };

  const handleDeleteMember = (member: Member) => {
    const advanceAmount = getMemberAdvanceAmount(member._id);
    setMemberToDelete(member);
    setSubtractAdvanceFromTotals(advanceAmount > 0);
    setIsDeleteDialogOpen(true);
  };

  const confirmDeleteMember = () => {
    if (!memberToDelete?._id) return;
    const advanceAmount = getMemberAdvanceAmount(memberToDelete._id);
    deleteMemberMutation.mutate({
      id: memberToDelete._id,
      subtractAdvanceFromTotals: advanceAmount > 0 ? subtractAdvanceFromTotals : false,
    });
  };

  const formatExpenseTitle = (expense: any) => {
    if (expense?.category === "court") {
      const shuttlesUsed = expense.shuttlesUsed ?? 0;
      const perShuttleCost = expense.perShuttleCost ?? 0;
      const courtBookingCost = expense.courtBookingCost ?? 0;
      return `${shuttlesUsed}*${perShuttleCost}+${courtBookingCost}`;
    }
    return expense?.description || "Expense";
  };

  const renderFilterControls = (isMobile = false) => (
    <div className={isMobile ? "space-y-3" : "flex flex-wrap items-center gap-3"}>
      <div className={isMobile ? "relative" : "relative min-w-[220px] flex-1"}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      <Select value={sortBy} onValueChange={(value) => setSortBy(value as MemberSortOption)}>
        <SelectTrigger className={isMobile ? "w-full" : "w-[170px]"}>
          <SelectValue placeholder="Sort By" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="name_asc">Name (A-Z)</SelectItem>
          <SelectItem value="name_desc">Name (Z-A)</SelectItem>
          <SelectItem value="recent">Recently Joined</SelectItem>
          <SelectItem value="oldest">Oldest Members</SelectItem>
          <SelectItem value="expense_low">Expense: Lowest</SelectItem>
          <SelectItem value="expense_high">Expense: Highest</SelectItem>
          <SelectItem value="attendance_high">Attendance: Highest</SelectItem>
          <SelectItem value="attendance_low">Attendance: Lowest</SelectItem>
        </SelectContent>
      </Select>
      <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as MemberStatusFilter)}>
        <SelectTrigger className={isMobile ? "w-full" : "w-[150px]"}>
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Members</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="inactive">Inactive</SelectItem>
        </SelectContent>
      </Select>
      <Select value={billsFilter} onValueChange={(value) => setBillsFilter(value as BillsFilter)}>
        <SelectTrigger className={isMobile ? "w-full" : "w-[165px]"}>
          <SelectValue placeholder="Bills" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Bills</SelectItem>
          <SelectItem value="visible">Visible in Bills</SelectItem>
          <SelectItem value="hidden">Hidden in Bills</SelectItem>
        </SelectContent>
      </Select>
      <Select
        value={paymentStatusFilter}
        onValueChange={(value) => setPaymentStatusFilter(value as PaymentStatusFilter)}
      >
        <SelectTrigger className={isMobile ? "w-full" : "w-[180px]"}>
          <SelectValue placeholder="Payment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Payments</SelectItem>
          <SelectItem value="fully_paid">Fully Paid</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="partial">Partial Payment</SelectItem>
          <SelectItem value="outstanding">Outstanding Balance</SelectItem>
        </SelectContent>
      </Select>
      <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as RoleFilter)}>
        <SelectTrigger className={isMobile ? "w-full" : "w-[135px]"}>
          <SelectValue placeholder="Role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Roles</SelectItem>
          <SelectItem value="admin">Admin</SelectItem>
          <SelectItem value="member">Member</SelectItem>
        </SelectContent>
      </Select>
      <Select value={attendanceFilter} onValueChange={(value) => setAttendanceFilter(value as AttendanceFilter)}>
        <SelectTrigger className={isMobile ? "w-full" : "w-[170px]"}>
          <SelectValue placeholder="Attendance" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Attendance</SelectItem>
          <SelectItem value="above_75">Above 75%</SelectItem>
          <SelectItem value="below_50">Below 50%</SelectItem>
        </SelectContent>
      </Select>
      <Button variant="outline" onClick={clearFilters} disabled={!hasActiveFilters} className={isMobile ? "w-full" : ""}>
        Clear Filters
      </Button>
    </div>
  );

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
                  <Label>Email (Optional)</Label>
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
                  <Label>Phone (Optional)</Label>
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
                <div className="space-y-2">
                  <Label>Advance (Optional)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={newMember.joiningFeeAmount || ""}
                    onChange={(e) =>
                      setNewMember({
                        ...newMember,
                        joiningFeeAmount: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Advance Note (Optional)</Label>
                  <Input
                    placeholder="Payment note..."
                    value={newMember.joiningFeeNote}
                    onChange={(e) =>
                      setNewMember({ ...newMember, joiningFeeNote: e.target.value })
                    }
                  />
                </div>
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
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>All Members</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  Showing {filteredMembers.length} of {members.length} members
                </p>
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="md:hidden">
                    <SlidersHorizontal className="mr-2 h-4 w-4" />
                    Filters
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[88vw] overflow-y-auto sm:max-w-sm">
                  <SheetHeader>
                    <SheetTitle>Filters & Sort</SheetTitle>
                    <SheetDescription>Refine the member list instantly.</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">{renderFilterControls(true)}</div>
                </SheetContent>
              </Sheet>
            </div>
          </CardHeader>
          <CardContent>
            <div className="mb-4 hidden md:block">{renderFilterControls()}</div>
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
                            {member.email || "-"}
                          </div>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3" />
                            {member.phone || "-"}
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
                          <Badge variant={member.hiddenFromPublicBills ? "outline" : "secondary"}>
                            {member.hiddenFromPublicBills ? "Hidden in Bills" : "Visible in Bills"}
                          </Badge>
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
                              <DropdownMenuItem
                                onClick={() =>
                                  toggleMemberBillsVisibilityMutation.mutate({
                                    id: member._id,
                                    hiddenFromPublicBills: !member.hiddenFromPublicBills,
                                  })
                                }
                                disabled={toggleMemberBillsVisibilityMutation.isPending}
                              >
                                {member.hiddenFromPublicBills ? (
                                  <>
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Unhide in Bills
                                  </>
                                ) : (
                                  <>
                                    <UserX className="h-4 w-4 mr-2" />
                                    Hide in Bills
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateMemberStatusMutation.mutate({
                                    id: member._id,
                                    status: member.status === "active" ? "inactive" : "active",
                                  })
                                }
                                disabled={updateMemberStatusMutation.isPending}
                              >
                                {member.status === "active" ? (
                                  <>
                                    <UserX className="h-4 w-4 mr-2" />
                                    Deactivate
                                  </>
                                ) : (
                                  <>
                                    <UserCheck className="h-4 w-4 mr-2" />
                                    Activate
                                  </>
                                )}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteMember(member)}
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
        <Dialog
          open={isPaymentDialogOpen}
          onOpenChange={(open) => {
            setIsPaymentDialogOpen(open);
            if (!open) {
              setIsPaymentEditMode(false);
            }
          }}
        >
          <DialogContent className="max-w-2xl w-[95vw] max-h-[80vh] overflow-y-auto">
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

                {user?.role === "admin" && (
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      onClick={handleMarkAllPaidForMember}
                      disabled={
                        markAllMemberPaidMutation.isPending ||
                        updatePaymentStatusMutation.isPending ||
                        memberPayments.summary.totalUnpaid <= 0
                      }
                    >
                      <CheckCheck className="h-4 w-4 mr-2" />
                      {memberPayments.summary.totalUnpaid <= 0 ? "All Paid" : "Mark All Paid"}
                    </Button>
                    <Button
                      variant={isPaymentEditMode ? "default" : "outline"}
                      onClick={() => setIsPaymentEditMode((prev) => !prev)}
                      disabled={markAllMemberPaidMutation.isPending || updatePaymentStatusMutation.isPending}
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      {isPaymentEditMode ? "Done Editing" : "Edit"}
                    </Button>
                  </div>
                )}

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
                                  {formatExpenseTitle(share.expenseId)}
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
                              {user?.role === 'admin' && isPaymentEditMode && (
                                <Button
                                  size="sm"
                                  onClick={() => {
                                    handlePaymentStatusUpdate(
                                      share.expenseId?._id || share.expenseId?.id,
                                      selectedMemberForPayments!._id,
                                      share.paidStatus
                                    );
                                  }}
                                  variant={share.paidStatus ? "outline" : "default"}
                                  disabled={
                                    updatePaymentStatusMutation.isPending ||
                                    markAllMemberPaidMutation.isPending
                                  }
                                >
                                  <Pencil className="h-4 w-4 mr-2" />
                                  {share.paidStatus ? "Mark Unpaid" : "Mark Paid"}
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

        <Dialog
          open={isDeleteDialogOpen}
          onOpenChange={(open) => {
            setIsDeleteDialogOpen(open);
            if (!open) {
              setMemberToDelete(null);
            }
          }}
        >
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Delete Member</DialogTitle>
              <DialogDescription>
                The member will be removed from the member list, but past expenses and payment history will be kept.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">{memberToDelete?.name}</p>
                <p className="text-muted-foreground">
                  This member will appear as <span className="font-medium">name + (deleted member)</span> in historical records.
                </p>
              </div>
              {memberToDelete && getMemberAdvanceAmount(memberToDelete._id) > 0 ? (
                <div className="flex items-start gap-3 rounded-md border p-3">
                  <Checkbox
                    id="subtract-advance-on-delete"
                    checked={subtractAdvanceFromTotals}
                    onCheckedChange={(checked) => setSubtractAdvanceFromTotals(checked === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-1">
                    <Label htmlFor="subtract-advance-on-delete" className="cursor-pointer">
                      Subtract this member&apos;s advance from total advance amount
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Advance found: ${getMemberAdvanceAmount(memberToDelete._id).toFixed(2)}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No direct advance payment found for this member.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setMemberToDelete(null);
                }}
                disabled={deleteMemberMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDeleteMember}
                disabled={deleteMemberMutation.isPending}
              >
                {deleteMemberMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Member"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
