import type { Deadline, Payment } from './types';
export type DashboardDeadline = Deadline & { entities: { name: string } | null };
export type DashboardPayment = Payment & { deadlines: DashboardDeadline | null };
export function romeToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function dayDifference(date: string, today: string) {
  return Math.round((Date.parse(date + 'T00:00:00Z') - Date.parse(today + 'T00:00:00Z')) / 86400000);
}
export function matchesDeadline(d: DashboardDeadline, query: string, category: string, entity: string) {
  return `${d.title} ${d.category} ${d.entities?.name ?? ''}`.toLocaleLowerCase('it').includes(query.trim().toLocaleLowerCase('it'))
    && (category === '' || d.category === category)
    && (entity === '' || (entity === 'unassigned' ? !d.entity_id : d.entity_id === entity));
}
export function upcoming(date: string, today: string, range: string) {
  // Include overdue items so a period filter never hides unfinished obligations.
  return range === 'all' || dayDifference(date, today) <= Number(range);
}
export function recent(date: string, today: string, range: string) {
  const days = dayDifference(date, today);
  return days <= 0 && (range === 'all' || days >= -(Number(range) - 1));
}
export function isPaymentProof(type: string) {
  return ['receipt', 'discharge', 'f24'].includes(type);
}
