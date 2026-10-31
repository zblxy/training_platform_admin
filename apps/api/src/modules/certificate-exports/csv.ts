// Quote every cell and neutralize spreadsheet formulas, including leading whitespace.
export function csvCell(value: string): string {
  const safe = /^[\s\uFEFF]*[=+@-]/u.test(value) || /^[\t\r\n]/u.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}
export const csvHeader = '\uFEFFLearner name,Course title,Serial number,Issue date\r\n';
export function csvRow(row: { learnerName: string; courseTitle: string; serialNumber: string; issueDate: string }): string {
  return [row.learnerName, row.courseTitle, row.serialNumber, row.issueDate].map(csvCell).join(',') + '\r\n';
}
