"use client";

import { useEffect } from 'react';

/**
 * ClientSecurityInitializer component - Initializes client-side security measures
 * Implements various security protections including:
 * - Console disabling in production
 * - eval() and Function constructor overrides
 * - Clickjacking protection
 * - DOM injection monitoring
 * This component renders nothing but sets up security measures on mount
 * @returns null - This component doesn't render any visible content
 */
export function ClientSecurityInitializer() {
  useEffect(() => {
    // Basic client-side security measures
    if (process.env.NODE_ENV === 'production') {
      // Disable console in production
      Object.keys(console).forEach(key => {
        if (typeof (console as any)[key] === 'function') {
          (console as any)[key] = () => {};
        }
      });

      // Override eval to prevent code injection
      (window as any).eval = () => {
        throw new Error('eval is disabled for security reasons');
      };

      // Override Function constructor
      (window as any).Function = () => {
        throw new Error('Function constructor is disabled for security reasons');
      };
    }

    // Check if page is being framed (clickjacking protection)
    if (window !== window.top) {
      try {
        window.top!.location.href = window.location.href;
      } catch (e) {
        document.body.style.display = 'none';
      }
    }

    // Monitor for suspicious DOM changes
    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as Element;
            
            // Check for suspicious script additions
            if (element.tagName === 'SCRIPT') {
              console.warn('Suspicious script injection detected');
              element.remove();
            }

            // Check for suspicious attributes
            const suspiciousAttributes = ['onload', 'onerror', 'onclick', 'onmouseover'];
            suspiciousAttributes.forEach(attr => {
              if (element.hasAttribute(attr)) {
                console.warn(`Suspicious ${attr} attribute detected`);
                element.removeAttribute(attr);
              }
            });
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur']
    });

    // Cleanup on unmount
    return () => {
      observer.disconnect();
    };
  }, []);

  // This component doesn't render anything visible
  return null;
}