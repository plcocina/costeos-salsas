export type ServiceName = 'luz' | 'agua' | 'gas';
export type ServiceWeekCost = Record<ServiceName, number> & { total: number };
export type ServiceWeekCosts = Record<string, ServiceWeekCost>;

const SHEET_ID = '1SaeapIjUSSbbfTNlj_CHVd0nfWmzrDPNLbj40CdO5hs';
const DAY_MS = 86_400_000;
const FIRST_MONDAY = Date.UTC(2025, 11, 29);
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const SERVICES: { name: ServiceName; firstRow: number; shareColumn: number }[] = [
  { name: 'luz', firstRow: 2, shareColumn: 1 },
  { name: 'agua', firstRow: 8, shareColumn: 2 },
  { name: 'gas', firstRow: 14, shareColumn: 3 },
];

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(value);
      value = '';
    } else if (char === '\n') {
      row.push(value.replace(/\r$/, ''));
      rows.push(row);
      row = [];
      value = '';
    } else value += char;
  }
  if (value || row.length) rows.push([...row, value.replace(/\r$/, '')]);
  return rows;
};

const amount = (value: string | undefined) => {
  const result = Number((value || '').replace(/[$,%\s,]/g, ''));
  return Number.isFinite(result) ? result : 0;
};

const spanishDate = (value: string | undefined) => {
  const match = value?.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .match(/^(\d{1,2})[\s-]+([a-z]{3})[\s-]+(\d{2}|\d{4})$/);
  if (!match) return null;
  const month = MONTHS.indexOf(match[2]);
  const year = Number(match[3]) + (match[3].length === 2 ? 2000 : 0);
  if (month < 0) return null;
  const date = Date.UTC(year, month, Number(match[1]));
  const check = new Date(date);
  return check.getUTCFullYear() === year && check.getUTCMonth() === month && check.getUTCDate() === Number(match[1])
    ? date : null;
};

export function calculateServiceWeekCosts(
  pl1: string[][],
  methodology: string[][],
  weekCount: number,
): ServiceWeekCosts {
  const salsaRow = methodology.find((row) => row[0]?.trim().toLowerCase() === 'salsas');
  if (!salsaRow) throw new Error('No se encontró la distribución de Salsas en Metodología PL1.');

  const rates = {} as Record<ServiceName, { start: number; daily: number }[]>;
  SERVICES.forEach(({ name, firstRow, shareColumn }) => {
    const share = amount(salsaRow[shareColumn]) / 100;
    if (share <= 0 || share > 1) throw new Error(`Porcentaje de ${name} inválido para Salsas.`);
    const periods: { start: number; daily: number }[] = [];
    for (let column = 2; column <= 24; column += 2) {
      const start = spanishDate(pl1[firstRow]?.[column]);
      const end = spanishDate(pl1[firstRow + 1]?.[column]);
      const bill = amount(pl1[firstRow + 3]?.[column]);
      if (start === null || end === null || bill <= 0 || end <= start) continue;
      periods.push({ start, daily: (bill / ((end - start) / DAY_MS)) * share });
    }
    if (!periods.length) throw new Error(`No se encontraron recibos válidos de ${name} en PL1.`);
    rates[name] = periods.sort((a, b) => a.start - b.start);
  });

  const result: ServiceWeekCosts = {};
  for (let week = 0; week < weekCount; week += 1) {
    const costs = { luz: 0, agua: 0, gas: 0, total: 0 };
    for (let day = 0; day < 7; day += 1) {
      const date = FIRST_MONDAY + (week * 7 + day) * DAY_MS;
      SERVICES.forEach(({ name }) => {
        const last = rates[name].findLast((period) => period.start <= date);
        if (last) costs[name] += last.daily;
      });
    }
    costs.total = Math.round((costs.luz + costs.agua + costs.gas) * 100) / 100;
    result[`S${week + 1}`] = costs;
  }
  return result;
}

export async function fetchServiceWeekCosts(weekCount: number): Promise<ServiceWeekCosts> {
  const read = async (gid: number) => {
    const response = await fetch(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}&_=${Date.now()}`,
      { cache: 'no-store' },
    );
    if (!response.ok) throw new Error('No fue posible leer SERVICIOS 2026.');
    return parseCsv(await response.text());
  };
  const [pl1, methodology] = await Promise.all([read(0), read(1109242026)]);
  return calculateServiceWeekCosts(pl1, methodology, weekCount);
}
