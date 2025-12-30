import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export function MemberBalances() {
  const { api } = useAuth();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["members"],
    queryFn: () => api.getMembers(),
  });

  // Get top 5 members by balance (positive or negative)
  const sortedMembers = [...members]
    .sort((a: any, b: any) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, 5)
    .map((member: any) => ({
      id: member._id || member.id,
      name: member.name,
      balance: member.balance || 0,
      status: member.balance < 0 ? "owes" : member.balance > 0 ? "owed" : "settled",
    }));

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Member Balances</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Member Balances</CardTitle>
        <Badge variant="outline" className="font-normal">
          Top 5
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedMembers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No member data available</p>
          ) : (
            sortedMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between py-2"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={member.avatar} />
                    <AvatarFallback className="bg-secondary text-secondary-foreground text-sm">
                      {member.name.split(" ").map(n => n[0]).join("")}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">{member.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`font-semibold text-sm ${
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
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      member.status === "owes"
                        ? "border-destructive/30 text-destructive"
                        : member.status === "owed"
                        ? "border-success/30 text-success"
                        : "border-muted-foreground/30 text-muted-foreground"
                    }`}
                  >
                    {member.status === "owes" ? "Owes" : member.status === "owed" ? "Owed" : "Settled"}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
