
import { TimePeriod } from '../types';

/**
 * Checks if a date string falls within the selected time period relative to now.
 */
export const isDateInPeriod = (dateStr: string, period: TimePeriod): boolean => {
  if (period === 'ALL') return true;

  const date = new Date(dateStr);
  const now = new Date();
  
  // Get difference in milliseconds
  const diffTime = now.getTime() - date.getTime();
  
  // Convert to days
  const diffDays = diffTime / (1000 * 3600 * 24);

  switch (period) {
    case '1d': return diffDays <= 1;
    case '7d': return diffDays <= 7;
    case '14d': return diffDays <= 14;
    case '1m': return diffDays <= 30;
    case '3m': return diffDays <= 90;
    default: return true;
  }
};

/**
 * Returns a human-readable label for the period
 */
export const getPeriodLabel = (period: TimePeriod): string => {
  switch (period) {
    case '1d': return 'За 24 часа';
    case '7d': return 'За 7 дней';
    case '14d': return 'За 14 дней';
    case '1m': return 'За 30 дней';
    case '3m': return 'За 90 дней';
    case 'ALL': return 'За все время';
    default: return '';
  }
};

/**
 * Returns number of days for chart generation
 */
export const getDaysForPeriod = (period: TimePeriod): number => {
    switch (period) {
      case '1d': return 1; // Special case usually handled by hours, but for simplicity 1
      case '7d': return 7;
      case '14d': return 14;
      case '1m': return 30;
      case '3m': return 90;
      case 'ALL': return 14; // Default chart view
      default: return 7;
    }
  };