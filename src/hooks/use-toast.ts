"use client"

// Inspired by react-hot-toast library
import * as React from "react"

import type {
  ToastActionElement,
  ToastProps,
} from "@/components/ui/toast"

/** Maximum number of toasts that can be displayed simultaneously */
const TOAST_LIMIT = 1
/** Delay in milliseconds before removing a toast from the DOM after dismissal */
const TOAST_REMOVE_DELAY = 1000 // Reduced duration from 5000ms (5 seconds) to 1000ms

/**
 * Extended toast configuration with additional properties
 */
type ToasterToast = ToastProps & {
  /** Unique identifier for the toast */
  id: string
  /** Optional title content for the toast */
  title?: React.ReactNode
  /** Optional description content for the toast */
  description?: React.ReactNode
  /** Optional action element (button) for the toast */
  action?: ToastActionElement
  /** Optional duration in milliseconds for auto-dismiss */
  duration?: number;
}

/** Available action types for toast management */
const actionTypes = {
  ADD_TOAST: "ADD_TOAST",
  UPDATE_TOAST: "UPDATE_TOAST",
  DISMISS_TOAST: "DISMISS_TOAST",
  REMOVE_TOAST: "REMOVE_TOAST",
} as const

let count = 0

/**
 * Generates a unique ID for each toast
 * @returns Unique string identifier
 */
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ActionType = typeof actionTypes

/**
 * Union type for all possible toast actions
 */
type Action =
  | {
      type: ActionType["ADD_TOAST"]
      toast: ToasterToast
    }
  | {
      type: ActionType["UPDATE_TOAST"]
      toast: Partial<ToasterToast>
    }
  | {
      type: ActionType["DISMISS_TOAST"]
      toastId?: ToasterToast["id"]
    }
  | {
      type: ActionType["REMOVE_TOAST"]
      toastId?: ToasterToast["id"]
    }

/**
 * Toast manager state interface
 */
interface State {
  /** Array of currently active toasts */
  toasts: ToasterToast[]
}

/** Map of toast IDs to their removal timeout handlers */
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
/** Map of toast IDs to their auto-dismiss timeout handlers */
const toastDismissTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

/**
 * Adds a toast to the removal queue with a delay
 * @param toastId - ID of the toast to remove
 */
const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) {
    clearTimeout(toastTimeouts.get(toastId)) // Clears existing timeout if called again
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({
      type: "REMOVE_TOAST",
      toastId: toastId,
    })
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

/**
 * Reducer function for managing toast state
 * @param state - Current toast state
 * @param action - Action to perform on the state
 * @returns New state after applying the action
 */
export const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_TOAST":
      // Clear auto-dismiss timeout for existing toasts if we add a new one and TOAST_LIMIT is 1
      if (TOAST_LIMIT === 1 && state.toasts.length > 0) {
        state.toasts.forEach(t => {
          if (toastDismissTimeouts.has(t.id)) {
            clearTimeout(toastDismissTimeouts.get(t.id));
            toastDismissTimeouts.delete(t.id);
          }
          // Force immediate closure of the previous toast
           dispatch({ type: "DISMISS_TOAST", toastId: t.id });
        });
      }
      return {
        ...state,
        toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT),
      }

    case "UPDATE_TOAST":
      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === action.toast.id ? { ...t, ...action.toast } : t
        ),
      }

    case "DISMISS_TOAST": {
      const { toastId } = action

      if (toastId) {
        if (toastDismissTimeouts.has(toastId)) {
          clearTimeout(toastDismissTimeouts.get(toastId));
          toastDismissTimeouts.delete(toastId);
        }
        addToRemoveQueue(toastId)
      } else { // Dismiss all
        state.toasts.forEach((toast) => {
          if (toastDismissTimeouts.has(toast.id)) {
            clearTimeout(toastDismissTimeouts.get(toast.id));
            toastDismissTimeouts.delete(toast.id);
          }
          addToRemoveQueue(toast.id)
        })
      }

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined
            ? {
                ...t,
                open: false,
              }
            : t
        ),
      }
    }
    case "REMOVE_TOAST":
      if (action.toastId === undefined) {
        return {
          ...state,
          toasts: [],
        }
      }
      return {
        ...state,
        toasts: state.toasts.filter((t) => t.id !== action.toastId),
      }
  }
}

/** Array of listener functions for state changes */
const listeners: Array<(state: State) => void> = []

/** Global memory state for toasts */
let memoryState: State = { toasts: [] }

/**
 * Dispatches an action to update the toast state
 * @param action - Action to dispatch
 */
function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  listeners.forEach((listener) => {
    listener(memoryState)
  })
}

/** Toast configuration type without the auto-generated ID */
type Toast = Omit<ToasterToast, "id"> & { duration?: number }

/**
 * Creates and displays a new toast
 * @param props - Toast configuration options
 * @returns Object with toast ID and control methods
 */
function toast({ ...props }: Toast) {
  const id = genId()

  const update = (toastProps: ToasterToast) =>
    dispatch({
      type: "UPDATE_TOAST",
      toast: { ...toastProps, id },
    })
  const dismiss = () => dispatch({ type: "DISMISS_TOAST", toastId: id })

  dispatch({
    type: "ADD_TOAST",
    toast: {
      ...props,
      id,
      open: true,
      onOpenChange: (open) => {
        if (!open) dismiss()
      },
    },
  })

  // Auto-dismiss logic
  const autoDismissDuration = props.duration || 3000; // Default 3 seconds
  if (toastDismissTimeouts.has(id)) { // Clear any existing dismiss timeout for this ID
      clearTimeout(toastDismissTimeouts.get(id));
  }
  const dismissTimeoutId = setTimeout(() => {
    dismiss();
    toastDismissTimeouts.delete(id);
  }, autoDismissDuration);
  toastDismissTimeouts.set(id, dismissTimeoutId);


  return {
    id: id,
    dismiss,
    update,
  }
}

/**
 * Custom hook for managing toasts in the application
 * Provides access to the current toast state and methods to show/dismiss toasts
 * @returns Object containing toast state and control methods
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const index = listeners.indexOf(setState)
      if (index > -1) {
        listeners.splice(index, 1)
      }
    }
  }, [state])

  return {
    ...state,
    /** Function to create and show a new toast */
    toast,
    /** Function to dismiss a toast by ID, or all toasts if no ID provided */
    dismiss: (toastId?: string) => dispatch({ type: "DISMISS_TOAST", toastId }),
  }
}

export { useToast, toast }

