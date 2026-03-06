import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { TournamentBracket } from "@/components/tournament/TournamentBracket";
import { TournamentOverview } from "@/components/tournament/TournamentOverview";
import type { Tournament } from "@/types/tournament";

const statusOptions = [
  { label: "Upcoming", value: "upcoming" },
  { label: "Ongoing", value: "ongoing" },
  { label: "Completed", value: "completed" },
] as const;

export default function Tournaments() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [form, setForm] = useState({
    name: "",
    date: "",
    location: "",
    type: "doubles" as "singles" | "doubles",
    entryFee: "",
    status: "upcoming" as "upcoming" | "ongoing" | "completed",
    isVisibleToMembers: true,
  });
  const [teamName, setTeamName] = useState("");
  const [players, setPlayers] = useState<string[]>(["", ""]);

  const { data: tournaments = [] } = useQuery<Tournament[]>({
    queryKey: ["tournaments"],
    queryFn: () => api.getTournaments(),
  });

  const { data: config } = useQuery({
    queryKey: ["tournamentConfig"],
    queryFn: () => api.getTournamentConfig(),
  });

  const selectedTournament = useMemo(
    () => tournaments.find((item) => item._id === selectedTournamentId) || tournaments[0],
    [selectedTournamentId, tournaments]
  );

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["tournaments"] }),
      queryClient.invalidateQueries({ queryKey: ["publicTournaments"] }),
      queryClient.invalidateQueries({ queryKey: ["publicTournamentConfig"] }),
      queryClient.invalidateQueries({ queryKey: ["tournamentConfig"] }),
    ]);
  };

  const createTournamentMutation = useMutation({
    mutationFn: () =>
      api.createTournament({
        name: form.name,
        date: form.date,
        location: form.location,
        type: form.type,
        entryFee: form.entryFee ? Number(form.entryFee) : 0,
        status: form.status,
        isVisibleToMembers: form.isVisibleToMembers,
      }),
    onSuccess: async (created) => {
      setSelectedTournamentId(created._id);
      setForm({
        name: "",
        date: "",
        location: "",
        type: "doubles",
        entryFee: "",
        status: "upcoming",
        isVisibleToMembers: true,
      });
      await refresh();
      toast({ title: "Tournament created" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateConfigMutation = useMutation({
    mutationFn: (enabled: boolean) => api.updateTournamentConfig(enabled),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Tournament visibility updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateTournamentMutation = useMutation({
    mutationFn: (payload: Partial<Tournament>) => api.updateTournament(selectedTournament!._id, payload),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Tournament updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const deleteTournamentMutation = useMutation({
    mutationFn: (id: string) => api.deleteTournament(id),
    onSuccess: async () => {
      setSelectedTournamentId("");
      await refresh();
      toast({ title: "Tournament deleted" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const addTeamMutation = useMutation({
    mutationFn: () =>
      api.addTournamentTeam(selectedTournament!._id, {
        name: teamName || undefined,
        players: players.filter(Boolean),
      }),
    onSuccess: async () => {
      setTeamName("");
      setPlayers(selectedTournament?.type === "doubles" ? ["", ""] : [""]);
      await refresh();
      toast({ title: "Team added" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const removeTeamMutation = useMutation({
    mutationFn: (teamId: string) => api.removeTournamentTeam(selectedTournament!._id, teamId),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Team removed" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const generateBracketMutation = useMutation({
    mutationFn: () => api.generateTournamentBracket(selectedTournament!._id),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Bracket generated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateScoreMutation = useMutation({
    mutationFn: ({ matchId, scoreA, scoreB }: { matchId: string; scoreA: number; scoreB: number }) =>
      api.updateTournamentMatchScore(selectedTournament!._id, matchId, { scoreA, scoreB }),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Score updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const declareWinnerMutation = useMutation({
    mutationFn: (teamId: string) => api.declareTournamentWinner(selectedTournament!._id, teamId),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Winner declared" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const canAddTeams = Boolean(selectedTournament && selectedTournament.matches.length === 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tournaments</h1>
            <p className="text-sm text-muted-foreground">Manage tournament setup, bracket progress, and winner tracking.</p>
          </div>
          <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2">
            <span className="text-sm font-medium">Show tournament to members</span>
            <Switch
              checked={Boolean(config?.enabled)}
              onCheckedChange={(checked) => updateConfigMutation.mutate(checked)}
            />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Create Tournament</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label>Name</Label>
                <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Date</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Location / Court</Label>
                <Input value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(value: "singles" | "doubles") => setForm((prev) => ({ ...prev, type: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="singles">Singles</SelectItem>
                      <SelectItem value="doubles">Doubles</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Entry Fee</Label>
                  <Input
                    type="number"
                    min={0}
                    value={form.entryFee}
                    onChange={(e) => setForm((prev) => ({ ...prev, entryFee: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Status</Label>
                <Select
                  value={form.status}
                  onValueChange={(value: "upcoming" | "ongoing" | "completed") => setForm((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border p-2">
                <span className="text-sm">Visible in member tournament page</span>
                <Switch
                  checked={form.isVisibleToMembers}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isVisibleToMembers: checked }))}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createTournamentMutation.mutate()}
                disabled={!form.name || !form.date || !form.location}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Tournament
              </Button>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="space-y-3">
              <CardTitle>Manage Tournament</CardTitle>
              <Select value={selectedTournament?._id || ""} onValueChange={setSelectedTournamentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select tournament" />
                </SelectTrigger>
                <SelectContent>
                  {tournaments.map((item) => (
                    <SelectItem key={item._id} value={item._id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {!selectedTournament ? (
                <p className="text-sm text-muted-foreground">Create a tournament to begin.</p>
              ) : (
                <div className="space-y-5">
                  <TournamentOverview tournament={selectedTournament} />

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        updateTournamentMutation.mutate({ isVisibleToMembers: !selectedTournament.isVisibleToMembers })
                      }
                    >
                      {selectedTournament.isVisibleToMembers ? "Hide from Members" : "Show to Members"}
                    </Button>
                    <Button variant="outline" onClick={() => generateBracketMutation.mutate()}>
                      Generate Bracket
                    </Button>
                    <Button
                      variant="outline"
                      disabled={!selectedTournament.championTeam}
                      onClick={() =>
                        selectedTournament.championTeam &&
                        declareWinnerMutation.mutate(selectedTournament.championTeam._id)
                      }
                    >
                      Declare Winner
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => deleteTournamentMutation.mutate(selectedTournament._id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </Button>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Teams</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          placeholder="Team name (optional)"
                          value={teamName}
                          onChange={(event) => setTeamName(event.target.value)}
                          disabled={!canAddTeams}
                        />
                        <Button onClick={() => addTeamMutation.mutate()} disabled={!canAddTeams}>
                          Add Team
                        </Button>
                      </div>
                      <div className={`grid gap-2 ${selectedTournament.type === "doubles" ? "sm:grid-cols-2" : "sm:grid-cols-1"}`}>
                        {(selectedTournament.type === "doubles" ? [0, 1] : [0]).map((index) => (
                          <Input
                            key={index}
                            placeholder={`Player ${index + 1}`}
                            value={players[index] || ""}
                            onChange={(event) =>
                              setPlayers((prev) => {
                                const next = [...prev];
                                next[index] = event.target.value;
                                return next;
                              })
                            }
                            disabled={!canAddTeams}
                          />
                        ))}
                      </div>
                      {!canAddTeams && (
                        <p className="text-xs text-muted-foreground">
                          Team edits are disabled after bracket generation.
                        </p>
                      )}
                      <div className="space-y-2">
                        {selectedTournament.teams.map((team) => (
                          <div key={team._id} className="flex items-center justify-between rounded-md border bg-secondary/30 px-3 py-2">
                            <div>
                              <p className="font-medium">{team.name}</p>
                              <p className="text-xs text-muted-foreground">{team.players.join(" / ")}</p>
                            </div>
                            {canAddTeams && (
                              <Button size="sm" variant="ghost" onClick={() => removeTeamMutation.mutate(team._id)}>
                                Remove
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {selectedTournament.matches.length > 0 && (
                    <TournamentBracket
                      tournament={selectedTournament}
                      editable
                      onSubmitScore={(matchId, scoreA, scoreB) =>
                        updateScoreMutation.mutateAsync({ matchId, scoreA, scoreB })
                      }
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
