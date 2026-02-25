import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createApiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronDown, ChevronUp, Boxes } from "lucide-react";
import { format } from "date-fns";

const publicApi = createApiClient(() => null, () => {});

export default function PublicBills() {
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["publicBills"],
    queryFn: () => publicApi.getPublicBills(),
  });

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Group Bills (Read-only)</h1>
            <p className="text-muted-foreground">Transparent member-wise expense and payment status.</p>
          </div>
          <Link to="/login">
            <Button variant="outline">Admin Login</Button>
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Share</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold">${(data?.summary.totalShare || 0).toFixed(2)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Total Paid</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-success">${(data?.summary.totalPaid || 0).toFixed(2)}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Outstanding</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-bold text-destructive">
              ${(data?.summary.totalOutstanding || 0).toFixed(2)}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Member Billing Status</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Total Expense Share</TableHead>
                    <TableHead>Amount Paid</TableHead>
                    <TableHead>Outstanding Balance</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Unpaid</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.members || []).map((member) => {
                    const isExpanded = expandedMemberId === member.memberId;
                    return (
                      <>
                        <TableRow key={member.memberId}>
                          <TableCell className="font-medium">
                            <Button
                              variant="ghost"
                              className="px-0 h-auto font-medium"
                              onClick={() =>
                                setExpandedMemberId(isExpanded ? null : member.memberId)
                              }
                            >
                              {member.name}
                              {isExpanded ? (
                                <ChevronUp className="ml-2 h-4 w-4" />
                              ) : (
                                <ChevronDown className="ml-2 h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>${member.totalExpenseShare.toFixed(2)}</TableCell>
                          <TableCell className="text-success">${member.amountPaid.toFixed(2)}</TableCell>
                          <TableCell className={member.outstandingBalance > 0 ? "text-destructive" : "text-muted-foreground"}>
                            ${member.outstandingBalance.toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{member.paidExpenses}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={member.unpaidExpenses > 0 ? "destructive" : "secondary"}>
                              {member.unpaidExpenses}
                            </Badge>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={6} className="bg-secondary/30">
                              {member.breakdown?.length ? (
                                <div className="p-2">
                                  <div className="text-sm font-medium mb-2">Expense Breakdown</div>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Category</TableHead>
                                        <TableHead>Share</TableHead>
                                        <TableHead>Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {member.breakdown.map((item: any, index: number) => (
                                        <TableRow key={`${member.memberId}-${index}`}>
                                          <TableCell>
                                            {item.date ? format(new Date(item.date), "MMM d") : "-"}
                                          </TableCell>
                                          <TableCell className="max-w-[220px] truncate">
                                            {item.isInventory ? item.itemName || item.description : item.description}
                                          </TableCell>
                                          <TableCell className="capitalize">
                                            {item.isInventory ? "equipment-stock" : item.category}
                                          </TableCell>
                                          <TableCell className="font-medium">
                                            ${item.shareAmount.toFixed(2)}
                                          </TableCell>
                                          <TableCell>
                                            <Badge variant={item.paidStatus ? "secondary" : "destructive"}>
                                              {item.paidStatus ? "Paid" : "Unpaid"}
                                            </Badge>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground py-2">
                                  No expense details for this member.
                                </p>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Equipment Stock</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              </div>
            ) : (data?.equipment || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No equipment purchases recorded.
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.equipment || []).map((item: any) => {
                    const purchasedQty = item.quantityPurchased || 0;
                    const usedQty = item.quantityUsed || 0;
                    const remainingQty = Math.max(0, purchasedQty - usedQty);
                    return (
                      <TableRow key={item._id || item.id}>
                        <TableCell className="font-medium">
                          {item.date ? format(new Date(item.date), "MMM d") : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded bg-accent/10">
                              <Boxes className="h-3.5 w-3.5 text-accent" />
                            </div>
                            <span className="text-sm">{item.itemName || item.description}</span>
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
                        <TableCell className="font-semibold">${(item.amount || 0).toFixed(2)}</TableCell>
                        <TableCell>
                          {typeof item.paidBy === "object" ? item.paidBy?.name || "Unknown" : item.paidBy || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Advance payment</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              </div>
            ) : (data?.joiningFees || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No joining fee payments recorded.
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(data?.joiningFees || []).map((fee: any) => (
                    <TableRow key={fee._id || fee.id}>
                      <TableCell className="font-medium">
                        {fee.date ? format(new Date(fee.date), "MMM d") : "-"}
                      </TableCell>
                      <TableCell>
                        {typeof fee.memberId === "object" ? fee.memberId?.name || "Unknown" : fee.memberId}
                      </TableCell>
                      <TableCell className="font-semibold">${(fee.amount || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        {typeof fee.receivedBy === "object" ? fee.receivedBy?.name || "Unknown" : fee.receivedBy || "-"}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate">{fee.note || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
