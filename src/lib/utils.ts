import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a date string (YYYY-MM-DD or ISO) to DD-MMM-YYYY (e.g. 01-Jun-2026)
 */
export function formatDate(date: string | null | undefined): string {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function getPlannedMonthWeek(date: string | null): string {
  if (!date) return '';
  const d = new Date(date);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[d.getMonth()];
  const week = Math.ceil(d.getDate() / 7);
  return `${month} - ${week}`;
}

export function getOverdueDays(plannedEndDate: string | null, isClosed: boolean): number {
  if (!plannedEndDate || isClosed) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(plannedEndDate);
  end.setHours(0, 0, 0, 0);
  const diff = Math.floor((today.getTime() - end.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 0;
}

export function generateTaskNo(seq: number): string {
  return `T-${String(seq).padStart(6, '0')}`;
}
