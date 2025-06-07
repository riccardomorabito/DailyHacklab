"use client";

import React, { useState, useEffect, useCallback } from 'react';
import {
  format,
  addMonths,
  subMonths,
  addYears,
  subYears,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  isSameDay,
  isToday,
  isFuture,
  parseISO,
  startOfDay as dateFnsStartOfDay,
  formatISO, // Added formatISO
} from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getSubmissionsCountByDayInRange } from '@/actions/submission';
import { logger } from '@/lib/logger';

const CUSTOM_DATE_PICKER_CONTEXT = "CustomDatePicker";

/**
 * Props for CustomDatePicker component
 */
interface CustomDatePickerProps {
  selectedDate: Date | null;
  onDateSelect: (date: Date) => void;
  initialDisplayDate: Date;
  disableFutureDatesAfter: Date; 
  onCloseDialog?: () => void; 
}

/**
 * CustomDatePicker component - Advanced date picker with submission count indicators
 * Features month/year navigation, submission count visualization, and future date restrictions
 * Shows visual indicators for dates with submissions and handles date selection
 *
 * Color indicators:
 * - Yellow dot: Single submission on that date
 * - Green dot: Multiple submissions on that date
 * - No dot: No submissions on that date
 *
 * @param props - CustomDatePickerProps containing date selection and configuration options
 * @param props.selectedDate - Currently selected date (can be null)
 * @param props.onDateSelect - Callback function when a date is selected
 * @param props.initialDisplayDate - Initial date to display in the calendar
 * @param props.disableFutureDatesAfter - Date after which future dates are disabled
 * @param props.onCloseDialog - Optional callback to close the dialog
 * @returns JSX element representing the custom date picker with activity legend
 */
export default function CustomDatePicker({
  selectedDate,
  onDateSelect,
  initialDisplayDate,
  disableFutureDatesAfter,
  onCloseDialog,
}: CustomDatePickerProps) {
  const [displayDate, setDisplayDate] = useState<Date>(dateFnsStartOfDay(initialDisplayDate));
  const [postCounts, setPostCounts] = useState<Record<string, number>>({});
  const [isLoadingCounts, setIsLoadingCounts] = useState(false);

  /**
   * Fetches submission counts for each day in the specified month
   * Used to display activity indicators (green/yellow dots) on calendar dates
   * @param monthDate - Date representing the month to fetch counts for
   */
  const fetchPostCountsForMonth = useCallback(async (monthDate: Date) => {
    logger.info(CUSTOM_DATE_PICKER_CONTEXT, `fetchPostCountsForMonth: Fetching counts for month ${format(monthDate, 'MMMM yyyy', { locale: enUS })}`);
    setIsLoadingCounts(true);
    const monthStart = startOfMonth(monthDate);
    const monthEnd = endOfMonth(monthDate);
    
    const { data, error } = await getSubmissionsCountByDayInRange(monthStart, monthEnd);
    if (error) {
      logger.error(CUSTOM_DATE_PICKER_CONTEXT, `fetchPostCountsForMonth: Error fetching counts: ${error}`);
      setPostCounts({}); 
    } else if (data) {
      const countsMap = data.reduce((acc, item) => {
        // item.date is already YYYY-MM-DD (UTC) from getSubmissionsCountByDayInRange
        acc[item.date] = item.count;
        return acc;
      }, {} as Record<string, number>);
      setPostCounts(countsMap);
      logger.info(CUSTOM_DATE_PICKER_CONTEXT, `fetchPostCountsForMonth: Counts retrieved:`, countsMap);
    }
    setIsLoadingCounts(false);
  }, []);

  useEffect(() => {
    fetchPostCountsForMonth(displayDate);
  }, [displayDate, fetchPostCountsForMonth]);

  /** Navigate to previous year */
  const handlePrevYear = () => setDisplayDate(prev => subYears(prev, 1));
  
  /** Navigate to next year (respects future date restrictions) */
  const handleNextYear = () => {
    const nextYearDate = addYears(displayDate, 1);
    if (startOfMonth(nextYearDate) <= startOfMonth(disableFutureDatesAfter)) {
      setDisplayDate(nextYearDate);
    }
  };
  
  /** Navigate to previous month */
  const handlePrevMonth = () => setDisplayDate(prev => subMonths(prev, 1));
  
  /** Navigate to next month (respects future date restrictions) */
  const handleNextMonth = () => {
    const nextMonthDate = addMonths(displayDate, 1);
     if (startOfMonth(nextMonthDate) <= startOfMonth(disableFutureDatesAfter)) {
      setDisplayDate(nextMonthDate);
    }
  };

  /**
   * Handles day selection in the calendar
   * Prevents selection of future dates beyond the allowed limit
   * @param day - Selected date from the calendar
   */
  const handleDayClick = (day: Date) => {
    // day is a local date from the picker
    if (isFuture(day) && !isSameDay(day, dateFnsStartOfDay(disableFutureDatesAfter))) return;
    onDateSelect(day); // Pass the local date
    if (onCloseDialog) onCloseDialog();
  };

  const firstDayCurrentMonth = startOfMonth(displayDate);
  const lastDayCurrentMonth = endOfMonth(displayDate);
  const daysInMonth = eachDayOfInterval({ start: firstDayCurrentMonth, end: lastDayCurrentMonth });

  const startingDayOfWeek = getDay(firstDayCurrentMonth); 
  const paddingDaysCount = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
  const paddingDays = Array(paddingDaysCount).fill(null);

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  const isNextMonthNavDisabled = startOfMonth(addMonths(displayDate,1)) > startOfMonth(disableFutureDatesAfter);
  const isNextYearNavDisabled = startOfMonth(addYears(displayDate,1)) > startOfMonth(disableFutureDatesAfter);


  return (
    <div className="p-4 bg-background rounded-lg shadow-xl w-full max-w-md mx-auto">
      {/* Calendar Legend */}
      <div className="mb-4 p-3 bg-muted/30 rounded-lg">
        <h4 className="text-sm font-medium text-muted-foreground mb-2">Activity Indicators</h4>
        <div className="flex flex-col gap-1.5 text-xs">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-yellow-400"></div>
            <span className="text-muted-foreground">Single submission</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500"></div>
            <span className="text-muted-foreground">Multiple submissions</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={handlePrevYear} aria-label="Previous year">
          <ChevronsLeft className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handlePrevMonth} aria-label="Previous month">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-lg font-semibold text-center flex-grow capitalize">
          {format(displayDate, 'MMMM yyyy', { locale: enUS })}
        </div>
        <Button variant="ghost" size="icon" onClick={handleNextMonth} disabled={isNextMonthNavDisabled} aria-label="Next month">
          <ChevronRight className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleNextYear} disabled={isNextYearNavDisabled} aria-label="Next year">
          <ChevronsRight className="h-5 w-5" />
        </Button>
      </div>

      {isLoadingCounts && (
        <div className="flex justify-center items-center h-48">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoadingCounts && (
        <>
          <div className="grid grid-cols-7 gap-1 text-center text-sm text-muted-foreground mb-2">
            {dayLabels.map(label => <div key={label}>{label}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {paddingDays.map((_, index) => (
              <div key={`pad-${index}`} className="h-10 w-10"></div> 
            ))}
            {daysInMonth.map(day => {
              // day is a local date from the calendar.
              // For lookup in postCounts (which uses UTC YYYY-MM-DD keys), we convert day to YYYY-MM-DD UTC.
              const dayKeyUTC = formatISO(day, { representation: 'date' });
              const postCount = postCounts[dayKeyUTC] || 0; 
              const isDisabled = isFuture(day) && !isSameDay(day, dateFnsStartOfDay(disableFutureDatesAfter));
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={dayKeyUTC} // Use dayKeyUTC for consistency
                  type="button"
                  onClick={() => !isDisabled && handleDayClick(day)}
                  disabled={isDisabled}
                  className={cn(
                    "h-10 w-10 rounded-md flex flex-col items-center justify-center text-sm relative transition-colors",
                    "hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                    isDisabled ? "text-muted-foreground opacity-50 cursor-not-allowed" : "cursor-pointer",
                    isSelected && "bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-white ring-offset-2 ring-offset-background",
                    !isSelected && isToday(day) && "bg-accent/50 text-accent-foreground" 
                  )}
                  aria-label={`Select date ${format(day, 'PPP', { locale: enUS })}`}
                >
                  <span>{format(day, 'd')}</span>
                  {postCount > 0 && !isDisabled && (
                    <div className={cn(
                      "absolute bottom-1 left-1/2 -translate-x-1/2 h-2 w-2 rounded-full",
                      isSelected ? "bg-primary-foreground" : (postCount > 1 ? "bg-green-500" : "bg-yellow-400")
                    )}></div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
