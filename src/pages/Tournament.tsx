import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ChevronRight, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TournamentBracket } from "@/components/tournament/TournamentBracket";
import { TournamentOverview } from "@/components/tournament/TournamentOverview";
import { createApiClient } from "@/lib/api";
import type { PublicTournamentPayload, Tournament } from "@/types/tournament";

const publicApi = createApiClient(() => null, () => {});

export default function TournamentPage() {
  const { data, isLoading } = useQuery<PublicTournamentPayload>({
    queryKey: ["publicTournaments"],
    queryFn: () => publicApi.getPublicTournaments(),
  });
  const selectedTournament: Tournament | null = data?.currentTournament || null;

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-b-transparent" />
      </div>
    );
  }

  if (!data?.isEnabled) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center">
        <h1 className="text-3xl font-bold">Tournament</h1>
        <p className="mt-3 text-muted-foreground">
          Tournament view is currently disabled by the admin.
        </p>
        <Button asChild className="mt-6">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">UBISmashers Tournament</h1>
            <p className="text-sm text-muted-foreground">
              Live bracket, scores, and tournament champions.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">
              Back to Home
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {selectedTournament ? (
          <>
            <TournamentOverview tournament={selectedTournament} />
            {selectedTournament.matches.length > 0 ? (
              <TournamentBracket tournament={selectedTournament} />
            ) : (
              <Card>
                <CardContent className="p-6 text-sm text-muted-foreground">
                  Bracket has not been generated yet.
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No tournament is currently available.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Tournament History</CardTitle>
          </CardHeader>
          <CardContent>
            {data.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No completed tournaments yet.</p>
            ) : (
              <div className="space-y-2">
                {data.history.map((item) => (
                  <div key={item._id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(item.date), "dd MMM yyyy")}</p>
                    </div>
                    <div className="text-right">
                      <Badge className="bg-emerald-600 text-white">
                        <Trophy className="mr-1 h-3.5 w-3.5" />
                        {item.championTeam?.name || "Champion"}
                      </Badge>
                      {item.finalScore && (
                        <p className="mt-1 text-xs text-muted-foreground">Final: {item.finalScore}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
