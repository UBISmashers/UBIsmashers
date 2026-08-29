import { Document, Image, Page, pdf, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { Tournament, TournamentMatch } from "@/types/tournament";

const logoSrc = "/icon.jpeg";

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 20,
    fontFamily: "Helvetica",
    color: "#111827",
    lineHeight: 1.4,
  },
  watermark: {
    position: "absolute",
    width: 420,
    height: 420,
    left: 88,
    top: 100,
    opacity: 0.06,
    objectFit: "contain",
  },
  header: {
    marginBottom: 18,
    alignItems: "center",
  },
  title: {
    fontFamily: "Helvetica-Bold",
    fontSize: 24,
    color: "#0f172a",
    textAlign: "center",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  subTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: "#0f172a",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  table: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 6,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#0f172a",
    color: "#ffffff",
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
  },
  tableHeaderCell: {
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRightWidth: 1,
    borderRightColor: "#ffffff",
    textAlign: "center",
  },
  tableHeaderCellLast: {
    borderRightWidth: 0,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    minHeight: 32,
  },
  tableCell: {
    paddingVertical: 8,
    paddingHorizontal: 6,
    fontSize: 9,
    color: "#111827",
    textAlign: "center",
  },
  tableCellLeft: {
    textAlign: "left",
  },
  tableCellSpan: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 9,
    color: "#111827",
    textAlign: "center",
    backgroundColor: "#f0f9ff",
    fontFamily: "Helvetica-Bold",
  },
  breakRow: {
    flexDirection: "row",
    backgroundColor: "#e0f2fe",
    paddingVertical: 10,
    paddingHorizontal: 8,
    minHeight: 30,
  },
  breakText: {
    color: "#0c4a6e",
    fontSize: 9,
    fontStyle: "italic",
    textAlign: "center",
    fontFamily: "Helvetica-Bold",
  },
  sectionTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 12,
    color: "#0f172a",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  bulletList: {
    marginLeft: 12,
    marginBottom: 6,
  },
  bulletItem: {
    flexDirection: "row",
    marginBottom: 3,
  },
  bulletDot: {
    width: 4,
    height: 4,
    backgroundColor: "#0f172a",
    borderRadius: 2,
    marginTop: 6,
    marginRight: 6,
  },
  bulletText: {
    fontSize: 9.5,
    color: "#111827",
    flex: 1,
  },
  metadataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
  },
  metadataLabel: {
    fontSize: 9,
    color: "#475569",
  },
  metadataValue: {
    fontSize: 9,
    color: "#111827",
    fontFamily: "Helvetica-Bold",
  },
});

const formatDate = (value: string | null | undefined) => {
  if (!value) return "TBD";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "TBD";
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][date.getUTCMonth()];
  return `${day}-${month}-${date.getUTCFullYear()}`;
};

const formatTime = (value: Date | null | undefined) => {
  if (!value) return "TBD";
  const hours = value.getUTCHours();
  const minutes = String(value.getUTCMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const normalizeCourtName = (match: TournamentMatch) => match.court_name || match.court || "Court TBD";

const getScheduledMatches = (tournament: Tournament) =>
  tournament.matches
    .filter((match) => match.scheduledAt)
    .map((match) => ({
      ...match,
      scheduledAtDate: new Date(match.scheduledAt as string),
      scheduledEndAtDate: match.scheduledEndAt ? new Date(match.scheduledEndAt as string) : null,
      courtName: normalizeCourtName(match),
    }))
    .sort((a, b) => {
      const aTime = a.scheduledAtDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bTime = b.scheduledAtDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (aTime !== bTime) return aTime - bTime;
      const courtCompare = a.courtName.localeCompare(b.courtName, undefined, { numeric: true });
      if (courtCompare !== 0) return courtCompare;
      if (a.roundNumber !== b.roundNumber) return a.roundNumber - b.roundNumber;
      return a.matchNumber - b.matchNumber;
    });

const getCourtColumns = (matches: Array<TournamentMatch & { courtName: string }>) =>
  Array.from(new Set(matches.map((match) => match.courtName))).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true })
  );

const getTimeRange = (match: TournamentMatch & { scheduledAtDate: Date; scheduledEndAtDate: Date | null }) => {
  const start = formatTime(match.scheduledAtDate);
  const end = match.scheduledEndAtDate ? formatTime(match.scheduledEndAtDate) : null;
  return end ? `${start} – ${end}` : start;
};

type ScheduleRow =
  | {
      type: "match";
      timeLabel: string;
      roundLabel: string;
      courtCells: Record<string, string | null>;
      slotKey: string;
    }
  | {
      type: "break";
      timeLabel: string;
      message: string;
      slotKey: string;
    };

const buildScheduleRows = (
  tournament: Tournament,
  scheduledMatches: Array<TournamentMatch & { scheduledAtDate: Date; scheduledEndAtDate: Date | null; courtName: string }> 
) => {
  const courts = getCourtColumns(scheduledMatches);
  const rows: ScheduleRow[] = [];
  const slots = new Map<string, ScheduleRow>();

  scheduledMatches.forEach((match) => {
    const slotKey = `${match.scheduledAtDate.toISOString()}|${match.roundLabel || ""}`;
    const timeLabel = getTimeRange(match);
    const teamLabel = `${match.teamA?.name || "TBD"} vs ${match.teamB?.name || "TBD"}`;
    const existing = slots.get(slotKey);
    const entry: Extract<ScheduleRow, { type: "match" }> = existing?.type === "match" ? existing : {
      type: "match",
      timeLabel,
      roundLabel: match.roundLabel || "",
      courtCells: Object.fromEntries(courts.map((court) => [court, null])),
      slotKey,
    };
    entry.courtCells[match.courtName] = teamLabel;
    slots.set(slotKey, entry);
  });

  slots.forEach((row) => rows.push(row));
  return rows.sort((a, b) => {
    const aTime = a.timeLabel;
    const bTime = b.timeLabel;
    if (aTime !== bTime) return aTime.localeCompare(bTime, undefined, { numeric: true });
    const aRound = a.type === "match" ? a.roundLabel : "";
    const bRound = b.type === "match" ? b.roundLabel : "";
    return aRound.localeCompare(bRound, undefined, { numeric: true });
  });
};

const insertBreaks = (
  tournament: Tournament,
  rows: ScheduleRow[],
  scheduledMatches: Array<TournamentMatch & { scheduledAtDate: Date; scheduledEndAtDate: Date | null; courtName: string }>
) => {
  if (rows.length === 0) return rows;

  const groupRows = scheduledMatches.filter((match) => match.matchType === "league" && /^Group\s/i.test(match.roundLabel || ""));
  const knockoutRows = scheduledMatches.filter((match) => match.matchType !== "league");
  const rowsWithBreaks: ScheduleRow[] = [];

  const insertAfter = (index: number, breakRow: ScheduleRow) => {
    rowsWithBreaks.splice(index + 1, 0, breakRow);
  };

  rowsWithBreaks.push(...rows);

  if (groupRows.length > 0 && knockoutRows.length > 0) {
    const lastGroup = groupRows[groupRows.length - 1];
    const firstKnockout = knockoutRows[0];
    const insertIndex = rowsWithBreaks.findIndex((row) => row.type === "match" && row.timeLabel === getTimeRange(lastGroup) && row.roundLabel === lastGroup.roundLabel);
    if (insertIndex >= 0) {
      rowsWithBreaks.splice(insertIndex + 1, 0, {
        type: "break",
        timeLabel: lastGroup.scheduledEndAtDate ? `${formatTime(lastGroup.scheduledEndAtDate)} – ${formatTime(new Date(lastGroup.scheduledEndAtDate.getTime() + (tournament.breakDurationMinutes || 10) * 60000))}` : "",
        message: "Break time, Preparation for Quarter Final Matches",
        slotKey: `break-qf-${lastGroup.scheduledAtDate.toISOString()}`,
      });
    }
  }

  const semiMatches = scheduledMatches.filter((match) => match.matchType === "semifinal");
  const finalMatches = scheduledMatches.filter((match) => match.matchType === "final");
  if (semiMatches.length > 0 && finalMatches.length > 0) {
    const lastSemi = semiMatches[semiMatches.length - 1];
    const insertIndex = rowsWithBreaks.findIndex((row) => row.type === "match" && row.timeLabel === getTimeRange(lastSemi) && row.roundLabel === lastSemi.roundLabel);
    if (insertIndex >= 0) {
      rowsWithBreaks.splice(insertIndex + 1, 0, {
        type: "break",
        timeLabel: lastSemi.scheduledEndAtDate ? `${formatTime(lastSemi.scheduledEndAtDate)} – ${formatTime(new Date(lastSemi.scheduledEndAtDate.getTime() + (tournament.breakDurationMinutes || 10) * 60000))}` : "",
        message: "Break time, Preparation for Final Matches",
        slotKey: `break-final-${lastSemi.scheduledAtDate.toISOString()}`,
      });
    }
  }

  const finalMatch = scheduledMatches.find((match) => match.matchType === "final");
  if (finalMatch) {
    const insertIndex = rowsWithBreaks.findIndex((row) => row.type === "match" && row.timeLabel === getTimeRange(finalMatch) && row.roundLabel === finalMatch.roundLabel);
    if (insertIndex >= 0) {
      rowsWithBreaks.splice(insertIndex + 1, 0, {
        type: "break",
        timeLabel: finalMatch.scheduledEndAtDate ? `${formatTime(finalMatch.scheduledEndAtDate)} – ${formatTime(new Date(finalMatch.scheduledEndAtDate.getTime() + (tournament.breakDurationMinutes || 10) * 60000))}` : "",
        message: tournament.closingEvent || "Presentations, Trophy Distributions, Prize Giving",
        slotKey: `break-closing-${finalMatch.scheduledAtDate.toISOString()}`,
      });
    }
  }

  return rowsWithBreaks;
};

const getScheduleRows = (tournament: Tournament) => {
  const scheduledMatches = getScheduledMatches(tournament);
  if (scheduledMatches.length === 0) return { courts: [], rows: [] };
  const courts = getCourtColumns(scheduledMatches);
  const rows = buildScheduleRows(tournament, scheduledMatches);
  const enrichedRows = insertBreaks(tournament, rows, scheduledMatches);
  return { courts, rows: enrichedRows };
};

const formatPdfRuleText = (tournament: Tournament): string[] => {
  const formatRules: Record<Tournament["format"], string[]> = {
    knockout: [
      "Single elimination bracket format.",
      "Winners advance to the next round until the final.",
      "All matches are knockouts with no return path.",
    ],
    round_robin: [
      "Each team plays all other teams once.",
      "Teams are ranked by points, point difference, and points for.",
      "The top teams advance to the final rounds if applicable.",
    ],
    group_stage: [
      "Teams are split into groups and play within their groups.",
      "Top teams from each group qualify for the knockout stage.",
      "Standings are based on points, point difference, and points for.",
    ],
    group_knockout: [
      "Teams play round robin matches within groups first.",
      "Top teams qualify for a knockout bracket.",
      "Knockout winners advance until the final.",
    ],
    round_robin_knockout: [
      "Teams start in round robin groups to guarantee multiple matches.",
      "Top teams from each group advance to knockout rounds.",
      "Knockout winners advance until the final.",
    ],
  };

  return formatRules[tournament.format] || [
    "Teams play according to the tournament format selected.",
    "Scores and standings determine qualification for later rounds.",
  ];
};

const buildPlanBullets = (tournament: Tournament): string[] => {
  if (tournament.format === "round_robin_knockout") {
    return [
      `Each group will consist of ${tournament.teamsPerGroup ?? "N"} teams.`,
      "Every team will play one match against each other team in their group.",
      `The top ${tournament.directQualifierCount || 1} team(s) from each group will advance directly to the Semi-Finals.`,
      `The next ${tournament.qfQualifierCount || 2} team(s) from each group will compete in the Quarter Finals.`,
      "Quarter Final winners join direct qualifiers in the Semi-Finals.",
      "Winners of the Semi-Finals play in the Final. Losers of the Semi-Finals play in the Third-Place Match.",
    ];
  }

  return [
    ...formatPdfRuleText(tournament),
    `Match duration is scheduled for ${tournament.matchDurationMinutes || 10} minutes per match.`,
    tournament.breakDurationMinutes
      ? `Scheduled breaks are ${tournament.breakDurationMinutes} minutes between key phases.`
      : "Breaks are included between phase transitions.",
  ];
};

const formatTournamentFormatLabel = (format: Tournament["format"]) => {
  const labels: Record<Tournament["format"], string> = {
    knockout: "Knockout",
    round_robin: "Round Robin",
    group_stage: "Group Stage",
    group_knockout: "Group + Knockout",
    round_robin_knockout: "Round Robin + Knockout",
  };
  return labels[format] || format;
};

const buildMatchScheduleTable = (courts: string[], rows: ScheduleRow[]) => (
  <View style={styles.table}>
    <View style={styles.tableHeader}>
      <Text style={[styles.tableHeaderCell, styles.tableCellLeft, { flex: 1 }]}>Round</Text>
      <Text style={[styles.tableHeaderCell, { flex: 1.3 }]}>Time</Text>
      {courts.map((court, index) => (
        <Text
          key={court}
          style={[
            styles.tableHeaderCell,
            index === courts.length - 1 && styles.tableHeaderCellLast,
            { flex: 1.5 },
          ]}
        >
          {court}
        </Text>
      ))}
    </View>
    {rows.map((row, index) => {
      if (row.type === "break") {
        return (
          <View key={row.slotKey} style={styles.breakRow}>
            <Text style={styles.breakText}>{row.message}</Text>
          </View>
        );
      }
      return (
        <View
          key={row.slotKey}
          style={[styles.tableRow, index % 2 === 1 ? { backgroundColor: "#f8fafc" } : undefined]}
        >
          <Text style={[styles.tableCell, styles.tableCellLeft, { flex: 1 }]}>{row.roundLabel || "-"}</Text>
          <Text style={[styles.tableCell, { flex: 1.3 }]}>{row.timeLabel}</Text>
          {courts.map((court) => (
            <Text key={court} style={[styles.tableCell, { flex: 1.5 }]}> 
              {row.courtCells[court] || "-"}
            </Text>
          ))}
        </View>
      );
    })}
  </View>
);

export function MatchScheduleDocument({ tournament }: { tournament: Tournament }) {
  const scheduledMatches = getScheduledMatches(tournament);
  const { courts, rows } = getScheduleRows(tournament);
  return (
    <Document title={`${tournament.name} Match Schedule`}>
      <Page size="A4" style={styles.page} wrap>
        <Image src={logoSrc} style={styles.watermark} />
        <View style={styles.header}>
          <Text style={styles.title}>{tournament.name}</Text>
          <Text style={styles.subTitle}>{formatDate(tournament.date)}</Text>
        </View>
        {courts.length > 0 ? (
          buildMatchScheduleTable(courts, rows)
        ) : (
          <Text style={styles.breakText}>No scheduled matches available.</Text>
        )}
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Generated for format</Text>
          <Text style={styles.metadataValue}>{formatTournamentFormatLabel(tournament.format)}</Text>
        </View>
      </Page>
      <Page size="A4" style={styles.page}>
        <Image src={logoSrc} style={styles.watermark} />
        <Text style={styles.title}>{tournament.name}</Text>
        <Text style={styles.subTitle}>Schedule Plan 🏸</Text>
        <View style={{ marginTop: 16 }}>
          {buildPlanBullets(tournament).map((bullet, index) => (
            <View key={index} style={styles.bulletItem}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{bullet}</Text>
            </View>
          ))}
        </View>
        <View style={styles.metadataRow}>
          <Text style={styles.metadataLabel}>Date</Text>
          <Text style={styles.metadataValue}>{formatDate(tournament.date)}</Text>
        </View>
      </Page>
    </Document>
  );
}

export const getMatchScheduleFilename = (tournamentName: string) =>
  `${tournamentName.replace(/[^a-z0-9]+/gi, "_").replace(/^_+|_+$/g, "")}_Match_Schedule.pdf`;

export const downloadMatchSchedulePdf = async (tournament: Tournament) => {
  const blob = await pdf(<MatchScheduleDocument tournament={tournament} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = getMatchScheduleFilename(tournament.name);
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};
