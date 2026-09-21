'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  FileDown,
  PackageCheck,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type SauceKey = 'all' | 'verde' | 'roja' | 'molca';
type ReportView = 'week' | 'month' | 'trends';
type WeeklyResultView = 'summary' | Exclude<SauceKey, 'all'>;
type ReportMonth =
  | 'enero'
  | 'febrero'
  | 'marzo'
  | 'abril'
  | 'mayo'
  | 'junio'
  | 'julio'
  | 'agosto'
  | 'septiembre';
type SauceData = {
  sales: number[];
  production: number[];
  cost: number[];
  revenue: number[];
  profit: number[];
  ingredients: DailyIngredient[][];
};
type DailyIngredient = {
  name: string;
  quantity: number;
  unit: string;
  unitCost: number;
  total: number;
  secondaryQuantity?: string;
};
type Week = {
  id: string;
  label: string;
  short: string;
  dates: string[];
  verde: SauceData;
  roja: SauceData;
  molca: SauceData;
};
type ReportData = {
  generatedThrough: string;
  weeks: Week[];
  monthWeeks: Record<string, string[]>;
  salePrices: Record<string, Record<Exclude<SauceKey, 'all'>, number>>;
};

type WeekSettings = {
  prices: Record<Exclude<SauceKey, 'all'>, number>;
  services: number;
  payroll: number;
  overtime: number;
  bonuses: number;
  completed: boolean;
};

const makeWeekSettings = (
  prices: WeekSettings['prices'] = { verde: 0, roja: 0, molca: 0 },
): WeekSettings => ({
  prices,
  services: 0,
  payroll: 0,
  overtime: 0,
  bonuses: 0,
  completed: true,
});
const weeklyExpenseTotal = (settings: WeekSettings) =>
  settings.services + settings.payroll + settings.overtime + settings.bonuses;
const sauceMeta = {
  verde: { label: 'Salsa verde', color: '#A8C957', ink: '#4E681A' },
  roja: { label: 'Salsa roja', color: '#E45C4E', ink: '#8F241D' },
  molca: { label: 'Salsa molca', color: '#F3A83B', ink: '#8C4E06' },
};

const WATER_COST_PER_LITER = 0.1780;
const reportMonths: { id: ReportMonth; label: string }[] = [
  { id: 'enero', label: 'Enero' },
  { id: 'febrero', label: 'Febrero' },
  { id: 'marzo', label: 'Marzo' },
  { id: 'abril', label: 'Abril' },
  { id: 'mayo', label: 'Mayo' },
  { id: 'junio', label: 'Junio' },
  { id: 'julio', label: 'Julio' },
  { id: 'agosto', label: 'Agosto' },
  { id: 'septiembre', label: 'Septiembre' },
];
const monthWeekLabel = (month: ReportMonth, monthWeeks: Record<string, string[]>) => {
  const ids = monthWeeks[month] || [];
  return ids.length > 1 ? `${ids[0]}–${ids[ids.length - 1]}` : ids[0] || '';
};

const money = (value: number, digits = 0) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: digits,
  }).format(value);
const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
const integer = (value: number) =>
  new Intl.NumberFormat('es-MX').format(Math.round(value));

const ingredientsForWeek = (week: Week, sauce: Exclude<SauceKey, 'all'>) => {
  const totals = new Map<string, { quantity: number; unit: string; cost: number }>();

  week[sauce].ingredients.flat().forEach((item) => {
    const current = totals.get(item.name) || { quantity: 0, unit: item.unit, cost: 0 };
    totals.set(item.name, {
      quantity: current.quantity + item.quantity,
      unit: item.unit,
      cost: current.cost + item.total,
    });
  });

  return Array.from(totals, ([name, item]) => ({
    name,
    amount: `${new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(item.quantity)} ${item.unit}`,
    cost: item.cost,
  })).sort((a, b) => b.cost - a.cost);
};

const weekOptionLabel = (week: Week) => {
  const monthNames: Record<string, string> = {
    ene: 'Ene',
    feb: 'Feb',
    mar: 'Mar',
    abr: 'Abr',
    may: 'May',
    jun: 'Jun',
    jul: 'Jul',
    ago: 'Ago',
    sep: 'Sep',
    oct: 'Oct',
    nov: 'Nov',
    dic: 'Dic',
  };
  const [, range = ''] = week.label.split(' · ');
  const crossMonth = range.match(/^(\d+) ([a-záéíóú]+)–(\d+) ([a-záéíóú]+)$/i);
  if (crossMonth) {
    const firstMonth = monthNames[crossMonth[2].slice(0, 3).toLowerCase()];
    const secondMonth = monthNames[crossMonth[4].slice(0, 3).toLowerCase()];
    return `${week.id}: ${crossMonth[1].padStart(2, '0')} ${firstMonth} - ${crossMonth[3].padStart(2, '0')} ${secondMonth}`;
  }

  const sameMonth = range.match(/^(\d+)–(\d+) ([a-záéíóú]+)$/i);
  if (sameMonth) {
    const month = monthNames[sameMonth[3].slice(0, 3).toLowerCase()];
    return `${week.id}: ${sameMonth[1].padStart(2, '0')} ${month} - ${sameMonth[2].padStart(2, '0')} ${month}`;
  }

  return week.id;
};

function Metric({
  icon,
  label,
  value,
  note,
  tone = 'ink',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  note: string;
  tone?: 'ink' | 'green';
}) {
  return (
    <article
      className={`metric-card ${tone === 'green' ? 'metric-green' : ''}`}
    >
      <div className="metric-icon">{icon}</div>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{note}</span>
    </article>
  );
}

type TrendTooltipEntry = {
  color?: string;
  dataKey?: string | number;
  name?: string | number;
  payload?: Record<string, string | number | null>;
  value?: string | number;
};

function TrendTooltip({
  active,
  payload,
  label,
  isMoney,
  showBalance = false,
}: {
  active?: boolean;
  payload?: readonly TrendTooltipEntry[];
  label?: string | number;
  isMoney: boolean;
  showBalance?: boolean;
}) {
  if (!active || !payload?.length) return null;
  const order = ['verde', 'roja', 'molca'];
  const entries = [...payload].sort(
    (a, b) =>
      order.findIndex((key) => String(a.dataKey).startsWith(key)) -
      order.findIndex((key) => String(b.dataKey).startsWith(key)),
  );
  const balance = entries.reduce(
    (total, entry) => total + Number(entry.value || 0),
    0,
  );

  return (
    <div className="trend-tooltip">
      <strong>Semana {label}</strong>
      <div>
        {entries.map((entry) => {
          const change = entry.payload?.[`${String(entry.dataKey)}Change`];
          const numericChange = typeof change === 'number' ? change : null;
          return (
            <section key={String(entry.dataKey)}>
              <span style={{ color: entry.color }}>{entry.name}</span>
              <b style={{ color: entry.color }}>
                {isMoney
                  ? money(Number(entry.value), 2)
                  : `${integer(Number(entry.value))} cubetas`}
              </b>
              {numericChange === null ? (
                <small className="trend-change-neutral">Sin comparación anterior</small>
              ) : (
                <small className={numericChange >= 0 ? 'trend-change-up' : 'trend-change-down'}>
                  {numericChange >= 0 ? '↑' : '↓'} {Math.abs(numericChange).toFixed(1)}% vs. semana anterior
                </small>
              )}
            </section>
          );
        })}
        {showBalance && (
          <section className="trend-tooltip-balance">
            <span>Balance total</span>
            <b className={balance < 0 ? 'loss' : 'profit'}>
              {money(balance, 2)}
            </b>
          </section>
        )}
      </div>
    </div>
  );
}

function WeeklySauceMenu({
  value,
  onSelect,
  placement,
}: {
  value: WeeklyResultView;
  onSelect: (value: WeeklyResultView) => void;
  placement: 'sidebar' | 'workspace';
}) {
  return (
    <nav
      className={`weekly-result-tabs ${placement}-weekly-tabs`}
      aria-label="Vistas del reporte semanal"
    >
      {(
        [
          ['summary', 'Resumen 3 salsas'],
          ['verde', 'Salsa verde'],
          ['roja', 'Salsa roja'],
          ['molca', 'Salsa molca'],
        ] as const
      ).map(([key, label]) => (
        <button
          key={key}
          type="button"
          aria-current={value === key ? 'page' : undefined}
          className={value === key ? 'selected' : ''}
          onClick={() => onSelect(key)}
        >
          {key !== 'summary' && <i className={`dot dot-${key}`} aria-hidden="true" />}
          {label}
        </button>
      ))}
    </nav>
  );
}

function SauceResultCard({
  sauceKey,
  week,
  settings,
  sharedExpenses,
  onViewDetail,
}: {
  sauceKey: Exclude<SauceKey, 'all'>;
  week: Week;
  settings: WeekSettings;
  sharedExpenses: number;
  onViewDetail: () => void;
}) {
  const data = week[sauceKey];
  const sales = sum(data.sales);
  const production = sum(data.production);
  const cost = sum(data.cost);
  const revenue = sales * settings.prices[sauceKey];
  const contribution = revenue - cost;
  const netProfit = contribution - sharedExpenses;
  const meta = sauceMeta[sauceKey];

  return (
    <article className={`sauce-result-card sauce-result-${sauceKey}`}>
      <header style={{ background: meta.color }}>
        <h2>{meta.label.replace('Salsa ', '').toUpperCase()}</h2>
        <span>{money(settings.prices[sauceKey], 2)} por cubeta</span>
        <button
          type="button"
          className="sauce-detail-cta"
          onClick={onViewDetail}
          aria-label={`Ver detalle de ${meta.label}`}
        >
          Ver detalle
          <ArrowUpRight size={15} aria-hidden="true" />
        </button>
      </header>
      <dl className="sauce-summary">
        <div className="summary-sales">
          <dt>Total cubetas vendidas</dt>
          <dd>{integer(sales)}</dd>
        </div>
        <div className="summary-production">
          <dt>Total cubetas producidas</dt>
          <dd>{integer(production)}</dd>
        </div>
        <div>
          <dt>Costo de producción</dt>
          <dd>{money(cost, 2)}</dd>
        </div>
        <div>
          <dt>Ingreso por cubetas vendidas</dt>
          <dd>{money(revenue, 2)}</dd>
        </div>
        <div className="summary-expenses">
          <dt>Gastos asignados</dt>
          <dd>-{money(sharedExpenses, 2)}</dd>
        </div>
        <div className="summary-profit">
          <dt>Utilidad neta</dt>
          <dd>{money(netProfit, 2)}</dd>
        </div>
      </dl>
      <div className="sauce-daily-table">
        <table>
          <thead>
            <tr>
              <th>Día</th>
              <th>Utilidad antes de gastos</th>
            </tr>
          </thead>
          <tbody>
            {week.dates.map((date, index) => {
              const dailyRevenue = data.sales[index] * settings.prices[sauceKey];
              const dailyProfit = dailyRevenue - data.cost[index];
              return (
                <tr key={date}>
                  <td>{date}</td>
                  <td className={dailyProfit >= 0 ? 'profit' : 'loss'}>
                    {money(dailyProfit, 2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>Total antes de gastos</td>
              <td>{money(contribution, 2)}</td>
            </tr>
            <tr className="net-total-row">
              <td>Utilidad neta</td>
              <td>{money(netProfit, 2)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </article>
  );
}

function ReportApp({
  reportData,
  onSync,
  syncing,
  syncNotice,
}: {
  reportData: ReportData;
  onSync: () => void;
  syncing: boolean;
  syncNotice: { tone: 'success' | 'error'; message: string } | null;
}) {
  const weeks = reportData.weeks;
  const monthWeeks = reportData.monthWeeks;
  const defaultSettingsForWeek = (id: string) =>
    makeWeekSettings(reportData.salePrices[id]);
  const [view, setView] = useState<ReportView>('week');
  const [reportMonth, setReportMonth] = useState<ReportMonth>('septiembre');
  const [weekId, setWeekId] = useState('S38');
  const [sauce, setSauce] = useState<SauceKey>('all');
  const [weeklyResultView, setWeeklyResultView] =
    useState<WeeklyResultView>('summary');
  const [weekSettings, setWeekSettings] = useState<Record<string, WeekSettings>>(
    () =>
      Object.fromEntries(
        weeks.map((item) => [item.id, defaultSettingsForWeek(item.id)]),
      ),
  );
  const [settingsReady, setSettingsReady] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);
  const [formError, setFormError] = useState('');
  const previousSalePrices = useRef(reportData.salePrices);
  useEffect(() => {
    const saved = window.localStorage.getItem('pl-cocina-week-settings-v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Record<string, WeekSettings>;
        setWeekSettings((current) =>
          Object.fromEntries(
            weeks.map((item) => {
              const defaults = defaultSettingsForWeek(item.id);
              const savedSettings = parsed[item.id];
              return [
                item.id,
                {
                  ...defaults,
                  ...(savedSettings || {}),
                  prices: {
                    verde:
                      savedSettings?.prices?.verde > 0
                        ? savedSettings.prices.verde
                        : defaults.prices.verde,
                    roja:
                      savedSettings?.prices?.roja > 0
                        ? savedSettings.prices.roja
                        : defaults.prices.roja,
                    molca:
                      savedSettings?.prices?.molca > 0
                        ? savedSettings.prices.molca
                        : defaults.prices.molca,
                  },
                  bonuses: savedSettings?.bonuses ?? 0,
                  completed: true,
                },
              ];
            }),
          ),
        );
      } catch {
        // Conserva los valores iniciales si el dato local no es válido.
      }
    }
    setSettingsReady(true);
  }, []);
  useEffect(() => {
    if (!settingsReady) return;
    window.localStorage.setItem(
      'pl-cocina-week-settings-v2',
      JSON.stringify(weekSettings),
    );
  }, [settingsReady, weekSettings]);
  useEffect(() => {
    const previous = previousSalePrices.current;
    setWeekSettings((current) =>
      Object.fromEntries(
        weeks.map((item) => {
          const saved = current[item.id] || defaultSettingsForWeek(item.id);
          const nextDefaults = reportData.salePrices[item.id] || saved.prices;
          return [
            item.id,
            {
              ...saved,
              prices: Object.fromEntries(
                (['verde', 'roja', 'molca'] as const).map((key) => [
                  key,
                  saved.prices[key] === previous[item.id]?.[key]
                    ? nextDefaults[key]
                    : saved.prices[key],
                ]),
              ) as WeekSettings['prices'],
            },
          ];
        }),
      ),
    );
    previousSalePrices.current = reportData.salePrices;
  }, [reportData]);
  useEffect(() => {
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options?: { signal?: AbortSignal },
          ) => void | Promise<void>;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: 'configure_cost_report',
          title: 'Configurar reporte de costos',
          description:
            'Cambia la vista visible del reporte entre semana y mes, y permite filtrar una semana o salsa específica.',
          inputSchema: {
            type: 'object',
            properties: {
              view: { type: 'string', enum: ['week', 'month'] },
              weekId: { type: 'string', enum: weeks.map((w) => w.id) },
              sauce: {
                type: 'string',
                enum: ['all', 'verde', 'roja', 'molca'],
              },
            },
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input: unknown) {
            const value = input as {
              view?: 'week' | 'month';
              weekId?: string;
              sauce?: SauceKey;
            };
            if (value.view) setView(value.view);
            if (value.weekId) {
              if (!weeks.some((w) => w.id === value.weekId))
                throw new Error('Semana no disponible');
              setWeekId(value.weekId);
            }
            if (value.sauce) setSauce(value.sauce);
            return {
              view: value.view ?? view,
              weekId: value.weekId ?? weekId,
              sauce: value.sauce ?? sauce,
            };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, [view, weekId, sauce]);
  const week = weeks.find((w) => w.id === weekId) || weeks[0];
  const activeSettings =
    weekSettings[week.id] || defaultSettingsForWeek(week.id);
  const configuredWeeks = weeks.filter((item) => {
    return monthWeeks[reportMonth]?.includes(item.id) && weekSettings[item.id]?.completed;
  });
  const trendWeeks = weeks.filter((item) => weekSettings[item.id]?.completed);
  const reportReady = activeSettings.completed && !editingSettings;
  const updateSetting = (
    field: 'services' | 'payroll' | 'overtime' | 'bonuses',
    value: number,
  ) => {
    setWeekSettings((current) => ({
      ...current,
      [week.id]: {
        ...(current[week.id] || defaultSettingsForWeek(week.id)),
        [field]: value,
      },
    }));
  };
  const updatePrice = (
    key: Exclude<SauceKey, 'all'>,
    value: number,
  ) => {
    setWeekSettings((current) => {
      const settings =
        current[week.id] || defaultSettingsForWeek(week.id);
      return {
        ...current,
        [week.id]: {
          ...settings,
          prices: { ...settings.prices, [key]: value },
        },
      };
    });
  };
  const calculateReport = () => {
    const prices = Object.values(activeSettings.prices);
    if (prices.some((price) => !Number.isFinite(price) || price <= 0)) {
      setFormError('Captura un precio mayor a cero para cada salsa.');
      return;
    }
    if (
      (['services', 'payroll', 'overtime', 'bonuses'] as const).some(
        (field) =>
          !Number.isFinite(activeSettings[field]) || activeSettings[field] < 0,
      )
    ) {
      setFormError('Los gastos semanales no pueden contener valores negativos.');
      return;
    }
    setWeekSettings((current) => ({
      ...current,
      [week.id]: { ...activeSettings, completed: true },
    }));
    setFormError('');
    setEditingSettings(false);
    setWeeklyResultView('summary');
    setSauce('all');
  };
  const selectedKeys =
    sauce === 'all' ? (['verde', 'roja', 'molca'] as const) : [sauce];
  const expenseShare = selectedKeys.length / 3;
  const totals = useMemo(() => {
    const sourceWeeks = view === 'month' ? configuredWeeks : [week];
    let sales = 0,
      production = 0,
      cost = 0,
      revenue = 0,
      gross = 0;
    sourceWeeks.forEach((w) =>
      selectedKeys.forEach((key) => {
        sales += sum(w[key].sales);
        production += sum(w[key].production);
        cost += sum(w[key].cost);
        const settings = weekSettings[w.id] || defaultSettingsForWeek(w.id);
        revenue += sum(w[key].sales) * settings.prices[key];
      }),
    );
    gross = revenue - cost;
    const fixed = sourceWeeks.reduce((total, item) => {
      const settings =
        weekSettings[item.id] || defaultSettingsForWeek(item.id);
      return (
        total +
        weeklyExpenseTotal(settings) * expenseShare
      );
    }, 0);
    return {
      sales,
      production,
      cost,
      revenue,
      gross,
      net: gross - fixed,
      fixed,
      variance: production - sales,
    };
  }, [view, week, sauce, weekSettings, configuredWeeks, reportMonth]);
  const daily = week.dates.map((date, i) => {
    let sales = 0,
      production = 0,
      cost = 0,
      revenue = 0,
      profit = 0;
    selectedKeys.forEach((key) => {
      sales += week[key].sales[i];
      production += week[key].production[i];
      cost += week[key].cost[i];
      const itemRevenue = week[key].sales[i] * activeSettings.prices[key];
      revenue += itemRevenue;
      profit += itemRevenue - week[key].cost[i];
    });
    return { date, sales, production, cost, revenue, profit };
  });
  const monthly = configuredWeeks.map((w) => {
    let cost = 0,
      revenue = 0,
      profit = 0;
    selectedKeys.forEach((key) => {
      cost += sum(w[key].cost);
      const settings = weekSettings[w.id] || defaultSettingsForWeek(w.id);
      revenue += sum(w[key].sales) * settings.prices[key];
    });
    const settings = weekSettings[w.id] || defaultSettingsForWeek(w.id);
    const expenses =
      weeklyExpenseTotal(settings) * (selectedKeys.length / 3);
    profit = revenue - cost - expenses;
    return { name: w.short, cost, revenue, profit, expenses };
  });
  const weeklyCombined = (['verde', 'roja', 'molca'] as const).reduce(
    (result, key) => {
      const sales = sum(week[key].sales);
      const cost = sum(week[key].cost);
      result.sales += sales;
      result.production += sum(week[key].production);
      result.cost += cost;
      result.revenue += sales * activeSettings.prices[key];
      return result;
    },
    { sales: 0, production: 0, cost: 0, revenue: 0 },
  );
  const weeklyExpenses = weeklyExpenseTotal(activeSettings);
  const weeksWithoutExpenses =
    view === 'week'
      ? weeklyExpenses === 0 ? [week.id] : []
      : configuredWeeks
          .filter((item) =>
            weeklyExpenseTotal(
              weekSettings[item.id] || defaultSettingsForWeek(item.id),
            ) === 0,
          )
          .map((item) => item.id);
  const weeklyNet =
    weeklyCombined.revenue - weeklyCombined.cost - weeklyExpenses;
  const trendData = trendWeeks.map((item) => {
    const settings = weekSettings[item.id] || defaultSettingsForWeek(item.id);
    const sharedExpenses = weeklyExpenseTotal(settings) / 3;
    const point: Record<string, string | number | null> = {
      week: item.short,
      weekNumber: Number(item.id.slice(1)),
    };
    (['verde', 'roja', 'molca'] as const).forEach((key) => {
      const sales = sum(item[key].sales);
      const revenue = sales * settings.prices[key];
      point[`${key}Sales`] = sales;
      point[`${key}Revenue`] = revenue;
      point[`${key}Net`] = revenue - sum(item[key].cost) - sharedExpenses;
      point[`${key}Price`] = settings.prices[key];
    });
    return point;
  });
  (['Sales', 'Revenue', 'Net', 'Price'] as const).forEach((metric) => {
    (['verde', 'roja', 'molca'] as const).forEach((key) => {
      trendData.forEach((point, index) => {
        const previous = trendData[index - 1];
        const currentValue = Number(point[`${key}${metric}`]);
        const previousValue = Number(previous?.[`${key}${metric}`]);
        const isPreviousWeek =
          previous && Number(point.weekNumber) - Number(previous.weekNumber) === 1;
        point[`${key}${metric}Change`] =
          isPreviousWeek && previousValue !== 0
            ? ((currentValue - previousValue) / Math.abs(previousValue)) * 100
            : null;
      });
    });
  });
  const ingredientSauce = sauce === 'all' ? 'verde' : sauce;
  const ingredientItems = ingredientsForWeek(week, ingredientSauce);
  const activeLabel =
    sauce === 'all' ? 'Todas las salsas' : sauceMeta[sauce].label;
  const selectWeeklyResult = (key: WeeklyResultView) => {
    setWeeklyResultView(key);
    setSauce(key === 'summary' ? 'all' : key);
  };
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <img src="logo-pl-cocina.png" alt="Logotipo de PL Cocina" />
          </div>
          <div>
            <strong>PL Cocina</strong>
            <span>Control de costos</span>
          </div>
        </div>
        <nav className="sidebar-main-nav" aria-label="Secciones principales">
          <button
            type="button"
            className={view !== 'trends' ? 'selected' : ''}
            onClick={() => setView('week')}
          >
            <CalendarDays size={17} />
            Reportes
          </button>
          <button
            type="button"
            className={view === 'trends' ? 'selected' : ''}
            onClick={() => setView('trends')}
          >
            <TrendingUp size={17} />
            Tendencias
          </button>
        </nav>
        {view === 'week' && reportReady && (
          <WeeklySauceMenu
            value={weeklyResultView}
            onSelect={selectWeeklyResult}
            placement="sidebar"
          />
        )}
        <div className="source-status">
          <span className="status-dot" />
          <div>
            <strong>5 fuentes operativas</strong>
            <span>Datos oficiales: S1–S38</span>
          </div>
        </div>
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">CONTROL DE PRODUCCIÓN</p>
            <h1>Costeo de salsas</h1>
          </div>
          <div className="topbar-actions">
            {(reportReady || view === 'trends') && (
              <button className="pdf-button" onClick={() => window.print()}>
                <FileDown size={16} />
                Descargar PDF
              </button>
            )}
            <button
              className={`sync-button ${syncing ? 'syncing' : ''}`}
              onClick={onSync}
              disabled={syncing}
              title="Volver a leer las hojas operativas de Google Sheets"
            >
              <RefreshCw size={16} />
              {syncing ? 'Actualizando datos…' : 'Datos de Google Sheets'}
            </button>
          </div>
        </header>
        {syncNotice && (
          <p className={`sync-notice sync-notice-${syncNotice.tone}`} role="status">
            {syncNotice.message}
          </p>
        )}
        <div className="filters" aria-label="Filtros del reporte">
          {view !== 'trends' && (
            <Tabs
              value={view}
              onValueChange={(value) => setView(value as 'week' | 'month')}
            >
              <TabsList className="segmented">
                <TabsTrigger value="week">Semana</TabsTrigger>
                <TabsTrigger value="month">Mes</TabsTrigger>
              </TabsList>
            </Tabs>
          )}
          {view === 'week' && (
            <div className="select-wrap">
              <CalendarDays size={17} />
              <Select
                value={weekId}
                onValueChange={(value) => {
                  setWeekId(value as string);
                  setEditingSettings(false);
                  setFormError('');
                  setWeeklyResultView('summary');
                  setSauce('all');
                }}
              >
                <SelectTrigger
                  className="week-select-trigger"
                  aria-label="Elegir semana"
                >
                  <SelectValue>{week.label}</SelectValue>
                </SelectTrigger>
                <SelectContent className="report-select-menu">
                  {weeks.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {weekOptionLabel(w)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {view === 'month' && (
            <div className="select-wrap">
              <CalendarDays size={17} />
              <Select
                value={reportMonth}
                onValueChange={(value) => setReportMonth(value as ReportMonth)}
              >
                <SelectTrigger className="month-select-trigger" aria-label="Elegir mes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="report-select-menu">
                  {reportMonths.map((month) => (
                    <SelectItem key={month.id} value={month.id}>
                      {month.label} · {monthWeekLabel(month.id, monthWeeks)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {configuredWeeks.length > 0 && view === 'month' && (
            <div
              className="sauce-filters"
              role="group"
              aria-label="Filtrar por salsa"
            >
              {(['all', 'verde', 'roja', 'molca'] as SauceKey[]).map((key) => (
                <button
                  key={key}
                  onClick={() => setSauce(key)}
                  className={sauce === key ? 'selected' : ''}
                >
                  <i className={`dot dot-${key}`} />
                  {key === 'all'
                    ? 'Todas'
                    : sauceMeta[key].label.replace('Salsa ', '')}
                </button>
              ))}
            </div>
          )}
        </div>
        {view === 'trends' ? (
          <section className="trends-view" aria-labelledby="trends-title">
            <div className="trends-hero">
              <div>
                <p className="eyebrow">TENDENCIAS DEL AÑO · SEMANAS CALCULADAS</p>
                <h2 id="trends-title">Evolución semanal de las tres salsas</h2>
                <p>
                  Compara Verde, Roja y Molca en volumen vendido, ingresos y utilidad neta.
                </p>
              </div>
              <span>{trendWeeks.length} semanas incluidas</span>
            </div>
            {trendData.length === 0 ? (
              <div className="empty-report trends-empty">
                <h2>Aún no hay semanas calculadas</h2>
                <p>Calcula al menos una semana para comenzar a ver sus tendencias.</p>
                <button type="button" onClick={() => setView('week')}>Ir al reporte semanal</button>
              </div>
            ) : (
              <div className="trend-charts">
                {(
                  [
                    ['Sales', 'Cubetas vendidas', 'Cantidad de cubetas vendidas por semana', false],
                    ['Revenue', 'Ingresos por cubetas', 'Ingreso semanal generado por las cubetas vendidas', true],
                    ['Net', 'Utilidad neta', 'Resultado después de materia prima y gastos semanales prorrateados', true],
                    ['Price', 'Precio de venta por cubeta', 'Evolución del precio de venta semanal de cada salsa', true],
                  ] as const
                ).map(([metric, title, description, isMoney]) => (
                  <article className="panel trend-card" key={metric}>
                    <div className="trend-card-heading">
                      <div>
                        <p className="eyebrow">COMPARATIVO SEMANAL</p>
                        <h3>{title}</h3>
                        <p>{description}</p>
                      </div>
                      <div className="trend-legend" aria-label="Leyenda">
                        {(Object.keys(sauceMeta) as Exclude<SauceKey, 'all'>[]).map((key) => (
                          <span key={key}><i style={{ background: sauceMeta[key].color }} />{sauceMeta[key].label.replace('Salsa ', '')}</span>
                        ))}
                      </div>
                    </div>
                    <div className="trend-chart-wrap">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData} margin={{ top: 12, right: 18, left: 8, bottom: 4 }}>
                          <CartesianGrid vertical={false} stroke="#E8E9E4" strokeDasharray="4 4" />
                          <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: '#68706B', fontSize: 11 }} minTickGap={20} />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            width={isMoney ? 68 : 42}
                            tick={{ fill: '#89908B', fontSize: 11 }}
                            tickFormatter={(value) => metric === 'Price'
                              ? money(Number(value), 0)
                              : isMoney
                                ? new Intl.NumberFormat('es-MX', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(value))
                                : integer(Number(value))}
                          />
                          {metric === 'Net' && <ReferenceLine y={0} stroke="#bd3a31" strokeDasharray="5 5" />}
                          <Tooltip
                            content={(props) => (
                              <TrendTooltip
                                active={props.active}
                                payload={props.payload as readonly TrendTooltipEntry[]}
                                label={props.label}
                                isMoney={isMoney}
                                showBalance={metric === 'Net'}
                              />
                            )}
                          />
                          {(Object.keys(sauceMeta) as Exclude<SauceKey, 'all'>[]).map((key) => (
                            <Line
                              key={key}
                              type="monotone"
                              dataKey={`${key}${metric}`}
                              name={sauceMeta[key].label}
                              stroke={sauceMeta[key].color}
                              strokeWidth={3}
                              dot={{ r: 3, fill: '#fff', strokeWidth: 2 }}
                              activeDot={{ r: 6, strokeWidth: 2 }}
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        ) : view === 'week' && !reportReady ? (
          <section className="weekly-inputs setup-gate" aria-labelledby="weekly-inputs-title">
            <div className="weekly-inputs-heading">
              <div>
                <p className="eyebrow">DATOS DE LA SEMANA · {week.id}</p>
                <h2 id="weekly-inputs-title">Edita los datos del reporte</h2>
              </div>
              <span>Precios y gastos semanales</span>
            </div>
            <div className="input-groups">
              <fieldset>
                <legend>Precio por cubeta</legend>
                <div className="field-row three-fields">
                  {(Object.keys(sauceMeta) as Exclude<SauceKey, 'all'>[]).map(
                    (key) => (
                      <label key={key}>
                        <span>{sauceMeta[key].label}</span>
                        <div className="money-input">
                          <b>$</b>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={activeSettings.prices[key]}
                            onChange={(event) =>
                              updatePrice(key, Number(event.target.value) || 0)
                            }
                            aria-label={`Precio por cubeta de ${sauceMeta[key].label}`}
                          />
                        </div>
                      </label>
                    ),
                  )}
                </div>
                <small className="field-help">
                  Precios precargados desde PRECIOS PLOG. Puedes modificarlos
                  para esta semana y actualizar el cálculo.
                </small>
              </fieldset>
              <fieldset>
                <legend>Gastos semanales</legend>
                <div className="field-row four-fields">
                  {(
                    [
                      ['services', 'Servicios'],
                      ['payroll', 'Nómina'],
                      ['overtime', 'Horas extras'],
                      ['bonuses', 'Bonos'],
                    ] as const
                  ).map(([field, label]) => (
                    <label key={field}>
                      <span>{label}</span>
                      <div className="money-input">
                        <b>$</b>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={activeSettings[field]}
                          onChange={(event) =>
                            updateSetting(field, Number(event.target.value) || 0)
                          }
                          aria-label={`Costo semanal de ${label.toLowerCase()}`}
                        />
                      </div>
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
            {formError && <p className="form-error" role="alert">{formError}</p>}
            <div className="setup-actions">
              <small>Los datos se guardarán para esta semana en este navegador.</small>
              <button className="calculate-button" onClick={calculateReport}>
                Guardar y actualizar reporte
                <ArrowUpRight size={17} />
              </button>
            </div>
          </section>
        ) : view === 'week' ? (
          <>
            <div className="report-toolbar">
              <span>Reporte calculado con los datos capturados para {week.id}</span>
              <button onClick={() => setEditingSettings(true)}>Editar datos semanales</button>
            </div>
            <WeeklySauceMenu
              value={weeklyResultView}
              onSelect={selectWeeklyResult}
              placement="workspace"
            />
          </>
        ) : configuredWeeks.length === 0 ? (
          <section className="empty-report">
            <h2>Aún no hay semanas calculadas</h2>
            <p>Regresa a la vista semanal, captura sus datos y calcula el reporte.</p>
          </section>
        ) : (
          <div className="report-toolbar">
            <span>{configuredWeeks.length} semanas incluidas en el reporte mensual</span>
          </div>
        )}
        {view !== 'trends' && (view === 'month' ? configuredWeeks.length > 0 : reportReady) && <>
        {view === 'week' && weeklyResultView === 'summary' && (
          <>
            <section className="sauce-results-grid" aria-label="Resultados por salsa">
              {(['verde', 'roja', 'molca'] as const).map((key) => (
                <SauceResultCard
                  key={key}
                  sauceKey={key}
                  week={week}
                  settings={activeSettings}
                  sharedExpenses={weeklyExpenses / 3}
                  onViewDetail={() => selectWeeklyResult(key)}
                />
              ))}
            </section>
            <section className="panel summary-mix-panel" aria-labelledby="weekly-mix-title">
              <div className="panel-heading summary-mix-heading">
                <div>
                  <p className="eyebrow">DISTRIBUCIÓN DE VENTAS · {week.id}</p>
                  <h2 id="weekly-mix-title">Cómo se reparten las cubetas vendidas</h2>
                  <p className="panel-explanation">
                    Compara el volumen vendido de cada salsa y su participación en el total semanal.
                  </p>
                </div>
                <strong className="mix-total">{integer(weeklyCombined.sales)} cubetas en total</strong>
              </div>
              <div className="mix-list summary-mix-list">
                {(Object.keys(sauceMeta) as Exclude<SauceKey, 'all'>[]).map((key) => {
                  const value = sum(week[key].sales);
                  const percentage = weeklyCombined.sales
                    ? (value / weeklyCombined.sales) * 100
                    : 0;
                  return (
                    <div className="mix-row" key={key}>
                      <div className="mix-label">
                        <span>
                          <i style={{ background: sauceMeta[key].color }} />
                          {sauceMeta[key].label}
                        </span>
                        <strong>{integer(value)}</strong>
                      </div>
                      <div className="progress">
                        <b style={{ width: `${percentage}%`, background: sauceMeta[key].color }} />
                      </div>
                      <small>{percentage.toFixed(0)}% del total semanal</small>
                    </div>
                  );
                })}
              </div>
            </section>
            <section className="grand-total-panel" aria-labelledby="grand-total-title">
              <div className="grand-total-heading">
                <div>
                  <p className="eyebrow">CONSOLIDADO · {week.id}</p>
                  <h2 id="grand-total-title">Totales de las tres salsas</h2>
                </div>
                <strong className={weeklyNet < 0 ? 'loss' : 'profit'}>{money(weeklyNet, 2)}</strong>
              </div>
              <div className="grand-total-grid">
                <div><span>Cubetas vendidas</span><strong>{integer(weeklyCombined.sales)}</strong></div>
                <div><span>Cubetas producidas</span><strong>{integer(weeklyCombined.production)}</strong></div>
                <div><span>Costo de producción</span><strong>{money(weeklyCombined.cost, 2)}</strong></div>
                <div><span>Ingresos</span><strong>{money(weeklyCombined.revenue, 2)}</strong></div>
                <div><span>Gastos semanales</span><strong>{money(weeklyExpenses, 2)}</strong></div>
                <div className="grand-net"><span>Utilidad neta total</span><strong className={weeklyNet < 0 ? 'loss' : 'profit'}>{money(weeklyNet, 2)}</strong></div>
              </div>
            </section>
          </>
        )}
        {view === 'week' && weeklyResultView !== 'summary' && (
          <section
            className="sauce-detail-heading"
            aria-labelledby="sauce-detail-title"
            style={{ background: sauceMeta[weeklyResultView].color }}
          >
            <button
              type="button"
              onClick={() => selectWeeklyResult('summary')}
              aria-label="Regresar al resumen"
            >
              <ArrowLeft size={17} aria-hidden="true" />
              Regresar
            </button>
            <div>
              <p className="eyebrow">DETALLE SEMANAL · {week.id}</p>
              <h2 id="sauce-detail-title">{sauceMeta[weeklyResultView].label}</h2>
            </div>
          </section>
        )}
        <div
          className={
            view === 'week' && weeklyResultView === 'summary'
              ? 'legacy-report hide-weekly'
              : 'legacy-report'
          }
        >
        <section className="metric-grid">
          <Metric
            icon={<CircleDollarSign size={20} />}
            label="Utilidad neta"
            value={money(totals.net)}
            note={`${money(totals.fixed)} en gastos semanales prorrateados`}
            tone="green"
          />
          <Metric
            icon={<TrendingUp size={20} />}
            label="Ingresos por pedidos"
            value={money(totals.revenue)}
            note={`${((totals.gross / totals.revenue) * 100).toFixed(1)}% margen antes de gastos fijos`}
          />
          <Metric
            icon={<PackageCheck size={20} />}
            label="Cubetas vendidas"
            value={integer(totals.sales)}
            note={`${integer(totals.production)} producidas`}
          />
          <Metric
            icon={
              totals.variance >= 0 ? (
                <ArrowUpRight size={20} />
              ) : (
                <ArrowDownRight size={20} />
              )
            }
            label="Diferencia producción–pedido"
            value={`${totals.variance > 0 ? '+' : ''}${integer(totals.variance)}`}
            note={
              totals.variance >= 0
                ? 'Cubetas por encima del pedido'
                : 'Cubetas por debajo del pedido'
            }
          />
        </section>
        <section className={`content-grid ${view === 'week' ? 'detail-chart-only' : ''}`}>
          <article className="panel chart-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">
                  {view === 'week'
                    ? 'LUNES A DOMINGO'
                    : `${reportMonth.toUpperCase()} · ${configuredWeeks.length} SEMANAS`}
                </p>
                <h2>Ingresos y costo de producción</h2>
              </div>
              <span className="pill">{activeLabel}</span>
            </div>
            <div className="chart-wrap">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={view === 'week' ? daily : monthly}
                  barGap={5}
                  margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
                >
                  <CartesianGrid vertical={false} stroke="#E8E9E4" />
                  <XAxis
                    dataKey={view === 'week' ? 'date' : 'name'}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#68706B', fontSize: 12 }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                    tick={{ fill: '#89908B', fontSize: 11 }}
                    width={46}
                  />
                  <Tooltip
                    formatter={(v) => money(Number(v))}
                    contentStyle={{
                      border: '1px solid #dfe2dc',
                      borderRadius: 12,
                      boxShadow: '0 12px 30px #17231b18',
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Ingresos"
                    fill="#163D2A"
                    radius={[7, 7, 0, 0]}
                  />
                  <Bar
                    dataKey="cost"
                    name="Materia prima"
                    fill="#A8C957"
                    radius={[7, 7, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="legend">
              <span>
                <i className="legend-ink" />
                Ingresos
              </span>
              <span>
                <i className="legend-lime" />
                Costo de producción
              </span>
            </div>
          </article>
          {view === 'month' && <article className="panel mix-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">MEZCLA DE VENTAS</p>
                <h2>Cubetas por salsa</h2>
              </div>
            </div>
            <div className="mix-list">
              {(Object.keys(sauceMeta) as Exclude<SauceKey, 'all'>[]).map(
                (key) => {
                  const value =
                    view === 'month'
                      ? sum(configuredWeeks.flatMap((w) => w[key].sales))
                      : sum(week[key].sales);
                  const total =
                    view === 'month'
                      ? sum(
                          configuredWeeks.flatMap((w) =>
                            (['verde', 'roja', 'molca'] as const).flatMap(
                              (k) => w[k].sales,
                            ),
                          ),
                        )
                      : (['verde', 'roja', 'molca'] as const).reduce(
                          (n, k) => n + sum(week[k].sales),
                          0,
                        );
                  return (
                    <div className="mix-row" key={key}>
                      <div className="mix-label">
                        <span>
                          <i style={{ background: sauceMeta[key].color }} />
                          {sauceMeta[key].label}
                        </span>
                        <strong>{integer(value)}</strong>
                      </div>
                      <div className="progress">
                        <b
                          style={{
                            width: `${(value / total) * 100}%`,
                            background: sauceMeta[key].color,
                          }}
                        />
                      </div>
                      <small>
                        {((value / total) * 100).toFixed(0)}% de las ventas
                      </small>
                    </div>
                  );
                },
              )}
            </div>
          </article>}
        </section>
        {view === 'week' && sauce !== 'all' && (
          <section
            className={`panel daily-profit-panel daily-profit-${sauce}`}
            aria-labelledby="daily-profit-title"
          >
            <div className="panel-heading daily-profit-heading">
              <div>
                <p className="eyebrow">RENTABILIDAD DIARIA · {week.id}</p>
                <h2 id="daily-profit-title">Resultado por cada día de la semana</h2>
                <p className="panel-explanation">
                  Del costo unitario de producción a la utilidad real obtenida por día.
                </p>
              </div>
              <span
                className="pill"
                style={{ color: sauceMeta[sauce].ink }}
              >
                {sauceMeta[sauce].label}
              </span>
            </div>
            <div className="daily-profit-scroll">
              <div className="daily-profit-grid">
                {daily.map((row, dayIndex) => {
                  const unitCost = row.production ? row.cost / row.production : 0;
                  const salePrice = activeSettings.prices[sauce];
                  const unitProfit = salePrice - unitCost;
                  const realProfit = row.revenue - row.cost;
                  const dailyMargin = row.revenue
                    ? (realProfit / row.revenue) * 100
                    : null;
                  const materialRows = week[sauce].ingredients[dayIndex] || [];
                  return (
                    <article key={row.date} className="daily-profit-card">
                      <header style={{ background: sauceMeta[sauce].color }}>
                        <span>{row.date}</span>
                        <strong>{integer(row.sales)} pedidas</strong>
                      </header>
                      <div className="daily-production-summary">
                        <span>{integer(row.production)} producidas</span>
                        <span>Diferencia: {row.production - row.sales > 0 ? '+' : ''}{integer(row.production - row.sales)}</span>
                      </div>
                      <dl>
                        <div className="daily-sale-price">
                          <dt>Precio de venta por cubeta</dt>
                          <dd>{salePrice ? money(salePrice, 2) : 'Pendiente'}</dd>
                        </div>
                        <div>
                          <dt>Costo de la cubeta</dt>
                          <dd>{money(unitCost, 2)}</dd>
                        </div>
                        <div>
                          <dt>Utilidad por cubeta</dt>
                          <dd className={unitProfit >= 0 ? 'profit' : 'loss'}>
                            {money(unitProfit, 2)}
                          </dd>
                        </div>
                        <div>
                          <dt>Ingreso total de cubetas pedidas</dt>
                          <dd>{money(row.revenue, 2)}</dd>
                        </div>
                        <div className="daily-real-profit">
                          <dt>Utilidad real total</dt>
                          <dd className={realProfit >= 0 ? 'profit' : 'loss'}>
                            {money(realProfit, 2)}
                          </dd>
                        </div>
                        <div className="daily-profit-margin">
                          <dt>Margen de ganancia diario</dt>
                          <dd
                            className={
                              dailyMargin === null
                                ? undefined
                                : dailyMargin >= 0
                                  ? 'profit'
                                  : 'loss'
                            }
                          >
                            {dailyMargin === null ? '—' : `${dailyMargin.toFixed(1)}%`}
                          </dd>
                          <small>Antes de gastos semanales</small>
                        </div>
                      </dl>
                      <div className="daily-materials">
                        <div className="daily-materials-title">
                          <strong>Materia prima usada</strong>
                        </div>
                        <div className="daily-materials-table-wrap">
                          <table>
                            <thead>
                              <tr>
                                <th>Materia prima</th>
                                <th>Usada</th>
                                <th>C. x MP</th>
                                <th>C. total x MP</th>
                              </tr>
                            </thead>
                            <tbody>
                              {materialRows.map((item) => (
                                <tr key={item.name}>
                                  <td>{item.name}</td>
                                  <td>
                                    {integer(item.quantity)} {item.unit}
                                    {item.secondaryQuantity && <small>{item.secondaryQuantity}</small>}
                                  </td>
                                  <td>{money(item.unitCost, item.unitCost === WATER_COST_PER_LITER ? 4 : 2)}</td>
                                  <td>{money(item.total, 2)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr>
                                <th colSpan={3}>Costo total de producción</th>
                                <td>{money(row.cost, 2)}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>
        )}
        {view === 'week' && sauce === 'all' ? (
          <section className="panel table-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">DETALLE DIARIO</p>
                <h2>Pedido, producción y rentabilidad</h2>
              </div>
              <span className="week-badge">{week.id}</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Día</th>
                    <th>Pedido</th>
                    <th>Producción</th>
                    <th>Diferencia</th>
                    <th>Materia prima</th>
                    <th>Ingresos</th>
                    <th>Utilidad antes de gastos</th>
                  </tr>
                </thead>
                <tbody>
                  {daily.map((row) => (
                    <tr key={row.date}>
                      <td>
                        <strong>{row.date}</strong>
                      </td>
                      <td>{integer(row.sales)}</td>
                      <td>{integer(row.production)}</td>
                      <td>
                        <span
                          className={
                            row.production - row.sales >= 0
                              ? 'positive'
                              : 'negative'
                          }
                        >
                          {row.production - row.sales > 0 ? '+' : ''}
                          {integer(row.production - row.sales)}
                        </span>
                      </td>
                      <td>{money(row.cost)}</td>
                      <td>{money(row.revenue)}</td>
                      <td>
                        <strong className={row.profit >= 0 ? 'profit' : 'loss'}>
                          {money(row.profit)}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total</td>
                    <td>{integer(totals.sales)}</td>
                    <td>{integer(totals.production)}</td>
                    <td>
                      {totals.variance > 0 ? '+' : ''}
                      {integer(totals.variance)}
                    </td>
                    <td>{money(totals.cost)}</td>
                    <td>{money(totals.revenue)}</td>
                    <td>{money(totals.gross)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        ) : view === 'month' ? (
          <section className="panel table-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">RESUMEN MENSUAL</p>
                <h2>Resultado por semana</h2>
              </div>
              <span className="week-badge">AGO 2026</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Semana</th>
                    <th>Ingresos</th>
                    <th>Materia prima</th>
                    <th>Gastos semanales</th>
                    <th>Utilidad neta</th>
                    <th>Margen</th>
                  </tr>
                </thead>
                <tbody>
                  {monthly.map((row) => (
                    <tr key={row.name}>
                      <td>
                        <strong>{row.name}</strong>
                      </td>
                      <td>{money(row.revenue)}</td>
                      <td>{money(row.cost)}</td>
                      <td>{money(row.expenses)}</td>
                      <td>
                        <strong className={row.profit >= 0 ? 'profit' : 'loss'}>
                          {money(row.profit)}
                        </strong>
                      </td>
                      <td>{((row.profit / row.revenue) * 100).toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
        <section className="bottom-grid">
          <article className="panel ingredients-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">MATERIA PRIMA · {week.id}</p>
                <h2>
                  {ingredientSauce === 'verde' || ingredientSauce === 'molca'
                    ? 'Costo total por ingrediente'
                    : 'Ingredientes de mayor costo'}
                </h2>
              </div>
              <span
                className="pill"
                style={{ color: sauceMeta[ingredientSauce].ink }}
              >
                {sauceMeta[ingredientSauce].label}
              </span>
            </div>
            <div className="ingredient-list">
              {ingredientItems
                .slice(0, ingredientSauce === 'roja' ? 6 : undefined)
                .map((item, index) => (
                <div key={item.name}>
                  <span className="rank">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="ingredient-name">
                    <strong>{item.name}</strong>
                    <small>{item.amount}</small>
                  </span>
                  <strong>{money(item.cost)}</strong>
                </div>
              ))}
            </div>
          </article>
          <article className="panel cost-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">GASTOS SEMANALES · {week.id}</p>
                <h2>Resumen capturado</h2>
              </div>
            </div>
            <dl>
              <div>
                <dt>Servicios</dt>
                <dd>{money(activeSettings.services * expenseShare)}</dd>
              </div>
              <div>
                <dt>Nómina</dt>
                <dd>{money(activeSettings.payroll * expenseShare)}</dd>
              </div>
              <div>
                <dt>Horas extras</dt>
                <dd>{money(activeSettings.overtime * expenseShare)}</dd>
              </div>
              <div>
                <dt>Bonos</dt>
                <dd>{money(activeSettings.bonuses * expenseShare)}</dd>
              </div>
              <div className="total-line">
                <dt>Total semanal</dt>
                <dd>{money(weeklyExpenses * expenseShare)}</dd>
              </div>
            </dl>
            <p className="footnote">
              Los gastos se distribuyen entre las tres salsas para
              calcular la utilidad neta del periodo.
            </p>
          </article>
        </section>
        </div>
        {weeksWithoutExpenses.length > 0 && (
          <p className="expense-caveat" role="note">
            <strong>Gastos semanales en $0:</strong> {weeksWithoutExpenses.join(', ')}.
            {view === 'week' || weeksWithoutExpenses.length === configuredWeeks.length
              ? ' La utilidad neta mostrada se calculó con ingresos menos costo de materia prima y es antes de gastos semanales.'
              : ' Para esas semanas, la utilidad incluida en el consolidado se calculó con ingresos menos costo de materia prima, antes de sus gastos semanales.'}
            {' '}La utilidad disminuirá si se registran gastos para{' '}
            {weeksWithoutExpenses.length === 1 ? 'esa semana' : 'esas semanas'}.
          </p>
        )}
        <footer>
          Información calculada a partir de las hojas compartidas · Semana
          completa de lunes a domingo
        </footer>
        </>}
      </section>
    </main>
  );
}

export default function Home() {
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncNotice, setSyncNotice] = useState<{
    tone: 'success' | 'error';
    message: string;
  } | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`data2026.json?t=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' },
    })
      .then((response) => {
        if (!response.ok) throw new Error('No fue posible cargar los datos');
        return response.json() as Promise<ReportData>;
      })
      .then((data) => {
        if (active) setReportData(data);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const syncSheets = async () => {
    setSyncing(true);
    setSyncNotice(null);
    try {
      const response = await fetch(`/api/sync?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' },
      });
      const data = (await response.json()) as ReportData & { error?: string };
      if (!response.ok) throw new Error(data.error || 'No fue posible actualizar las hojas.');
      setReportData(data);
      setSyncNotice({
        tone: 'success',
        message: `Datos actualizados desde Google Sheets · ${new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date())}`,
      });
    } catch (error) {
      setSyncNotice({
        tone: 'error',
        message: `${error instanceof Error ? error.message : 'No fue posible actualizar las hojas.'} Se conservaron los datos anteriores.`,
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loadError) {
    return (
      <main className="data-loading-state">
        <h1>No se pudieron cargar los datos del reporte</h1>
        <button onClick={() => window.location.reload()}>Volver a intentar</button>
      </main>
    );
  }

  if (!reportData) {
    return (
      <main className="data-loading-state" aria-live="polite">
        <h1>Preparando el reporte de costos…</h1>
      </main>
    );
  }

  return (
    <ReportApp
      reportData={reportData}
      onSync={syncSheets}
      syncing={syncing}
      syncNotice={syncNotice}
    />
  );
}
