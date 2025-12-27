import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Expense {
  id: string;
  date: string;
  category: "court" | "equipment" | "refreshments" | "other";
  description: string;
  amount: number;
  paidBy: string;
  presentMembers: number;
  perMemberShare: number;
  status: "pending" | "completed";
}

const mockExpenses: Expense[] = [
  {
    id: "1",
    date: "2024-12-27",
    category: "court",
    description: "Court 1 & 2 rental - Evening session",
    amount: 120,
    paidBy: "John Doe",
    presentMembers: 18,
    perMemberShare: 6.67,
    status: "completed",
  },
  {
    id: "2",
    date: "2024-12-26",
    category: "equipment",
    description: "Shuttlecocks (12 tubes)",
    amount: 85,
    paidBy: "Mike Smith",
    presentMembers: 22,
    perMemberShare: 3.86,
    status: "completed",
  },
  {
    id: "3",
    date: "2024-12-26",
    category: "refreshments",
    description: "Water and energy drinks",
    amount: 45,
    paidBy: "Sarah Lee",
    presentMembers: 22,
    perMemberShare: 2.05,
    status: "pending",
  },
  {
    id: "4",
    date: "2024-12-25",
    category: "court",
    description: "Court rental - Morning session",
    amount: 80,
    paidBy: "Tom Wilson",
    presentMembers: 15,
    perMemberShare: 5.33,
    status: "completed",
  },
  {
    id: "5",
    date: "2024-12-24",
    category: "equipment",
    description: "New net for Court 2",
    amount: 150,
    paidBy: "Admin",
    presentMembers: 40,
    perMemberShare: 3.75,
    status: "completed",
  },
];

const categoryInfo = {
  court: { icon: CircleDollarSign, color: "text-primary", bg: "bg-primary/10" },
  equipment: { icon: Receipt, color: "text-accent", bg: "bg-accent/10" },
  refreshments: { icon: Coffee, color: "text-info", bg: "bg-info/10" },
  other: { icon: DollarSign, color: "text-muted-foreground", bg: "bg-muted" },
};

export default function Expenses() {
  const [expenses] = useState<Expense[]>(mockExpenses);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  const filteredExpenses =
    filterCategory === "all"
      ? expenses
      : expenses.filter((e) => e.category === filterCategory);

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const completedExpenses = expenses.filter((e) => e.status === "completed");
  const pendingAmount = expenses
    .filter((e) => e.status === "pending")
    .reduce((sum, e) => sum + e.amount, 0);

  const handleAddExpense = () => {
    setIsAddOpen(false);
    toast.success("Expense added successfully!");
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
                    <Select defaultValue="court">
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
                    <Label>Amount ($)</Label>
                    <Input type="number" placeholder="0.00" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea placeholder="Describe the expense..." />
                  </div>
                  <div className="space-y-2">
                    <Label>Paid By</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select member" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="john">John Doe</SelectItem>
                        <SelectItem value="mike">Mike Smith</SelectItem>
                        <SelectItem value="sarah">Sarah Lee</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/50">
                    <p className="text-sm text-muted-foreground">
                      This expense will be automatically split among members
                      marked present on the selected date.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddExpense}>Add Expense</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total This Month</p>
                  <p className="text-2xl font-bold font-display">${totalExpenses}</p>
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
                    ${expenses.filter((e) => e.category === "court").reduce((s, e) => s + e.amount, 0)}
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
                    ${expenses.filter((e) => e.category === "equipment").reduce((s, e) => s + e.amount, 0)}
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
                    ${pendingAmount}
                  </p>
                </div>
                <Badge variant="outline" className="border-warning/30 text-warning">
                  {expenses.filter((e) => e.status === "pending").length} items
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
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map((expense) => {
                  const catInfo = categoryInfo[expense.category];
                  const Icon = catInfo.icon;
                  return (
                    <TableRow key={expense.id}>
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
                      <TableCell>{expense.paidBy}</TableCell>
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
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
