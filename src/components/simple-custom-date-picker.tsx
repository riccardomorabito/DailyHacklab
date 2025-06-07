"use client";

import React, { useState } from 'react';
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
  isPast,
  startOfDay as dateFnsStartOfDay,
} from 'date-fns';
import { it } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Props for the SimpleCustomDatePicker component
 */
interface SimpleCustomDatePickerProps {
  /** The currently selected date */
  selectedDate: Date | null;
  /** Callback function called when a date is selected */
  onDateSelect: (date: Date) => void;
  /** Initial date to display in the calendar */
  initialDisplayDate?: Date;
  /** Whether to allow selection of past dates */
  allowPastDates?: boolean;
  /** Optional callback to close the dialog when a date is selected */
  onCloseDialog?: () => void;
}

/**
 * A simple custom date picker component with month/year navigation
 * @param props - The component props
 * @returns The date picker component
 */
export default function SimpleCustomDatePicker({
  selectedDate,
  onDateSelect,
  initialDisplayDate = new Date(),
  allowPastDates = false,
  onCloseDialog,
}: SimpleCustomDatePickerProps) {
  const [displayDate, setDisplayDate] = useState<Date>(dateFnsStartOfDay(initialDisplayDate));

  /** Navigate to previous year */
  const handlePrevYear = () => setDisplayDate(prev => subYears(prev, 1));
  /** Navigate to next year */
  const handleNextYear = () => setDisplayDate(prev => addYears(prev, 1));
  /** Navigate to previous month */
  const handlePrevMonth = () => setDisplayDate(prev => subMonths(prev, 1));
  /** Navigate to next month */
  const handleNextMonth = () => setDisplayDate(prev => addMonths(prev, 1));

  /**
   * Handle day selection
   * @param day - The selected day
   */
  const handleDayClick = (day: Date) => {
    if (!allowPastDates && isPast(day) && !isToday(day)) return;
    onDateSelect(day);
    if (onCloseDialog) onCloseDialog();
  };

  const firstDayCurrentMonth = startOfMonth(displayDate);
  const lastDayCurrentMonth = endOfMonth(displayDate);
  const daysInMonth = eachDayOfInterval({ start: firstDayCurrentMonth, end: lastDayCurrentMonth });

  const startingDayOfWeek = getDay(firstDayCurrentMonth);
  const paddingDaysCount = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
  const paddingDays = Array(paddingDaysCount).fill(null);

  const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="p-4 bg-background rounded-lg shadow-xl w-full max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <Button variant="ghost" size="icon" onClick={handlePrevYear} aria-label="Previous year">
          <ChevronsLeft className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handlePrevMonth} aria-label="Previous month">
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-lg font-semibold text-center flex-grow capitalize">
          {format(displayDate, 'MMMM yyyy', { locale: it })}
        </div>
        <Button variant="ghost" size="icon" onClick={handleNextMonth} aria-label="Next month">
          <ChevronRight className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleNextYear} aria-label="Next year">
          <ChevronsRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm text-muted-foreground mb-2">
        {dayLabels.map(label => <div key={label}>{label}</div>)}
      </div>
      
      <div className="grid grid-cols-7 gap-1">
        {paddingDays.map((_, index) => (
          <div key={`pad-${index}`} className="h-10 w-10"></div>
        ))}
        {daysInMonth.map(day => {
          const isDisabled = !allowPastDates && isPast(day) && !isToday(day);
          const isSelected = selectedDate && isSameDay(day, selectedDate);

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => !isDisabled && handleDayClick(day)}
              disabled={isDisabled}
              className={cn(
                "h-10 w-10 rounded-md flex items-center justify-center text-sm transition-colors",
                "hover:bg-accent hover:text-accent-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                isDisabled ? "text-muted-foreground opacity-50 cursor-not-allowed" : "cursor-pointer",
                isSelected && "bg-primary text-primary-foreground hover:bg-primary/90 ring-2 ring-white ring-offset-2 ring-offset-background",
                !isSelected && isToday(day) && "bg-accent/50 text-accent-foreground"
              )}
              aria-label={`Select date ${format(day, 'PPP', { locale: it })}`}
            >
              {format(day, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}