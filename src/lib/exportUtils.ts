/**
 * Export data to Excel format (CSV that opens in Excel)
 */

const toCsvCell = (value: string | number | boolean | null | undefined) => {
  const cellStr = String(value ?? "");
  if (cellStr.includes(",") || cellStr.includes('"') || cellStr.includes("\n")) {
    return `"${cellStr.replace(/"/g, '""')}"`;
  }
  return cellStr;
};

export function exportToExcel<T>(
  data: T[],
  filename: string,
  headers: string[],
  getRowData: (item: T) => Array<string | number | boolean | null | undefined>
) {
  const csvContent = [
    headers.join(","),
    ...data.map((item) => getRowData(item).map(toCsvCell).join(",")),
    "",
    "UBISmashers",
  ].join("\n");

  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

export function exportSectionsToExcel(
  filename: string,
  sections: Array<{
    title: string;
    headers: string[];
    rows: Array<Array<string | number | boolean | null | undefined>>;
  }>
) {
  const lines: string[] = [];

  sections.forEach((section, index) => {
    if (index > 0) {
      lines.push("");
      lines.push("");
    }

    lines.push(toCsvCell(section.title));
    lines.push(section.headers.map(toCsvCell).join(","));

    if (section.rows.length === 0) {
      lines.push(toCsvCell("No data"));
      return;
    }

    section.rows.forEach((row) => {
      lines.push(row.map(toCsvCell).join(","));
    });
  });

  lines.push("");
  lines.push("UBISmashers");

  const csvContent = lines.join("\n");
  const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
