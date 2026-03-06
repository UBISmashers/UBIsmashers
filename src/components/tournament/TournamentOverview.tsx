import { CalendarDays, MapPin, Trophy, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { Tournament } from "@/types/tournament";
import { format } from "date-fns";

const statusStyle: Record<Tournament["status"], string> = {
  upcoming: "bg-blue-500/15 text-blue-700 border-blue-500/30",
  ongoing: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  completed: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
};

export function TournamentOverview({ tournament }: { tournament: Tournament }) {
  return (
    <Card className="border-primary/15 shadow-md">
      <CardContent className="p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">{tournament.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Club Tournament • {tournament.type === "doubles" ? "Doubles" : "Singles"}
            </p>
          </div>
          <Badge className={statusStyle[tournament.status]}>
            {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
          </Badge>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2 rounded-lg border bg-secondary/40 px-3 py-2 text-sm">
            <CalendarDays className="h-4 w-4 text-primary" />
            <span>{format(new Date(tournament.date), "dd MMM yyyy")}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-secondary/40 px-3 py-2 text-sm">
            <MapPin className="h-4 w-4 text-primary" />
            <span>{tournament.location}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-secondary/40 px-3 py-2 text-sm">
            <Users className="h-4 w-4 text-primary" />
            <span>{tournament.teams.length} Teams</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-secondary/40 px-3 py-2 text-sm">
            <Trophy className="h-4 w-4 text-primary" />
            <span>Entry Fee: {tournament.entryFee ? `$${tournament.entryFee}` : "Free"}</span>
          </div>
        </div>

        {tournament.championTeam && (
          <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-700">Champion</p>
            <p className="text-lg font-semibold text-emerald-800">{tournament.championTeam.name}</p>
            {tournament.finalScore && (
              <p className="text-sm text-emerald-700">Final Score: {tournament.finalScore}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
