import {
  Document,
  Image,
  Page,
  pdf,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import type { Tournament, TournamentMatch } from "@/types/tournament";

export type ScoresheetStage = "league" | "playoffs" | "finals";

type NumberedMatch = TournamentMatch & {
  displayNumber: string;
};

type ScoresheetBucket = {
  stage: ScoresheetStage;
  label: string;
  filenamePart: string;
  matches: NumberedMatch[];
};

type RecordSheetGroup = {
  label: string;
  teams: Tournament["teams"];
};

const stageMeta: Record<ScoresheetStage, Pick<ScoresheetBucket, "label" | "filenamePart">> = {
  league: { label: "League Stage Scoresheets", filenamePart: "League" },
  playoffs: { label: "Quarter Final / Qualifying Scoresheets", filenamePart: "Playoffs" },
  finals: { label: "Semi Final & Final Scoresheets", filenamePart: "Finals" },
};

const logoSrc = "/icon.jpeg";
const tallyNumbers = Array.from({ length: 30 }, (_, index) => index + 1);

const styles = StyleSheet.create({
  page: {
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 14,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  matchBlock: {
    height: 397,
    position: "relative",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    padding: 12,
  },
  divider: {
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    marginVertical: 8,
  },
  watermark: {
    position: "absolute",
    width: 330,
    height: 330,
    left: 106,
    top: 34,
    opacity: 0.06,
    objectFit: "contain",
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  logo: {
    height: 30,
    width: 30,
    objectFit: "cover",
    marginRight: 9,
  },
  title: {
    flex: 1,
    textAlign: "left",
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#1e3a5f",
    textTransform: "uppercase",
  },
  badge: {
    minWidth: 54,
    borderRadius: 12,
    backgroundColor: "#1e3a5f",
    color: "#ffffff",
    paddingVertical: 6,
    paddingHorizontal: 10,
    textAlign: "center",
    fontSize: 12.5,
    fontFamily: "Helvetica-Bold",
  },
  headerRule: {
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    marginBottom: 8,
  },
  infoGrid: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    flexDirection: "row",
    marginBottom: 9,
    backgroundColor: "#f3f4f6",
  },
  infoCell: {
    flex: 1,
    minHeight: 42,
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  infoCellLast: {
    borderRightWidth: 0,
  },
  infoLabel: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
    marginBottom: 4,
    textAlign: "center",
    textTransform: "uppercase",
  },
  infoValue: {
    fontSize: 11,
    color: "#111827",
    textAlign: "center",
  },
  teamLabelChip: {
    alignSelf: "center",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    color: "#1e3a5f",
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    marginBottom: 7,
    paddingHorizontal: 9,
    paddingVertical: 3,
    textAlign: "center",
  },
  teamName: {
    color: "#111827",
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    lineHeight: 1.25,
    textAlign: "center",
  },
  teamsRow: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 9,
  },
  teamBox: {
    flex: 1,
    minHeight: 54,
    paddingVertical: 7,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  vsBox: {
    width: 46,
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: "#d1d5db",
  },
  vsText: {
    color: "#9ca3af",
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },
  tracker: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    marginBottom: 9,
    paddingBottom: 8,
    backgroundColor: "#ffffff",
  },
  trackerHeader: {
    backgroundColor: "#d1fae5",
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    color: "#065f46",
    paddingVertical: 6,
    textAlign: "center",
    fontSize: 9.5,
    fontFamily: "Helvetica-Bold",
  },
  tallyBlock: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 5,
    marginHorizontal: 8,
    marginTop: 8,
    overflow: "hidden",
  },
  tallyBlockGap: {
    marginTop: 12,
  },
  tallyLabel: {
    width: 78,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    color: "#111827",
    paddingHorizontal: 5,
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    textAlign: "center",
  },
  tallyRows: {
    flex: 1,
  },
  tallyGridRow: {
    flexDirection: "row",
    minHeight: 24,
    backgroundColor: "#ffffff",
  },
  tallyGridRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tallyGridRowAlt: {
    backgroundColor: "#f9fafb",
  },
  tallyCell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#e5e7eb",
    color: "#374151",
    fontSize: 10,
    textAlign: "center",
  },
  tallyCellLast: {
    borderRightWidth: 0,
  },
  resultBox: {
    backgroundColor: "#ecfdf5",
    borderRadius: 6,
    paddingVertical: 9,
    paddingHorizontal: 13,
  },
  resultField: {
    flexDirection: "row",
    alignItems: "flex-end",
    minHeight: 20,
  },
  resultFieldGap: {
    marginTop: 8,
  },
  resultLabel: {
    color: "#065f46",
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginRight: 9,
  },
  underline: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#065f46",
    borderBottomStyle: "dashed",
    minHeight: 15,
  },
  emptyBlock: {
    height: 397,
  },
  recordPage: {
    paddingTop: 28,
    paddingHorizontal: 28,
    paddingBottom: 24,
    fontFamily: "Helvetica",
    color: "#111827",
    position: "relative",
  },
  recordWatermark: {
    position: "absolute",
    width: 430,
    height: 430,
    left: 82,
    top: 205,
    opacity: 0.06,
    objectFit: "contain",
  },
  recordHeader: {
    alignItems: "center",
    flexDirection: "row",
    minHeight: 58,
    marginBottom: 13,
  },
  recordLogo: {
    width: 50,
    height: 50,
    objectFit: "cover",
    marginRight: 22,
  },
  recordTitle: {
    flex: 1,
    color: "#1e3a5f",
    fontFamily: "Helvetica-Bold",
    fontSize: 19,
    lineHeight: 1.18,
    textTransform: "uppercase",
  },
  recordRule: {
    borderTopWidth: 1,
    borderTopColor: "#d1d5db",
    marginBottom: 18,
  },
  recordInfoGrid: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    backgroundColor: "#f3f4f6",
    marginBottom: 18,
    overflow: "hidden",
  },
  recordInfoRow: {
    flexDirection: "row",
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: "#d1d5db",
  },
  recordInfoRowLast: {
    borderBottomWidth: 0,
  },
  recordInfoCell: {
    flex: 1,
    minHeight: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRightWidth: 1,
    borderRightColor: "#d1d5db",
    paddingHorizontal: 6,
    paddingVertical: 7,
  },
  recordInfoCellLast: {
    borderRightWidth: 0,
  },
  recordInfoValue: {
    fontSize: 10.5,
    color: "#111827",
    lineHeight: 1.25,
    textAlign: "center",
  },
  sectionHeader: {
    backgroundColor: "#d1fae5",
    borderRadius: 6,
    color: "#065f46",
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
    marginBottom: 10,
    paddingVertical: 6,
    textAlign: "center",
  },
  recordGroupsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -4,
    marginBottom: 18,
  },
  recordGroupCard: {
    width: "25%",
    paddingHorizontal: 4,
    marginBottom: 14,
  },
  recordGroupInner: {
    height: 120,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 6,
    padding: 6,
    backgroundColor: "#ffffff",
  },
  recordGroupChip: {
    alignSelf: "flex-start",
    backgroundColor: "#dbeafe",
    borderRadius: 999,
    color: "#1e3a5f",
    fontFamily: "Helvetica-Bold",
    fontSize: 8.5,
    marginBottom: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  recordTeamRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  recordTeamNumber: {
    width: 13,
    color: "#374151",
    fontSize: 8.2,
  },
  recordTeamName: {
    flex: 1,
    color: "#111827",
    fontSize: 8.2,
    lineHeight: 1.2,
  },
  recordEmptyText: {
    color: "#6b7280",
    fontSize: 9,
    textAlign: "center",
    paddingVertical: 18,
  },
  prizeBox: {
    backgroundColor: "#ecfdf5",
    borderRadius: 6,
    minHeight: 168,
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 18,
  },
  prizeRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    minHeight: 28,
  },
  prizeRowGap: {
    marginTop: 0,
  },
  prizeLabel: {
    width: 96,
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
  },
  prizeWinner: {
    color: "#ca8a04",
  },
  prizeRunnerUp: {
    color: "#6b7280",
  },
  prizeThird: {
    color: "#b45309",
  },
  prizeFourth: {
    color: "#374151",
  },
  prizeUnderline: {
    flex: 1,
    borderBottomWidth: 1,
    borderBottomColor: "#065f46",
    borderBottomStyle: "dashed",
    minHeight: 17,
  },
  recordFooter: {
    position: "absolute",
    right: 28,
    bottom: 14,
    color: "#6b7280",
    fontSize: 8,
  },
});

const getMatchTime = (match: TournamentMatch) => {
  if (!match.scheduledAt) return null;
  const value = new Date(match.scheduledAt).getTime();
  return Number.isNaN(value) ? null : value;
};

const getCourtLabel = (match: TournamentMatch) => match.court_name || match.court || "TBD";

const compareCourt = (a: TournamentMatch, b: TournamentMatch) =>
  getCourtLabel(a).localeCompare(getCourtLabel(b), undefined, { numeric: true, sensitivity: "base" });

export const sortScoresheetMatches = (matches: TournamentMatch[]) =>
  [...matches].sort((a, b) => {
    const timeA = getMatchTime(a);
    const timeB = getMatchTime(b);

    if (timeA !== null && timeB !== null && timeA !== timeB) return timeA - timeB;
    if (timeA !== null && timeB === null) return -1;
    if (timeA === null && timeB !== null) return 1;

    const courtCompare = compareCourt(a, b);
    if (courtCompare !== 0) return courtCompare;
    if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
    if (a.matchNumber !== b.matchNumber) return a.matchNumber - b.matchNumber;
    return a.matchId.localeCompare(b.matchId);
  });

const isLeagueMatch = (match: TournamentMatch) =>
  match.matchType === "league" && /^Group\s/i.test(match.roundLabel || "");

const isFinalsMatch = (match: TournamentMatch) =>
  match.matchType === "semifinal" ||
  match.matchType === "final" ||
  /semi\s*final|final/i.test(match.roundLabel || "");

const isPlayableKnockout = (match: TournamentMatch) =>
  !isLeagueMatch(match) && match.matchType !== "friendly" && match.matchType !== "practice";

const getStageForMatch = (match: TournamentMatch): ScoresheetStage | null => {
  if (isLeagueMatch(match)) return "league";
  if (!isPlayableKnockout(match)) return null;
  if (isFinalsMatch(match)) return "finals";
  return "playoffs";
};

export const buildScoresheetBuckets = (tournament: Tournament): ScoresheetBucket[] => {
  let nextNumber = 1;
  return (["league", "playoffs", "finals"] as ScoresheetStage[]).map((stage) => {
    const matches = sortScoresheetMatches(
      tournament.matches.filter((match) => getStageForMatch(match) === stage)
    ).map((match) => ({
      ...match,
      displayNumber: `M-${nextNumber++}`,
    }));

    return {
      stage,
      ...stageMeta[stage],
      matches,
    };
  });
};

export const getScoresheetFilename = (tournamentName: string, part: string) =>
  `${tournamentName.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "")}_${part}_Scoresheets.pdf`;

const sanitizeFilenamePart = (value: string) => value.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "");

export const getTournamentRecordSheetFilename = (tournamentName: string) =>
  `${sanitizeFilenamePart(tournamentName)}_Tournament_Record_Sheet.pdf`;

export const downloadScoresheetPdf = async (tournamentName: string, bucket: ScoresheetBucket) => {
  const blob = await pdf(<ScoresheetDocument tournamentName={tournamentName} matches={bucket.matches} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getScoresheetFilename(tournamentName, bucket.filenamePart);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const downloadTournamentRecordSheetPdf = async (tournament: Tournament) => {
  const blob = await pdf(<TournamentRecordSheetDocument tournament={tournament} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getTournamentRecordSheetFilename(tournament.name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const formatScoresheetDateTime = (value: string | null | undefined) => {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    date.getUTCMonth()
  ];
  const year = date.getUTCFullYear();
  const hours = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const hour12 = hours % 12 || 12;
  const period = hours >= 12 ? "PM" : "AM";
  return `${day}-${month}-${year} ${String(hour12).padStart(2, "0")}:${minutes} ${period}`;
};

const InfoCell = ({ label, value, last = false }: { label: string; value: string; last?: boolean }) => (
  <View style={[styles.infoCell, last && styles.infoCellLast]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

const RecordInfoCell = ({ label, value, last = false }: { label: string; value: string; last?: boolean }) => (
  <View style={[styles.recordInfoCell, last && styles.recordInfoCellLast]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.recordInfoValue}>{value}</Text>
  </View>
);

const formatTournamentDate = (value: string | null | undefined) => {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    date.getUTCMonth()
  ];
  return `${day}-${month}-${date.getUTCFullYear()}`;
};

const getGeneratedDate = () => {
  const date = new Date();
  const day = String(date.getDate()).padStart(2, "0");
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    date.getMonth()
  ];
  return `${day}-${month}-${date.getFullYear()}`;
};

const formatTournamentFormat = (format: Tournament["format"]) => {
  const labels: Record<Tournament["format"], string> = {
    knockout: "Knockout",
    round_robin: "Round Robin",
    group_stage: "Group Stage",
    group_knockout: "Group Stage + Knockout",
  };
  return labels[format] || format;
};

const buildRecordSheetGroups = (tournament: Tournament): RecordSheetGroup[] => {
  const teamsById = new Map(tournament.teams.map((team) => [team._id, team]));
  const configuredGroups = [...(tournament.tournamentGroups || [])]
    .sort((a, b) => a.groupOrder - b.groupOrder)
    .map((group) => ({
      label: group.groupName,
      teams: group.teamIds.map((teamId) => teamsById.get(teamId)).filter((team): team is Tournament["teams"][number] => Boolean(team)),
    }))
    .filter((group) => group.teams.length > 0);

  if (configuredGroups.length > 0) return configuredGroups;

  const groupedFromMatches = new Map<string, Set<string>>();
  tournament.matches.forEach((match) => {
    if (match.matchType !== "league") return;
    const label = (match.roundLabel || "").trim();
    if (!/^Group\s/i.test(label)) return;
    if (!groupedFromMatches.has(label)) groupedFromMatches.set(label, new Set<string>());
    if (match.teamAId) groupedFromMatches.get(label)?.add(match.teamAId);
    if (match.teamBId) groupedFromMatches.get(label)?.add(match.teamBId);
  });

  return [...groupedFromMatches.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([label, teamIds]) => ({
      label,
      teams: [...teamIds]
        .map((teamId) => teamsById.get(teamId))
        .filter((team): team is Tournament["teams"][number] => Boolean(team))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
};

const RecordGroupCard = ({ group }: { group: RecordSheetGroup }) => (
  <View style={styles.recordGroupCard}>
    <View style={styles.recordGroupInner}>
      <Text style={styles.recordGroupChip}>{group.label}</Text>
      {group.teams.map((team, index) => (
        <View key={`${group.label}-${team._id}`} style={styles.recordTeamRow}>
          <Text style={styles.recordTeamNumber}>{index + 1}.</Text>
          <Text style={styles.recordTeamName}>{team.name}</Text>
        </View>
      ))}
    </View>
  </View>
);

const PrizeRow = ({
  label,
  labelStyle,
  gap = false,
}: {
  label: string;
  labelStyle: object;
  gap?: boolean;
}) => (
  <View style={[styles.prizeRow, gap && styles.prizeRowGap]}>
    <Text style={[styles.prizeLabel, labelStyle]}>{label}</Text>
    <View style={styles.prizeUnderline} />
  </View>
);

export function TournamentRecordSheetDocument({ tournament }: { tournament: Tournament }) {
  const groups = buildRecordSheetGroups(tournament);
  const groupCount = groups.length || tournament.groupCount || 0;

  return (
    <Document title={`${tournament.name} Tournament Record Sheet`}>
      <Page size="A4" style={styles.recordPage}>
        <Image src={logoSrc} style={styles.recordWatermark} />
        <View style={styles.recordHeader}>
          <Image src={logoSrc} style={styles.recordLogo} />
          <Text style={styles.recordTitle}>{tournament.name}</Text>
        </View>
        <View style={styles.recordRule} />

        <View style={styles.recordInfoGrid}>
          <View style={styles.recordInfoRow}>
            <RecordInfoCell label="Date" value={formatTournamentDate(tournament.date)} />
            <RecordInfoCell label="Time" value={tournament.time || "TBD"} />
            <RecordInfoCell label="Venue / Location" value={tournament.location || "TBD"} last />
          </View>
          <View style={[styles.recordInfoRow, styles.recordInfoRowLast]}>
            <RecordInfoCell label="Total Number of Teams" value={String(tournament.teams.length)} />
            <RecordInfoCell label="Total Number of Groups" value={String(groupCount)} />
            <RecordInfoCell label="Format" value={formatTournamentFormat(tournament.format)} last />
          </View>
        </View>

        <Text style={styles.sectionHeader}>REGISTERED TEAMS</Text>
        {groups.length > 0 ? (
          <View style={styles.recordGroupsGrid}>
            {groups.map((group) => (
              <RecordGroupCard key={group.label} group={group} />
            ))}
          </View>
        ) : (
          <Text style={styles.recordEmptyText}>No groups have been allocated yet.</Text>
        )}

        <Text style={styles.sectionHeader}>TOURNAMENT RESULTS</Text>
        <View style={styles.prizeBox}>
          <PrizeRow label="WINNER:" labelStyle={styles.prizeWinner} />
          <PrizeRow label="RUNNER-UP:" labelStyle={styles.prizeRunnerUp} gap />
          <PrizeRow label="3RD PLACE:" labelStyle={styles.prizeThird} gap />
          <PrizeRow label="4TH PLACE:" labelStyle={styles.prizeFourth} gap />
        </View>

        <Text style={styles.recordFooter}>Generated on {getGeneratedDate()}</Text>
      </Page>
    </Document>
  );
}

const TallyGrid = ({ label, withGap = false }: { label: string; withGap?: boolean }) => (
  <View style={[styles.tallyBlock, withGap && styles.tallyBlockGap]}>
    <Text style={styles.tallyLabel}>{label}</Text>
    <View style={styles.tallyRows}>
      {[tallyNumbers.slice(0, 15), tallyNumbers.slice(15)].map((row, rowIndex) => (
        <View
          key={`${label}-${rowIndex}`}
          style={[
            styles.tallyGridRow,
            rowIndex === 0 && styles.tallyGridRowDivider,
            rowIndex === 1 && styles.tallyGridRowAlt,
          ]}
        >
          {row.map((number, index) => (
            <Text key={`${label}-${number}`} style={[styles.tallyCell, index === row.length - 1 && styles.tallyCellLast]}>
              {number}
            </Text>
          ))}
        </View>
      ))}
    </View>
  </View>
);

const MatchBlock = ({ tournamentName, match }: { tournamentName: string; match: NumberedMatch }) => (
  <View style={styles.matchBlock}>
    <Image src={logoSrc} style={styles.watermark} />
    <View style={styles.header}>
      <Image src={logoSrc} style={styles.logo} />
      <Text style={styles.title}>{tournamentName}</Text>
      <Text style={styles.badge}>{match.displayNumber}</Text>
    </View>
    <View style={styles.headerRule} />

    <View style={styles.infoGrid}>
      <InfoCell label="STAGE / ROUND" value={match.roundLabel || match.matchType || "TBD"} />
      <InfoCell label="COURT" value={getCourtLabel(match)} />
      <InfoCell label="SCHEDULED DATE & TIME" value={formatScoresheetDateTime(match.scheduledAt)} last />
    </View>

    <View style={styles.teamsRow}>
      <View style={styles.teamBox}>
        <Text style={styles.teamLabelChip}>TEAM A</Text>
        <Text style={styles.teamName}>{match.teamA?.name || "TBD"}</Text>
      </View>
      <View style={styles.vsBox}>
        <Text style={styles.vsText}>VS</Text>
      </View>
      <View style={styles.teamBox}>
        <Text style={styles.teamLabelChip}>TEAM B</Text>
        <Text style={styles.teamName}>{match.teamB?.name || "TBD"}</Text>
      </View>
    </View>

    <View style={styles.tracker}>
      <Text style={styles.trackerHeader}>POINTS TALLY TRACKER (CIRCLE / CROSS OUT POINTS AS SCORED)</Text>
      <TallyGrid label="Team A Score" />
      <TallyGrid label="Team B Score" withGap />
    </View>

    <View style={styles.resultBox}>
      <View style={styles.resultField}>
        <Text style={styles.resultLabel}>WINNER:</Text>
        <View style={styles.underline} />
      </View>
      <View style={[styles.resultField, styles.resultFieldGap]}>
        <Text style={styles.resultLabel}>FINAL SCORE:</Text>
        <View style={styles.underline} />
      </View>
    </View>
  </View>
);

export function ScoresheetDocument({
  tournamentName,
  matches,
}: {
  tournamentName: string;
  matches: NumberedMatch[];
}) {
  const pages = [];
  for (let index = 0; index < matches.length; index += 2) {
    pages.push(matches.slice(index, index + 2));
  }

  return (
    <Document title={`${tournamentName} Scoresheets`}>
      {pages.map((pageMatches, pageIndex) => (
        <Page key={`page-${pageIndex}`} size="A4" style={styles.page}>
          <MatchBlock tournamentName={tournamentName} match={pageMatches[0]} />
          <View style={styles.divider} />
          {pageMatches[1] ? (
            <MatchBlock tournamentName={tournamentName} match={pageMatches[1]} />
          ) : (
            <View style={styles.emptyBlock} />
          )}
        </Page>
      ))}
    </Document>
  );
}

