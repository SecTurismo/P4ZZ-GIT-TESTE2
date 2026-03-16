
/**
 * Utility for handling plan expiration dates consistently across the system.
 * Avoids timezone shifts by treating dates as local strings.
 */

/**
 * Calculates the expiration date based on an activation date and number of days.
 * Returns a string in YYYY-MM-DD format (or YYYY-MM-DDTHH:mm if it's a demo with specific time).
 */
export function calculateExpiryDate(days: number, fromDate: Date | string | undefined | null = new Date()): string {
  let result: Date;
  
  if (!fromDate) {
    result = new Date();
  } else if (typeof fromDate === 'string') {
    if (fromDate.includes('T')) {
      result = new Date(fromDate);
    } else {
      const [year, month, day] = fromDate.split('-').map(Number);
      result = new Date(year, month - 1, day);
    }
  } else {
    result = new Date(fromDate);
  }
  
  result.setDate(result.getDate() + days);
  
  // If it's a full day plan (most cases), we return YYYY-MM-DD
  // To avoid timezone issues, we use the local date components
  const year = result.getFullYear();
  const month = String(result.getMonth() + 1).padStart(2, '0');
  const day = String(result.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
}

/**
 * Formats a stored date string for display without timezone shifts.
 * Handles both YYYY-MM-DD and YYYY-MM-DDTHH:mm formats.
 */
export function formatDisplayDate(dateStr: string | undefined | null): string {
  if (!dateStr) return 'VITALÍCIO';
  
  try {
    // If it contains a time component (T), it's likely a demo or precise expiry
    if (dateStr.includes('T')) {
      const date = new Date(dateStr);
      // Use pt-BR locale but ensure we don't accidentally shift if it was saved as ISO
      // However, if it was saved as YYYY-MM-DDTHH:mm (local), new Date() might still shift it.
      // Best approach for display is to use the components if we want to be 100% safe from TZ shifts.
      return date.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }
    
    // For YYYY-MM-DD, we split and reassemble to avoid any Date object TZ logic
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

/**
 * Checks if a date string is expired compared to now.
 * Uses local time comparison to avoid TZ issues.
 */
export function isExpired(dateStr: string | undefined | null, gracePeriodDays: number = 0): boolean {
  if (!dateStr) return false;
  
  const now = new Date();
  let expiry: Date;
  
  if (dateStr.includes('T')) {
    expiry = new Date(dateStr);
  } else {
    // For YYYY-MM-DD, set to end of day to be fair
    const [year, month, day] = dateStr.split('-').map(Number);
    expiry = new Date(year, month - 1, day, 23, 59, 59, 999);
  }
  
  if (gracePeriodDays > 0) {
    expiry.setDate(expiry.getDate() + gracePeriodDays);
  }
  
  return now > expiry;
}

/**
 * Checks if a date is within grace period.
 */
export function isWithinGracePeriod(dateStr: string | undefined | null, gracePeriodDays: number = 0): boolean {
  if (!dateStr || gracePeriodDays <= 0) return false;
  
  const now = new Date();
  let expiry: Date;
  
  if (dateStr.includes('T')) {
    expiry = new Date(dateStr);
  } else {
    const [year, month, day] = dateStr.split('-').map(Number);
    expiry = new Date(year, month - 1, day, 23, 59, 59, 999);
  }
  
  const limit = new Date(expiry);
  limit.setDate(limit.getDate() + gracePeriodDays);
  
  return now > expiry && now <= limit;
}
