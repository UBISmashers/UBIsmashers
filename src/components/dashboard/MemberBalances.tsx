import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface Member {
  id: string;
  name: string;
  avatar?: string;
  balance: number;
  status: "settled" | "owes" | "owed";
}

const members: Member[] = [
  { id: "1", name: "Mike Smith", balance: -45, status: "owes" },
  { id: "2", name: "Sarah Lee", balance: 32, status: "owed" },
  { id: "3", name: "Tom Wilson", balance: -28, status: "owes" },
  { id: "4", name: "Anna Kumar", balance: 0, status: "settled" },
  { id: "5", name: "Chris Park", balance: -15, status: "owes" },
];

export function MemberBalances() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Member Balances</CardTitle>
        <Badge variant="outline" className="font-normal">
          This Month
        </Badge>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member) => (
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
                  {Math.abs(member.balance)}
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
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
