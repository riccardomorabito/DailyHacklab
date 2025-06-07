"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import SimpleCustomDatePicker from '@/components/simple-custom-date-picker';
import { CalendarIcon, ListChecks, PlusCircle, Sparkles, BadgeCheck, BadgeX, Loader2, AlertTriangle, RefreshCw, Trash2, Edit } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { parseISO, startOfDay, isPast, isToday } from 'date-fns';
import { cn, formatDateInUserTimezone } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import type { SpecialEvent } from '@/types';
import { createSpecialEvent, deleteSpecialEvent, updateSpecialEvent } from '@/actions/events';
import { getSpecialEvents } from '@/lib/events-client';
import {
  Table,
  TableBody,
  TableCell,
  TableCaption,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from '@/components/ui/skeleton';
import { logger } from '@/lib/logger';
import ErrorDisplay from './error-display';

const SPECIAL_EVENTS_MANAGER_CONTEXT = "SpecialEventsManager";

/**
 * Zod schema for validating special event form data
 */
const eventSchema = z.object({
  name: z.string().min(3, { message: "Event name must contain at least 3 characters." }),
  event_date: z.date({ required_error: "Event date is required." }),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  bonus_points: z.coerce.number().int().min(0, {message: "Bonus points must be 0 or a positive integer."}),
  description: z.string().optional(),
  show_notification: z.boolean(),
  notification_message: z.string().optional(),
  is_recurring: z.boolean(),
  recurring_interval_days: z.coerce.number().int().min(1).max(365).optional(),
  recurring_end_date: z.date().optional(),
}).refine((data) => {
  // If recurring is enabled, interval days must be provided
  if (data.is_recurring && !data.recurring_interval_days) {
    return false;
  }
  // If recurring end date is provided, it must be after the start date
  if (data.recurring_end_date && data.event_date >= data.recurring_end_date) {
    return false;
  }
  // If end time is provided, start time must also be provided
  if (data.end_time && !data.start_time) {
    return false;
  }
  // If both times are provided, start time must be before end time
  if (data.start_time && data.end_time && data.start_time >= data.end_time) {
    return false;
  }
  return true;
}, {
  message: "Invalid configuration. Check times and recurrence.",
  path: ["start_time"]
});

/** Type definition for event form data derived from the schema */
type EventFormData = z.infer<typeof eventSchema>;

/**
 * Special Events Manager component for creating and managing special events
 * Provides forms for creating events with bonus points, notifications, and recurrence
 * @returns The special events manager component
 */
export default function SpecialEventsManager() {
  const [specialEvents, setSpecialEvents] = useState<SpecialEvent[]>([]);
  const [isLoadingEvents, setIsLoadingEvents] = useState(true);
  const [errorLoadingEvents, setErrorLoadingEvents] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
  const [eventToDelete, setEventToDelete] = useState<SpecialEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<SpecialEvent | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const { toast } = useToast();

  const { register, handleSubmit, control, formState: { errors, isSubmitting }, reset, setValue, watch } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      bonus_points: 100,
      description: "",
      start_time: "",
      end_time: "",
      show_notification: true,
      notification_message: "",
      is_recurring: false,
      recurring_interval_days: 7,
    }
  });

  const isRecurring = watch("is_recurring");

  /**
   * Fetch and reload special events from the database
   */
  const fetchEvents = useCallback(async () => {
    logger.info(SPECIAL_EVENTS_MANAGER_CONTEXT, "fetchEvents: Starting special events retrieval.");
    setIsLoadingEvents(true);
    setErrorLoadingEvents(null);
    setErrorDetails(undefined);
    const { data, error } = await getSpecialEvents();
    if (error) {
      logger.error(SPECIAL_EVENTS_MANAGER_CONTEXT, "fetchEvents: Error during events retrieval:", error);
      setErrorLoadingEvents("Unable to load the special events list.");
      // setErrorDetails(typeof error === 'object' ? JSON.stringify(error) : error);
      setSpecialEvents([]);
      // Don't show toast here, ErrorDisplay will handle the UI
    } else if (data) {
      const sortedEvents = data.map(event => ({
        ...event,
        isActive: !isPast(startOfDay(parseISO(event.event_date))) || isToday(startOfDay(parseISO(event.event_date)))
      })).sort((a, b) => {
        if (a.isActive && !b.isActive) return -1;
        if (!a.isActive && b.isActive) return 1;
        return new Date(b.event_date).getTime() - new Date(a.event_date).getTime();
      });
      setSpecialEvents(sortedEvents);
      logger.info(SPECIAL_EVENTS_MANAGER_CONTEXT, `fetchEvents: Retrieved ${data.length} special events.`);
    }
    setIsLoadingEvents(false);
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  /**
   * Handle form submission for creating or updating events
   * @param data - The form data to submit
   */
  const onSubmitHandler: SubmitHandler<EventFormData> = async (data) => {
    if (isEditMode && editingEvent) {
      logger.info(SPECIAL_EVENTS_MANAGER_CONTEXT, "onSubmitHandler: Attempting event update:", data);
      const { data: updatedEvent, error } = await updateSpecialEvent(editingEvent.id, data);

      if (error) {
        logger.error(SPECIAL_EVENTS_MANAGER_CONTEXT, "onSubmitHandler: Error during event update:", error);
        toast({
          title: "Event Update Error",
          description: error,
          variant: "destructive",
        });
      } else if (updatedEvent) {
        logger.info(SPECIAL_EVENTS_MANAGER_CONTEXT, "onSubmitHandler: Event updated successfully:", updatedEvent);
        toast({
          title: "Event Updated!",
          description: `The event "${updatedEvent.name}" has been successfully updated.`,
        });
        fetchEvents();
        handleCancelEdit();
      }
    } else {
      logger.info(SPECIAL_EVENTS_MANAGER_CONTEXT, "onSubmitHandler: Attempting event creation:", data);
      const { data: newEvent, error } = await createSpecialEvent(data);

      if (error) {
        logger.error(SPECIAL_EVENTS_MANAGER_CONTEXT, "onSubmitHandler: Error during event creation:", error);
        toast({
          title: "Event Creation Error",
          description: error,
          variant: "destructive",
        });
      } else if (newEvent) {
        logger.info(SPECIAL_EVENTS_MANAGER_CONTEXT, "onSubmitHandler: Event created successfully:", newEvent);
        toast({
          title: "Special Event Created!",
          description: `The event "${newEvent.name}" has been successfully added.`,
        });
        fetchEvents();
        reset();
        setValue('event_date', undefined as unknown as Date); // Reset date field
      }
    }
  };

  /**
   * Handle editing an existing event by populating the form
   * @param event - The event to edit
   */
  const handleEditEvent = (event: SpecialEvent) => {
    logger.info(SPECIAL_EVENTS_MANAGER_CONTEXT, `handleEditEvent: Starting event edit ID: ${event.id}`);
    setEditingEvent(event);
    setIsEditMode(true);
    
    // Populate form with event data
    reset({
      name: event.name,
      event_date: parseISO(event.event_date),
      start_time: event.start_time || "",
      end_time: event.end_time || "",
      bonus_points: event.bonus_points,
      description: event.description || "",
      show_notification: event.show_notification,
      notification_message: event.notification_message || "",
      is_recurring: event.is_recurring,
      recurring_interval_days: event.recurring_interval_days || 7,
      recurring_end_date: event.recurring_end_date ? parseISO(event.recurring_end_date) : undefined,
    });
    
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Cancel event editing and reset the form
   */
  const handleCancelEdit = () => {
    logger.info(SPECIAL_EVENTS_MANAGER_CONTEXT, "handleCancelEdit: Canceling event edit");
    setEditingEvent(null);
    setIsEditMode(false);
    reset();
    setValue('event_date', undefined as unknown as Date);
  };

  /**
   * Handle event deletion confirmation
   */
  const handleDeleteConfirm = async () => {
    if (!eventToDelete) return;
    
    logger.info(SPECIAL_EVENTS_MANAGER_CONTEXT, `handleDeleteConfirm: Confirming deletion for event ID: ${eventToDelete.id}`);
    setDeletingEventId(eventToDelete.id);
    
    const { success, error } = await deleteSpecialEvent(eventToDelete.id);
    
    if (error) {
      logger.error(SPECIAL_EVENTS_MANAGER_CONTEXT, "handleDeleteConfirm: Error during deletion:", error);
      toast({
        title: "Event Deletion Error",
        description: error,
        variant: "destructive",
      });
    } else if (success) {
      logger.info(SPECIAL_EVENTS_MANAGER_CONTEXT, "handleDeleteConfirm: Event deleted successfully.");
      toast({
        title: "Event Deleted!",
        description: `The event "${eventToDelete.name}" has been successfully deleted.`,
      });
      fetchEvents(); // Refresh the events list
    }
    
    setDeletingEventId(null);
    setEventToDelete(null);
  };

  return (
    <div className="space-y-10 max-w-4xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl font-headline">
            {isEditMode ? (
              <>
                <Edit className="mr-3 h-7 w-7 text-primary" />
                Edit Special Event
              </>
            ) : (
              <>
                <PlusCircle className="mr-3 h-7 w-7 text-primary" />
                Add New Special Event
              </>
            )}
          </CardTitle>
          <CardDescription>
            {isEditMode
              ? `Edit the event "${editingEvent?.name}" to update details.`
              : "Define an event to encourage participation with bonus points."
            }
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit(onSubmitHandler)}>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5">
                <Label htmlFor="eventName">Event Name</Label>
                <Input id="eventName" {...register('name')} placeholder="e.g., Monthly Hackathon" disabled={isSubmitting} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="eventDate">Event Date</Label>
                <Controller
                  name="event_date"
                  control={control}
                  render={({ field }) => (
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isSubmitting}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? formatDateInUserTimezone(field.value.toISOString(), "PPP") : <span>Select date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <SimpleCustomDatePicker
                          selectedDate={field.value || null}
                          onDateSelect={(date: Date) => {
                            field.onChange(date);
                            setIsCalendarOpen(false);
                          }}
                          initialDisplayDate={field.value || new Date()}
                          allowPastDates={false} // Don't allow past dates for events
                          onCloseDialog={() => setIsCalendarOpen(false)}
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                />
                {errors.event_date && <p className="text-sm text-destructive">{errors.event_date.message}</p>}
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-1.5">
                <Label htmlFor="bonusPoints">Bonus Points</Label>
                <Input id="bonusPoints" type="number" {...register('bonus_points')} placeholder="e.g., 100" disabled={isSubmitting}/>
                {errors.bonus_points && <p className="text-sm text-destructive">{errors.bonus_points.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="startTime">Start Time (Optional)</Label>
                <Input id="startTime" type="time" {...register('start_time')} disabled={isSubmitting}/>
                {errors.start_time && <p className="text-sm text-destructive">{errors.start_time.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="endTime">End Time (Optional)</Label>
                <Input id="endTime" type="time" {...register('end_time')} disabled={isSubmitting}/>
                {errors.end_time && <p className="text-sm text-destructive">{errors.end_time.message}</p>}
              </div>
            </div>
            
            {/* Notification Settings */}
            <div className="space-y-4 p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/30">
              <div className="flex items-center space-x-2">
                <Controller
                  name="show_notification"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="show_notification"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <div>
                  <Label htmlFor="show_notification" className="flex items-center cursor-pointer">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Show Site Notification
                  </Label>
                  <p className="text-sm text-muted-foreground">Show a prominent notification on the site for this event</p>
                </div>
              </div>

              {watch("show_notification") && (
                <div className="space-y-1.5 pl-6">
                  <Label htmlFor="notificationMessage">Notification Message (Optional)</Label>
                  <Textarea
                    id="notificationMessage"
                    {...register('notification_message')}
                    placeholder="Custom notification message. If empty, the event name will be used."
                    disabled={isSubmitting}
                    rows={2}
                  />
                  {errors.notification_message && <p className="text-sm text-destructive">{errors.notification_message.message}</p>}
                  <p className="text-xs text-muted-foreground">
                    💡 If you don't specify a message, it will show: "Event in progress: [Event Name]"
                  </p>
                </div>
              )}
            </div>
            
            {/* Recurring Event Controls */}
            <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center space-x-2">
                <Controller
                  name="is_recurring"
                  control={control}
                  render={({ field }) => (
                    <Checkbox
                      id="is_recurring"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={isSubmitting}
                    />
                  )}
                />
                <div>
                  <Label htmlFor="is_recurring" className="flex items-center cursor-pointer">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Recurring Event
                  </Label>
                  <p className="text-sm text-muted-foreground">The event will repeat automatically every X days</p>
                </div>
              </div>

              {isRecurring && (
                <div className="space-y-4 pl-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="recurring_interval_days">Repeat every (days)</Label>
                      <Controller
                        name="recurring_interval_days"
                        control={control}
                        render={({ field }) => (
                          <Select
                            value={field.value?.toString()}
                            onValueChange={(value) => field.onChange(parseInt(value))}
                            disabled={isSubmitting}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select interval" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">Daily</SelectItem>
                              <SelectItem value="7">Weekly</SelectItem>
                              <SelectItem value="14">Every 2 weeks</SelectItem>
                              <SelectItem value="30">Monthly</SelectItem>
                              <SelectItem value="90">Every 3 months</SelectItem>
                              <SelectItem value="365">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                      {errors.recurring_interval_days && (
                        <p className="text-sm text-destructive">{errors.recurring_interval_days.message}</p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="recurring_end_date">Recurrence End Date (Optional)</Label>
                      <Controller
                        name="recurring_end_date"
                        control={control}
                        render={({ field }) => (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                                disabled={isSubmitting}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? formatDateInUserTimezone(field.value.toISOString(), "PPP") : <span>No end date</span>}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                              <SimpleCustomDatePicker
                                selectedDate={field.value || null}
                                onDateSelect={(date: Date) => field.onChange(date)}
                                initialDisplayDate={field.value || new Date()}
                                allowPastDates={false} // Don't allow past dates for recurring end date
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      />
                      {errors.recurring_end_date && (
                        <p className="text-sm text-destructive">{errors.recurring_end_date.message}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    ℹ️ If you don't specify an end date, the event will continue repeating indefinitely.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="eventDescription">Description (Optional)</Label>
              <Textarea id="eventDescription" {...register('description')} placeholder="Brief event description..." disabled={isSubmitting} />
              {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>
          </CardContent>
          <CardFooter className="flex gap-3">
            <Button type="submit" className="flex-1 md:flex-none" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isSubmitting
                ? (isEditMode ? 'Updating...' : 'Creating...')
                : (isEditMode ? 'Update Event' : 'Create Special Event')
              }
            </Button>
            {isEditMode && (
              <Button
                type="button"
                variant="outline"
                onClick={handleCancelEdit}
                disabled={isSubmitting}
                className="flex-1 md:flex-none"
              >
                Cancel Edit
              </Button>
            )}
          </CardFooter>
        </form>
      </Card>

      <Card className="shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl font-headline">
            <ListChecks className="mr-3 h-7 w-7 text-primary" />
            Special Events List
          </CardTitle>
          <CardDescription>
            View all created special events. Recurring events show frequency information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingEvents && (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}
          {!isLoadingEvents && errorLoadingEvents && (
            <ErrorDisplay message={errorLoadingEvents} details={errorDetails} title="Error Loading Events" showReturnHomeButton={false} />
          )}
          {!isLoadingEvents && !errorLoadingEvents && specialEvents.length === 0 && (
            <p className="text-muted-foreground text-center py-4">No special events created yet.</p>
          )}
          {!isLoadingEvents && !errorLoadingEvents && specialEvents.length > 0 && (
            <Table>
              <TableCaption>A list of scheduled special events.</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Event Name</TableHead>
                  <TableHead>Date & Time</TableHead>
                  <TableHead className="text-right">Bonus</TableHead>
                  <TableHead>Recurrence</TableHead>
                  <TableHead>Notification</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[150px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {specialEvents.map((event) => {
                  const isActive = !isPast(startOfDay(parseISO(event.event_date))) || isToday(startOfDay(parseISO(event.event_date)));
                  const isDeleting = deletingEventId === event.id;
                  
                  // Helper function to get recurrence description
                  const getRecurrenceDescription = (intervalDays: number) => {
                    switch (intervalDays) {
                      case 1: return "daily";
                      case 7: return "weekly";
                      case 14: return "every 2 weeks";
                      case 30: return "monthly";
                      case 90: return "every 3 months";
                      case 365: return "yearly";
                      default: return `every ${intervalDays} days`;
                    }
                  };
                  
                  return (
                    <TableRow key={event.id} className={cn(!isActive && "opacity-60")}>
                      <TableCell className="font-medium">{event.name}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span>{formatDateInUserTimezone(event.event_date, "PPP")}</span>
                          {(event.start_time || event.end_time) && (
                            <span className="text-xs text-muted-foreground">
                              {event.start_time && event.end_time
                                ? `${event.start_time} - ${event.end_time}`
                                : event.start_time
                                  ? `from ${event.start_time}`
                                  : `until ${event.end_time}`
                              }
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-semibold text-accent">{event.bonus_points}</TableCell>
                      <TableCell>
                        {event.is_recurring ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-700 dark:text-blue-100">
                              <RefreshCw className="mr-1 h-3 w-3" /> Recurring
                            </span>
                            {event.recurring_interval_days && (
                              <span className="text-xs text-muted-foreground">
                                {getRecurrenceDescription(event.recurring_interval_days)}
                              </span>
                            )}
                            {event.recurring_end_date && (
                              <span className="text-xs text-muted-foreground">
                                until {formatDateInUserTimezone(event.recurring_end_date, "dd/MM/yyyy")}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100">
                            Single event
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {event.show_notification ? (
                          <div className="flex flex-col gap-1">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-700 dark:text-orange-100">
                              <AlertTriangle className="mr-1 h-3 w-3" /> Active
                            </span>
                            {event.notification_message && (
                              <span className="text-xs text-muted-foreground truncate max-w-[150px]" title={event.notification_message}>
                                "{event.notification_message}"
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100">
                            Inactive
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-700 dark:text-green-100">
                            <BadgeCheck className="mr-1 h-3 w-3" /> Active/Upcoming
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-700 dark:text-red-100">
                            <BadgeX className="mr-1 h-3 w-3" /> Past
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{event.description || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditEvent(event)}
                            disabled={isDeleting || isSubmitting}
                          >
                            <Edit className="mr-0 sm:mr-2 h-4 w-4" />
                            <span className="hidden sm:inline">Edit</span>
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => setEventToDelete(event)}
                                disabled={isDeleting}
                              >
                                <Trash2 className="mr-0 sm:mr-2 h-4 w-4" />
                                <span className="hidden sm:inline">Delete</span>
                              </Button>
                            </AlertDialogTrigger>
                            {eventToDelete && eventToDelete.id === event.id && (
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete the event "{eventToDelete.name}" ({formatDateInUserTimezone(eventToDelete.event_date, "PPP")})?
                                    {eventToDelete.is_recurring && " This will also delete all future recurring instances."}
                                    This action is irreversible.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setEventToDelete(null)}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive hover:bg-destructive/90">
                                    Yes, Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            )}
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
