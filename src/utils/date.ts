import { format, parseISO, differenceInCalendarDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatDate(date: string | Date | null | undefined, fallback = '—') {
  if (!date) return fallback;
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return format(parsed, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function formatShortDate(date: string | Date | null | undefined, fallback = '—') {
  if (!date) return fallback;
  const parsed = typeof date === 'string' ? parseISO(date) : date;
  if (Number.isNaN(parsed.getTime())) {
    return fallback;
  }
  return format(parsed, 'dd/MM/yyyy', { locale: ptBR });
}

export function calculateDaysRemaining(expiresAt: string | null) {
  if (!expiresAt) return null;
  const parsed = parseISO(expiresAt);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  const today = new Date();
  return differenceInCalendarDays(parsed, today);
}

export function isActiveRental(expiresAt: string | null) {
  if (!expiresAt) return true;
  return isAfter(parseISO(expiresAt), new Date());
}

export function addDays(base: Date, days: number) {
  const copy = new Date(base.getTime());
  copy.setDate(copy.getDate() + days);
  return copy;
}
