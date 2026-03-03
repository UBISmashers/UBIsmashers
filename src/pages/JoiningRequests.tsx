import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { MainLayout } from "@/components/layout/MainLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, UsersRound } from "lucide-react";
import { toast } from "sonner";

type AvailabilityOption = "weekly_twice" | "only_weekends" | "weekdays_only" | "flexible";

const availabilityLabels: Record<AvailabilityOption, string> = {
  weekly_twice: "Weekly Twice",
  only_weekends: "Only Weekends",
  weekdays_only: "Weekdays Only",
  flexible: "Flexible",
};

export default function JoiningRequests() {
  const { api } = useAuth();
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["joiningRequests"],
    queryFn: () => api.getJoiningRequests(),
  });

  const markReviewedMutation = useMutation({
    mutationFn: (id: string) => api.updateJoiningRequestStatus(id, "reviewed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["joiningRequests"] });
      toast.success("Request marked as reviewed");
    },
    onError: (error: any) => {
      toast.error("Failed to update request", {
        description: error.message || "Please try again",
      });
    },
  });

  const newCount = useMemo(
    () => requests.filter((request: any) => request.status === "new").length,
    [requests]
  );

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-3xl font-display font-bold">Joining Requests</h1>
          <p className="text-muted-foreground mt-1">
            Review requests submitted from the public Join UBISmashers form.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2">
              <UsersRound className="h-5 w-5 text-primary" />
              Request History
            </CardTitle>
            <Badge variant={newCount > 0 ? "destructive" : "secondary"}>
              {newCount} New
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
                      <TableHead>Date</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Mobile</TableHead>
                      <TableHead>Address</TableHead>
                      <TableHead>Availability</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {requests.map((request: any) => (
                      <TableRow key={request._id || request.id}>
                        <TableCell className="font-medium">
                          {format(new Date(request.createdAt), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>{request.name}</TableCell>
                        <TableCell>{request.mobileNumber}</TableCell>
                        <TableCell className="max-w-[220px] truncate">{request.address}</TableCell>
                        <TableCell>
                          {availabilityLabels[request.availability as AvailabilityOption] || "Flexible"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={request.status === "new" ? "destructive" : "secondary"}
                            className="capitalize"
                          >
                            {request.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {request.status === "new" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => markReviewedMutation.mutate(request._id || request.id)}
                              disabled={markReviewedMutation.isPending}
                            >
                              Mark Reviewed
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">Reviewed</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

