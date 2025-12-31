/**
 * Export data to Excel format (CSV that opens in Excel)
 */
export function exportToExcel(
  data: any[],
  filename: string,
  headers: string[],
  getRowData: (item: any) => string[]
) {
  // Create CSV content
  const csvContent = [
    headers.join(','),
    ...data.map(item => {
      const row = getRowData(item);
      // Escape commas and quotes in cell values
      return row.map(cell => {
        const cellStr = String(cell || '');
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',');
    }),
    '', // Empty row
    '© UBISmashers', // Footer
  ].join('\n');

  // Create blob and download
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}.csv`);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

