import baseReport from '../../../public/data2026.json';

export const dynamic = 'force-dynamic';

type SauceKey = 'verde' | 'roja' | 'molca';
type Ingredient = {
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  total: number;
  secondaryQuantity?: string;
};

const WATER_COST = 0.178;
const DAY_MS = 86_400_000;
const firstMonday = Date.UTC(2025, 11, 29);
const monthTokens = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
const monthNames = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

const lastFinishedSunday = () => {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Monterrey', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const midnight = Date.parse(`${today}T00:00:00Z`);
  const day = new Date(midnight).getUTCDay();
  return Math.min(midnight - (day === 0 ? 7 : day) * DAY_MS, Date.UTC(2026, 11, 27));
};

const makeEmptySauce = () => ({
  sales: Array(7).fill(0) as number[], production: Array(7).fill(0) as number[],
  cost: Array(7).fill(0) as number[], revenue: Array(7).fill(0) as number[],
  profit: Array(7).fill(0) as number[], ingredients: Array.from({ length: 7 }, () => [] as Ingredient[]),
});

const makeWeek = (index: number) => {
  const monday = new Date(firstMonday + index * 7 * DAY_MS);
  const sunday = new Date(firstMonday + (index * 7 + 6) * DAY_MS);
  const startMonth = monthTokens[monday.getUTCMonth()].toLowerCase();
  const endMonth = monthTokens[sunday.getUTCMonth()].toLowerCase();
  const short = monday.getUTCMonth() === sunday.getUTCMonth()
    ? `${monday.getUTCDate()}–${sunday.getUTCDate()} ${endMonth}`
    : `${monday.getUTCDate()} ${startMonth}–${sunday.getUTCDate()} ${endMonth}`;
  return {
    id: `S${index + 1}`, label: `Semana ${index + 1} · ${short}`, short,
    dates: Array.from({ length: 7 }, (_, day) => {
      const date = new Date(firstMonday + (index * 7 + day) * DAY_MS);
      return `${dayNames[date.getUTCDay()]} ${date.getUTCDate()}`;
    }),
    verde: makeEmptySauce(), roja: makeEmptySauce(), molca: makeEmptySauce(),
  };
};

const productionSheets: Record<SauceKey, { id: string; gids: number[] }> = {
  verde: {
    id: '1PL3AC-y8QO1kBMxVQWgt6Y5GqE05wq7yYuC3FzQInwU',
    gids: [573364303, 508058107, 316186900, 1155164716, 437625771, 161135518, 766112573, 1925306401, 1993805291],
  },
  roja: {
    id: '1MOz_6skWKY35Lv0-F1BpagKQQ1rvIHTcMsv4rmPZgX8',
    gids: [2049451355, 1285240242, 1507004888, 2100394066, 718375101, 863971131, 603256968, 697818813, 986527132],
  },
  molca: {
    id: '1OY19k7UGTn7Iygm_Y1SjD2BqO7rftI43bc2mkvSuKOE',
    gids: [1636621455, 1051978416, 1026079306, 453187760, 2124141525, 1783494360, 851362634, 522068452, 430567830],
  },
};

const vegetableGids = [2052273932, 1076697694, 1670399244, 99691817, 618442277, 2068707185, 1743803604, 443327685, 560711388];
const salePriceGids = [0, 1911927854, 1933351388, 510517732, 1233785346, 1047428775, 700043206, 1945034243, 1273186372];

const csvUrl = (id: string, gid: number) =>
  `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}&_=${Date.now()}`;

const parseCsv = (text: string) => {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        value += '"';
        i += 1;
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
  if (value || row.length) {
    row.push(value.replace(/\r$/, ''));
    rows.push(row);
  }
  return rows;
};

const numberValue = (value: string | undefined) => {
  if (!value) return 0;
  const normalized = value.replace(/[$,%\s]/g, '').replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

const fetchCsv = async (id: string, gid: number) => {
  const response = await fetch(csvUrl(id, gid), {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Google Sheets respondió ${response.status}`);
  return parseCsv(await response.text());
};

const fetchCsvBySheet = async (id: string, sheet: string) => {
  const response = await fetch(
    `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_=${Date.now()}`,
    { cache: 'no-store' },
  );
  if (!response.ok) return null;
  const rows = parseCsv(await response.text());
  return rows.length > 2 ? rows : null;
};

const dateKey = (month: number, day: number) => Date.UTC(2026, month, day);
const dayFromLabel = (value: string | undefined) => {
  const match = value?.match(/(\d{1,2})(?!.*\d)/);
  return match ? Number(match[1]) : 0;
};

type PriceEvent = { date: number; price: number };
const priceAt = (events: PriceEvent[], date: number, fallback: number) => {
  let result = fallback;
  for (const event of events) {
    if (event.date > date) break;
    result = event.price;
  }
  return result;
};

const ingredient = (
  name: string,
  quantity: number,
  unit: string,
  unitCost: number,
  secondaryQuantity?: string,
): Ingredient => ({
  name,
  quantity,
  unit,
  unitCost,
  total: quantity * unitCost,
  ...(secondaryQuantity ? { secondaryQuantity } : {}),
});

const parseWeekStart = (value: string) => {
  const normalized = value.toUpperCase().replace(/\s+/g, ' ').trim();
  const match = normalized.match(/(\d{1,2})(?:\s*([A-ZÁÉÍÓÚ]{3}))?\s*[-–]\s*\d{1,2}\s*([A-ZÁÉÍÓÚ]{3})/);
  if (!match) return null;
  const token = (match[2] || match[3]).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const month = monthTokens.indexOf(token);
  return month >= 0 ? { month, day: Number(match[1]) } : null;
};

export async function GET() {
  try {
    const latestSunday = lastFinishedSunday();
    const latestMonth = new Date(latestSunday).getUTCMonth();
    const productionRequests = (Object.keys(productionSheets) as SauceKey[]).flatMap((sauce) => [
      ...productionSheets[sauce].gids.map((gid, month) =>
        fetchCsv(productionSheets[sauce].id, gid).then((rows) => ({ sauce, month, rows }))),
      ...Array.from({ length: Math.max(0, latestMonth - productionSheets[sauce].gids.length + 1) }, (_, offset) => {
        const month = productionSheets[sauce].gids.length + offset;
        return fetchCsvBySheet(productionSheets[sauce].id, monthTokens[month])
          .then((rows) => rows ? { sauce, month, rows } : null)
          .catch(() => null);
      }),
    ]);
    const vegetableRequests = [
      ...vegetableGids.map((gid, month) =>
        fetchCsv('17oCqRPNB1mMHY5D-kt5c5UEtf3bprvKC292ovBvq7KA', gid).then((rows) => ({ month, rows }))),
      ...Array.from({ length: Math.max(0, latestMonth - vegetableGids.length + 1) }, (_, offset) => {
        const month = vegetableGids.length + offset;
        return fetchCsvBySheet('17oCqRPNB1mMHY5D-kt5c5UEtf3bprvKC292ovBvq7KA', monthTokens[month])
          .then((rows) => rows ? { month, rows } : null).catch(() => null);
      }),
    ];
    const salesRequests = [
      ...salePriceGids.map((gid, month) =>
        fetchCsv('1mnTOi04lPvTAPql1rqBOGUm6ro_mN3HevIcgJBpBDXI', gid).then((rows) => ({ month, rows }))),
      ...Array.from({ length: Math.max(0, latestMonth - salePriceGids.length + 1) }, (_, offset) => {
        const month = salePriceGids.length + offset;
        return fetchCsvBySheet('1mnTOi04lPvTAPql1rqBOGUm6ro_mN3HevIcgJBpBDXI', monthNames[month].toUpperCase())
          .then((rows) => rows ? { month, rows } : null).catch(() => null);
      }),
    ];
    const [productionTabs, vegetableTabs, salesTabs, purchases] = await Promise.all([
      Promise.all(productionRequests),
      Promise.all(vegetableRequests),
      Promise.all(salesRequests),
      fetchCsv('1v9-qmQugPpx7N3VzMVW_1m5Bg-OxqwKPk_G4q3O_vpM', 1351591836),
    ]);

    const production = new Map<string, string[]>();
    productionTabs.filter((tab): tab is NonNullable<typeof tab> => tab !== null).forEach(({ sauce, month, rows }) => {
      rows.slice(2).forEach((row) => {
        const day = dayFromLabel(row[0]);
        const key = `${sauce}-${month}-${day}`;
        if (day && !production.has(key)) production.set(key, row);
      });
    });

    const vegetableColumns: Record<string, number> = {
      tomate: 0,
      tomateVerde: 5,
      tomatillo: 10,
      jalapeno: 15,
      serrano: 20,
      cilantro: 30,
      cebolla: 50,
      limon: 65,
    };
    const vegetablePrices: Record<string, PriceEvent[]> = Object.fromEntries(
      Object.keys(vegetableColumns).map((key) => [key, []]),
    );
    vegetableTabs.filter((tab): tab is NonNullable<typeof tab> => tab !== null).forEach(({ month, rows }) => {
      rows.slice(1).forEach((row) => {
        Object.entries(vegetableColumns).forEach(([product, column]) => {
          const day = dayFromLabel(row[column]);
          const price = numberValue(row[column + 2]);
          if (day && price > 0) vegetablePrices[product].push({ date: dateKey(month, day), price });
        });
      });
    });
    Object.values(vegetablePrices).forEach((events) => events.sort((a, b) => a.date - b.date));

    const purchasePrices: Record<string, PriceEvent[]> = {
      'PULPA AGUACATE': [],
      ACEITE: [],
      AJO: [],
      SAL: [],
    };
    const priceLimits: Record<string, number> = { 'PULPA AGUACATE': 300, ACEITE: 100, AJO: 1000, SAL: 50 };
    purchases.slice(1).forEach((row) => {
      const product = row[3]?.trim().toUpperCase();
      if (!(product in purchasePrices)) return;
      const month = monthTokens.indexOf((row[0]?.split(/\s+/)[1] || '').toUpperCase());
      const day = dayFromLabel(row[1]);
      const price = numberValue(row[7]);
      if (month >= 0 && day && price > 0 && price <= priceLimits[product]) {
        purchasePrices[product].push({ date: dateKey(month, day), price });
      }
    });
    Object.values(purchasePrices).forEach((events) => events.sort((a, b) => a.date - b.date));

    const report = structuredClone(baseReport) as Omit<typeof baseReport, 'salePrices' | 'monthWeeks'> & {
      salePrices: Record<string, Record<SauceKey, number>>;
      monthWeeks: Record<string, string[]>;
      latestCompleteWeekId?: string;
    };
    for (let index = report.weeks.length; firstMonday + (index * 7 + 6) * DAY_MS <= latestSunday; index += 1) {
      const complete = Array.from({ length: 7 }, (_, day) => {
        const date = new Date(firstMonday + (index * 7 + day) * DAY_MS);
        return (Object.keys(productionSheets) as SauceKey[]).every((sauce) =>
          !!production.get(`${sauce}-${date.getUTCMonth()}-${date.getUTCDate()}`)?.[2]?.trim());
      }).every(Boolean);
      if (!complete) break;
      const week = makeWeek(index);
      report.weeks.push(week);
      const monthName = monthNames[new Date(firstMonday + (index * 7 + 6) * DAY_MS).getUTCMonth()];
      report.monthWeeks[monthName] ??= [];
      report.monthWeeks[monthName].push(week.id);
      report.salePrices[week.id] = { ...report.salePrices[`S${index}`] };
    }
    for (let index = report.weeks.length - 1; index >= 0; index -= 1) {
      if (firstMonday + (index * 7 + 6) * DAY_MS > latestSunday) continue;
      const complete = Array.from({ length: 7 }, (_, day) => {
        const date = new Date(firstMonday + (index * 7 + day) * DAY_MS);
        return (Object.keys(productionSheets) as SauceKey[]).every((sauce) =>
          !!production.get(`${sauce}-${date.getUTCMonth()}-${date.getUTCDate()}`)?.[2]?.trim());
      }).every(Boolean);
      if (complete) { report.latestCompleteWeekId = report.weeks[index].id; break; }
    }
    const weeksByStart = new Map<string, string>();
    report.weeks.forEach((week, index) => {
      const monday = new Date(firstMonday + index * 7 * DAY_MS);
      weeksByStart.set(`${monday.getUTCMonth()}-${monday.getUTCDate()}`, week.id);
    });

    salesTabs.filter((tab): tab is NonNullable<typeof tab> => tab !== null).forEach(({ rows }) => {
      const priceRows: Partial<Record<SauceKey, string[]>> = {};
      rows.forEach((row) => {
        const product = (row[0] || '').toUpperCase();
        if (product.includes('SALSA VERDE')) priceRows.verde = row;
        else if (product.includes('SALSA ROJA')) priceRows.roja = row;
        else if (product.includes('SALSA MOLCA')) priceRows.molca = row;
      });
      const columnCount = Math.max(...rows.slice(0, 3).map((row) => row.length), 0);
      for (let column = 2; column < columnCount; column += 1) {
        const start = parseWeekStart(rows[1]?.[column] || rows[0]?.[column] || '');
        if (!start) continue;
        const weekId = weeksByStart.get(`${start.month}-${start.day}`);
        if (!weekId || !report.salePrices[weekId]) continue;
        (['verde', 'roja', 'molca'] as const).forEach((sauce) => {
          const price = numberValue(priceRows[sauce]?.[column]);
          if (price > 0) report.salePrices[weekId][sauce] = price;
        });
      }
    });

    report.weeks.forEach((week, weekIndex) => {
      week.dates.forEach((_label, dayIndex) => {
        const timestamp = firstMonday + (weekIndex * 7 + dayIndex) * DAY_MS;
        const date = new Date(timestamp);
        const month = date.getUTCMonth();
        const day = date.getUTCDate();
        if (date.getUTCFullYear() !== 2026) return;

        (['verde', 'roja', 'molca'] as const).forEach((sauce) => {
          const row = production.get(`${sauce}-${month}-${day}`);
          if (!row) return;
          const existing = week[sauce].ingredients[dayIndex] || [];
          const fallback = (name: string) => existing.find((item) => item.name === name)?.unitCost || 0;
          const veg = (product: string, name: string) => priceAt(vegetablePrices[product], timestamp, fallback(name));
          const bought = (product: string, name: string) => priceAt(purchasePrices[product], timestamp, fallback(name));
          let ingredients: Ingredient[];
          if (sauce === 'verde') {
            const pulpa = numberValue(row[11]);
            ingredients = [
              ingredient('Pulpa de aguacate', pulpa, 'bolsas', priceAt(purchasePrices['PULPA AGUACATE'], timestamp, fallback('Pulpa de aguacate') / 2.72) * 2.72, `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(pulpa * 2.72)} kg`),
              ingredient('Serrano', numberValue(row[12]), 'kg', veg('serrano', 'Serrano')),
              ingredient('Jalapeño cocido', numberValue(row[13]), 'kg', veg('jalapeno', 'Jalapeño cocido')),
              ingredient('Tomate verde', numberValue(row[14]), 'kg', veg('tomateVerde', 'Tomate verde')),
              ingredient('Tomatillo', numberValue(row[15]), 'kg', veg('tomatillo', 'Tomatillo')),
              ingredient('Cilantro', numberValue(row[16]), 'kg', veg('cilantro', 'Cilantro')),
              ingredient('Sal', numberValue(row[17]), 'kg', bought('SAL', 'Sal')),
              ingredient('Hielo', numberValue(row[18]), 'kg', WATER_COST),
              ingredient('Agua', numberValue(row[19]), 'lt', WATER_COST),
              ingredient('Agua de chile', numberValue(row[20]), 'lt', WATER_COST),
              ingredient('Aceite', numberValue(row[21]), 'lt', bought('ACEITE', 'Aceite')),
            ];
          } else if (sauce === 'roja') {
            const tomato = numberValue(row[11]);
            ingredients = [
              ingredient('Tomate', tomato, 'kg', veg('tomate', 'Tomate')),
              ingredient('Serrano', numberValue(row[12]), 'kg', veg('serrano', 'Serrano')),
              ingredient('Sal', tomato / 72, 'kg', bought('SAL', 'Sal')),
            ];
          } else {
            const tomato = numberValue(row[12]);
            ingredients = [
              ingredient('Tomate', tomato, 'kg', veg('tomate', 'Tomate')),
              ingredient('Agua', tomato / 3.625, 'lt', WATER_COST),
              ingredient('Jalapeño tatemado', numberValue(row[14]), 'kg', veg('jalapeno', 'Jalapeño tatemado')),
              ingredient('Cebolla', numberValue(row[15]), 'kg', veg('cebolla', 'Cebolla')),
              ingredient('Cilantro', numberValue(row[16]), 'kg', veg('cilantro', 'Cilantro')),
              ingredient('Ajo', numberValue(row[17]), 'kg', bought('AJO', 'Ajo')),
              ingredient('Limón', numberValue(row[19]), 'kg', veg('limon', 'Limón')),
              ingredient('Sal', numberValue(row[20]), 'kg', bought('SAL', 'Sal')),
            ];
          }
          week[sauce].sales[dayIndex] = numberValue(row[2]);
          week[sauce].production[dayIndex] = numberValue(row[4]);
          week[sauce].ingredients[dayIndex] = ingredients;
          week[sauce].cost[dayIndex] = ingredients.reduce((total, item) => total + item.total, 0);
          week[sauce].revenue[dayIndex] = 0;
          week[sauce].profit[dayIndex] = 0;
        });
      });
    });

    report.generatedThrough = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Monterrey', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());

    return Response.json(report, {
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'No fue posible actualizar las hojas' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
