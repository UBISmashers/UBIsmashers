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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Eye,
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
  selectedMembers?: any[];
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

const categoryLabels: Record<string, string> = {
  court: "Session Expense",
  equipment: "Equipment",
  refreshments: "Refreshments",
  other: "Other",
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
  const [memberSearch, setMemberSearch] = useState("");
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [editMemberSearch, setEditMemberSearch] = useState("");
  const [editSplitMode, setEditSplitMode] = useState<"attendance" | "manual">("manual");
  const [editExpense, setEditExpense] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    category: "court" as "court" | "equipment" | "refreshments" | "other",
    description: "",
    amount: 0,
    paidBy: "",
    presentMembers: 1,
    selectedMemberIds: [] as string[],
  });
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [newExpense, setNewExpense] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    category: "court" as "court" | "equipment" | "refreshments" | "other",
    description: "Session expense",
    amount: 0,
    courtBookingCost: 0,
    perShuttleCost: 0,
    shuttlesUsed: 0,
    reduceFromStock: false,
    selectedMemberIds: [] as string[],
  });
  const [newEquipment, setNewEquipment] = useState<{
    date: string;
    itemName: string;
    description: string;
    amount: number;
    quantityPurchased: string;
  }>({
    date: format(new Date(), "yyyy-MM-dd"),
    itemName: "",
    description: "",
    amount: 0,
    quantityPurchased: "",
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
        description: "Session expense",
        amount: 0,
        courtBookingCost: 0,
        perShuttleCost: 0,
        shuttlesUsed: 0,
        reduceFromStock: false,
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
        quantityPurchased: "",
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
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["allPayments"] });
      queryClient.invalidateQueries({ queryKey: ["memberPayments"] });
      toast.success("Expense deleted successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to delete expense", {
        description: error.message || "An error occurred",
      });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: (data: { id: string; payload: any }) =>
      api.updateExpense(data.id, data.payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["allPayments"] });
      queryClient.invalidateQueries({ queryKey: ["memberPayments"] });
      if (editingExpense?._id || editingExpense?.id) {
        queryClient.invalidateQueries({
          queryKey: ["expenseDetails", editingExpense._id || editingExpense.id],
        });
      }
      setIsEditOpen(false);
      setEditingExpense(null);
      toast.success("Expense updated successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to update expense", {
        description: error.message || "An error occurred",
      });
    },
  });

  const selectedExpenseId = selectedExpense?._id || selectedExpense?.id;
  const { data: expenseDetails, isLoading: isExpenseDetailsLoading } = useQuery({
    queryKey: ["expenseDetails", selectedExpenseId],
    queryFn: () => api.getExpenseDetails(selectedExpenseId),
    enabled: Boolean(selectedExpenseId) && user?.role === "admin" && isDetailsOpen,
  });

  const editingExpenseId = editingExpense?._id || editingExpense?.id;
  const { data: editingExpenseDetails, isLoading: isEditingExpenseDetailsLoading } = useQuery({
    queryKey: ["expenseDetails", editingExpenseId],
    queryFn: () => api.getExpenseDetails(editingExpenseId),
    enabled: Boolean(editingExpenseId) && user?.role === "admin" && isEditOpen,
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
    const isCourt = newExpense.category === "court";
    const computedCourtAmount =
      (newExpense.courtBookingCost || 0) + (newExpense.perShuttleCost || 0) * (newExpense.shuttlesUsed || 0);
    const effectiveAmount = isCourt ? computedCourtAmount : newExpense.amount;

    if (!newExpense.description || effectiveAmount <= 0 || newExpense.selectedMemberIds.length === 0) {
      toast.error("Please fill in all required fields and select at least one member");
      return;
    }
    createExpenseMutation.mutate({
      ...newExpense,
      amount: effectiveAmount,
      selectedMembers: newExpense.selectedMemberIds,
    });
  };

  const handleAddEquipment = () => {
    const quantityPurchased = parseInt(newEquipment.quantityPurchased, 10);
    if (
      !newEquipment.itemName ||
      newEquipment.amount <= 0 ||
      Number.isNaN(quantityPurchased) ||
      quantityPurchased <= 0
    ) {
      toast.error("Please fill in all required fields");
      return;
    }
    createEquipmentMutation.mutate({
      date: newEquipment.date,
      itemName: newEquipment.itemName,
      description: newEquipment.description,
      amount: newEquipment.amount,
      quantityPurchased,
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
  const isCourt = newExpense.category === "court";
  const computedCourtAmount =
    (newExpense.courtBookingCost || 0) + (newExpense.perShuttleCost || 0) * (newExpense.shuttlesUsed || 0);
  const effectiveAmount = isCourt ? computedCourtAmount : newExpense.amount;
  const perMemberShare = effectiveAmount > 0 && selectedMembersCount > 0
    ? effectiveAmount / selectedMembersCount
    : 0;

  const normalizedMemberSearch = memberSearch.trim().toLowerCase();
  const filteredMembers = normalizedMemberSearch.length === 0
    ? members
    : members.filter((member: any) =>
        (member.name || "").toLowerCase().includes(normalizedMemberSearch)
      );

  const editNormalizedMemberSearch = editMemberSearch.trim().toLowerCase();
  const filteredEditMembers = editNormalizedMemberSearch.length === 0
    ? members
    : members.filter((member: any) =>
        (member.name || "").toLowerCase().includes(editNormalizedMemberSearch)
      );

  const getItemId = (value: any) => value?._id || value?.id || value;

  const toggleEditMemberSelection = (memberId: string) => {
    setEditExpense((prev) => ({
      ...prev,
      selectedMemberIds: prev.selectedMemberIds.includes(memberId)
        ? prev.selectedMemberIds.filter((id) => id !== memberId)
        : [...prev.selectedMemberIds, memberId],
    }));
  };

  const openEditModal = (expense: any) => {
    const selectedIds = (expense.selectedMembers || []).map((m: any) => getItemId(m).toString());
    const paidById = getItemId(expense.paidBy)?.toString() || "";
    setEditingExpense(expense);
    setEditExpense({
      date: format(new Date(expense.date), "yyyy-MM-dd"),
      category: expense.category,
      description: expense.description || "",
      amount: Number(expense.amount || 0),
      paidBy: paidById,
      presentMembers: Number(expense.presentMembers || selectedIds.length || 1),
      selectedMemberIds: selectedIds,
    });
    setEditSplitMode(selectedIds.length > 0 ? "manual" : "attendance");
    setEditMemberSearch("");
    setIsEditOpen(true);
  };

  const openDetailsView = (expense: any) => {
    setSelectedExpense(expense);
    setIsDetailsOpen(true);
  };

  const editMemberCount =
    editSplitMode === "manual" ? editExpense.selectedMemberIds.length : editExpense.presentMembers;
  const editPerMemberShare =
    editExpense.amount > 0 && editMemberCount > 0 ? editExpense.amount / editMemberCount : 0;

  const handleSaveEditedExpense = () => {
    if (!editingExpense) return;

    const expenseId = editingExpense._id || editingExpense.id;
    if (!expenseId) {
      toast.error("Invalid expense selected");
      return;
    }

    if (!editExpense.description.trim() || editExpense.amount <= 0 || !editExpense.paidBy) {
      toast.error("Please fill in category, description, amount and paid by");
      return;
    }

    if (editSplitMode === "manual" && editExpense.selectedMemberIds.length === 0) {
      toast.error("Select at least one member for manual split");
      return;
    }

    if (editSplitMode === "attendance" && editExpense.presentMembers < 1) {
      toast.error("Attendance count must be at least 1");
      return;
    }

    updateExpenseMutation.mutate({
      id: expenseId,
      payload: {
        date: editExpense.date,
        category: editExpense.category,
        description: editExpense.description.trim(),
        amount: editExpense.amount,
        paidBy: editExpense.paidBy,
        presentMembers:
          editSplitMode === "manual"
            ? editExpense.selectedMemberIds.length
            : editExpense.presentMembers,
        selectedMembers:
          editSplitMode === "manual"
            ? editExpense.selectedMemberIds
            : undefined,
      },
    });
  };

  const getBreakdownMembers = (expenseItem: any) => {
    const memberMap = new Map<string, any>();
    members.forEach((m: any) => {
      const id = getItemId(m)?.toString();
      if (id) memberMap.set(id, m);
    });
    (expenseItem?.selectedMembers || []).forEach((m: any) => {
      const id = getItemId(m)?.toString();
      if (id && !memberMap.has(id)) memberMap.set(id, m);
    });
    if (expenseItem?.paidBy) {
      const id = getItemId(expenseItem.paidBy)?.toString();
      if (id && !memberMap.has(id)) memberMap.set(id, expenseItem.paidBy);
    }
    return Array.from(memberMap.values());
  };

  const getBreakdownRows = (expenseItem: any, shares: any[]) => {
    if (!expenseItem) return [];
    const selectedIds = new Set(
      (expenseItem.selectedMembers || []).map((m: any) => getItemId(m)?.toString())
    );
    const paidById = getItemId(expenseItem.paidBy)?.toString();
    const shareMap = new Map(
      shares.map((share: any) => [getItemId(share.memberId)?.toString(), share])
    );
    const defaultShare =
      Number(expenseItem.perMemberShare || 0) ||
      (Number(expenseItem.amount || 0) / Number(expenseItem.presentMembers || 1));

    return getBreakdownMembers(expenseItem).map((memberItem: any) => {
      const memberId = getItemId(memberItem)?.toString();
      const isPresent = selectedIds.has(memberId);
      const isPayer = Boolean(memberId && paidById && memberId === paidById);
      const share = shareMap.get(memberId);
      const shareAmount = isPresent
        ? Number(isPayer ? defaultShare : share?.amount ?? defaultShare)
        : 0;
      const paymentStatus = !isPresent
        ? "—"
        : isPayer
          ? "Paid"
          : share?.paidStatus
            ? "Paid"
            : "Pending";

      return {
        memberId,
        memberName: memberItem?.name || "Unknown",
        present: isPresent,
        shareAmount,
        paymentStatus,
      };
    });
  };

  const detailExpense = expenseDetails?.expense || selectedExpense;
  const detailRows = getBreakdownRows(detailExpense, expenseDetails?.shares || []);
  const editDetailExpense = editingExpenseDetails?.expense || editingExpense;
  const editDetailRows = getBreakdownRows(editDetailExpense, editingExpenseDetails?.shares || []);

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
                          categoryLabels[expense.category] || expense.category,
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
                          categoryLabels[expense.category] || expense.category,
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
              <DialogContent className="max-w-md w-[95vw] max-h-[80vh] overflow-y-auto">
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
                        setNewExpense((prev) => {
                          const nextCategory = value as any;
                          const nextDescription =
                            nextCategory === "court"
                              ? "Session expense"
                              : prev.description === "Session expense"
                              ? ""
                              : prev.description;
                          return {
                            ...prev,
                            category: nextCategory,
                            description: nextDescription,
                          };
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="court">Session Expense</SelectItem>
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
                  {newExpense.category !== "court" && (
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
                  )}
                  {newExpense.category === "court" && (
                    <div className="space-y-3 rounded-lg border p-3">
                      <p className="text-sm font-medium">Court Payment Breakdown</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label>Court Booking Cost ($)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={newExpense.courtBookingCost || ""}
                            onChange={(e) =>
                              setNewExpense({
                                ...newExpense,
                                courtBookingCost: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Per Shuttle Cost ($)</Label>
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder="0.00"
                            value={newExpense.perShuttleCost || ""}
                            onChange={(e) =>
                              setNewExpense({
                                ...newExpense,
                                perShuttleCost: parseFloat(e.target.value) || 0,
                              })
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>No. of Shuttles Used</Label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            className="no-spinner"
                            placeholder="0"
                            value={newExpense.shuttlesUsed || ""}
                            onChange={(e) =>
                              setNewExpense({
                                ...newExpense,
                                shuttlesUsed: parseInt(e.target.value, 10) || 0,
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Reduce This Number in Equipment Stock?</Label>
                        <RadioGroup
                          className="grid grid-cols-2 gap-4"
                          value={newExpense.reduceFromStock ? "yes" : "no"}
                          onValueChange={(value) =>
                            setNewExpense({ ...newExpense, reduceFromStock: value === "yes" })
                          }
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="reduce-yes" />
                            <Label htmlFor="reduce-yes" className="font-normal">
                              Yes, reduce stock
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="reduce-no" />
                            <Label htmlFor="reduce-no" className="font-normal">
                              No, do nothing
                            </Label>
                          </div>
                        </RadioGroup>
                        <p className="text-xs text-muted-foreground">
                          When enabled, shuttle usage will reduce the available shuttle stock.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Amount ($)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0.00"
                      value={effectiveAmount || ""}
                      disabled={newExpense.category === "court"}
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
                    <div className="space-y-2">
                      <Input
                        placeholder="Search members..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                      />
                    </div>
                    <ScrollArea className="h-48 rounded-md border p-3">
                      <div className="space-y-2">
                        {members.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No members found. Add members first.
                          </p>
                        ) : filteredMembers.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            No members match your search.
                          </p>
                        ) : (
                          filteredMembers.map((member: any) => {
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
                  <p className="text-sm text-muted-foreground">Session Expenses</p>
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
                    <SelectItem value="court">Session Expense</SelectItem>
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
                      <TableRow
                        key={expense._id || expense.id}
                        className="cursor-pointer"
                        onClick={() => openDetailsView(expense)}
                      >
                        <TableCell className="font-medium">
                          {format(new Date(expense.date), "MMM d")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded ${catInfo.bg}`}>
                              <Icon className={`h-3.5 w-3.5 ${catInfo.color}`} />
                            </div>
                            <span className="text-sm">{categoryLabels[expense.category] || expense.category}</span>
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
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDetailsView(expense);
                                }}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(expense);
                                }}
                                disabled={updateExpenseMutation.isPending}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteExpense(expense._id || expense.id);
                                }}
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

        {user?.role === "admin" && (
          <Dialog
            open={isEditOpen}
            onOpenChange={(open) => {
              setIsEditOpen(open);
              if (!open) setEditingExpense(null);
            }}
          >
            <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Expense</DialogTitle>
                <DialogDescription>
                  Update expense information and split settings.
                </DialogDescription>
              </DialogHeader>
              <Tabs defaultValue="edit" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="edit">Edit</TabsTrigger>
                  <TabsTrigger value="details">View Details</TabsTrigger>
                </TabsList>
                <TabsContent value="edit" className="space-y-4 mt-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select
                        value={editExpense.category}
                        onValueChange={(value) =>
                          setEditExpense((prev) => ({
                            ...prev,
                            category: value as "court" | "equipment" | "refreshments" | "other",
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="court">Session Expense</SelectItem>
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
                        value={editExpense.date}
                        onChange={(e) => setEditExpense((prev) => ({ ...prev, date: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Description</Label>
                      <Textarea
                        value={editExpense.description}
                        onChange={(e) =>
                          setEditExpense((prev) => ({ ...prev, description: e.target.value }))
                        }
                        placeholder="What this expense is for"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Total Amount ($)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editExpense.amount || ""}
                        onChange={(e) =>
                          setEditExpense((prev) => ({
                            ...prev,
                            amount: parseFloat(e.target.value) || 0,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Paid By</Label>
                      <Select
                        value={editExpense.paidBy}
                        onValueChange={(value) =>
                          setEditExpense((prev) => ({ ...prev, paidBy: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select member" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((member: any) => {
                            const memberId = getItemId(member)?.toString();
                            if (!memberId) return null;
                            return (
                              <SelectItem key={memberId} value={memberId}>
                                {member.name}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-lg border p-3">
                    <Label>Split Method</Label>
                    <RadioGroup
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                      value={editSplitMode}
                      onValueChange={(value) =>
                        setEditSplitMode(value as "attendance" | "manual")
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="attendance" id="split-attendance" />
                        <Label htmlFor="split-attendance" className="font-normal">
                          Attendance count
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="manual" id="split-manual" />
                        <Label htmlFor="split-manual" className="font-normal">
                          Manual member selection
                        </Label>
                      </div>
                    </RadioGroup>

                    {editSplitMode === "attendance" && (
                      <div className="space-y-2">
                        <Label>Attendance Count</Label>
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={editExpense.presentMembers}
                          onChange={(e) =>
                            setEditExpense((prev) => ({
                              ...prev,
                              presentMembers: Math.max(1, parseInt(e.target.value, 10) || 1),
                            }))
                          }
                        />
                      </div>
                    )}

                    {editSplitMode === "manual" && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Select Members</Label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() =>
                                setEditExpense((prev) => ({
                                  ...prev,
                                  selectedMemberIds: members
                                    .map((m: any) => getItemId(m)?.toString())
                                    .filter(Boolean),
                                }))
                              }
                            >
                              Select All
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() =>
                                setEditExpense((prev) => ({ ...prev, selectedMemberIds: [] }))
                              }
                            >
                              Clear
                            </Button>
                          </div>
                        </div>
                        <Input
                          placeholder="Search members..."
                          value={editMemberSearch}
                          onChange={(e) => setEditMemberSearch(e.target.value)}
                        />
                        <ScrollArea className="h-40 rounded-md border p-3">
                          <div className="space-y-2">
                            {filteredEditMembers.map((member: any) => {
                              const memberId = getItemId(member)?.toString();
                              if (!memberId) return null;
                              const isSelected = editExpense.selectedMemberIds.includes(memberId);
                              return (
                                <div
                                  key={memberId}
                                  className="flex items-center space-x-2 p-2 rounded hover:bg-secondary/50 cursor-pointer"
                                  onClick={() => toggleEditMemberSelection(memberId)}
                                >
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleEditMemberSelection(memberId)}
                                  />
                                  <Label className="flex-1 cursor-pointer font-normal">
                                    {member.name}
                                  </Label>
                                </div>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                  </div>

                  <div className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-sm text-muted-foreground">
                      Split across <span className="font-semibold">{editMemberCount}</span> member
                      {editMemberCount !== 1 ? "s" : ""}. Per member share:{" "}
                      <span className="font-semibold text-primary">${editPerMemberShare.toFixed(2)}</span>
                    </p>
                  </div>

                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsEditOpen(false)}
                      disabled={updateExpenseMutation.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveEditedExpense}
                      disabled={updateExpenseMutation.isPending}
                    >
                      {updateExpenseMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </DialogFooter>
                </TabsContent>
                <TabsContent value="details" className="space-y-4 mt-4">
                  {isEditingExpenseDetailsLoading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                  ) : !editDetailExpense ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      No expense selected.
                    </p>
                  ) : (
                    <>
                      <div className="rounded-lg border p-4 space-y-2">
                        <p className="text-sm"><span className="font-medium">Expense ID:</span> {editDetailExpense._id || editDetailExpense.id}</p>
                        <p className="text-sm"><span className="font-medium">Date:</span> {format(new Date(editDetailExpense.date), "yyyy-MM-dd")}</p>
                        <p className="text-sm"><span className="font-medium">Category:</span> {categoryLabels[editDetailExpense.category] || editDetailExpense.category}</p>
                        <p className="text-sm"><span className="font-medium">Description:</span> {editDetailExpense.description}</p>
                        <p className="text-sm"><span className="font-medium">Total Amount:</span> ${Number(editDetailExpense.amount || 0).toFixed(2)}</p>
                        <p className="text-sm"><span className="font-medium">Paid By:</span> {typeof editDetailExpense.paidBy === "object" ? editDetailExpense.paidBy?.name || "Unknown" : editDetailExpense.paidBy}</p>
                        <p className="text-sm"><span className="font-medium">Status:</span> {editDetailExpense.status === "completed" ? "Settled" : "Pending"}</p>
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Member Name</TableHead>
                            <TableHead>Present</TableHead>
                            <TableHead>Share Amount</TableHead>
                            <TableHead>Payment Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {editDetailRows.map((row: any) => (
                            <TableRow key={row.memberId || row.memberName}>
                              <TableCell>{row.memberName}</TableCell>
                              <TableCell>{row.present ? "Present" : "Absent"}</TableCell>
                              <TableCell>${Number(row.shareAmount || 0).toFixed(2)}</TableCell>
                              <TableCell>{row.paymentStatus}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}

        <Dialog
          open={isDetailsOpen}
          onOpenChange={(open) => {
            setIsDetailsOpen(open);
            if (!open) setSelectedExpense(null);
          }}
        >
          <DialogContent className="max-w-3xl w-[95vw] max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Expense Details</DialogTitle>
              <DialogDescription>
                Expense overview and split breakdown.
              </DialogDescription>
            </DialogHeader>
            {isExpenseDetailsLoading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : !detailExpense ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                No expense selected.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-2">
                  <p className="text-sm"><span className="font-medium">Expense ID:</span> {detailExpense._id || detailExpense.id}</p>
                  <p className="text-sm"><span className="font-medium">Date:</span> {format(new Date(detailExpense.date), "yyyy-MM-dd")}</p>
                  <p className="text-sm"><span className="font-medium">Category:</span> {categoryLabels[detailExpense.category] || detailExpense.category}</p>
                  <p className="text-sm"><span className="font-medium">Description:</span> {detailExpense.description}</p>
                  <p className="text-sm"><span className="font-medium">Total Amount:</span> ${Number(detailExpense.amount || 0).toFixed(2)}</p>
                  <p className="text-sm"><span className="font-medium">Paid By:</span> {typeof detailExpense.paidBy === "object" ? detailExpense.paidBy?.name || "Unknown" : detailExpense.paidBy}</p>
                  <p className="text-sm"><span className="font-medium">Status:</span> {detailExpense.status === "completed" ? "Settled" : "Pending"}</p>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member Name</TableHead>
                      <TableHead>Present</TableHead>
                      <TableHead>Share Amount</TableHead>
                      <TableHead>Payment Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailRows.map((row: any) => (
                      <TableRow key={row.memberId || row.memberName}>
                        <TableCell>{row.memberName}</TableCell>
                        <TableCell>{row.present ? "Present" : "Absent"}</TableCell>
                        <TableCell>${Number(row.shareAmount || 0).toFixed(2)}</TableCell>
                        <TableCell>{row.paymentStatus}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </DialogContent>
        </Dialog>

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
                        Track equipment bought in advance.
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
                          className="no-spinner"
                          value={newEquipment.quantityPurchased}
                          onChange={(e) =>
                            setNewEquipment({
                              ...newEquipment,
                              quantityPurchased: e.target.value,
                            })
                          }
                        />
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
                        disabled={createEquipmentMutation.isPending}
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
