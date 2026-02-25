import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function JoiningFees() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newFee, setNewFee] = useState({
    memberId: "",
    amount: 0,
    date: format(new Date(), "yyyy-MM-dd"),
    note: "",
  });

  const { data: fees = [], isLoading } = useQuery({
    queryKey: ["joining-fees"],
    queryFn: () => api.getJoiningFees(),
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: () => api.getMembers(),
  });

  const createFeeMutation = useMutation({
    mutationFn: (data: any) => api.createJoiningFee(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["joining-fees"] });
      setIsAddOpen(false);
      setNewFee({
        memberId: "",
        amount: 0,
        date: format(new Date(), "yyyy-MM-dd"),
        note: "",
      });
      toast.success("Joining fee added successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to add joining fee", {
        description: error.message || "An error occurred",
      });
    },
  });

  const deleteFeeMutation = useMutation({
    mutationFn: (id: string) => api.deleteJoiningFee(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["joining-fees"] });
      toast.success("Joining fee deleted successfully!");
    },
    onError: (error: any) => {
      toast.error("Failed to delete joining fee", {
        description: error.message || "An error occurred",
      });
    },
  });

  const handleAddFee = () => {
    if (!newFee.memberId || newFee.amount <= 0) {
      toast.error("Please select a member and enter a valid amount");
      return;
    }
    createFeeMutation.mutate({
      memberId: newFee.memberId,
      amount: newFee.amount,
      date: newFee.date,
      note: newFee.note,
    });
  };

  const handleDeleteFee = (id: string) => {
    if (confirm("Are you sure you want to delete this joining fee entry?")) {
      deleteFeeMutation.mutate(id);
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Joining Fees</h1>
            <p className="text-muted-foreground mt-1">
              Record multiple joining fee payments per member
            </p>
          </div>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Add Joining Fee</DialogTitle>
                <DialogDescription>
                  Record a joining fee payment for a member.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Member</Label>
                  <Select
                    value={newFee.memberId}
                    onValueChange={(value) => setNewFee({ ...newFee, memberId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select member" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((member: any) => (
                        <SelectItem key={member._id || member.id} value={member._id || member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={newFee.date}
                    onChange={(e) => setNewFee({ ...newFee, date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Amount ($)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newFee.amount || ""}
                    onChange={(e) =>
                      setNewFee({ ...newFee, amount: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Note</Label>
                  <Textarea
                    placeholder="Optional note..."
                    value={newFee.note}
                    onChange={(e) => setNewFee({ ...newFee, note: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAddFee} disabled={createFeeMutation.isPending}>
                  {createFeeMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Payment"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : fees.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No joining fee payments recorded yet.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Received By</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fees.map((fee: any) => (
                    <TableRow key={fee._id || fee.id}>
                      <TableCell className="font-medium">
                        {format(new Date(fee.date), "MMM d")}
                      </TableCell>
                      <TableCell>
                        {typeof fee.memberId === "object" ? fee.memberId?.name || "Unknown" : fee.memberId}
                      </TableCell>
                      <TableCell className="font-semibold">${fee.amount.toFixed(2)}</TableCell>
                      <TableCell>
                        {typeof fee.receivedBy === "object"
                          ? fee.receivedBy?.name || "Unknown"
                          : fee.receivedBy}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {fee.note || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteFee(fee._id || fee.id)}
                          disabled={deleteFeeMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
