import { isValid, parseISO } from 'date-fns';

export function isValidDateInput(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && isValid(parseISO(date));
}
