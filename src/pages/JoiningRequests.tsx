import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Eye, Loader2, UserCheck, UserX, UsersRound } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

type AvailabilityOption = "weekly_twice" | "only_weekends" | "weekdays_only" | "flexible";
type RequestStatus = "pending" | "approved" | "rejected";

type JoiningRequest = {
  _id?: string;
  id?: string;
  name: string;
  email?: string;
  mobileNumber?: string;
  phoneNumber?: string;
  address: string;
  availability: AvailabilityOption;
  status: RequestStatus;
  createdAt: string;
};

const availabilityLabels: Record<AvailabilityOption, string> = {
  weekly_twice: "Weekly Twice",
  only_weekends: "Only Weekends",
  weekdays_only: "Weekdays Only",
  flexible: "Flexible",
};

const statusLabels: Record<RequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
};

const statusVariant: Record<RequestStatus, "default" | "destructive" | "secondary"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

export default function JoiningRequests() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<JoiningRequest | null>(null);

  const { data: requests = [], isLoading } = useQuery<JoiningRequest[]>({
    queryKey: ["joiningRequests"],
    queryFn: () => api.getJoiningRequests(),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: RequestStatus }) =>
      api.updateJoiningRequestStatus(id, status),
    onSuccess: async (_data, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["joiningRequests"] }),
        queryClient.invalidateQueries({ queryKey: ["members"] }),
      ]);
      toast.success(
        variables.status === "approved"
          ? "Joining request approved and member created"
          : variables.status === "rejected"
          ? "Joining request rejected"
          : "Joining request updated"
      );
    },
    onError: (error: any) => {
      toast.error("Failed to update request", {
        description: error.message || "Please try again",
      });
    },
  });

  const pendingCount = useMemo(
    () => requests.filter((request) => request.status === "pending").length,
    [requests]
  );

  const updateStatus = (request: JoiningRequest, status: RequestStatus) => {
    const id = request._id || request.id;
    if (!id) return;
    updateStatusMutation.mutate({ id, status });
  };

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold">Joining Requests</h1>
          <p className="text-muted-foreground mt-1">
            Review membership requests submitted from the public Join UBISmashers form.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-primary" />
              Pending Membership Requests
            </CardTitle>
            <Badge variant={pendingCount > 0 ? "destructive" : "secondary"}>
              {pendingCount} Pending
            </Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : requests.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-10">
                No joining requests yet.
              </p>
            ) : (
              <div className="max-h-[600px] overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Applicant Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone Number</TableHead>
                      <TableHead>Submitted Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request) => {
                      const phone = request.phoneNumber || request.mobileNumber || "-";
                      return (
                        <TableRow key={request._id || request.id}>
                          <TableCell className="font-medium">{request.name}</TableCell>
                          <TableCell>{request.email || "-"}</TableCell>
                          <TableCell>{phone}</TableCell>
                          <TableCell>{format(new Date(request.createdAt), "MMM d, yyyy")}</TableCell>
                          <TableCell>
                            <Badge variant={statusVariant[request.status]}>{statusLabels[request.status]}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => setSelectedRequest(request)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Details
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateStatus(request, "approved")}
                                disabled={request.status !== "pending" || updateStatusMutation.isPending}
                              >
                                <UserCheck className="mr-2 h-4 w-4" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateStatus(request, "rejected")}
                                disabled={request.status !== "pending" || updateStatusMutation.isPending}
                              >
                                <UserX className="mr-2 h-4 w-4" />
                                Reject
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(selectedRequest)} onOpenChange={(open) => !open && setSelectedRequest(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Joining Request Details</DialogTitle>
              <DialogDescription>
                Submitted {selectedRequest ? format(new Date(selectedRequest.createdAt), "MMM d, yyyy") : ""}
              </DialogDescription>
            </DialogHeader>
            {selectedRequest && (
              <div className="space-y-3 text-sm">
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Applicant Name</p>
                  <p className="font-medium">{selectedRequest.name}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedRequest.email || "-"}</p>
                  </div>
                  <div className="rounded-md border p-3">
                    <p className="text-muted-foreground">Phone Number</p>
                    <p className="font-medium">{selectedRequest.phoneNumber || selectedRequest.mobileNumber || "-"}</p>
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Availability</p>
                  <p className="font-medium">
                    {availabilityLabels[selectedRequest.availability] || availabilityLabels.flexible}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-muted-foreground">Address</p>
                  <p className="font-medium">{selectedRequest.address}</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
}
