export type LaborWeekCost = { payroll: number; overtime: number; bonuses: number };
export type LaborWeekCosts = Record<string, LaborWeekCost>;

const SHEET_ID = '1dzyVvcYIcLozj0rcarjZX9U2GUdLsJ8QI4OQfmICw_4';
const FIRST_MONDAY = Date.UTC(2025, 11, 29);
const DAY_MS = 86_400_000;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { value += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n') { row.push(value.replace(/\r$/, '')); rows.push(row); row = []; value = ''; }
    else value += char;
  }
  if (value || row.length) rows.push([...row, value.replace(/\r$/, '')]);
  return rows;
};

const dateToken = (value: string | undefined) => {
  const match = value?.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .match(/^(\d{1,2})\s+([a-z]{3})/);
  return match ? `${Number(match[1])} ${match[2]}` : null;
};
const dateLabel = (date: number) => {
  const day = new Date(date);
  return `${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]}`;
};
const amount = (value: string | undefined) => {
  if (!value?.trim()) return null;
  const result = Number(value.replace(/[$\s,]/g, ''));
  return Number.isFinite(result) ? result : null;
};

export function calculateLaborWeekCosts(rows: string[][], weekCount: number): LaborWeekCosts {
  const result: LaborWeekCosts = {};
  // Cada bloque ocupa cinco columnas y una separadora; las semanas se apilan
  // cada trece filas. Se usan fechas, no el rótulo «Semana», que se reinicia.
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const header = rows[rowIndex];
    if (!header?.some((cell) => /^Semana\s*\d+/i.test(cell?.trim() || ''))) continue;
    for (let column = 0; column < header.length; column += 6) {
      if (!/^Semana\s*\d+/i.test(header[column]?.trim() || '')) continue;
      const monday = dateToken(header[column + 1]);
      const sunday = dateToken(header[column + 3]);
      if (!monday || !sunday) continue;
      const total = rows[rowIndex + 11];
      if (!total || rows[rowIndex + 1]?.[column + 1]?.trim().toLowerCase() !== 'sueldo') continue;
      const payroll = amount(total[column + 1]);
      const overtime = amount(total[column + 3]);
      const bonuses = amount(total[column + 4]);
      if (payroll === null || overtime === null || bonuses === null) continue;
      for (let week = 0; week < weekCount; week += 1) {
        const start = FIRST_MONDAY + week * 7 * DAY_MS;
        if (dateLabel(start) === monday && dateLabel(start + 6 * DAY_MS) === sunday) {
          result[`S${week + 1}`] = { payroll, overtime, bonuses };
          break;
        }
      }
    }
  }
  if (!Object.keys(result).length) throw new Error('No se encontraron gastos semanales con fechas válidas.');
  return result;
}

export async function fetchLaborWeekCosts(weekCount: number): Promise<LaborWeekCosts> {
  const response = await fetch(
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0&_=${Date.now()}`,
    { cache: 'no-store' },
  );
  if (!response.ok) throw new Error('No fue posible leer la hoja de nómina, horas extras y bonos.');
  return calculateLaborWeekCosts(parseCsv(await response.text()), weekCount);
}
