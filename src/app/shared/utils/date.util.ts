const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'] as const;
const MONTHS = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
] as const;

/** `2026-10-26` em data local, sem o fuso puxar o dia para trás. */
function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** "SEG 26 OUT", como no kicker das telas. */
export function formatShortDate(date: string): string {
  const parsed = parseLocalDate(date);
  return `${WEEKDAYS[parsed.getDay()]} ${parsed.getDate()} ${MONTHS[parsed.getMonth()]}`;
}

/** "26 OUT", para as listas de dias anteriores. */
export function formatDayMonth(date: string): string {
  const parsed = parseLocalDate(date);
  return `${parsed.getDate()} ${MONTHS[parsed.getMonth()]}`;
}

/** "20:12" a partir de um timestamp ISO. */
export function formatTime(iso: string): string {
  const parsed = new Date(iso);
  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`;
}

export function todayDateString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function daysBetween(from: string, to: string): number {
  const a = parseLocalDate(from).getTime();
  const b = parseLocalDate(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** "26 OUT" a partir de um timestamp ISO, no fuso de quem está olhando. */
export function formatDayMonthFromIso(iso: string): string {
  const parsed = new Date(iso);
  return `${parsed.getDate()} ${MONTHS[parsed.getMonth()]}`;
}
