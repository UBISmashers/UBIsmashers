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
  Boxes,
  Loader2,
  CheckSquare,
  Square,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { exportToExcel } from "@/lib/exportUtils";

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
  isInventory?: boolean;
  itemName?: string;
  quantityPurchased?: number;
  quantityUsed?: number;
}

const categoryInfo = {
  court: { icon: CircleDollarSign, color: "text-primary", bg: "bg-primary/10" },
  equipment: { icon: Receipt, color: "text-accent", bg: "bg-accent/10" },
  refreshments: { icon: Coffee, color: "text-info", bg: "bg-info/10" },
  other: { icon: DollarSign, color: "text-muted-foreground", bg: "bg-muted" },
};

export default function Expenses() {
  const { api, user, member } = useAuth();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAddEquipmentOpen, setIsAddEquipmentOpen] = useState(false);
  const [isUsageOpen, setIsUsageOpen] = useState(false);
  const [usageTarget, setUsageTarget] = useState<any>(null);
  const [usageValue, setUsageValue] = useState(0);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [newExpense, setNewExpense] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    category: "court" as "court" | "equipment" | "refreshments" | "other",
    description: "",
    amount: 0,
    selectedMemberIds: [] as string[],
  });
  const [newEquipment, setNewEquipment] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    itemName: "",
    description: "",
    amount: 0,
    quantityPurchased: 1,
    selectedMemberIds: [] as string[],
  });

  // Fetch expenses - filter by member if not admin
  const { data: allExpenses = [], isLoading } = useQuery({
    queryKey: ["expenses"],
    queryFn: () => api.getExpenses(),
  });

  // Filter expenses based on role
  const baseExpenses = user?.role === "admin" 
    ? allExpenses 
    : allExpenses.filter((expense: any) => {
        // Members should only see expenses where they are in selectedMembers
        const memberId = member?._id || member?.id;
        if (!memberId) return false;
        
        const selectedMemberIds = expense.selectedMembers?.map((m: any) => 
          m._id || m.id || m
        ) || [];
        
        return selectedMemberIds.some((id: any) => 
          id?.toString() === memberId.toString()
        );
      });

  const expenses = baseExpenses.filter((expense: any) => !expense.isInventory);

  const { data: equipmentPurchases = [], isLoading: isEquipmentLoading } = useQuery({
    queryKey: ["equipment"],
    queryFn: () => api.getEquipmentPurchases(),
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

  const createEquipmentMutation = useMutation({
    mutationFn: (data: any) => api.createEquipmentPurchase(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      setIsAddEquipmentOpen(false);
      setNewEquipment({
        date: format(new Date(), "yyyy-MM-dd"),
        itemName: "",
        description: "",
        amount: 0,
        quantityPurchased: 1,
        selectedMemberIds: [],
      });
      toast.success("Equipment purchase added successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to add equipment purchase", {
        description: error.message || "An error occurred",
      });
    },
  });

  const updateEquipmentUsageMutation = useMutation({
    mutationFn: (data: { id: string; quantityUsed: number }) =>
      api.updateEquipmentUsage(data.id, data.quantityUsed),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      setIsUsageOpen(false);
      setUsageTarget(null);
      toast.success("Usage updated successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to update usage", {
        description: error.message || "An error occurred",
      });
    },
  });

  const deleteEquipmentMutation = useMutation({
    mutationFn: (id: string) => api.deleteEquipmentPurchase(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast.success("Equipment purchase deleted successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to delete equipment purchase", {
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

  const handleAddEquipment = () => {
    if (!newEquipment.itemName || newEquipment.amount <= 0 || newEquipment.quantityPurchased <= 0 || newEquipment.selectedMemberIds.length === 0) {
      toast.error("Please fill in all required fields and select at least one member");
      return;
    }
    createEquipmentMutation.mutate({
      date: newEquipment.date,
      itemName: newEquipment.itemName,
      description: newEquipment.description,
      amount: newEquipment.amount,
      quantityPurchased: newEquipment.quantityPurchased,
      selectedMembers: newEquipment.selectedMemberIds,
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

  const toggleEquipmentMemberSelection = (memberId: string) => {
    setNewEquipment((prev) => ({
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

  const selectAllEquipmentMembers = () => {
    const allMemberIds = members.map((m: any) => m._id || m.id);
    setNewEquipment((prev) => ({
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

  const deselectAllEquipmentMembers = () => {
    setNewEquipment((prev) => ({
      ...prev,
      selectedMemberIds: [],
    }));
  };

  const selectedMembersCount = newExpense.selectedMemberIds.length;
  const perMemberShare = newExpense.amount > 0 && selectedMembersCount > 0
    ? newExpense.amount / selectedMembersCount
    : 0;

  const equipmentSelectedCount = newEquipment.selectedMemberIds.length;
  const equipmentPerMemberShare = newEquipment.amount > 0 && equipmentSelectedCount > 0
    ? newEquipment.amount / equipmentSelectedCount
    : 0;

  const handleDeleteExpense = (id: string) => {
    if (confirm("Are you sure you want to delete this expense?")) {
      deleteExpenseMutation.mutate(id);
    }
  };

  const handleDeleteEquipment = (id: string) => {
    if (confirm("Are you sure you want to delete this equipment purchase?")) {
      deleteEquipmentMutation.mutate(id);
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
            <Button 
              variant="outline"
              onClick={() => {
                try {
                  // Export expenses
                  const headers = user?.role === "admin" 
                    ? ["Date", "Category", "Description", "Amount", "Paid By", "Present", "Per Member", "Status"]
                    : ["Date", "Category", "Description", "Amount", "Your Share", "Status"];
                  
                  const exportData = user?.role === "admin" 
                    ? expenses
                    : expenses.filter((exp: any) => {
                        const memberId = member?._id || member?.id;
                        const selectedMemberIds = exp.selectedMembers?.map((m: any) => m._id || m.id || m) || [];
                        return selectedMemberIds.some((id: any) => id?.toString() === memberId?.toString());
                      });

                  exportToExcel(
                    exportData,
                    `UBISmashers_Expenses_${format(new Date(), "yyyy-MM-dd")}`,
                    headers,
                    (expense: any) => {
                      if (user?.role === "admin") {
                        return [
                          format(new Date(expense.date), "yyyy-MM-dd"),
                          expense.category,
                          expense.description,
                          `$${expense.amount.toFixed(2)}`,
                          typeof expense.paidBy === "object" ? expense.paidBy?.name || "Unknown" : expense.paidBy || "Unknown",
                          expense.presentMembers?.toString() || "0",
                          `$${expense.perMemberShare?.toFixed(2) || "0.00"}`,
                          expense.status,
                        ];
                      } else {
                        return [
                          format(new Date(expense.date), "yyyy-MM-dd"),
                          expense.category,
                          expense.description,
                          `$${expense.amount.toFixed(2)}`,
                          `$${expense.perMemberShare?.toFixed(2) || "0.00"}`,
                          expense.status,
                        ];
                      }
                    }
                  );
                  toast.success("Expenses exported successfully!");
                } catch (error: any) {
                  toast.error("Failed to export expenses", {
                    description: error.message || "An error occurred",
                  });
                }
              }}
            >
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

        {/* Equipment Stock Section */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>Equipment Stock</CardTitle>
              {user?.role === "admin" && (
                <Dialog open={isAddEquipmentOpen} onOpenChange={setIsAddEquipmentOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Purchase
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Add Equipment Purchase</DialogTitle>
                      <DialogDescription>
                        Track equipment bought in advance and split the cost among members
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Item Name</Label>
                        <Input
                          placeholder="e.g., Shuttles"
                          value={newEquipment.itemName}
                          onChange={(e) =>
                            setNewEquipment({ ...newEquipment, itemName: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Date</Label>
                        <Input
                          type="date"
                          value={newEquipment.date}
                          onChange={(e) =>
                            setNewEquipment({ ...newEquipment, date: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          placeholder="Optional notes..."
                          value={newEquipment.description}
                          onChange={(e) =>
                            setNewEquipment({ ...newEquipment, description: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Total Cost ($)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={newEquipment.amount || ""}
                          onChange={(e) =>
                            setNewEquipment({
                              ...newEquipment,
                              amount: parseFloat(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Quantity Purchased</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={newEquipment.quantityPurchased || 1}
                          onChange={(e) =>
                            setNewEquipment({
                              ...newEquipment,
                              quantityPurchased: parseInt(e.target.value, 10) || 1,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Select Members to Split Cost</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={selectAllEquipmentMembers}
                              className="h-7 text-xs"
                            >
                              Select All
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={deselectAllEquipmentMembers}
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
                                const isSelected = newEquipment.selectedMemberIds.includes(memberId);
                                return (
                                  <div
                                    key={memberId}
                                    className="flex items-center space-x-2 p-2 rounded hover:bg-secondary/50 cursor-pointer"
                                    onClick={() => toggleEquipmentMemberSelection(memberId)}
                                  >
                                    <Checkbox
                                      checked={isSelected}
                                      onCheckedChange={() => toggleEquipmentMemberSelection(memberId)}
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
                          This purchase will be split among{" "}
                          <span className="font-semibold">{equipmentSelectedCount}</span>{" "}
                          member{equipmentSelectedCount !== 1 ? "s" : ""}. Per member share:{" "}
                          <span className="font-semibold text-primary">
                            ${equipmentPerMemberShare.toFixed(2)}
                          </span>
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsAddEquipmentOpen(false)}
                        disabled={createEquipmentMutation.isPending}
                      >
                        Cancel
                      </Button>
                      <Button
                        onClick={handleAddEquipment}
                        disabled={createEquipmentMutation.isPending || equipmentSelectedCount === 0}
                      >
                        {createEquipmentMutation.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Adding...
                          </>
                        ) : (
                          "Add Purchase"
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEquipmentLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : equipmentPurchases.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No equipment purchases found. Add your first purchase to get started.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Remaining</TableHead>
                    <TableHead>Cost</TableHead>
                    <TableHead>Paid By</TableHead>
                    <TableHead>Per Member</TableHead>
                    {user?.role === "admin" && (
                      <TableHead className="text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipmentPurchases.map((purchase: any) => {
                    const purchasedQty = purchase.quantityPurchased || 0;
                    const usedQty = purchase.quantityUsed || 0;
                    const remainingQty = Math.max(0, purchasedQty - usedQty);
                    return (
                      <TableRow key={purchase._id || purchase.id}>
                        <TableCell className="font-medium">
                          {format(new Date(purchase.date), "MMM d")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded bg-accent/10">
                              <Boxes className="h-3.5 w-3.5 text-accent" />
                            </div>
                            <span className="text-sm">{purchase.itemName || purchase.description}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{purchasedQty}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{usedQty}</Badge>
                        </TableCell>
                        <TableCell className={remainingQty > 0 ? "text-success font-medium" : "text-destructive"}>
                          {remainingQty}
                        </TableCell>
                        <TableCell className="font-semibold">${purchase.amount.toFixed(2)}</TableCell>
                        <TableCell>
                          {typeof purchase.paidBy === "object"
                            ? purchase.paidBy?.name || "Unknown"
                            : purchase.paidBy}
                        </TableCell>
                        <TableCell className="text-primary font-medium">
                          ${purchase.perMemberShare?.toFixed(2) || "0.00"}
                        </TableCell>
                        {user?.role === "admin" && (
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => {
                                  setUsageTarget(purchase);
                                  setUsageValue(usedQty);
                                  setIsUsageOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteEquipment(purchase._id || purchase.id)}
                                disabled={deleteEquipmentMutation.isPending}
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

        {/* Update Usage Dialog */}
        <Dialog open={isUsageOpen} onOpenChange={setIsUsageOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Update Usage</DialogTitle>
              <DialogDescription>
                Update how many items have been used for this purchase.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <Label>Used Quantity</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={usageValue}
                onChange={(e) => setUsageValue(parseInt(e.target.value, 10) || 0)}
              />
              {usageTarget?.quantityPurchased !== undefined && (
                <p className="text-xs text-muted-foreground">
                  Purchased: {usageTarget.quantityPurchased} | Remaining:{" "}
                  {Math.max(0, (usageTarget.quantityPurchased || 0) - usageValue)}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsUsageOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!usageTarget) return;
                  updateEquipmentUsageMutation.mutate({
                    id: usageTarget._id || usageTarget.id,
                    quantityUsed: usageValue,
                  });
                }}
                disabled={updateEquipmentUsageMutation.isPending}
              >
                {updateEquipmentUsageMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
