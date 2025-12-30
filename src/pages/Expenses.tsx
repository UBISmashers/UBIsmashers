import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  DollarSign,
  Filter,
  Download,
  Trash2,
  Edit,
  Receipt,
  Coffee,
  CircleDollarSign,
  Loader2,
  CheckSquare,
  Square,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Expense {
  _id?: string;
  id: string;
  date: string;
  category: "court" | "equipment" | "refreshments" | "other";
  description: string;
  amount: number;
  paidBy: string | any;
  presentMembers: number;
  perMemberShare: number;
  status: "pending" | "completed";
}

const categoryInfo = {
  court: { icon: CircleDollarSign, color: "text-primary", bg: "bg-primary/10" },
  equipment: { icon: Receipt, color: "text-accent", bg: "bg-accent/10" },
  refreshments: { icon: Coffee, color: "text-info", bg: "bg-info/10" },
  other: { icon: DollarSign, color: "text-muted-foreground", bg: "bg-muted" },
};

export default function Expenses() {
  const { api, user } = useAuth();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [newExpense, setNewExpense] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    category: "court" as "court" | "equipment" | "refreshments" | "other",
    description: "",
    amount: 0,
    selectedMemberIds: [] as string[],
  });

  // Fetch expenses
  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => api.getExpenses(),
  });

  // Fetch members for checkbox list
  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => api.getMembers(),
  });

  // Create expense mutation
  const createExpenseMutation = useMutation({
    mutationFn: (data: any) => api.createExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      setIsAddOpen(false);
      setNewExpense({
        date: format(new Date(), "yyyy-MM-dd"),
        category: "court",
        description: "",
        amount: 0,
        selectedMemberIds: [],
      });
      toast.success("Expense added successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to add expense", {
        description: error.message || "An error occurred",
      });
    },
  });

  // Delete expense mutation
  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) => api.deleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      toast.success("Expense deleted successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to delete expense", {
        description: error.message || "An error occurred",
      });
    },
  });

  const filteredExpenses =
    filterCategory === "all"
      ? expenses
      : expenses.filter((e: any) => e.category === filterCategory);

  const totalExpenses = expenses.reduce((sum: number, e: any) => sum + e.amount, 0);
  const completedExpenses = expenses.filter((e: any) => e.status === "completed");
  const pendingAmount = expenses
    .filter((e: any) => e.status === "pending")
    .reduce((sum: number, e: any) => sum + e.amount, 0);

  const handleAddExpense = () => {
    if (!newExpense.description || newExpense.amount <= 0 || newExpense.selectedMemberIds.length === 0) {
      toast.error("Please fill in all required fields and select at least one member");
      return;
    }
    createExpenseMutation.mutate({
      ...newExpense,
      selectedMembers: newExpense.selectedMemberIds,
    });
  };

  const toggleMemberSelection = (memberId: string) => {
    setNewExpense((prev) => ({
      ...prev,
      selectedMemberIds: prev.selectedMemberIds.includes(memberId)
        ? prev.selectedMemberIds.filter((id) => id !== memberId)
        : [...prev.selectedMemberIds, memberId],
    }));
  };

  const selectAllMembers = () => {
    const allMemberIds = members.map((m: any) => m._id || m.id);
    setNewExpense((prev) => ({
      ...prev,
      selectedMemberIds: allMemberIds,
    }));
  };

  const deselectAllMembers = () => {
    setNewExpense((prev) => ({
      ...prev,
      selectedMemberIds: [],
    }));
  };

  const selectedMembersCount = newExpense.selectedMemberIds.length;
  const perMemberShare = newExpense.amount > 0 && selectedMembersCount > 0
    ? newExpense.amount / selectedMembersCount
    : 0;

  const handleDeleteExpense = (id: string) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      deleteExpenseMutation.mutate(id);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Expenses</h1>
            <p className="text-muted-foreground mt-1">
              Track and manage group expenses with attendance-based splitting
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            {user?.role === "admin" && (
              <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Expense
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add New Expense</DialogTitle>
                  <DialogDescription>
                    Add a shared expense that will be split among present members
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select
                      value={newExpense.category}
                      onValueChange={(value) =>
                        setNewExpense({ ...newExpense, category: value as any })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="court">Court Booking</SelectItem>
                        <SelectItem value="equipment">Equipment</SelectItem>
                        <SelectItem value="refreshments">Refreshments</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input
                      type="date"
                      value={newExpense.date}
                      onChange={(e) =>
                        setNewExpense({ ...newExpense, date: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="Describe the expense..."
                      value={newExpense.description}
                      onChange={(e) =>
                        setNewExpense({ ...newExpense, description: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Amount ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={newExpense.amount || ""}
                      onChange={(e) =>
                        setNewExpense({
                          ...newExpense,
                          amount: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Select Members to Split Expense</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={selectAllMembers}
                          className="h-7 text-xs"
                        >
                          Select All
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={deselectAllMembers}
                          className="h-7 text-xs"
                        >
                          Clear
                        </Button>
                      </div>
                    </div>
                    <ScrollArea className="h-48 rounded-md border p-3">
                      <div className="space-y-2">
                        {members.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No members found. Add members first.
                          </p>
                        ) : (
                          members.map((member: any) => {
                            const memberId = member._id || member.id;
                            const isSelected = newExpense.selectedMemberIds.includes(memberId);
                            return (
                              <div
                                key={memberId}
                                className="flex items-center space-x-2 p-2 rounded hover:bg-secondary/50 cursor-pointer"
                                onClick={() => toggleMemberSelection(memberId)}
                              >
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleMemberSelection(memberId)}
                                />
                                <Label className="flex-1 cursor-pointer font-normal">
                                  {member.name}
                                </Label>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-sm text-muted-foreground">
                      This expense will be split equally among{" "}
                      <span className="font-semibold">{selectedMembersCount}</span> selected
                      member{selectedMembersCount !== 1 ? "s" : ""}. Per member share:{" "}
                      <span className="font-semibold text-primary">
                        ${perMemberShare.toFixed(2)}
                      </span>
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsAddOpen(false)}
                    disabled={createExpenseMutation.isPending}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddExpense}
                    disabled={createExpenseMutation.isPending || selectedMembersCount === 0}
                  >
                    {createExpenseMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      "Add Expense"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total This Month</p>
                  <p className="text-2xl font-bold font-display">${totalExpenses.toFixed(2)}</p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Court Fees</p>
                  <p className="text-2xl font-bold font-display">
                    ${expenses.filter((e: any) => e.category === "court").reduce((s: number, e: any) => s + e.amount, 0).toFixed(2)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-primary/10">
                  <CircleDollarSign className="h-5 w-5 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Equipment</p>
                  <p className="text-2xl font-bold font-display">
                    ${expenses.filter((e: any) => e.category === "equipment").reduce((s: number, e: any) => s + e.amount, 0).toFixed(2)}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-accent/10">
                  <Receipt className="h-5 w-5 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-2xl font-bold font-display text-warning">
                    ${pendingAmount.toFixed(2)}
                  </p>
                </div>
                <Badge variant="outline" className="border-warning/30 text-warning">
                  {expenses.filter((e: any) => e.status === "pending").length} items
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Expenses Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>Expense History</CardTitle>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="court">Court Booking</SelectItem>
                    <SelectItem value="equipment">Equipment</SelectItem>
                    <SelectItem value="refreshments">Refreshments</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredExpenses.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No expenses found. Add your first expense to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Paid By</TableHead>
                    <TableHead>Present</TableHead>
                    <TableHead>Per Member</TableHead>
                    <TableHead>Status</TableHead>
                    {user?.role === "admin" && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExpenses.map((expense: any) => {
                    const catInfo = categoryInfo[expense.category];
                    const Icon = catInfo.icon;
                    return (
                      <TableRow key={expense._id || expense.id}>
                        <TableCell className="font-medium">
                          {format(new Date(expense.date), "MMM d")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded ${catInfo.bg}`}>
                              <Icon className={`h-3.5 w-3.5 ${catInfo.color}`} />
                            </div>
                            <span className="capitalize text-sm">{expense.category}</span>
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {expense.description}
                        </TableCell>
                        <TableCell className="font-semibold">
                          ${expense.amount.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {typeof expense.paidBy === "object"
                            ? expense.paidBy?.name || "Unknown"
                            : expense.paidBy}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{expense.presentMembers}</Badge>
                        </TableCell>
                        <TableCell className="text-primary font-medium">
                          ${expense.perMemberShare.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              expense.status === "completed"
                                ? "border-success/30 text-success"
                                : "border-warning/30 text-warning"
                            }
                          >
                            {expense.status}
                          </Badge>
                        </TableCell>
                        {user?.role === "admin" && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteExpense(expense._id || expense.id)}
                                disabled={deleteExpenseMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
