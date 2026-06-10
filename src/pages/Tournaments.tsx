import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronUp, Download, Lock, Pencil, Plus, Trash2, Unlock, X } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { TournamentBracket } from "@/components/tournament/TournamentBracket";
import { TournamentOverview } from "@/components/tournament/TournamentOverview";
import { TournamentPointsTable } from "@/components/tournament/TournamentPointsTable";
import { buildTournamentGroupView } from "@/lib/tournamentGroups";
import { buildCourtScheduleGroups, buildScheduleRows, formatScheduleDateTime } from "@/lib/tournamentSchedule";
import type { Tournament, TournamentIncomingType, TournamentMatchType } from "@/types/tournament";

const statusOptions = [
  { label: "Upcoming", value: "upcoming" },
  { label: "Ongoing", value: "ongoing" },
  { label: "Completed", value: "completed" },
] as const;

const formatOptions = [
  { label: "Knockout", value: "knockout" },
  { label: "Round Robin", value: "round_robin" },
  { label: "Group + Knockout", value: "group_knockout" },
] as const;

const groupDistributionOptions = [
  { label: "Random Distribution", value: "random" },
  { label: "Balanced Distribution", value: "balanced" },
  { label: "Manual Distribution", value: "manual" },
] as const;

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

const customMatchTypeOptions: Array<{ label: string; value: TournamentMatchType }> = [
  { label: "League Match", value: "league" },
  { label: "Semi Final", value: "semifinal" },
  { label: "Final", value: "final" },
  { label: "Friendly", value: "friendly" },
  { label: "Practice", value: "practice" },
];

const formatMoney = (value: number) => `Rs ${Number(value || 0).toFixed(2)}`;

const formatShortDate = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString();
};

const getAutoGroupCount = (teamCount: number) => {
  if (teamCount <= 8) return 2;
  if (teamCount <= 24) return 4;
  return Math.min(16, Math.max(2, Math.ceil(teamCount / 4)));
};

const isAdminGroupLeagueMatch = (match: Tournament["matches"][number]) =>
  match.matchType === "league" && /^Group\s/i.test(match.roundLabel || "");

const isAdminKnockoutStageMatch = (match: Tournament["matches"][number]) =>
  !isAdminGroupLeagueMatch(match) &&
  match.matchType !== "friendly" &&
  match.matchType !== "practice" &&
  match.roundNumber >= 2;

const getBracketActionState = (tournament: Tournament) => {
  if (tournament.format !== "group_knockout") {
    return { label: "Generate Bracket", disabled: false };
  }

  const groupMatches = tournament.matches.filter(isAdminGroupLeagueMatch);
  const knockoutMatches = tournament.matches.filter(isAdminKnockoutStageMatch);
  const allGroupMatchesCompleted = groupMatches.length > 0 && groupMatches.every((match) => match.isCompleted);

  if (groupMatches.length === 0) {
    return { label: "Generate Group Fixtures", disabled: false };
  }
  if (knockoutMatches.length > 0) {
    return { label: "Knockout Bracket Generated", disabled: true };
  }
  if (!allGroupMatchesCompleted) {
    return { label: "Complete Group Matches First", disabled: true };
  }

  return { label: "Generate Knockout Bracket", disabled: false };
};

const getAdminBracketMatches = (tournament: Tournament) => {
  if (tournament.format === "knockout") return tournament.matches;
  if (tournament.format === "round_robin") return tournament.matches.filter(isAdminKnockoutStageMatch);

  const groupMatches = tournament.matches.filter(isAdminGroupLeagueMatch);
  const allGroupMatchesCompleted = groupMatches.length > 0 && groupMatches.every((match) => match.isCompleted);
  const knockoutMatches = tournament.matches.filter(isAdminKnockoutStageMatch);
  const knockoutGenerated = knockoutMatches.some((match) => match.teamAId || match.teamBId);

  return allGroupMatchesCompleted && knockoutGenerated ? knockoutMatches : [];
};

export default function Tournaments() {
  const { api } = useAuth();
  const queryClient = useQueryClient();
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>("");
  const [showCreateTournament, setShowCreateTournament] = useState(false);
  const [form, setForm] = useState({
    name: "",
    date: "",
    time: "",
    location: "",
    type: "doubles" as "singles" | "doubles",
    format: "knockout" as "knockout" | "round_robin" | "group_knockout",
    groupCount: "",
    groupDistributionMode: "random" as "random" | "balanced" | "manual",
    teamsQualifyingPerGroup: "2",
    enableManualGroupEditing: false,
    entryFee: "",
    status: "upcoming" as "upcoming" | "ongoing" | "completed",
    isVisibleToMembers: true,
    allowTeamRegistration: false,
    registrationDeadline: "",
  });
  const [editForm, setEditForm] = useState({
    name: "",
    date: "",
    time: "",
    location: "",
    type: "doubles" as "singles" | "doubles",
    format: "knockout" as "knockout" | "round_robin" | "group_knockout",
    groupCount: "",
    groupDistributionMode: "random" as "random" | "balanced" | "manual",
    teamsQualifyingPerGroup: "2",
    enableManualGroupEditing: false,
    entryFee: "",
    status: "upcoming" as "upcoming" | "ongoing" | "completed",
    isVisibleToMembers: true,
    allowTeamRegistration: false,
    registrationDeadline: "",
  });
  const [teamPlayer1, setTeamPlayer1] = useState("");
  const [teamPlayer2, setTeamPlayer2] = useState("");
  const [editingTeamId, setEditingTeamId] = useState("");
  const [adminContactMobileNumber, setAdminContactMobileNumber] = useState("");
  const [entryFeePaid, setEntryFeePaid] = useState("");
  const [customMatchForm, setCustomMatchForm] = useState({
    matchType: "friendly" as TournamentMatchType,
    teamAId: "",
    teamBId: "",
    date: "",
    time: "",
    court: "",
  });
  const [editingMatchId, setEditingMatchId] = useState("");
  const [scheduleDraftByMatch, setScheduleDraftByMatch] = useState<
    Record<string, { teamAId: string; teamBId: string; date: string; time: string; court: string }>
  >({});
  const [scoreDraftByMatch, setScoreDraftByMatch] = useState<
    Record<string, { scoreA: string; scoreB: string }>
  >({});
  const [editingScoreByMatch, setEditingScoreByMatch] = useState<Record<string, boolean>>({});
  const [scheduleConfig, setScheduleConfig] = useState({
    courtCount: 2,
    courtNames: ["Court A", "Court B"],
    startTime: "18:00",
    matchDurationMinutes: 10,
  });
  const [expenseForm, setExpenseForm] = useState({
    title: "",
    amount: "",
    note: "",
    date: "",
  });
  const [incomeForm, setIncomeForm] = useState({
    type: "donation" as TournamentIncomingType,
    title: "",
    amount: "",
    note: "",
    date: "",
  });
  const [financeTab, setFinanceTab] = useState<"expenses" | "incoming">("expenses");
  const [editingExpenseId, setEditingExpenseId] = useState("");
  const [editingIncomeId, setEditingIncomeId] = useState("");
  const [draggedTeamId, setDraggedTeamId] = useState("");
  const [groupRenameDrafts, setGroupRenameDrafts] = useState<Record<string, string>>({});
  const [teamToAddByGroup, setTeamToAddByGroup] = useState<Record<string, string>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmationName, setDeleteConfirmationName] = useState("");

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
  const bracketActionState = selectedTournament
    ? getBracketActionState(selectedTournament)
    : { label: "Generate Bracket", disabled: true };
  const adminBracketMatches = selectedTournament ? getAdminBracketMatches(selectedTournament) : [];
  const adminBracketTournament = selectedTournament
    ? { ...selectedTournament, matches: adminBracketMatches }
    : selectedTournament;
  const canConfirmTournamentDelete =
    Boolean(selectedTournament) && deleteConfirmationName === selectedTournament.name;

  useEffect(() => {
    if (!selectedTournament) return;
    setEditForm({
      name: selectedTournament.name,
      date: selectedTournament.date ? selectedTournament.date.slice(0, 10) : "",
      time: selectedTournament.time || "",
      location: selectedTournament.location,
      type: selectedTournament.type,
      format: selectedTournament.format || "knockout",
      groupCount: selectedTournament.groupCount?.toString() || "",
      groupDistributionMode: selectedTournament.groupDistributionMode || "random",
      teamsQualifyingPerGroup: selectedTournament.teamsQualifyingPerGroup?.toString() || "2",
      enableManualGroupEditing: selectedTournament.enableManualGroupEditing ?? false,
      entryFee: selectedTournament.entryFee?.toString() || "0",
      status: selectedTournament.status,
      isVisibleToMembers: selectedTournament.isVisibleToMembers,
      allowTeamRegistration: selectedTournament.allowTeamRegistration ?? false,
      registrationDeadline: selectedTournament.registrationDeadline ? selectedTournament.registrationDeadline.slice(0, 10) : "",
    });
  }, [selectedTournament]);

  useEffect(() => {
    if (!selectedTournament) return;
    setGroupRenameDrafts(
      Object.fromEntries((selectedTournament.tournamentGroups || []).map((group) => [group._id, group.groupName]))
    );
  }, [selectedTournament]);

  useEffect(() => {
    if (!selectedTournament) return;
    const toDatePart = (value: Date) => {
      const y = value.getUTCFullYear();
      const m = String(value.getUTCMonth() + 1).padStart(2, "0");
      const d = String(value.getUTCDate()).padStart(2, "0");
      return `${y}-${m}-${d}`;
    };
    const toTimePart = (value: Date) => {
      const h = String(value.getUTCHours()).padStart(2, "0");
      const m = String(value.getUTCMinutes()).padStart(2, "0");
      return `${h}:${m}`;
    };
    const next: Record<string, { teamAId: string; teamBId: string; date: string; time: string; court: string }> = {};
    selectedTournament.matches.forEach((match) => {
      const scheduled = match.scheduledAt ? new Date(match.scheduledAt) : null;
      next[match.matchId] = {
        teamAId: match.teamAId || "",
        teamBId: match.teamBId || "",
        date: scheduled ? toDatePart(scheduled) : "",
        time: scheduled ? toTimePart(scheduled) : "",
        court: match.court || "",
      };
    });
    setScheduleDraftByMatch(next);
    setEditingMatchId("");
  }, [selectedTournament]);

  useEffect(() => {
    if (!selectedTournament) return;
    setScoreDraftByMatch(
      Object.fromEntries(
        selectedTournament.matches.map((match) => [
          match.matchId,
          {
            scoreA: match.scoreA?.toString() || "",
            scoreB: match.scoreB?.toString() || "",
          },
        ])
      )
    );
    setEditingScoreByMatch({});
  }, [selectedTournament]);

  useEffect(() => {
    if (!selectedTournament) return;
    setScheduleConfig((prev) => ({
      ...prev,
      startTime: selectedTournament.time || prev.startTime,
    }));
  }, [selectedTournament]);

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
        time: form.time,
        location: form.location,
        type: form.type,
        format: form.format,
        groupCount: form.format === "group_knockout" && form.groupCount ? Number(form.groupCount) : null,
        groupDistributionMode: form.groupDistributionMode,
        teamsQualifyingPerGroup: Number(form.teamsQualifyingPerGroup || 2),
        enableManualGroupEditing: form.enableManualGroupEditing,
        entryFee: form.entryFee ? Number(form.entryFee) : 0,
        status: form.status,
        isVisibleToMembers: form.isVisibleToMembers,
        allowTeamRegistration: form.allowTeamRegistration,
        registrationDeadline: form.registrationDeadline || null,
      }),
    onSuccess: async (created) => {
      setSelectedTournamentId(created._id);
      setForm({
        name: "",
        date: "",
        time: "",
        location: "",
        type: "doubles",
        format: "knockout",
        groupCount: "",
        groupDistributionMode: "random",
        teamsQualifyingPerGroup: "2",
        enableManualGroupEditing: false,
        entryFee: "",
        status: "upcoming",
        isVisibleToMembers: true,
        allowTeamRegistration: false,
        registrationDeadline: "",
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
    mutationFn: (payload: Partial<{
      name: string;
      date: string;
      time: string;
      location: string;
      type: "singles" | "doubles";
      format: "knockout" | "round_robin" | "group_knockout";
      groupCount: number | null;
      groupDistributionMode: "random" | "balanced" | "manual";
      teamsQualifyingPerGroup: number;
      enableManualGroupEditing: boolean;
      entryFee: number;
      status: "upcoming" | "ongoing" | "completed";
      isVisibleToMembers: boolean;
      allowTeamRegistration: boolean;
      registrationDeadline: string | null;
    }>) => api.updateTournament(selectedTournament!._id, payload),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Tournament updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const deleteTournamentMutation = useMutation({
    mutationFn: (id: string) => api.deleteTournament(id),
    onSuccess: async () => {
      setDeleteDialogOpen(false);
      setDeleteConfirmationName("");
      setSelectedTournamentId("");
      await refresh();
      toast({ title: "Tournament deleted successfully." });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const addTeamMutation = useMutation({
    mutationFn: () =>
      api.addTournamentTeam(selectedTournament!._id, {
        players:
          selectedTournament?.type === "doubles"
            ? [teamPlayer1.trim(), teamPlayer2.trim()]
            : [teamPlayer1.trim()],
        contactMobileNumber: adminContactMobileNumber.trim() || undefined,
        entryFeePaid: entryFeePaid ? Number(entryFeePaid) : 0,
      }),
    onSuccess: async () => {
      setTeamPlayer1("");
      setTeamPlayer2("");
      setEditingTeamId("");
      setAdminContactMobileNumber("");
      setEntryFeePaid("");
      await refresh();
      toast({ title: "Team added" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateTeamMutation = useMutation({
    mutationFn: () =>
      api.updateTournamentTeam(selectedTournament!._id, editingTeamId, {
        players:
          selectedTournament?.type === "doubles"
            ? [teamPlayer1.trim(), teamPlayer2.trim()]
            : [teamPlayer1.trim()],
        contactMobileNumber: adminContactMobileNumber.trim() || undefined,
        entryFeePaid: entryFeePaid ? Number(entryFeePaid) : 0,
      }),
    onSuccess: async () => {
      setTeamPlayer1("");
      setTeamPlayer2("");
      setEditingTeamId("");
      setAdminContactMobileNumber("");
      setEntryFeePaid("");
      await refresh();
      toast({ title: "Team updated" });
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
      toast({ title: selectedTournament?.format === "group_knockout" ? "Tournament stage generated" : "Bracket generated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const generateGroupsMutation = useMutation({
    mutationFn: () => api.generateTournamentGroups(selectedTournament!._id),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Groups generated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const renameGroupMutation = useMutation({
    mutationFn: ({ groupId, groupName }: { groupId: string; groupName: string }) =>
      api.renameTournamentGroup(selectedTournament!._id, groupId, groupName),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Group renamed" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateGroupTeamsMutation = useMutation({
    mutationFn: ({ groupId, teamIds }: { groupId: string; teamIds: string[] }) =>
      api.updateTournamentGroupTeams(selectedTournament!._id, groupId, teamIds),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Group teams updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateGroupLockMutation = useMutation({
    mutationFn: ({ groupId, isLocked }: { groupId: string; isLocked: boolean }) =>
      api.updateTournamentGroupLock(selectedTournament!._id, groupId, isLocked),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Group lock updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const generateScheduleMutation = useMutation({
    mutationFn: () =>
      api.generateTournamentSchedule(selectedTournament!._id, {
        courtCount: scheduleConfig.courtCount,
        courtNames: scheduleConfig.courtNames.slice(0, scheduleConfig.courtCount),
        startTime: scheduleConfig.startTime,
        matchDurationMinutes: scheduleConfig.matchDurationMinutes,
      }),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Match schedule generated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateScoreMutation = useMutation({
    mutationFn: ({ matchId, scoreA, scoreB }: { matchId: string; scoreA: number | null; scoreB: number | null }) =>
      api.updateTournamentMatchScore(selectedTournament!._id, matchId, { scoreA, scoreB }),
    onSuccess: async (_updatedTournament, variables) => {
      setEditingScoreByMatch((prev) => {
        const next = { ...prev };
        delete next[variables.matchId];
        return next;
      });
      if (variables.scoreA === null && variables.scoreB === null) {
        setScoreDraftByMatch((prev) => ({
          ...prev,
          [variables.matchId]: { scoreA: "", scoreB: "" },
        }));
      }
      await refresh();
      toast({ title: variables.scoreA === null ? "Match marked as not played" : "Score updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateMatchDetailsMutation = useMutation({
    mutationFn: ({
      matchId,
      teamAId,
      teamBId,
      date,
      time,
      court,
    }: {
      matchId: string;
      teamAId: string;
      teamBId: string;
      date: string;
      time: string;
      court: string;
    }) =>
      api.updateTournamentMatchDetails(selectedTournament!._id, matchId, {
        teamAId: teamAId || null,
        teamBId: teamBId || null,
        scheduledAt: date && time ? `${date}T${time}:00.000Z` : null,
        court: court.trim() || null,
      }),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Match updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const createCustomMatchMutation = useMutation({
    mutationFn: () =>
      api.createTournamentCustomMatch(selectedTournament!._id, {
        matchType: customMatchForm.matchType,
        teamAId: customMatchForm.teamAId || null,
        teamBId: customMatchForm.teamBId || null,
        scheduledAt:
          customMatchForm.date && customMatchForm.time
            ? `${customMatchForm.date}T${customMatchForm.time}:00.000Z`
            : null,
        court: customMatchForm.court.trim() || null,
      }),
    onSuccess: async () => {
      setCustomMatchForm({
        matchType: "friendly",
        teamAId: "",
        teamBId: "",
        date: "",
        time: "",
        court: "",
      });
      await refresh();
      toast({ title: "Custom match added" });
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

  const reviewRegistrationMutation = useMutation({
    mutationFn: ({ registrationId, status }: { registrationId: string; status: "accepted" | "rejected" }) =>
      api.reviewTournamentRegistration(selectedTournament!._id, registrationId, { status }),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Registration updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateRegistryEntryMutation = useMutation({
    mutationFn: ({ registryId, entryFeePaid }: { registryId: string; entryFeePaid: number }) =>
      api.updateTournamentTeamRegistry(selectedTournament!._id, registryId, { entryFeePaid }),
    onSuccess: async () => {
      await refresh();
      toast({ title: "Team registry updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const startEditTeam = (team: Tournament["teams"][number]) => {
    setEditingTeamId(team._id);
    setTeamPlayer1(team.players[0] || "");
    setTeamPlayer2(team.players[1] || "");
    const registryEntry = selectedTournament?.teamRegistry?.find(
      (entry) => entry.teamId === team._id || entry.teamName.trim().toLowerCase() === team.name.trim().toLowerCase()
    );
    setAdminContactMobileNumber(registryEntry?.members?.[0]?.mobileNumber || "");
    setEntryFeePaid(registryEntry ? String(registryEntry.entryFeePaid || 0) : "");
  };

  const cancelEditTeam = () => {
    setEditingTeamId("");
    setTeamPlayer1("");
    setTeamPlayer2("");
    setAdminContactMobileNumber("");
    setEntryFeePaid("");
  };

  const addTournamentExpenseMutation = useMutation({
    mutationFn: () =>
      api.addTournamentExpense(selectedTournament!._id, {
        title: expenseForm.title.trim(),
        amount: Number(expenseForm.amount),
        note: expenseForm.note.trim() || undefined,
        date: expenseForm.date || null,
      }),
    onSuccess: async () => {
      setExpenseForm({ title: "", amount: "", note: "", date: "" });
      await refresh();
      toast({ title: "Expense added" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const addTournamentIncomeMutation = useMutation({
    mutationFn: () =>
      api.addTournamentIncome(selectedTournament!._id, {
        type: incomeForm.type,
        title: incomeForm.title.trim(),
        amount: Number(incomeForm.amount),
        note: incomeForm.note.trim() || undefined,
        date: incomeForm.date || null,
      }),
    onSuccess: async () => {
      setIncomeForm({ type: "donation", title: "", amount: "", note: "", date: "" });
      await refresh();
      toast({ title: "Incoming entry added" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateTournamentExpenseMutation = useMutation({
    mutationFn: () =>
      api.updateTournamentExpense(selectedTournament!._id, editingExpenseId, {
        title: expenseForm.title.trim(),
        amount: Number(expenseForm.amount),
        note: expenseForm.note.trim() || undefined,
        date: expenseForm.date || null,
      }),
    onSuccess: async () => {
      setEditingExpenseId("");
      setExpenseForm({ title: "", amount: "", note: "", date: "" });
      await refresh();
      toast({ title: "Expense updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const updateTournamentIncomeMutation = useMutation({
    mutationFn: () =>
      api.updateTournamentIncome(selectedTournament!._id, editingIncomeId, {
        type: incomeForm.type,
        title: incomeForm.title.trim(),
        amount: Number(incomeForm.amount),
        note: incomeForm.note.trim() || undefined,
        date: incomeForm.date || null,
      }),
    onSuccess: async () => {
      setEditingIncomeId("");
      setIncomeForm({ type: "donation", title: "", amount: "", note: "", date: "" });
      await refresh();
      toast({ title: "Incoming updated" });
    },
    onError: (error: Error) => toast({ title: "Failed", description: error.message, variant: "destructive" }),
  });

  const canAddTeams = Boolean(selectedTournament);
  const canSubmitTeam =
    canAddTeams &&
    Boolean(teamPlayer1.trim()) &&
    (selectedTournament?.type === "singles" || Boolean(teamPlayer2.trim()));
  const scheduleMatches = [...(selectedTournament?.matches || [])].sort((a, b) => {
    const aTs = a.scheduledAt ? new Date(a.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    const bTs = b.scheduledAt ? new Date(b.scheduledAt).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTs !== bTs) return aTs - bTs;
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
    return a.matchNumber - b.matchNumber;
  });
  const resultMatches = scheduleMatches;
  const scheduleRows = useMemo(() => buildScheduleRows(scheduleMatches), [scheduleMatches]);
  const courtScheduleGroups = useMemo(() => buildCourtScheduleGroups(scheduleMatches), [scheduleMatches]);
  const scheduleGroups = useMemo(() => {
    const grouped = new Map<string, { slotLabel: string; rows: typeof scheduleRows }>();
    scheduleRows.forEach((row) => {
      const existing = grouped.get(row.slotKey);
      if (existing) {
        existing.rows.push(row);
        return;
      }
      grouped.set(row.slotKey, { slotLabel: row.slotLabel, rows: [row] });
    });
    return [...grouped.entries()].map(([key, value]) => ({
      slotKey: key,
      slotLabel: value.slotLabel,
      rows: value.rows,
    }));
  }, [scheduleRows]);
  const groupView = useMemo(() => buildTournamentGroupView(selectedTournament), [selectedTournament]);
  const teamsById = useMemo(
    () => new Map((selectedTournament?.teams || []).map((team) => [team._id, team])),
    [selectedTournament?.teams]
  );
  const groupCards = useMemo(
    () =>
      [...(selectedTournament?.tournamentGroups || [])]
        .sort((a, b) => a.groupOrder - b.groupOrder)
        .map((group) => ({
          ...group,
          teams: group.teamIds.map((teamId) => teamsById.get(teamId)).filter((team): team is Tournament["teams"][number] => Boolean(team)),
        })),
    [selectedTournament?.tournamentGroups, teamsById]
  );
  const assignedGroupTeamIds = useMemo(
    () => new Set(groupCards.flatMap((group) => group.teamIds)),
    [groupCards]
  );
  const unassignedTeams = useMemo(
    () => (selectedTournament?.teams || []).filter((team) => !assignedGroupTeamIds.has(team._id)),
    [assignedGroupTeamIds, selectedTournament?.teams]
  );
  const groupStandings = useMemo(() => {
    const standings = new Map<string, Map<string, { wins: number; losses: number; points: number }>>();
    groupCards.forEach((group) => {
      standings.set(
        group._id,
        new Map(group.teamIds.map((teamId) => [teamId, { wins: 0, losses: 0, points: 0 }]))
      );
    });

    (selectedTournament?.matches || []).forEach((match) => {
      if (match.matchType !== "league" || !match.isCompleted || !match.teamAId || !match.teamBId) return;
      if (match.scoreA === null || match.scoreB === null) return;
      const group = groupCards.find((item) => item.groupName === match.roundLabel);
      if (!group) return;
      const rows = standings.get(group._id);
      const teamA = rows?.get(match.teamAId);
      const teamB = rows?.get(match.teamBId);
      if (!teamA || !teamB) return;

      if (match.scoreA > match.scoreB) {
        teamA.wins += 1;
        teamA.points += 2;
        teamB.losses += 1;
      } else if (match.scoreB > match.scoreA) {
        teamB.wins += 1;
        teamB.points += 2;
        teamA.losses += 1;
      } else {
        teamA.points += 1;
        teamB.points += 1;
      }
    });

    return standings;
  }, [groupCards, selectedTournament?.matches]);
  const confirmBracketReset = () =>
    !selectedTournament?.matches.length ||
    window.confirm("This change will delete the generated bracket and schedule. Generate a new bracket after saving?");
  const downloadCsv = (filename: string, rows: Array<Array<string | number>>) => {
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };
  const exportGroups = () => {
    if (!selectedTournament) return;
    downloadCsv(`${selectedTournament.name}-groups.csv`, [
      ["Group", "Team", "Players", "Wins", "Losses", "Points"],
      ...groupCards.flatMap((group) =>
        group.teams.map((team) => {
          const standing = groupStandings.get(group._id)?.get(team._id) || { wins: 0, losses: 0, points: 0 };
          return [group.groupName, team.name, team.players.join(" / "), standing.wins, standing.losses, standing.points];
        })
      ),
    ]);
  };
  const exportFixtures = () => {
    if (!selectedTournament) return;
    downloadCsv(`${selectedTournament.name}-fixtures.csv`, [
      ["Match ID", "Round", "Team A", "Team B", "Date", "Court", "Status"],
      ...scheduleMatches.map((match) => [
        match.matchId,
        match.roundLabel,
        match.teamA?.name || "TBD",
        match.teamB?.name || "TBD",
        formatScheduleDateTime(match.scheduledAt),
        match.court || "",
        match.isCompleted ? "Completed" : "Pending",
      ]),
    ]);
  };
  const exportResults = () => {
    if (!selectedTournament) return;
    downloadCsv(`${selectedTournament.name}-results.csv`, [
      ["Match ID", "Round", "Team A", "Score A", "Score B", "Team B", "Winner"],
      ...selectedTournament.matches.map((match) => [
        match.matchId,
        match.roundLabel,
        match.teamA?.name || "TBD",
        match.scoreA ?? "",
        match.scoreB ?? "",
        match.teamB?.name || "TBD",
        match.winnerTeam?.name || "",
      ]),
    ]);
  };
  const registryByTeamName = useMemo(
    () =>
      new Map(
        (selectedTournament?.teamRegistry || []).map((entry) => [entry.teamName.trim().toLowerCase(), entry])
      ),
    [selectedTournament?.teamRegistry]
  );
  const financeSummary = selectedTournament?.financeSummary || {
    totalExpenses: (selectedTournament?.tournamentExpenses || []).reduce((sum, item) => sum + Number(item.amount || 0), 0),
    totalEntryRegistration: (selectedTournament?.teamRegistry || []).reduce((sum, item) => sum + Number(item.entryFeePaid || 0), 0),
    totalDonations: (selectedTournament?.tournamentIncomes || [])
      .filter((item) => item.type === "donation")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0),
    totalIncoming: 0,
    netBalance: 0,
  };
  if (!selectedTournament?.financeSummary) {
    financeSummary.totalIncoming = financeSummary.totalEntryRegistration + financeSummary.totalDonations;
    financeSummary.netBalance = financeSummary.totalIncoming - financeSummary.totalExpenses;
  }
  const startEditExpense = (expense: Tournament["tournamentExpenses"][number]) => {
    setFinanceTab("expenses");
    setEditingExpenseId(expense._id);
    setExpenseForm({
      title: expense.title || "",
      amount: Number(expense.amount || 0).toString(),
      note: expense.note || "",
      date: expense.date ? expense.date.slice(0, 10) : "",
    });
  };
  const startEditIncome = (income: Tournament["tournamentIncomes"][number]) => {
    setFinanceTab("incoming");
    setEditingIncomeId(income._id);
    setIncomeForm({
      type: income.type,
      title: income.title || "",
      amount: Number(income.amount || 0).toString(),
      note: income.note || "",
      date: income.date ? income.date.slice(0, 10) : "",
    });
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Tournaments</h1>
            <p className="text-sm text-muted-foreground">Manage tournament setup, bracket progress, and winner tracking.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="default" onClick={() => setShowCreateTournament((prev) => !prev)}>
              {showCreateTournament ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
              {showCreateTournament ? "Close Create Tournament" : "Create Tournament"}
            </Button>
            <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-2">
              <span className="text-sm font-medium">Show tournament to members</span>
              <Switch
                checked={Boolean(config?.enabled)}
                onCheckedChange={(checked) => updateConfigMutation.mutate(checked)}
              />
            </div>
          </div>
        </div>

        <div className={`grid gap-6 ${showCreateTournament ? "lg:grid-cols-3" : "lg:grid-cols-1"}`}>
          {showCreateTournament && (
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
                <Label>Time</Label>
                <Input type="time" value={form.time} onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>Location / Court</Label>
                <Input value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} />
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
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
                  <Label>Format</Label>
                  <Select
                    value={form.format}
                    onValueChange={(value: "knockout" | "round_robin" | "group_knockout") =>
                      setForm((prev) => ({ ...prev, format: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {formatOptions.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
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
              {form.format === "group_knockout" && (
                <div className="space-y-3 rounded-md border p-3">
                  <div>
                    <h3 className="text-sm font-semibold">Group Configuration</h3>
                    <p className="text-xs text-muted-foreground">
                      Leave group count blank to use the automatic default.
                    </p>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <div className="space-y-1">
                      <Label>Number of Groups</Label>
                      <Input
                        type="number"
                        min={2}
                        max={16}
                        placeholder="Auto"
                        value={form.groupCount}
                        onChange={(e) => setForm((prev) => ({ ...prev, groupCount: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Distribution Mode</Label>
                      <Select
                        value={form.groupDistributionMode}
                        onValueChange={(value: "random" | "balanced" | "manual") =>
                          setForm((prev) => ({ ...prev, groupDistributionMode: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {groupDistributionOptions.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label>Teams Qualifying</Label>
                      <Input
                        type="number"
                        min={1}
                        max={8}
                        value={form.teamsQualifyingPerGroup}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, teamsQualifyingPerGroup: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between rounded-md border p-2">
                    <span className="text-sm">Enable manual group editing</span>
                    <Switch
                      checked={form.enableManualGroupEditing}
                      onCheckedChange={(checked) =>
                        setForm((prev) => ({ ...prev, enableManualGroupEditing: checked }))
                      }
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1">
                <Label>Team Registration Deadline</Label>
                <Input
                  type="date"
                  value={form.registrationDeadline}
                  onChange={(e) => setForm((prev) => ({ ...prev, registrationDeadline: e.target.value }))}
                />
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
              <div className="flex items-center justify-between rounded-md border p-2">
                <span className="text-sm">Allow team registration</span>
                <Switch
                  checked={form.allowTeamRegistration}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, allowTeamRegistration: checked }))}
                />
              </div>
              <Button
                className="w-full"
                onClick={() => createTournamentMutation.mutate()}
                disabled={!form.name || !form.date || !form.time || !form.location || !form.registrationDeadline}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Tournament
              </Button>
            </CardContent>
          </Card>
          )}

          <Card className={showCreateTournament ? "lg:col-span-2" : "lg:col-span-1"}>
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
                  <TournamentPointsTable tournament={selectedTournament} />
                  <Accordion type="multiple" className="overflow-hidden rounded-lg border">
                    {groupView.length > 0 && (
                    <TournamentSectionItem value={`groupAllocation-${selectedTournament._id}`} title="Group Allocation">
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
                                        <td className="px-3 py-2 font-medium">{team.name}</td>
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

                  {selectedTournament.format === "group_knockout" && (
                    <TournamentSectionItem value={`groupManagement-${selectedTournament._id}`} title="Group Management">
                      <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Group Management</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                          <div className="rounded-md border p-3 text-sm">
                            <p className="text-muted-foreground">Tournament</p>
                            <p className="font-medium">{selectedTournament.name}</p>
                          </div>
                          <div className="rounded-md border p-3 text-sm">
                            <p className="text-muted-foreground">Total Teams</p>
                            <p className="font-medium">{selectedTournament.teams.length}</p>
                          </div>
                          <div className="rounded-md border p-3 text-sm">
                            <p className="text-muted-foreground">Groups</p>
                            <p className="font-medium">{groupCards.length || selectedTournament.groupCount || "Auto"}</p>
                          </div>
                          <div className="rounded-md border p-3 text-sm">
                            <p className="text-muted-foreground">Qualifiers</p>
                            <p className="font-medium">{selectedTournament.teamsQualifyingPerGroup} / group</p>
                          </div>
                          <div className="rounded-md border p-3 text-sm">
                            <p className="text-muted-foreground">Mode</p>
                            <p className="font-medium capitalize">{selectedTournament.groupDistributionMode}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              if (!confirmBracketReset()) return;
                              generateGroupsMutation.mutate();
                            }}
                          >
                            Generate Groups
                          </Button>
                          <Button variant="outline" onClick={exportGroups} disabled={groupCards.length === 0}>
                            <Download className="mr-2 h-4 w-4" />
                            Export Standings
                          </Button>
                          <Button variant="outline" onClick={exportFixtures} disabled={scheduleMatches.length === 0}>
                            <Download className="mr-2 h-4 w-4" />
                            Export Fixtures
                          </Button>
                          <Button variant="outline" onClick={exportResults} disabled={selectedTournament.matches.length === 0}>
                            <Download className="mr-2 h-4 w-4" />
                            Export Results
                          </Button>
                        </div>

                        {unassignedTeams.length > 0 && (
                          <div className="rounded-md border border-dashed p-3">
                            <p className="mb-2 text-sm font-medium">Unassigned Teams</p>
                            <div className="flex flex-wrap gap-2">
                              {unassignedTeams.map((team) => (
                                <div
                                  key={team._id}
                                  draggable
                                  onDragStart={() => setDraggedTeamId(team._id)}
                                  className="cursor-grab rounded-md border bg-secondary/40 px-3 py-2 text-sm"
                                >
                                  {team.name}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {groupCards.length === 0 ? (
                          <p className="text-sm text-muted-foreground">Generate groups to start manual assignment.</p>
                        ) : (
                          <div className="grid gap-3 lg:grid-cols-2">
                            {groupCards.map((group) => (
                              <div
                                key={group._id}
                                className="rounded-md border"
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={() => {
                                  if (!draggedTeamId || group.isLocked) return;
                                  const nextTeamIds = [...group.teamIds.filter((id) => id !== draggedTeamId), draggedTeamId];
                                  updateGroupTeamsMutation.mutate({ groupId: group._id, teamIds: nextTeamIds });
                                  setDraggedTeamId("");
                                }}
                              >
                                <div className="flex flex-col gap-2 border-b bg-secondary/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="flex flex-1 items-center gap-2">
                                    <Input
                                      value={groupRenameDrafts[group._id] ?? group.groupName}
                                      onChange={(event) =>
                                        setGroupRenameDrafts((prev) => ({ ...prev, [group._id]: event.target.value }))
                                      }
                                      disabled={group.isLocked}
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={group.isLocked || !groupRenameDrafts[group._id]?.trim()}
                                      onClick={() =>
                                        renameGroupMutation.mutate({
                                          groupId: group._id,
                                          groupName: groupRenameDrafts[group._id] || group.groupName,
                                        })
                                      }
                                    >
                                      Rename
                                    </Button>
                                  </div>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() =>
                                      updateGroupLockMutation.mutate({ groupId: group._id, isLocked: !group.isLocked })
                                    }
                                  >
                                    {group.isLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
                                    {group.isLocked ? "Unlock" : "Lock"}
                                  </Button>
                                </div>

                                <div className="space-y-3 p-3">
                                  <div className="flex flex-col gap-2 sm:flex-row">
                                    <Select
                                      value={teamToAddByGroup[group._id] || "__none__"}
                                      onValueChange={(value) =>
                                        setTeamToAddByGroup((prev) => ({ ...prev, [group._id]: value }))
                                      }
                                      disabled={group.isLocked}
                                    >
                                      <SelectTrigger>
                                        <SelectValue placeholder="Add team" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="__none__">Select team</SelectItem>
                                        {unassignedTeams.map((team) => (
                                          <SelectItem key={team._id} value={team._id}>
                                            {team.name}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    <Button
                                      variant="outline"
                                      disabled={group.isLocked || !teamToAddByGroup[group._id] || teamToAddByGroup[group._id] === "__none__"}
                                      onClick={() => {
                                        const teamId = teamToAddByGroup[group._id];
                                        if (!teamId || teamId === "__none__") return;
                                        updateGroupTeamsMutation.mutate({
                                          groupId: group._id,
                                          teamIds: [...group.teamIds, teamId],
                                        });
                                        setTeamToAddByGroup((prev) => ({ ...prev, [group._id]: "__none__" }));
                                      }}
                                    >
                                      Add Team
                                    </Button>
                                  </div>

                                  <div className="overflow-x-auto">
                                    <table className="min-w-full text-sm">
                                      <thead>
                                        <tr className="border-b text-left">
                                          <th className="px-3 py-2">Team</th>
                                          <th className="px-3 py-2 text-right">Wins</th>
                                          <th className="px-3 py-2 text-right">Losses</th>
                                          <th className="px-3 py-2 text-right">Points</th>
                                          <th className="px-3 py-2"></th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {group.teams.map((team) => {
                                          const standing = groupStandings.get(group._id)?.get(team._id) || {
                                            wins: 0,
                                            losses: 0,
                                            points: 0,
                                          };
                                          return (
                                            <tr
                                              key={team._id}
                                              draggable={!group.isLocked}
                                              onDragStart={() => setDraggedTeamId(team._id)}
                                              className="border-b last:border-0"
                                            >
                                              <td className="px-3 py-2 font-medium">{team.name}</td>
                                              <td className="px-3 py-2 text-right">{standing.wins}</td>
                                              <td className="px-3 py-2 text-right">{standing.losses}</td>
                                              <td className="px-3 py-2 text-right">{standing.points}</td>
                                              <td className="px-3 py-2 text-right">
                                                <Button
                                                  size="sm"
                                                  variant="ghost"
                                                  disabled={group.isLocked}
                                                  onClick={() => {
                                                    if (!window.confirm(`Remove ${team.name} from ${group.groupName}?`)) return;
                                                    updateGroupTeamsMutation.mutate({
                                                      groupId: group._id,
                                                      teamIds: group.teamIds.filter((teamId) => teamId !== team._id),
                                                    });
                                                  }}
                                                >
                                                  Remove
                                                </Button>
                                              </td>
                                            </tr>
                                          );
                                        })}
                                        {group.teams.length === 0 && (
                                          <tr>
                                            <td className="px-3 py-4 text-muted-foreground" colSpan={5}>
                                              Drop teams here or use Add Team.
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="rounded-md border p-3">
                          <p className="mb-2 text-sm font-medium">Audit History</p>
                          {selectedTournament.auditHistory.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No admin actions recorded yet.</p>
                          ) : (
                            <div className="max-h-56 space-y-2 overflow-y-auto">
                              {selectedTournament.auditHistory.slice(0, 30).map((entry) => (
                                <div key={entry._id} className="rounded-md bg-secondary/30 px-3 py-2 text-sm">
                                  <p>{entry.action}</p>
                                  <p className="text-xs text-muted-foreground">{formatShortDate(entry.createdAt)}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                      </Card>
                    </TournamentSectionItem>
                  )}

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        updateTournamentMutation.mutate({ isVisibleToMembers: !selectedTournament.isVisibleToMembers })
                      }
                    >
                      {selectedTournament.isVisibleToMembers ? "Hide from Members" : "Show to Members"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => generateBracketMutation.mutate()}
                      disabled={bracketActionState.disabled || generateBracketMutation.isPending}
                    >
                      {bracketActionState.label}
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
                    <AlertDialog
                      open={deleteDialogOpen}
                      onOpenChange={(open) => {
                        setDeleteDialogOpen(open);
                        if (!open) setDeleteConfirmationName("");
                      }}
                    >
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Tournament</AlertDialogTitle>
                          <AlertDialogDescription className="whitespace-pre-line">
                            {`This action is permanent and cannot be undone. Deleting this tournament will permanently remove:
• Tournament details
• Registered teams
• Group allocations
• Match schedules
• Match results
• Standings
• Knockout brackets
• Financial records related to this tournament

This data cannot be recovered.`}
                          </AlertDialogDescription>
                        </AlertDialogHeader>

                        <div className="space-y-2">
                          <Label htmlFor="delete-tournament-name">
                            Enter tournament name:
                          </Label>
                          <Input
                            id="delete-tournament-name"
                            value={deleteConfirmationName}
                            onChange={(event) => setDeleteConfirmationName(event.target.value)}
                            placeholder={selectedTournament.name}
                            autoComplete="off"
                          />
                          {!canConfirmTournamentDelete && deleteConfirmationName.length > 0 && (
                            <p className="text-sm text-destructive">
                              Please enter the exact tournament name to continue.
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Type <span className="font-semibold text-foreground">{selectedTournament.name}</span> exactly.
                          </p>
                        </div>

                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <Button
                            variant="destructive"
                            disabled={!canConfirmTournamentDelete || deleteTournamentMutation.isPending}
                            onClick={() => deleteTournamentMutation.mutate(selectedTournament._id)}
                          >
                            Delete Tournament
                          </Button>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>

                  <TournamentSectionItem value={`editTournament-${selectedTournament._id}`} title="Edit Tournament">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Edit Tournament</CardTitle>
                      </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="space-y-1">
                        <Label>Name</Label>
                        <Input value={editForm.name} onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))} />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label>Date</Label>
                          <Input type="date" value={editForm.date} onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))} />
                        </div>
                        <div className="space-y-1">
                          <Label>Time</Label>
                          <Input type="time" value={editForm.time} onChange={(e) => setEditForm((prev) => ({ ...prev, time: e.target.value }))} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label>Location / Court</Label>
                        <Input value={editForm.location} onChange={(e) => setEditForm((prev) => ({ ...prev, location: e.target.value }))} />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Type</Label>
                          <Select
                            value={editForm.type}
                            onValueChange={(value: "singles" | "doubles") => setEditForm((prev) => ({ ...prev, type: value }))}
                          >
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
                          <Label>Format</Label>
                          <Select
                            value={editForm.format}
                            onValueChange={(value: "knockout" | "round_robin" | "group_knockout") =>
                              setEditForm((prev) => ({ ...prev, format: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {formatOptions.map((item) => (
                                <SelectItem key={item.value} value={item.value}>
                                  {item.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Entry Fee</Label>
                          <Input
                            type="number"
                            min={0}
                            value={editForm.entryFee}
                            onChange={(e) => setEditForm((prev) => ({ ...prev, entryFee: e.target.value }))}
                          />
                        </div>
                      </div>
                      {editForm.format === "group_knockout" && (
                        <div className="space-y-3 rounded-md border p-3">
                          <div>
                            <h3 className="text-sm font-semibold">Group Configuration</h3>
                            <p className="text-xs text-muted-foreground">
                              Auto default for current teams: {getAutoGroupCount(selectedTournament.teams.length)} groups.
                            </p>
                          </div>
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="space-y-1">
                              <Label>Number of Groups</Label>
                              <Input
                                type="number"
                                min={2}
                                max={16}
                                placeholder="Auto"
                                value={editForm.groupCount}
                                onChange={(e) => setEditForm((prev) => ({ ...prev, groupCount: e.target.value }))}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label>Distribution Mode</Label>
                              <Select
                                value={editForm.groupDistributionMode}
                                onValueChange={(value: "random" | "balanced" | "manual") =>
                                  setEditForm((prev) => ({ ...prev, groupDistributionMode: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {groupDistributionOptions.map((item) => (
                                    <SelectItem key={item.value} value={item.value}>
                                      {item.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label>Teams Qualifying</Label>
                              <Input
                                type="number"
                                min={1}
                                max={8}
                                value={editForm.teamsQualifyingPerGroup}
                                onChange={(e) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    teamsQualifyingPerGroup: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          </div>
                          <div className="flex items-center justify-between rounded-md border p-2">
                            <span className="text-sm">Enable manual group editing</span>
                            <Switch
                              checked={editForm.enableManualGroupEditing}
                              onCheckedChange={(checked) =>
                                setEditForm((prev) => ({ ...prev, enableManualGroupEditing: checked }))
                              }
                            />
                          </div>
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label>Team Registration Deadline</Label>
                        <Input
                          type="date"
                          value={editForm.registrationDeadline}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, registrationDeadline: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Status</Label>
                        <Select
                          value={editForm.status}
                          onValueChange={(value: "upcoming" | "ongoing" | "completed") =>
                            setEditForm((prev) => ({ ...prev, status: value }))
                          }
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
                          checked={editForm.isVisibleToMembers}
                          onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, isVisibleToMembers: checked }))}
                        />
                      </div>
                      <div className="flex items-center justify-between rounded-md border p-2">
                        <span className="text-sm">Allow team registration</span>
                        <Switch
                          checked={editForm.allowTeamRegistration}
                          onCheckedChange={(checked) => setEditForm((prev) => ({ ...prev, allowTeamRegistration: checked }))}
                        />
                      </div>
                      <Button
                        onClick={() =>
                          updateTournamentMutation.mutate({
                            name: editForm.name,
                            date: editForm.date,
                            time: editForm.time,
                            location: editForm.location,
                            type: editForm.type,
                            format: editForm.format,
                            groupCount:
                              editForm.format === "group_knockout" && editForm.groupCount
                                ? Number(editForm.groupCount)
                                : null,
                            groupDistributionMode: editForm.groupDistributionMode,
                            teamsQualifyingPerGroup: Number(editForm.teamsQualifyingPerGroup || 2),
                            enableManualGroupEditing: editForm.enableManualGroupEditing,
                            entryFee: editForm.entryFee ? Number(editForm.entryFee) : 0,
                            status: editForm.status,
                            isVisibleToMembers: editForm.isVisibleToMembers,
                            allowTeamRegistration: editForm.allowTeamRegistration,
                            registrationDeadline: editForm.registrationDeadline || null,
                          })
                        }
                        disabled={!editForm.name || !editForm.date || !editForm.time || !editForm.location || !editForm.registrationDeadline}
                      >
                        Save Tournament Changes
                      </Button>
                    </CardContent>
                    </Card>
                  </TournamentSectionItem>

                  <TournamentSectionItem value={`teams-${selectedTournament._id}`} title="Teams">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Teams</CardTitle>
                      </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          placeholder="Player 1"
                          value={teamPlayer1}
                          onChange={(event) => setTeamPlayer1(event.target.value)}
                        />
                        {selectedTournament.type === "doubles" ? (
                          <Input
                            placeholder="Player 2"
                            value={teamPlayer2}
                            onChange={(event) => setTeamPlayer2(event.target.value)}
                          />
                        ) : (
                          <div />
                        )}
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          placeholder="Phone number (optional)"
                          value={adminContactMobileNumber}
                          onChange={(event) => setAdminContactMobileNumber(event.target.value)}
                        />
                        <Input
                          type="number"
                          min={0}
                          placeholder="Entry fee paid"
                          value={entryFeePaid}
                          onChange={(event) => setEntryFeePaid(event.target.value)}
                        />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => {
                            if (!confirmBracketReset()) return;
                            editingTeamId ? updateTeamMutation.mutate() : addTeamMutation.mutate();
                          }}
                          disabled={!canSubmitTeam}
                        >
                          {editingTeamId ? "Save Team" : "Add Team"}
                        </Button>
                        {editingTeamId && (
                          <Button variant="outline" onClick={cancelEditTeam}>
                            Cancel Edit
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Team name will be created internally as <span className="font-medium">Player1+Player2</span>.
                        <span className="font-medium">
                          {selectedTournament.type === "doubles" ? "Player1+Player2 / Player1/Player2" : "Player1"}
                        </span>
                      </p>
                      {selectedTournament.matches.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Editing teams after bracket generation will clear the current bracket and schedule.
                        </p>
                      )}
                      <div className="space-y-2">
                        {selectedTournament.teams.map((team) => (
                          <div
                            key={team._id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-secondary/30 px-3 py-3"
                          >
                            <div>
                              <p className="font-medium">{team.name}</p>
                              <p className="text-xs text-muted-foreground">{team.players.join(" / ")}</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" variant="outline" onClick={() => startEditTeam(team)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  if (!confirmBracketReset()) return;
                                  removeTeamMutation.mutate(team._id);
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                    </Card>
                  </TournamentSectionItem>

                  <TournamentSectionItem value={`teamRegistrations-${selectedTournament._id}`} title="Team Registrations">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Team Registrations</CardTitle>
                      </CardHeader>
                    <CardContent>
                      {selectedTournament.registrations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No registrations yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedTournament.registrations.map((registration) => {
                            const matchedEntry = registryByTeamName.get(registration.teamName.trim().toLowerCase());
                            const isFeePaid = Boolean(matchedEntry && Number(matchedEntry.entryFeePaid || 0) > 0);

                            return (
                              <div key={registration._id} className="rounded-md border p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div>
                                    <p className="font-medium">{registration.teamName}</p>
                                    <p className="text-xs text-muted-foreground">Team lead: {registration.teamLeadName}</p>
                                    {registration.contactMobileNumber && (
                                      <p className="text-xs text-muted-foreground">Contact: {registration.contactMobileNumber}</p>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge
                                      className={
                                        registration.status === "accepted"
                                          ? "bg-emerald-600 text-white"
                                          : registration.status === "rejected"
                                          ? "bg-red-600 text-white"
                                          : "bg-amber-500 text-black"
                                      }
                                    >
                                      {registration.status}
                                    </Badge>
                                    <Badge variant={isFeePaid ? "default" : "secondary"}>{isFeePaid ? "Paid" : "Unpaid"}</Badge>
                                  </div>
                                </div>
                                <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                  <p>Players: {registration.members.map((member) => member.name).join(" / ")}</p>
                                </div>
                                {matchedEntry && (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <Button
                                      size="sm"
                                      variant={isFeePaid ? "outline" : "default"}
                                      onClick={() =>
                                        updateRegistryEntryMutation.mutate({
                                          registryId: matchedEntry._id,
                                          entryFeePaid: selectedTournament.entryFee || 1,
                                        })
                                      }
                                    >
                                      Mark Paid
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={!isFeePaid ? "outline" : "secondary"}
                                      onClick={() =>
                                        updateRegistryEntryMutation.mutate({
                                          registryId: matchedEntry._id,
                                          entryFeePaid: 0,
                                        })
                                      }
                                    >
                                      Mark Unpaid
                                    </Button>
                                  </div>
                                )}
                                {registration.status === "pending" && (
                                  <div className="mt-3 flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() =>
                                        reviewRegistrationMutation.mutate({
                                          registrationId: registration._id,
                                          status: "accepted",
                                        })
                                      }
                                    >
                                      Accept
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() =>
                                        reviewRegistrationMutation.mutate({
                                          registrationId: registration._id,
                                          status: "rejected",
                                        })
                                      }
                                    >
                                      Reject
                                    </Button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                    </Card>
                  </TournamentSectionItem>

                  <TournamentSectionItem value={`teamRegistry-${selectedTournament._id}`} title="Team Registry">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Team Registry</CardTitle>
                      </CardHeader>
                    <CardContent>
                      {(selectedTournament.teamRegistry || []).length === 0 ? (
                        <p className="text-sm text-muted-foreground">No team registry entries yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedTournament.teamRegistry.map((entry) => (
                            <div key={entry._id} className="rounded-md border p-3">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div>
                                  <p className="font-medium">{entry.teamName}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant={Number(entry.entryFeePaid || 0) > 0 ? "default" : "secondary"}>
                                    {Number(entry.entryFeePaid || 0) > 0 ? "Paid" : "Unpaid"}
                                  </Badge>
                                  <Button
                                    size="sm"
                                    variant={Number(entry.entryFeePaid || 0) > 0 ? "outline" : "default"}
                                    onClick={() =>
                                      updateRegistryEntryMutation.mutate({
                                        registryId: entry._id,
                                        entryFeePaid: selectedTournament.entryFee || 1,
                                      })
                                    }
                                    disabled={Number(entry.entryFeePaid || 0) > 0}
                                  >
                                    Mark Paid
                                  </Button>
                                  {Number(entry.entryFeePaid || 0) > 0 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        updateRegistryEntryMutation.mutate({
                                          registryId: entry._id,
                                          entryFeePaid: 0,
                                        })
                                      }
                                    >
                                      Edit: Mark Unpaid
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                {entry.members.map((member, index) => (
                                  <p key={`${entry._id}-member-${index}`}>
                                    {member.name}
                                    {member.mobileNumber ? ` • ${member.mobileNumber}` : ""}
                                  </p>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                    </Card>
                  </TournamentSectionItem>

                  <TournamentSectionItem value={`tournamentFinance-${selectedTournament._id}`} title="Tournament Finance">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Tournament Finance</CardTitle>
                      </CardHeader>
                    <CardContent className="space-y-4">
                      <Tabs value={financeTab} onValueChange={(value) => setFinanceTab(value as "expenses" | "incoming")}>
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="expenses">Expenses</TabsTrigger>
                          <TabsTrigger value="incoming">Incoming</TabsTrigger>
                        </TabsList>

                        <TabsContent value="expenses" className="mt-4 space-y-3">
                          <div className="rounded-md border bg-secondary/20 p-3">
                            <p className="text-xs text-muted-foreground">Total Expenses</p>
                            <p className="text-lg font-semibold">{formatMoney(financeSummary.totalExpenses)}</p>
                            <p className="text-xs text-muted-foreground">Net Balance: {formatMoney(financeSummary.netBalance)}</p>
                          </div>

                          <p className="text-sm font-medium">Expense History</p>
                          {(selectedTournament.tournamentExpenses || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground">No tournament expenses yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {selectedTournament.tournamentExpenses.map((expense) => (
                                <div key={expense._id} className="rounded-md border px-2 py-2 text-xs">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-medium">{expense.title}</p>
                                    <div className="flex items-center gap-2">
                                      <p>{formatMoney(expense.amount)}</p>
                                      <Button size="sm" variant="outline" onClick={() => startEditExpense(expense)}>
                                        <Pencil className="mr-1 h-3.5 w-3.5" />
                                        Edit
                                      </Button>
                                    </div>
                                  </div>
                                  <p className="text-muted-foreground">{formatShortDate(expense.date)}</p>
                                  {expense.note && <p className="text-muted-foreground">{expense.note}</p>}
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="space-y-4 rounded-lg border p-3">
                            <p className="text-sm font-medium">
                              {editingExpenseId ? "Edit Tournament Expense" : "Add Tournament Expense"}
                            </p>
                            <div className="space-y-2">
                              <Label>Date</Label>
                              <Input
                                type="date"
                                value={expenseForm.date}
                                onChange={(event) => setExpenseForm((prev) => ({ ...prev, date: event.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Title</Label>
                              <Input
                                placeholder="Expense title"
                                value={expenseForm.title}
                                onChange={(event) => setExpenseForm((prev) => ({ ...prev, title: event.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Amount</Label>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="0.00"
                                value={expenseForm.amount}
                                onChange={(event) => setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Textarea
                                placeholder="Describe the expense..."
                                value={expenseForm.note}
                                onChange={(event) => setExpenseForm((prev) => ({ ...prev, note: event.target.value }))}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() =>
                                  editingExpenseId
                                    ? updateTournamentExpenseMutation.mutate()
                                    : addTournamentExpenseMutation.mutate()
                                }
                                disabled={!expenseForm.title.trim() || !Number(expenseForm.amount)}
                              >
                                {editingExpenseId ? "Update Expense" : "Add Expense"}
                              </Button>
                              {editingExpenseId && (
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setEditingExpenseId("");
                                    setExpenseForm({ title: "", amount: "", note: "", date: "" });
                                  }}
                                >
                                  <X className="mr-1 h-4 w-4" />
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        </TabsContent>

                        <TabsContent value="incoming" className="mt-4 space-y-3">
                          <div className="rounded-md border bg-secondary/20 p-3">
                            <p className="text-xs text-muted-foreground">Total Incoming</p>
                            <p className="text-lg font-semibold">{formatMoney(financeSummary.totalIncoming)}</p>
                            <p className="text-xs text-muted-foreground">
                              Entry Registration: {formatMoney(financeSummary.totalEntryRegistration)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Donations: {formatMoney(financeSummary.totalDonations)}
                            </p>
                          </div>

                          <p className="text-sm font-medium">Incoming History</p>
                          {(selectedTournament.tournamentIncomes || []).length === 0 ? (
                            <p className="text-xs text-muted-foreground">No incoming entries yet.</p>
                          ) : (
                            <div className="space-y-2">
                              {selectedTournament.tournamentIncomes.map((income) => (
                                <div key={income._id} className="rounded-md border px-2 py-2 text-xs">
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="font-medium">{income.title}</p>
                                    <div className="flex items-center gap-2">
                                      <p>{formatMoney(income.amount)}</p>
                                      <Button size="sm" variant="outline" onClick={() => startEditIncome(income)}>
                                        <Pencil className="mr-1 h-3.5 w-3.5" />
                                        Edit
                                      </Button>
                                    </div>
                                  </div>
                                  <p className="text-muted-foreground">{formatShortDate(income.date)}</p>
                                  <Badge variant="outline" className="mt-1 text-[10px]">
                                    {income.type === "entry_registration" ? "Entry Registration" : "Donation"}
                                  </Badge>
                                  {income.note && <p className="mt-1 text-muted-foreground">{income.note}</p>}
                                </div>
                              ))}
                            </div>
                          )}

                          <div className="space-y-4 rounded-lg border p-3">
                            <p className="text-sm font-medium">
                              {editingIncomeId ? "Edit Incoming Amount" : "Add Incoming Amount"}
                            </p>
                            <div className="space-y-2">
                              <Label>Type</Label>
                              <Select
                                value={incomeForm.type}
                                onValueChange={(value: TournamentIncomingType) =>
                                  setIncomeForm((prev) => ({ ...prev, type: value }))
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="donation">Donation</SelectItem>
                                  <SelectItem value="entry_registration">Entry Registration</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Date</Label>
                              <Input
                                type="date"
                                value={incomeForm.date}
                                onChange={(event) => setIncomeForm((prev) => ({ ...prev, date: event.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Title</Label>
                              <Input
                                placeholder="Incoming title"
                                value={incomeForm.title}
                                onChange={(event) => setIncomeForm((prev) => ({ ...prev, title: event.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Amount</Label>
                              <Input
                                type="number"
                                min={0}
                                step="0.01"
                                placeholder="0.00"
                                value={incomeForm.amount}
                                onChange={(event) => setIncomeForm((prev) => ({ ...prev, amount: event.target.value }))}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Textarea
                                placeholder="Describe the incoming amount..."
                                value={incomeForm.note}
                                onChange={(event) => setIncomeForm((prev) => ({ ...prev, note: event.target.value }))}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                onClick={() =>
                                  editingIncomeId
                                    ? updateTournamentIncomeMutation.mutate()
                                    : addTournamentIncomeMutation.mutate()
                                }
                                disabled={!incomeForm.title.trim() || !Number(incomeForm.amount)}
                              >
                                {editingIncomeId ? "Update Incoming" : "Add Incoming"}
                              </Button>
                              {editingIncomeId && (
                                <Button
                                  variant="outline"
                                  onClick={() => {
                                    setEditingIncomeId("");
                                    setIncomeForm({ type: "donation", title: "", amount: "", note: "", date: "" });
                                  }}
                                >
                                  <X className="mr-1 h-4 w-4" />
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                    </Card>
                  </TournamentSectionItem>

                  <TournamentSectionItem value={`addCustomMatch-${selectedTournament._id}`} title="Add Custom Match (Admin)">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Add Custom Match (Admin)</CardTitle>
                      </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Match Type</Label>
                          <Select
                            value={customMatchForm.matchType}
                            onValueChange={(value: TournamentMatchType) =>
                              setCustomMatchForm((prev) => ({ ...prev, matchType: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {customMatchTypeOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Team A</Label>
                          <Select
                            value={customMatchForm.teamAId || "__none__"}
                            onValueChange={(value) =>
                              setCustomMatchForm((prev) => ({ ...prev, teamAId: value === "__none__" ? "" : value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Team A" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">TBD</SelectItem>
                              {selectedTournament.teams.map((team) => (
                                <SelectItem key={`custom-a-${team._id}`} value={team._id}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label>Team B</Label>
                          <Select
                            value={customMatchForm.teamBId || "__none__"}
                            onValueChange={(value) =>
                              setCustomMatchForm((prev) => ({ ...prev, teamBId: value === "__none__" ? "" : value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select Team B" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">TBD</SelectItem>
                              {selectedTournament.teams.map((team) => (
                                <SelectItem key={`custom-b-${team._id}`} value={team._id}>
                                  {team.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <div className="space-y-1">
                          <Label>Date</Label>
                          <Input
                            type="date"
                            value={customMatchForm.date}
                            onChange={(event) =>
                              setCustomMatchForm((prev) => ({ ...prev, date: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Time</Label>
                          <Input
                            type="time"
                            value={customMatchForm.time}
                            onChange={(event) =>
                              setCustomMatchForm((prev) => ({ ...prev, time: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Court (Optional)</Label>
                          <Input
                            value={customMatchForm.court}
                            onChange={(event) =>
                              setCustomMatchForm((prev) => ({ ...prev, court: event.target.value }))
                            }
                          />
                        </div>
                      </div>

                      <Button onClick={() => createCustomMatchMutation.mutate()}>Add Match</Button>
                    </CardContent>
                    </Card>
                  </TournamentSectionItem>

                  <TournamentSectionItem value={`matchResults-${selectedTournament._id}`} title="Enter Match Scores">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Enter Match Scores</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {resultMatches.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No matches available yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {resultMatches.map((match) => {
                              const scoreDraft = scoreDraftByMatch[match.matchId] || {
                                scoreA: match.scoreA?.toString() || "",
                                scoreB: match.scoreB?.toString() || "",
                              };
                              const canSaveScore = Boolean(match.teamAId && match.teamBId);
                              const hasScore = match.scoreA !== null && match.scoreB !== null;
                              const isEditingScore = !hasScore || Boolean(editingScoreByMatch[match.matchId]);

                              return (
                                <div key={`score-${match.matchId}`} className="rounded-md border px-3 py-3 text-sm">
                                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                    <div className="min-w-0 space-y-1">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium">{match.roundLabel}</p>
                                        {match.isManual && <Badge variant="outline">Manual</Badge>}
                                        <Badge variant="secondary">{match.matchType}</Badge>
                                        {hasScore && <Badge className="bg-emerald-600 text-white">Completed</Badge>}
                                      </div>
                                      <p className="text-muted-foreground">
                                        {match.teamA?.name || "TBD"} vs {match.teamB?.name || "TBD"}
                                      </p>
                                      <p className="text-xs text-muted-foreground">
                                        {formatScheduleDateTime(match.scheduledAt)}
                                        {match.court ? ` • Court: ${match.court}` : ""}
                                        {match.winnerTeam ? ` • Winner: ${match.winnerTeam.name}` : ""}
                                      </p>
                                    </div>

                                    {isEditingScore ? (
                                      <div className="grid w-full gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:w-auto lg:min-w-[360px]">
                                        <div className="space-y-1">
                                          <Label className="text-xs">{match.teamA?.name || "Team A"}</Label>
                                          <Input
                                            type="number"
                                            min={0}
                                            className="h-9"
                                            value={scoreDraft.scoreA}
                                            onChange={(event) =>
                                              setScoreDraftByMatch((prev) => ({
                                                ...prev,
                                                [match.matchId]: {
                                                  ...scoreDraft,
                                                  scoreA: event.target.value,
                                                },
                                              }))
                                            }
                                            disabled={!canSaveScore}
                                          />
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">{match.teamB?.name || "Team B"}</Label>
                                          <Input
                                            type="number"
                                            min={0}
                                            className="h-9"
                                            value={scoreDraft.scoreB}
                                            onChange={(event) =>
                                              setScoreDraftByMatch((prev) => ({
                                                ...prev,
                                                [match.matchId]: {
                                                  ...scoreDraft,
                                                  scoreB: event.target.value,
                                                },
                                              }))
                                            }
                                            disabled={!canSaveScore}
                                          />
                                        </div>
                                        <div className="flex items-end gap-2">
                                          <Button
                                            className="w-full"
                                            onClick={() =>
                                              updateScoreMutation.mutate({
                                                matchId: match.matchId,
                                                scoreA: Number(scoreDraft.scoreA),
                                                scoreB: Number(scoreDraft.scoreB),
                                              })
                                            }
                                            disabled={
                                              !canSaveScore ||
                                              scoreDraft.scoreA === "" ||
                                              scoreDraft.scoreB === "" ||
                                              updateScoreMutation.isPending
                                            }
                                          >
                                            Save Score
                                          </Button>
                                          {hasScore && (
                                            <Button
                                              type="button"
                                              variant="outline"
                                              size="icon"
                                              onClick={() => {
                                                setScoreDraftByMatch((prev) => ({
                                                  ...prev,
                                                  [match.matchId]: {
                                                    scoreA: match.scoreA?.toString() || "",
                                                    scoreB: match.scoreB?.toString() || "",
                                                  },
                                                }));
                                                setEditingScoreByMatch((prev) => {
                                                  const next = { ...prev };
                                                  delete next[match.matchId];
                                                  return next;
                                                });
                                              }}
                                              aria-label={`Cancel score edit for ${match.roundLabel}`}
                                            >
                                              <X className="h-4 w-4" />
                                            </Button>
                                          )}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-end">
                                        <div className="rounded-md border bg-secondary/30 px-4 py-2">
                                          <p className="text-xs text-muted-foreground">Score</p>
                                          <p className="text-base font-semibold">
                                            {match.teamA?.name || "Team A"} {match.scoreA} - {match.scoreB}{" "}
                                            {match.teamB?.name || "Team B"}
                                          </p>
                                        </div>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() => {
                                            setScoreDraftByMatch((prev) => ({
                                              ...prev,
                                              [match.matchId]: {
                                                scoreA: match.scoreA?.toString() || "",
                                                scoreB: match.scoreB?.toString() || "",
                                              },
                                            }));
                                            setEditingScoreByMatch((prev) => ({ ...prev, [match.matchId]: true }));
                                          }}
                                          disabled={!canSaveScore || updateScoreMutation.isPending}
                                        >
                                          <Pencil className="mr-2 h-4 w-4" />
                                          Edit
                                        </Button>
                                        <Button
                                          type="button"
                                          variant="outline"
                                          onClick={() =>
                                            updateScoreMutation.mutate({
                                              matchId: match.matchId,
                                              scoreA: null,
                                              scoreB: null,
                                            })
                                          }
                                          disabled={updateScoreMutation.isPending}
                                        >
                                          Not Played
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </TournamentSectionItem>

                  <TournamentSectionItem value={`tournamentSchedule-${selectedTournament._id}`} title="Tournament Schedule">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Tournament Schedule</CardTitle>
                      </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3 rounded-md border p-3">
                        <div>
                          <h3 className="text-sm font-semibold">Court Settings</h3>
                          <p className="text-xs text-muted-foreground">
                            Groups are assigned by order: Group A to the first court, Group B to the second, then the pattern repeats.
                          </p>
                        </div>
                      <div className="grid gap-2 md:grid-cols-4">
                        <div className="space-y-1">
                          <Label>Total Courts</Label>
                          <Input
                            type="number"
                            min={1}
                            max={10}
                            value={scheduleConfig.courtCount}
                            onChange={(event) =>
                              setScheduleConfig((prev) => {
                                const courtCount = Math.min(10, Math.max(1, Number(event.target.value || 1)));
                                const courtNames = Array.from(
                                  { length: courtCount },
                                  (_, index) => prev.courtNames[index] || `Court ${String.fromCharCode(65 + index)}`
                                );
                                return { ...prev, courtCount, courtNames };
                              })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Start Time</Label>
                          <Input
                            type="time"
                            value={scheduleConfig.startTime}
                            onChange={(event) =>
                              setScheduleConfig((prev) => ({ ...prev, startTime: event.target.value }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Match Duration (min)</Label>
                          <Input
                            type="number"
                            min={1}
                            max={240}
                            value={scheduleConfig.matchDurationMinutes}
                            onChange={(event) =>
                              setScheduleConfig((prev) => ({
                                ...prev,
                                matchDurationMinutes: Number(event.target.value || 1),
                              }))
                            }
                          />
                        </div>
                        <div className="flex items-end">
                          <Button
                            className="w-full"
                            onClick={() => {
                              if (
                                !window.confirm(
                                  "This will reset all unplayed matches. Played matches will be preserved. Continue?"
                                )
                              ) {
                                return;
                              }
                              generateScheduleMutation.mutate();
                            }}
                            disabled={!selectedTournament || selectedTournament.matches.length === 0}
                          >
                            Re-generate Schedule
                          </Button>
                        </div>
                      </div>
                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                          {scheduleConfig.courtNames.map((courtName, index) => (
                            <div key={`court-name-${index}`} className="space-y-1">
                              <Label>{`Court ${index + 1} Name`}</Label>
                              <Input
                                value={courtName}
                                onChange={(event) =>
                                  setScheduleConfig((prev) => ({
                                    ...prev,
                                    courtNames: prev.courtNames.map((item, itemIndex) =>
                                      itemIndex === index ? event.target.value : item
                                    ),
                                  }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {courtScheduleGroups.length > 0 && (
                        <div className="space-y-3">
                          {courtScheduleGroups.map((court) => (
                            <div key={court.courtName} className="rounded-md border">
                              <div className="border-b bg-slate-900 px-4 py-3 text-sm font-semibold text-white">
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
                                        <div
                                          key={`${court.courtName}-${row.matchId}`}
                                          className="rounded-md border px-3 py-2 text-sm transition hover:shadow-sm"
                                        >
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="font-medium">
                                              Match {row.matchId}: {row.teamAName} vs {row.teamBName}
                                            </p>
                                            <Badge
                                              className={
                                                row.status === "Done"
                                                  ? "bg-emerald-600 text-white"
                                                  : "bg-amber-500 text-black"
                                              }
                                            >
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

                      {scheduleMatches.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No matches scheduled yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {scheduleMatches.map((match) => (
                            <div key={`schedule-${match.matchId}`} className="rounded-md border px-3 py-2 text-sm">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-medium">{match.roundLabel}</p>
                                <div className="flex items-center gap-2">
                                  {match.isManual && <Badge variant="outline">Manual</Badge>}
                                  <Badge variant="secondary">{match.matchType}</Badge>
                                  {!match.isCompleted && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() =>
                                        setEditingMatchId((prev) => (prev === match.matchId ? "" : match.matchId))
                                      }
                                    >
                                      {editingMatchId === match.matchId ? "Close Edit" : "Edit"}
                                    </Button>
                                  )}
                                </div>
                              </div>
                              <p className="text-muted-foreground">
                                {match.teamA?.name || "TBD"} vs {match.teamB?.name || "TBD"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatScheduleDateTime(match.scheduledAt)}
                                {match.court ? ` • Court: ${match.court}` : ""}
                              </p>

                              {editingMatchId === match.matchId && (
                                <div className="mt-3 space-y-2 rounded-md border p-2">
                                  <div className="grid gap-2 sm:grid-cols-2">
                                    <div className="space-y-1">
                                      <Label>Team A</Label>
                                      <Select
                                        value={scheduleDraftByMatch[match.matchId]?.teamAId || "__none__"}
                                        onValueChange={(value) =>
                                          setScheduleDraftByMatch((prev) => ({
                                            ...prev,
                                            [match.matchId]: {
                                              ...(prev[match.matchId] || {
                                                teamAId: "",
                                                teamBId: "",
                                                date: "",
                                                time: "",
                                                court: "",
                                              }),
                                              teamAId: value === "__none__" ? "" : value,
                                            },
                                          }))
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Team A" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__none__">TBD</SelectItem>
                                          {selectedTournament.teams.map((team) => (
                                            <SelectItem key={`sched-a-${match.matchId}-${team._id}`} value={team._id}>
                                              {team.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-1">
                                      <Label>Team B</Label>
                                      <Select
                                        value={scheduleDraftByMatch[match.matchId]?.teamBId || "__none__"}
                                        onValueChange={(value) =>
                                          setScheduleDraftByMatch((prev) => ({
                                            ...prev,
                                            [match.matchId]: {
                                              ...(prev[match.matchId] || {
                                                teamAId: "",
                                                teamBId: "",
                                                date: "",
                                                time: "",
                                                court: "",
                                              }),
                                              teamBId: value === "__none__" ? "" : value,
                                            },
                                          }))
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Team B" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="__none__">TBD</SelectItem>
                                          {selectedTournament.teams.map((team) => (
                                            <SelectItem key={`sched-b-${match.matchId}-${team._id}`} value={team._id}>
                                              {team.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="grid gap-2 sm:grid-cols-3">
                                    <div className="space-y-1">
                                      <Label>Date</Label>
                                      <Input
                                        type="date"
                                        value={scheduleDraftByMatch[match.matchId]?.date || ""}
                                        onChange={(event) =>
                                          setScheduleDraftByMatch((prev) => ({
                                            ...prev,
                                            [match.matchId]: {
                                              ...(prev[match.matchId] || {
                                                teamAId: "",
                                                teamBId: "",
                                                date: "",
                                                time: "",
                                                court: "",
                                              }),
                                              date: event.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label>Time</Label>
                                      <Input
                                        type="time"
                                        value={scheduleDraftByMatch[match.matchId]?.time || ""}
                                        onChange={(event) =>
                                          setScheduleDraftByMatch((prev) => ({
                                            ...prev,
                                            [match.matchId]: {
                                              ...(prev[match.matchId] || {
                                                teamAId: "",
                                                teamBId: "",
                                                date: "",
                                                time: "",
                                                court: "",
                                              }),
                                              time: event.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      <Label>Court</Label>
                                      <Input
                                        value={scheduleDraftByMatch[match.matchId]?.court || ""}
                                        onChange={(event) =>
                                          setScheduleDraftByMatch((prev) => ({
                                            ...prev,
                                            [match.matchId]: {
                                              ...(prev[match.matchId] || {
                                                teamAId: "",
                                                teamBId: "",
                                                date: "",
                                                time: "",
                                                court: "",
                                              }),
                                              court: event.target.value,
                                            },
                                          }))
                                        }
                                      />
                                    </div>
                                  </div>
                                  <Button
                                    onClick={() =>
                                      updateMatchDetailsMutation.mutate({
                                        matchId: match.matchId,
                                        teamAId: scheduleDraftByMatch[match.matchId]?.teamAId || "",
                                        teamBId: scheduleDraftByMatch[match.matchId]?.teamBId || "",
                                        date: scheduleDraftByMatch[match.matchId]?.date || "",
                                        time: scheduleDraftByMatch[match.matchId]?.time || "",
                                        court: scheduleDraftByMatch[match.matchId]?.court || "",
                                      })
                                    }
                                  >
                                    Save Match Details
                                  </Button>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                    </Card>
                  </TournamentSectionItem>

                  {adminBracketTournament && adminBracketMatches.length > 0 && (
                    <TournamentSectionItem value={`tournamentBracket-${selectedTournament._id}`} title="Tournament Bracket">
                      <TournamentBracket
                        tournament={adminBracketTournament}
                        editable
                        onSubmitScore={(matchId, scoreA, scoreB) => {
                          updateScoreMutation.mutate({ matchId, scoreA, scoreB });
                        }}
                      />
                    </TournamentSectionItem>
                  )}
                  </Accordion>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
