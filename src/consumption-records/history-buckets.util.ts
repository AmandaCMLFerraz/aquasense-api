export type HistoryPeriod = 'dia' | 'semana' | 'mes';

export interface BucketDef {
  label: string;
  start: Date;
  end: Date;
}

export interface HistoryRange {
  buckets: BucketDef[];
  previousRangeStart: Date;
  previousRangeEnd: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function atMidnight(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfWeek(date: Date): Date {
  const midnight = atMidnight(date);
  const day = midnight.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  midnight.setDate(midnight.getDate() + diffToMonday);
  return midnight;
}

function buildDayRange(now: Date): HistoryRange {
  const HOURS_PER_BUCKET = 3;
  const todayStart = atMidnight(now);
  const buckets: BucketDef[] = [];

  for (let hour = 0; hour < 24; hour += HOURS_PER_BUCKET) {
    const start = new Date(todayStart.getTime() + hour * 60 * 60 * 1000);
    const end = new Date(start.getTime() + HOURS_PER_BUCKET * 60 * 60 * 1000);
    buckets.push({ label: `${String(hour).padStart(2, '0')}h`, start, end });
  }

  const previousRangeStart = new Date(todayStart.getTime() - DAY_MS);
  return { buckets, previousRangeStart, previousRangeEnd: todayStart };
}

function buildWeekRange(now: Date): HistoryRange {
  const weekStart = startOfWeek(now);
  const buckets: BucketDef[] = [];

  for (let i = 0; i < 7; i++) {
    const start = new Date(weekStart.getTime() + i * DAY_MS);
    const end = new Date(start.getTime() + DAY_MS);
    buckets.push({ label: WEEKDAY_LABELS[start.getDay()], start, end });
  }

  const previousRangeEnd = weekStart;
  const previousRangeStart = new Date(weekStart.getTime() - 7 * DAY_MS);
  return { buckets, previousRangeStart, previousRangeEnd };
}

function buildMonthRange(now: Date): HistoryRange {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const buckets: BucketDef[] = [];

  for (
    let cursor = monthStart;
    cursor < nextMonthStart;
    cursor = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
    )
  ) {
    const end = new Date(
      cursor.getFullYear(),
      cursor.getMonth(),
      cursor.getDate() + 1,
    );
    buckets.push({ label: String(cursor.getDate()), start: cursor, end });
  }

  const daysElapsed = Math.ceil(
    (now.getTime() - monthStart.getTime()) / DAY_MS,
  );
  const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousRangeStart = previousMonthStart;
  const previousRangeEnd = new Date(
    previousMonthStart.getTime() + daysElapsed * DAY_MS,
  );

  return { buckets, previousRangeStart, previousRangeEnd };
}

export function buildHistoryRange(
  period: HistoryPeriod,
  now = new Date(),
): HistoryRange {
  switch (period) {
    case 'dia':
      return buildDayRange(now);
    case 'mes':
      return buildMonthRange(now);
    case 'semana':
    default:
      return buildWeekRange(now);
  }
}
