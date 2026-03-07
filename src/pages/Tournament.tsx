import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ChevronDown, ChevronRight, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { TournamentBracket } from "@/components/tournament/TournamentBracket";
import { TournamentPointsTable } from "@/components/tournament/TournamentPointsTable";
import { createApiClient } from "@/lib/api";
import type { PublicTournamentPayload, Tournament } from "@/types/tournament";

const publicApi = createApiClient(() => null, () => {});

type RegistrationMemberForm = {
  name: string;
  mobileNumber: string;
  gender: "male" | "female" | "other";
  isAvailable: boolean;
};

const buildMemberForm = (count: number): RegistrationMemberForm[] =>
  Array.from({ length: count }, () => ({
    name: "",
    mobileNumber: "",
    gender: "male",
    isAvailable: false,
  }));

export default function TournamentPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery<PublicTournamentPayload>({
    queryKey: ["publicTournaments"],
    queryFn: () => publicApi.getPublicTournaments(),
  });

  const tournaments = data?.tournaments || [];
  const [expandedTournamentId, setExpandedTournamentId] = useState<string>("");
  const [registrationTournamentId, setRegistrationTournamentId] = useState<string>("");
  const [teamName, setTeamName] = useState("");
  const [teamLeadName, setTeamLeadName] = useState("");
  const [members, setMembers] = useState<RegistrationMemberForm[]>(buildMemberForm(1));

  const registrationTournament = tournaments.find((item) => item._id === registrationTournamentId) || null;
  const expectedMemberCount = registrationTournament?.type === "doubles" ? 2 : 1;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["publicTournaments"] });
  };

  const resetRegistrationForm = (memberCount: number) => {
    setTeamName("");
    setTeamLeadName("");
    setMembers(buildMemberForm(memberCount));
  };

  const registerMutation = useMutation({
    mutationFn: () =>
      publicApi.registerPublicTournamentTeam(registrationTournament!._id, {
        teamName,
        teamLeadName,
        members,
      }),
    onSuccess: async () => {
      resetRegistrationForm(expectedMemberCount);
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
          teamName.trim() &&
          teamLeadName.trim() &&
          members.length === expectedMemberCount &&
          members.every(
            (member) =>
              member.name.trim() &&
              member.mobileNumber.trim() &&
              member.gender &&
              member.isAvailable
          )
      ),
    [registrationTournament, teamName, teamLeadName, members, expectedMemberCount]
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
              const isExpanded = expandedTournamentId === tournament._id;
              const now = new Date();
              const deadline = tournament.registrationDeadline ? new Date(tournament.registrationDeadline) : null;
              const isDeadlinePassed = Boolean(deadline && now > deadline);
              const canRegister =
                tournament.isVisibleToMembers &&
                tournament.allowTeamRegistration &&
                tournament.status !== "completed" &&
                Boolean(deadline) &&
                !isDeadlinePassed;

              const sortedMatches = [...tournament.matches].sort((a, b) => {
                const aTs = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
                const bTs = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
                if (aTs !== bTs) return aTs - bTs;
                if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
                return a.matchNumber - b.matchNumber;
              });
              const upcomingMatches = sortedMatches.filter((match) => !match.isCompleted);
              const pastMatches = sortedMatches.filter((match) => match.isCompleted);
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
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="rounded-md border p-3 text-sm">Type: {tournament.type}</div>
                        <div className="rounded-md border p-3 text-sm">
                          Deadline: {deadline ? format(deadline, "dd MMM yyyy") : "Not set"}
                        </div>
                        <div className="rounded-md border p-3 text-sm">
                          Fee: {tournament.entryFee ? `$${tournament.entryFee}` : "Free"}
                        </div>
                        <div className="rounded-md border p-3 text-sm">Teams: {tournament.teams.length}</div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          onClick={() => {
                            if (isFormOpen) {
                              setRegistrationTournamentId("");
                              return;
                            }
                            setRegistrationTournamentId(tournament._id);
                            resetRegistrationForm(tournament.type === "doubles" ? 2 : 1);
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
                            <div className="space-y-1">
                              <Label>Team Name</Label>
                              <Input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Enter team name" />
                            </div>
                            <div className="space-y-1">
                              <Label>Team Lead Name</Label>
                              <Input
                                value={teamLeadName}
                                onChange={(e) => setTeamLeadName(e.target.value)}
                                placeholder="Enter team lead name"
                              />
                            </div>

                            {members.map((member, index) => (
                              <div key={index} className="space-y-3 rounded-md border p-3">
                                <p className="text-sm font-medium">Member {index + 1}</p>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <div className="space-y-1">
                                    <Label>Name</Label>
                                    <Input
                                      value={member.name}
                                      onChange={(e) =>
                                        setMembers((prev) =>
                                          prev.map((item, itemIndex) =>
                                            itemIndex === index ? { ...item, name: e.target.value } : item
                                          )
                                        )
                                      }
                                      placeholder="Member name"
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label>Mobile Number</Label>
                                    <Input
                                      value={member.mobileNumber}
                                      onChange={(e) =>
                                        setMembers((prev) =>
                                          prev.map((item, itemIndex) =>
                                            itemIndex === index ? { ...item, mobileNumber: e.target.value } : item
                                          )
                                        )
                                      }
                                      placeholder="Mobile number"
                                    />
                                  </div>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <div className="space-y-1">
                                    <Label>Gender</Label>
                                    <Select
                                      value={member.gender}
                                      onValueChange={(value: "male" | "female" | "other") =>
                                        setMembers((prev) =>
                                          prev.map((item, itemIndex) =>
                                            itemIndex === index ? { ...item, gender: value } : item
                                          )
                                        )
                                      }
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="male">Male</SelectItem>
                                        <SelectItem value="female">Female</SelectItem>
                                        <SelectItem value="other">Other</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex items-center gap-2 pt-6">
                                    <Checkbox
                                      checked={member.isAvailable}
                                      onCheckedChange={(checked) =>
                                        setMembers((prev) =>
                                          prev.map((item, itemIndex) =>
                                            itemIndex === index ? { ...item, isAvailable: checked === true } : item
                                          )
                                        )
                                      }
                                    />
                                    <Label>I confirm availability on tournament day</Label>
                                  </div>
                                </div>
                              </div>
                            ))}

                            <Button onClick={() => registerMutation.mutate()} disabled={!canSubmitRegistration}>
                              Submit Team Registration
                            </Button>
                          </CardContent>
                        </Card>
                      )}

                      <TournamentPointsTable tournament={tournament} />
                      {tournament.matches.length > 0 && <TournamentBracket tournament={tournament} />}

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Team Details</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {tournament.teams.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No teams added yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {tournament.teams.map((team) => (
                                <div key={team._id} className="rounded-md border bg-secondary/20 p-3">
                                  <p className="font-medium">{team.name}</p>
                                  <p className="text-sm text-muted-foreground">{team.players.join(" / ")}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>

                      <div className="grid gap-4 lg:grid-cols-2">
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
                                      {match.scheduledAt ? new Date(match.scheduledAt).toLocaleString() : "Schedule TBD"}
                                      {match.court ? ` • Court: ${match.court}` : ""}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>

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
                                      {match.scheduledAt ? new Date(match.scheduledAt).toLocaleString() : "Schedule TBD"}
                                      {match.court ? ` • Court: ${match.court}` : ""}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
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
    </div>
  );
}
