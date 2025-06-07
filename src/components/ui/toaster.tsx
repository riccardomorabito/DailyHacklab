
"use client"

import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useEffect, useState } from "react"; // Import useEffect and useState

export function Toaster() {
  const { toasts } = useToast()
  const [isClient, setIsClient] = useState(false); // New state for client-side rendering

  useEffect(() => {
    setIsClient(true); // Set to true after component mounts on client
  }, []);

  return (
    <ToastProvider>
      {isClient && toasts.map(function ({ id, title, description, action, ...props }) { // Only map toasts if isClient is true
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && (
                <ToastDescription>{description}</ToastDescription>
              )}
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
