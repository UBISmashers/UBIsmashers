import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createApiClient } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, ChevronDown, ChevronUp, Boxes } from "lucide-react";
import { format } from "date-fns";

const publicApi = createApiClient(() => null, () => {});
type PeriodFilter = "all" | "custom" | "this_month" | "last_week" | "last_month" | "last_6_months" | "last_year";

const periodLabel: Record<PeriodFilter, string> = {
  all: "All Time",
  custom: "Custom Range",
  this_month: "This Month",
  last_week: "Last Week",
  last_month: "Last Month",
  last_6_months: "Last 6 Months",
  last_year: "Last Year",
};

interface PublicBreakdownItem {
  date?: string;
  description?: string;
  category?: string;
  isInventory?: boolean;
  itemName?: string;
  shareAmount: number;
  paidStatus: boolean;
}

interface EquipmentItem {
  _id?: string;
  id?: string;
  date?: string;
  quantityPurchased?: number;
  quantityUsed?: number;
  boughtByName?: string;
  paidBy?: string | { name?: string };
}

interface CourtAdvanceItem {
  _id?: string;
  id?: string;
  date?: string;
  courtBookedDate?: string;
  bookedByName?: string;
  courtsBooked?: number;
}

interface SessionHistoryItem {
  _id?: string;
  id?: string;
  date?: string;
  description?: string;
  courtBookingCost?: number;
  shuttlesUsed?: number;
  perShuttleCost?: number;
  amount?: number;
  selectedMembers?: Array<string | { name?: string }>;
}

export default function PublicBills() {
  const todayString = format(new Date(), "yyyy-MM-dd");
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodFilter>("all");
  const [customStartDate, setCustomStartDate] = useState(todayString);
  const [customEndDate, setCustomEndDate] = useState(todayString);
  const { data, isLoading } = useQuery({
    queryKey: ["publicBills", period, customStartDate, customEndDate],
    queryFn: () =>
      publicApi.getPublicBills(
        period,
        period === "custom" ? { customStartDate, customEndDate } : undefined
      ),
    enabled: period !== "custom" || (Boolean(customStartDate) && Boolean(customEndDate)),
  });

  return (
    <div
      className="min-h-screen p-4 md:p-8 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url('/background.png')" }}
    >
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-3 inline-flex rounded-2xl border border-white/30 bg-white/10 p-1.5 shadow-[0_10px_30px_rgba(0,0,0,0.25)] backdrop-blur-sm">
              <img
                src="/icon.jpeg"
                alt="UBISmashers team symbol"
                className="h-14 w-14 rounded-xl object-cover"
              />
            </div>
            <h1 className="text-3xl font-display font-bold">Group Bills (Read-only)</h1>
            <p className="text-muted-foreground">Transparent member-wise expense and payment status.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={(value) => setPeriod(value as PeriodFilter)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Select range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{periodLabel.all}</SelectItem>
                <SelectItem value="custom">{periodLabel.custom}</SelectItem>
                <SelectItem value="this_month">{periodLabel.this_month}</SelectItem>
                <SelectItem value="last_week">{periodLabel.last_week}</SelectItem>
                <SelectItem value="last_month">{periodLabel.last_month}</SelectItem>
                <SelectItem value="last_6_months">{periodLabel.last_6_months}</SelectItem>
                <SelectItem value="last_year">{periodLabel.last_year}</SelectItem>
              </SelectContent>
            </Select>
            {period === "custom" && (
              <>
                <Input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-40"
                />
                <Input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-40"
                />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  Applied: {customStartDate || "-"} to {customEndDate || "-"}
                </span>
              </>
            )}
            <Link to="/admin-login">
              <Button variant="outline">Admin Login</Button>
            </Link>
          </div>
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
                    <TableHead>Advance Status</TableHead>
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
                            <span
                              className={
                                Number(member.advanceTotalPaid || 0) > 0
                                  ? "text-green-600 font-medium"
                                  : "text-red-600 font-medium"
                              }
                            >
                              {Number(member.advanceTotalPaid || 0) > 0 ? "Paid" : "Unpaid"}
                            </span>
                          </TableCell>
                        </TableRow>
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={5} className="bg-secondary/30">
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
                                      {member.breakdown.map((item: PublicBreakdownItem, index: number) => (
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
                    <TableHead>Bought By</TableHead>
                    <TableHead>Paid By</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((data?.equipment as EquipmentItem[]) || []).map((item) => {
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
                            <span className="text-sm">Shuttle</span>
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
                        <TableCell>{item.boughtByName || "-"}</TableCell>
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
            <CardTitle>Court Advance Bookings</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              </div>
            ) : (data?.courtAdvanceBookings || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No court advance bookings recorded.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Booked By</TableHead>
                    <TableHead>No. of Courts</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((data?.courtAdvanceBookings as CourtAdvanceItem[]) || []).map((item) => (
                    <TableRow key={item._id || item.id}>
                      <TableCell className="font-medium">
                        {item.courtBookedDate
                          ? format(new Date(item.courtBookedDate), "MMM d")
                          : item.date
                            ? format(new Date(item.date), "MMM d")
                            : "-"}
                      </TableCell>
                      <TableCell>{item.bookedByName || "-"}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{item.courtsBooked || 0}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-10 text-center">
                <Loader2 className="mx-auto h-6 w-6 animate-spin" />
              </div>
            ) : (data?.sessionHistory || []).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No session expenses recorded.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Court Cost</TableHead>
                    <TableHead>Shuttles Used</TableHead>
                    <TableHead>Per Shuttle Cost</TableHead>
                    <TableHead>Total Shuttle Cost</TableHead>
                    <TableHead>Total Amount</TableHead>
                    <TableHead>Players Played</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {((data?.sessionHistory as SessionHistoryItem[]) || []).map((item) => (
                    <TableRow key={item._id || item.id}>
                      <TableCell className="font-medium">
                        {item.date ? format(new Date(item.date), "MMM d") : "-"}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">{item.description || "-"}</TableCell>
                      <TableCell>${Number(item.courtBookingCost || 0).toFixed(2)}</TableCell>
                      <TableCell>{Number(item.shuttlesUsed || 0)}</TableCell>
                      <TableCell>${Number(item.perShuttleCost || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        $
                        {(
                          Number(item.shuttlesUsed || 0) * Number(item.perShuttleCost || 0)
                        ).toFixed(2)}
                      </TableCell>
                      <TableCell className="font-semibold">${Number(item.amount || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        {(item.selectedMembers || [])
                          .map((m) => (typeof m === "object" ? m?.name : m))
                          .filter(Boolean)
                          .join(", ") || "-"}
                      </TableCell>
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
