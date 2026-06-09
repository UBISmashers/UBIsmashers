import type * as React from "react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { AlertTriangle, ChevronDown, ChevronRight, Circle, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { TournamentBracket } from "@/components/tournament/TournamentBracket";
import { TournamentPointsTable } from "@/components/tournament/TournamentPointsTable";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createApiClient } from "@/lib/api";
import { buildTournamentGroupView } from "@/lib/tournamentGroups";
import { buildCourtScheduleGroups, formatScheduleDateTime } from "@/lib/tournamentSchedule";
import type { PublicTournamentPayload, Tournament, TournamentTeam } from "@/types/tournament";

const publicApi = createApiClient(() => null, () => {});

const tournamentFormatLabel: Record<Tournament["format"], string> = {
  knockout: "Knockout",
  round_robin: "Round Robin",
  group_knockout: "Group + Knockout",
};

const isGroupLeagueMatch = (match: Tournament["matches"][number]) =>
  match.matchType === "league" && /^Group\s/i.test(match.roundLabel || "");

const isKnockoutStageMatch = (match: Tournament["matches"][number]) =>
  !isGroupLeagueMatch(match) &&
  match.matchType !== "friendly" &&
  match.matchType !== "practice" &&
  (match.roundNumber >= 2 || match.matchType === "semifinal" || match.matchType === "final");

const getPublicBracketMatches = (tournament: Tournament) => {
  if (tournament.format === "knockout") return tournament.matches;

  if (tournament.format === "round_robin") {
    return tournament.matches.filter(isKnockoutStageMatch);
  }

  const groupMatches = tournament.matches.filter(isGroupLeagueMatch);
  const allGroupsCompleted = groupMatches.length > 0 && groupMatches.every((match) => match.isCompleted);
  const knockoutMatches = tournament.matches.filter(isKnockoutStageMatch);
  const knockoutGenerated = knockoutMatches.some((match) => match.teamAId || match.teamBId);

  return allGroupsCompleted && knockoutGenerated ? knockoutMatches : [];
};

const getPublicVisibleMatches = (tournament: Tournament) => {
  if (tournament.format !== "group_knockout") return tournament.matches;

  const bracketMatches = new Set(getPublicBracketMatches(tournament).map((match) => match.matchId));
  return tournament.matches.filter((match) => isGroupLeagueMatch(match) || bracketMatches.has(match.matchId));
};

const getTeamInitials = (team?: TournamentTeam | null) =>
  (team?.name || "TBD")
    .split(/[\s+]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "T";

function TeamButton({ team, onClick }: { team: TournamentTeam | null; onClick: (teamId: string) => void }) {
  if (!team) return <span>TBD</span>;
  return (
    <button
      type="button"
      onClick={() => onClick(team._id)}
      className="font-semibold text-slate-950 underline-offset-4 transition hover:text-emerald-700 hover:underline"
    >
      {team.name}
    </button>
  );
}

function TeamProfileDrawer({
  tournament,
  teamId,
  onClose,
}: {
  tournament: Tournament | null;
  teamId: string;
  onClose: () => void;
}) {
  const team = tournament?.teams.find((item) => item._id === teamId) || null;
  const matches = (tournament?.matches || []).filter((match) => match.teamAId === teamId || match.teamBId === teamId);
  const completed = matches
    .filter((match) => match.isCompleted)
    .sort((a, b) => new Date(b.scheduledAt || 0).getTime() - new Date(a.scheduledAt || 0).getTime());
  const upcoming = matches
    .filter((match) => !match.isCompleted)
    .sort((a, b) => new Date(a.scheduledAt || 0).getTime() - new Date(b.scheduledAt || 0).getTime());
  const wins = completed.filter((match) => match.winnerTeamId === teamId).length;
  const losses = completed.length - wins;
  const pointsFor = completed.reduce((sum, match) => {
    if (match.scoreA === null || match.scoreB === null) return sum;
    return sum + (match.teamAId === teamId ? match.scoreA : match.scoreB);
  }, 0);
  const pointsAgainst = completed.reduce((sum, match) => {
    if (match.scoreA === null || match.scoreB === null) return sum;
    return sum + (match.teamAId === teamId ? match.scoreB : match.scoreA);
  }, 0);
  const group = tournament?.tournamentGroups.find((item) => item.teamIds.includes(teamId));

  return (
    <Sheet open={Boolean(team)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto bg-slate-950 text-white sm:max-w-xl">
        <SheetHeader className="pr-8">
          <SheetTitle className="text-2xl text-white">{team?.name}</SheetTitle>
          <div className="flex flex-wrap gap-2 text-sm text-slate-300">
            {team?.players.map((player) => (
              <span key={player} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500 text-xs font-bold text-slate-950">
                  {player.slice(0, 2).toUpperCase()}
                </span>
                {player}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge className="bg-emerald-500 text-slate-950">W: {wins}</Badge>
            <Badge className="bg-red-600 text-white">L: {losses}</Badge>
            <Badge className="bg-slate-700 text-white">D: 0</Badge>
            {group && <Badge className="bg-amber-500 text-slate-950">{group.groupName}</Badge>}
          </div>
        </SheetHeader>

        <Tabs defaultValue="recent" className="mt-6">
          <TabsList className="grid w-full grid-cols-3 bg-white/10">
            <TabsTrigger value="recent">Recent</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="stats">Stats</TabsTrigger>
          </TabsList>
          <TabsContent value="recent" className="space-y-3">
            {completed.length === 0 ? (
              <p className="rounded-md bg-white/10 p-4 text-sm text-slate-300">No completed matches yet.</p>
            ) : (
              completed.map((match) => {
                const opponent = match.teamAId === teamId ? match.teamB : match.teamA;
                const won = match.winnerTeamId === teamId;
                return (
                  <div key={match.matchId} className="rounded-md border border-white/10 bg-white/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">vs {opponent?.name || "TBD"}</p>
                      <Badge className={won ? "bg-emerald-500 text-slate-950" : "bg-red-600 text-white"}>
                        {won ? "WON" : "LOST"}
                      </Badge>
                    </div>
                    <p className="mt-1 text-2xl font-bold tabular-nums">
                      {match.scoreA ?? "-"} - {match.scoreB ?? "-"}
                    </p>
                    <p className="text-xs text-slate-300">{match.roundLabel} · {formatScheduleDateTime(match.scheduledAt)}</p>
                  </div>
                );
              })
            )}
          </TabsContent>
          <TabsContent value="upcoming" className="space-y-3">
            {upcoming.length === 0 ? (
              <p className="rounded-md bg-white/10 p-4 text-sm text-slate-300">No upcoming matches.</p>
            ) : (
              upcoming.map((match, index) => {
                const opponent = match.teamAId === teamId ? match.teamB : match.teamA;
                return (
                  <div key={match.matchId} className="rounded-md border border-white/10 bg-white/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold">vs {opponent?.name || "TBD"}</p>
                      {index === 0 && <Badge className="gap-1 bg-emerald-500 text-slate-950"><Circle className="h-2 w-2 fill-current" />Next Match</Badge>}
                    </div>
                    <p className="text-sm text-slate-300">{formatScheduleDateTime(match.scheduledAt)} · {match.court_name || match.court || "Court TBD"}</p>
                    <Badge variant="outline" className="mt-2 border-white/20 text-white">{match.roundLabel}</Badge>
                  </div>
                );
              })
            )}
          </TabsContent>
          <TabsContent value="stats" className="space-y-3">
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md bg-white/10 p-3 text-center"><p className="text-xs text-slate-300">PF</p><p className="text-xl font-bold">{pointsFor}</p></div>
              <div className="rounded-md bg-white/10 p-3 text-center"><p className="text-xs text-slate-300">PA</p><p className="text-xl font-bold">{pointsAgainst}</p></div>
              <div className="rounded-md bg-white/10 p-3 text-center"><p className="text-xs text-slate-300">Diff</p><p className="text-xl font-bold">{pointsFor - pointsAgainst}</p></div>
            </div>
            <div className="rounded-md bg-white/10 p-4">
              <p className="mb-2 text-sm text-slate-300">Win rate</p>
              <div className="h-3 rounded-full bg-white/10">
                <div className="h-3 rounded-full bg-emerald-500" style={{ width: `${completed.length ? Math.round((wins / completed.length) * 100) : 0}%` }} />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

function TournamentSectionItem({
  value,
  title,
  children,
}: {
  value: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger className="px-4 text-base font-semibold">{title}</AccordionTrigger>
      <AccordionContent className="px-4 pt-0 space-y-5">{children}</AccordionContent>
    </AccordionItem>
  );
}

export default function TournamentPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<PublicTournamentPayload>({
    queryKey: ["publicTournaments"],
    queryFn: () => publicApi.getPublicTournaments(),
  });

  const tournaments = data?.tournaments || [];
  const [expandedTournamentId, setExpandedTournamentId] = useState<string>("");
  const [registrationTournamentId, setRegistrationTournamentId] = useState<string>("");
  const [teamPlayer1, setTeamPlayer1] = useState("");
  const [teamPlayer2, setTeamPlayer2] = useState("");
  const [contactMobileNumber, setContactMobileNumber] = useState("");
  const [selectedProfile, setSelectedProfile] = useState<{ tournamentId: string; teamId: string } | null>(null);

  const registrationTournament = tournaments.find((item) => item._id === registrationTournamentId) || null;
  const profileTournament = selectedProfile
    ? tournaments.find((item) => item._id === selectedProfile.tournamentId) || null
    : null;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["publicTournaments"] });
  };

  const resetRegistrationForm = () => {
    setTeamPlayer1("");
    setTeamPlayer2("");
    setContactMobileNumber("");
  };

  const registerMutation = useMutation({
    mutationFn: () =>
      publicApi.registerPublicTournamentTeam(registrationTournament!._id, {
        teamName:
          registrationTournament?.type === "doubles"
            ? `${teamPlayer1.trim()}+${teamPlayer2.trim()}`
            : teamPlayer1.trim(),
        contactMobileNumber,
      }),
    onSuccess: async () => {
      resetRegistrationForm();
      setRegistrationTournamentId("");
      await refresh();
      toast({ title: "Team registration submitted" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const canSubmitRegistration = useMemo(
    () =>
      Boolean(
        registrationTournament &&
          teamPlayer1.trim() &&
          (registrationTournament.type !== "doubles" || teamPlayer2.trim())
      ),
    [registrationTournament, teamPlayer1, teamPlayer2]
  );

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
        <p className="mt-3 text-muted-foreground">Tournament view is currently disabled by the admin.</p>
        <Button asChild className="mt-6">
          <Link to="/">Back to Home</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-background to-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">UBISmashers Tournament</h1>
            <p className="text-sm text-muted-foreground">Click a tournament to view details and register your team.</p>
          </div>
          <Button asChild variant="outline">
            <Link to="/">
              Back to Home
              <ChevronRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {tournaments.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">No tournament is currently available.</CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {tournaments.map((tournament) => {
              const openTeamProfile = (teamId: string) => setSelectedProfile({ tournamentId: tournament._id, teamId });
              const isExpanded = expandedTournamentId === tournament._id;
              const now = new Date();
              const deadline = tournament.registrationDeadline ? new Date(tournament.registrationDeadline) : null;
              const isDeadlinePassed = Boolean(deadline && now > deadline);
              const canRegister =
                tournament.allowTeamRegistration &&
                tournament.status !== "completed" &&
                Boolean(deadline) &&
                !isDeadlinePassed;

              const visibleMatches = getPublicVisibleMatches(tournament);
              const bracketMatches = getPublicBracketMatches(tournament);
              const bracketTournament = { ...tournament, matches: bracketMatches };
              const sortedMatches = [...visibleMatches].sort((a, b) => {
                const aTs = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
                const bTs = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
                if (aTs !== bTs) return aTs - bTs;
                if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
                return a.matchNumber - b.matchNumber;
              });
              const upcomingMatches = sortedMatches.filter((match) => !match.isCompleted);
              const pastMatches = sortedMatches.filter((match) => match.isCompleted);
              const groupView = buildTournamentGroupView(tournament);
              const courtScheduleGroups = buildCourtScheduleGroups(sortedMatches);
              const isFormOpen = registrationTournamentId === tournament._id;

              return (
                <Card key={tournament._id}>
                  <CardHeader className="cursor-pointer" onClick={() => setExpandedTournamentId(isExpanded ? "" : tournament._id)}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <CardTitle className="text-lg">{tournament.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(tournament.date), "dd MMM yyyy")} • {tournament.location}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          className={
                            tournament.status === "completed"
                              ? "bg-emerald-600 text-white"
                              : tournament.status === "ongoing"
                              ? "bg-blue-600 text-white"
                              : "bg-amber-500 text-black"
                          }
                        >
                          {tournament.status}
                        </Badge>
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </div>
                    </div>
                  </CardHeader>

                  {isExpanded && (
                    <CardContent className="space-y-5">
                      <img
                        src="/tournamentbanner.png"
                        alt={`${tournament.name} poster`}
                        className="max-h-[420px] w-full rounded-md border object-contain bg-black"
                      />
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                        <div className="rounded-md border p-3 text-sm">Type: {tournament.type}</div>
                        <div className="rounded-md border p-3 text-sm">
                          Format: {tournamentFormatLabel[tournament.format]}
                        </div>
                        <div className="rounded-md border p-3 text-sm">
                          Deadline: {deadline ? format(deadline, "dd MMM yyyy") : "Not set"}
                        </div>
                        <div className="rounded-md border p-3 text-sm">
                          Fee: {tournament.entryFee ? `$${tournament.entryFee}` : "Free"}
                        </div>
                        <div className="rounded-md border p-3 text-sm">Teams: {tournament.teams.length}</div>
                        <div className="rounded-md border p-3 text-sm">
                          {tournament.format === "group_knockout"
                            ? `Groups: ${tournament.tournamentGroups.length || tournament.groupCount || 0}`
                            : "Groups: Not used"}
                        </div>
                        <div className="rounded-md border p-3 text-sm sm:col-span-2 lg:col-span-6">
                          Qualification Rule:{" "}
                          {tournament.format === "group_knockout"
                            ? `Top ${tournament.teamsQualifyingPerGroup || 2} teams per group advance to knockout`
                            : tournament.format === "round_robin"
                            ? "All teams share one overall standings table"
                            : "Pure knockout bracket; standings are hidden"}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          onClick={() => {
                            if (isFormOpen) {
                              setRegistrationTournamentId("");
                              return;
                            }
                            setRegistrationTournamentId(tournament._id);
                            resetRegistrationForm();
                          }}
                          disabled={!canRegister}
                        >
                          {isFormOpen ? "Close Registration Form" : "Register Team"}
                        </Button>
                        {!canRegister && (
                          <p className="text-xs text-muted-foreground">
                            {!tournament.allowTeamRegistration
                              ? "Admin has not opened registration."
                              : !deadline
                              ? "Registration deadline is not set."
                              : isDeadlinePassed
                              ? "Registration deadline has passed."
                              : tournament.status === "completed"
                              ? "Tournament is completed."
                              : "Registration is currently unavailable."}
                          </p>
                        )}
                      </div>

                      {isFormOpen && registrationTournament && (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Team Registration</CardTitle>
                          </CardHeader>
                          <CardContent className="space-y-4">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="space-y-1">
                                <Label>Player 1</Label>
                                <Input
                                  value={teamPlayer1}
                                  onChange={(e) => setTeamPlayer1(e.target.value)}
                                  placeholder="Player 1"
                                />
                              </div>
                              {registrationTournament.type === "doubles" ? (
                                <div className="space-y-1">
                                  <Label>Player 2</Label>
                                  <Input
                                    value={teamPlayer2}
                                    onChange={(e) => setTeamPlayer2(e.target.value)}
                                    placeholder="Player 2"
                                  />
                                </div>
                              ) : (
                                <div />
                              )}
                            </div>
                            <div className="space-y-1">
                              <Label>Contact Mobile Number (Optional)</Label>
                              <Input
                                value={contactMobileNumber}
                                onChange={(e) => setContactMobileNumber(e.target.value)}
                                placeholder="Enter contact mobile number"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Team name will be created internally as <span className="font-medium">Player1+Player2</span>.
                            </p>

                            <Button onClick={() => registerMutation.mutate()} disabled={!canSubmitRegistration}>
                              Submit Team Registration
                            </Button>
                          </CardContent>
                        </Card>
                      )}

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Registered Teams</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {tournament.teams.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No teams registered yet.</p>
                          ) : (
                            <div className="grid gap-2 sm:grid-cols-2">
                              {tournament.teams.map((team) => (
                                <button
                                  key={team._id}
                                  type="button"
                                  onClick={() => openTeamProfile(team._id)}
                                  className="rounded-md border p-3 text-left text-sm transition hover:border-emerald-500 hover:shadow-sm"
                                >
                                  <p className="font-medium">{team.name}</p>
                                  <p className="text-muted-foreground">{team.players.join(" / ")}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      {tournament.isVisibleToMembers && (
                        <TournamentPointsTable tournament={tournament} onTeamClick={openTeamProfile} />
                      )}
                      {tournament.isVisibleToMembers && (
                      <Accordion type="multiple" className="overflow-hidden rounded-lg border">
                        {groupView.length > 0 && (
                          <TournamentSectionItem value={`groupAllocation-${tournament._id}`} title="Group Allocation">
                            <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Group Allocation</CardTitle>
                            </CardHeader>
                            <CardContent>
                              <div className="grid gap-3 md:grid-cols-2">
                                {groupView.map((group) => (
                                  <div key={group.label} className="rounded-md border">
                                    <div className="border-b bg-secondary/30 px-3 py-2 text-sm font-semibold">
                                      {group.label}
                                    </div>
                                    <div className="overflow-x-auto">
                                      <table className="min-w-full text-sm">
                                        <thead>
                                          <tr className="border-b text-left">
                                            <th className="px-3 py-2">Team</th>
                                            <th className="px-3 py-2">Players</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {group.teams.map((team) => (
                                            <tr key={`${group.label}-${team._id}`} className="border-b last:border-0">
                                              <td className="px-3 py-2 font-medium">
                                                <TeamButton team={team} onClick={openTeamProfile} />
                                              </td>
                                              <td className="px-3 py-2 text-muted-foreground">{team.players.join(" / ")}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </CardContent>
                            </Card>
                          </TournamentSectionItem>
                        )}

                        {bracketMatches.length > 0 && (
                          <TournamentSectionItem value={`tournamentBracket-${tournament._id}`} title="Tournament Bracket">
                            <TournamentBracket tournament={bracketTournament} />
                          </TournamentSectionItem>
                        )}

                        <TournamentSectionItem value={`matchResults-${tournament._id}`} title="Match Results">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Match Results</CardTitle>
                            </CardHeader>
                            <CardContent>
                              {sortedMatches.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No matches available yet.</p>
                              ) : (
                                <div className="space-y-2">
                                  {sortedMatches.map((match) => {
                                    const hasScore = match.scoreA !== null && match.scoreB !== null;

                                    return (
                                      <div key={`result-${match.matchId}`} className="rounded-md border p-3 text-sm">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <p className="font-medium">{match.roundLabel}</p>
                                          <div className="flex items-center gap-2">
                                            {match.isManual && <Badge variant="outline">Manual</Badge>}
                                            <Badge variant="secondary">{match.matchType}</Badge>
                                            {hasScore ? (
                                              <Badge className="bg-emerald-600 text-white">Completed</Badge>
                                            ) : (
                                              <Badge variant="outline">Pending</Badge>
                                            )}
                                          </div>
                                        </div>
                                        <p className="text-muted-foreground">
                                          {match.teamA?.name || "TBD"} {hasScore ? match.scoreA : "-"} -{" "}
                                          {hasScore ? match.scoreB : "-"} {match.teamB?.name || "TBD"}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {formatScheduleDateTime(match.scheduledAt)}
                                          {match.court ? ` • Court: ${match.court}` : ""}
                                          {match.winnerTeam ? ` • Winner: ${match.winnerTeam.name}` : ""}
                                        </p>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </TournamentSectionItem>

                        <TournamentSectionItem value={`matchSchedule-${tournament._id}`} title="Match Schedule">
                          <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Match Schedule By Court</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {courtScheduleGroups.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No schedule available yet.</p>
                          ) : (
                            <div className="space-y-3">
                              {courtScheduleGroups.map((court) => (
                                <div key={court.courtName} className="rounded-md border">
                                  <div className="border-b bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
                                    {court.courtName}
                                  </div>
                                  <div className="space-y-3 p-3">
                                    {court.groups.map((group) => (
                                      <div key={`${court.courtName}-${group.groupLabel}`} className="rounded-md border bg-card">
                                        <div className="border-b bg-secondary/30 px-3 py-2 text-sm font-semibold">
                                          {group.groupLabel} Matches ({group.rows.length})
                                        </div>
                                        <div className="grid gap-2 p-3">
                                          {group.rows.map((row) => (
                                            <div key={`${court.courtName}-${row.matchId}`} className="rounded-md border px-3 py-2 text-sm">
                                              <div className="flex flex-wrap items-center justify-between gap-2">
                                                <p className="font-medium">
                                                  {row.teamAName} vs {row.teamBName}
                                                </p>
                                                <Badge className={row.status === "Done" ? "bg-emerald-600 text-white" : "bg-amber-500 text-black"}>
                                                  {row.status}
                                                </Badge>
                                              </div>
                                              <p className="mt-1 text-xs text-muted-foreground">
                                                {row.slotLabel} · {row.court} · Score: {row.scoreLabel}
                                              </p>
                                              {row.backToBackTeams.length > 0 && (
                                                <Badge variant="outline" className="mt-2 gap-1 border-amber-500/40 text-amber-700">
                                                  <AlertTriangle className="h-3.5 w-3.5" />
                                                  Back-to-back for {row.backToBackTeams.join(", ")}
                                                </Badge>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                          </Card>
                        </TournamentSectionItem>

                        <TournamentSectionItem value={`upcomingMatches-${tournament._id}`} title="Upcoming Matches">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Upcoming Matches</CardTitle>
                            </CardHeader>
                            <CardContent>
                            {upcomingMatches.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No upcoming matches.</p>
                            ) : (
                              <div className="space-y-2">
                                {upcomingMatches.map((match) => (
                                  <div key={match.matchId} className="rounded-md border p-3 text-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="font-medium">{match.roundLabel}</p>
                                      <div className="flex items-center gap-2">
                                        {match.isManual && <Badge variant="outline">Manual</Badge>}
                                        <Badge variant="secondary">{match.matchType}</Badge>
                                      </div>
                                    </div>
                                    <p className="text-muted-foreground">
                                      {match.teamA?.name || "TBD"} vs {match.teamB?.name || "TBD"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatScheduleDateTime(match.scheduledAt)}
                                      {match.court ? ` • Court: ${match.court}` : ""}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                          </Card>
                        </TournamentSectionItem>

                        <TournamentSectionItem value={`pastMatches-${tournament._id}`} title="Past Matches">
                          <Card>
                            <CardHeader>
                              <CardTitle className="text-base">Past Matches</CardTitle>
                            </CardHeader>
                            <CardContent>
                            {pastMatches.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No completed matches yet.</p>
                            ) : (
                              <div className="space-y-2">
                                {pastMatches.map((match) => (
                                  <div key={match.matchId} className="rounded-md border p-3 text-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <p className="font-medium">{match.roundLabel}</p>
                                      <div className="flex items-center gap-2">
                                        {match.isManual && <Badge variant="outline">Manual</Badge>}
                                        <Badge variant="secondary">{match.matchType}</Badge>
                                      </div>
                                    </div>
                                    <p className="text-muted-foreground">
                                      {match.teamA?.name || "TBD"} {match.scoreA ?? "-"} - {match.scoreB ?? "-"}{" "}
                                      {match.teamB?.name || "TBD"}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {formatScheduleDateTime(match.scheduledAt)}
                                      {match.court ? ` • Court: ${match.court}` : ""}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </TournamentSectionItem>
                    </Accordion>
                      )}
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
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
                      {item.finalScore && <p className="mt-1 text-xs text-muted-foreground">Final: {item.finalScore}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {selectedProfile && (
        <TeamProfileDrawer
          tournament={profileTournament}
          teamId={selectedProfile.teamId}
          onClose={() => setSelectedProfile(null)}
        />
      )}
    </div>
  );
}

