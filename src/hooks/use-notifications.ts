"use client";

import { useState, useEffect, useCallback } from 'react';
import { logger } from '@/lib/logger';

const NOTIFICATIONS_CONTEXT = "useNotifications";

/**
 * Configuration options for displaying notifications
 */
export interface NotificationOptions {
  /** The title of the notification */
  title: string;
  /** The body text of the notification */
  body: string;
  /** Optional icon URL for the notification */
  icon?: string;
  /** Optional tag to group notifications */
  tag?: string;
  /** Whether the notification requires user interaction to dismiss */
  requireInteraction?: boolean;
}

/**
 * Custom hook for managing browser notifications
 * Provides functionality to request permission, show notifications, and handle special event notifications
 * @returns Object containing notification methods and state
 */
export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
      logger.info(NOTIFICATIONS_CONTEXT, `Notifications supported. Current permission: ${Notification.permission}`);
    } else {
      logger.warn(NOTIFICATIONS_CONTEXT, "Notifications not supported in this browser");
    }
  }, []);

  /**
   * Requests notification permission from the user
   * @returns Promise resolving to the notification permission status
   */
  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!isSupported) {
      logger.warn(NOTIFICATIONS_CONTEXT, "Cannot request permission: notifications not supported");
      return 'denied';
    }

    if (permission === 'granted') {
      logger.info(NOTIFICATIONS_CONTEXT, "Permission already granted");
      return 'granted';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      logger.info(NOTIFICATIONS_CONTEXT, `Permission request result: ${result}`);
      return result;
    } catch (error) {
      logger.error(NOTIFICATIONS_CONTEXT, "Error requesting notification permission:", error);
      return 'denied';
    }
  }, [isSupported, permission]);

  /**
   * Displays a notification with the given options
   * @param options - Configuration options for the notification
   * @returns Promise resolving to true if notification was shown, false otherwise
   */
  const showNotification = useCallback(async (options: NotificationOptions): Promise<boolean> => {
    if (!isSupported) {
      logger.warn(NOTIFICATIONS_CONTEXT, "Cannot show notification: not supported");
      return false;
    }

    if (permission !== 'granted') {
      logger.warn(NOTIFICATIONS_CONTEXT, "Cannot show notification: permission not granted");
      return false;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag,
        requireInteraction: options.requireInteraction || false,
      });

      // Auto-close after 5 seconds if not requiring interaction
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      logger.info(NOTIFICATIONS_CONTEXT, `Notification shown: ${options.title}`);
      return true;
    } catch (error) {
      logger.error(NOTIFICATIONS_CONTEXT, "Error showing notification:", error);
      return false;
    }
  }, [isSupported, permission]);

  /**
   * Shows a special event notification
   * @param eventName - Name of the event
   * @param customMessage - Optional custom message, defaults to event start message
   * @returns Promise resolving to true if notification was shown, false otherwise
   */
  const showEventNotification = useCallback(async (eventName: string, customMessage?: string): Promise<boolean> => {
    const title = "🎉 Special Event in Progress!";
    const body = customMessage || `The event has started: ${eventName}`;
    
    // Use a unique tag based on event name and current time to ensure uniqueness
    // but also prevent duplicate notifications for the same event
    const eventTag = `event-${eventName.replace(/\s+/g, '-').toLowerCase()}`;
    
    return showNotification({
      title,
      body,
      tag: eventTag,
      requireInteraction: true,
    });
  }, [showNotification]);

  /**
   * Shows a welcome notification for new users
   * @param userName - Name of the user to welcome
   * @returns Promise resolving to true if notification was shown, false otherwise
   */
  const showWelcomeNotification = useCallback(async (userName: string): Promise<boolean> => {
    const title = "👋 Welcome to Daily Hacklab!";
    const body = `Hello ${userName}! Start sharing your projects.`;
    
    return showNotification({
      title,
      body,
      tag: 'welcome',
      requireInteraction: false,
    });
  }, [showNotification]);

  return {
    /** Whether notifications are supported in the current browser */
    isSupported,
    /** Current notification permission status */
    permission,
    /** Function to request notification permission */
    requestPermission,
    /** Function to show a custom notification */
    showNotification,
    /** Function to show an event-specific notification */
    showEventNotification,
    /** Function to show a welcome notification */
    showWelcomeNotification,
  };
}