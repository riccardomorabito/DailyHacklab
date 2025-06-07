"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

type Theme = "light" | "dark" | "system";

/**
 * Defines the shape of the ThemeProvider state.
 */
interface ThemeProviderState {
  theme: Theme; // The user's selected theme preference ("light", "dark", or "system")
  appliedTheme: "light" | "dark"; // The actual theme being applied (resolved from "system" if chosen)
  toggleTheme: () => void; // Simple toggle between light/dark, overrides "system" preference
  setTheme: (theme: Theme) => void; // Function to set a specific theme preference
  isThemeMounted: boolean; // Flag indicating if the theme provider has mounted and loaded initial theme
}

// Default state for the ThemeProvider
const defaultState: ThemeProviderState = {
  theme: "system", 
  appliedTheme: "light", // Default applied theme before hydration, will be updated
  toggleTheme: () => console.warn("ThemeProvider not mounted"),
  setTheme: () => console.warn("ThemeProvider not mounted"),
  isThemeMounted: false,
};

const ThemeProviderContext = createContext<ThemeProviderState>(defaultState);

/**
 * ThemeProvider component.
 * Manages the application's theme (light, dark, system preference).
 * Persists theme preference to localStorage and applies theme to the document.
 * @param {object} props - The component props.
 * @param {ReactNode} props.children - The child components that will have access to the theme context.
 * @param {string} [props.storageKey="app-theme"] - The localStorage key for storing theme preference.
 * @returns {JSX.Element} The ThemeProvider wrapping its children.
 */
export function ThemeProvider({
  children,
  storageKey = "app-theme", // Default localStorage key
}: {
  children: ReactNode;
  storageKey?: string;
}) {
  const [theme, setThemeState] = useState<Theme>(defaultState.theme); // User's selected preference
  const [appliedTheme, setAppliedThemeState] = useState<"light" | "dark">(defaultState.appliedTheme); // Actual theme applied
  const [isMounted, setIsMounted] = useState(false); // Tracks if component has mounted client-side

  /**
   * Applies the theme preference to the document and updates appliedTheme state.
   * @param {Theme} pref - The theme preference ("light", "dark", or "system").
   */
  const applyThemePreference = useCallback((pref: Theme) => {
    let currentAppliedTheme: "light" | "dark";
    if (typeof window === 'undefined') { // Ensure window is defined (client-side)
        currentAppliedTheme = 'light'; // Default server-side or before mount
    } else if (pref === "system") {
      // Determine actual theme based on system preference
      currentAppliedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light";
    } else {
      currentAppliedTheme = pref; // Directly use "light" or "dark"
    }
    
    setAppliedThemeState(currentAppliedTheme); // Update state with the resolved theme
    // Apply theme class to the document's root element
    if (typeof window !== 'undefined') {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark"); // Remove previous theme classes
        root.classList.add(currentAppliedTheme); // Add the new theme class
    }
  }, []);

  // Effect to load stored theme preference on initial mount
  useEffect(() => {
    const storedTheme = typeof window !== 'undefined' ? localStorage.getItem(storageKey) as Theme | null : null;
    const initialTheme = storedTheme && ["light", "dark", "system"].includes(storedTheme) ? storedTheme : "system";
    setThemeState(initialTheme);
    // Theme application logic that depends on window object is handled in the next useEffect
    setIsMounted(true); // Mark as mounted
  }, [storageKey]);

  // Effect to apply theme and listen for system changes
  useEffect(() => {
    if (!isMounted || typeof window === 'undefined') return; // Run only client-side after mount

    applyThemePreference(theme); // Apply the current theme (loaded or default)
    localStorage.setItem(storageKey, theme); // Persist theme preference

    // If "system" theme is selected, listen for changes in system preference
    if (theme === "system") {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyThemePreference("system"); // Re-apply if system preference changes
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange); // Cleanup listener
    }
  }, [theme, storageKey, isMounted, applyThemePreference]);

  /**
   * Toggles the theme between "light" and "dark", effectively overriding "system" preference.
   */
  const toggleTheme = () => {
    if (!isMounted) return;
    setThemeState((prevTheme) => {
      // Determine the current actual theme if "system" was selected
      const currentActualTheme = prevTheme === "system" && typeof window !== 'undefined'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? "dark" : "light")
        : prevTheme; // If not system, or window undefined, use prevTheme as is
      
      return currentActualTheme === "light" ? "dark" : "light"; // Toggle
    });
  };

  /**
   * Sets the theme preference to a specific value ("light", "dark", or "system").
   * @param {Theme} newTheme - The new theme preference.
   */
  const setTheme = (newTheme: Theme) => {
    if (!isMounted) return;
    setThemeState(newTheme);
  };
  
  // Context value
  const value = {
    theme,
    appliedTheme, 
    toggleTheme,
    setTheme,
    isThemeMounted: isMounted,
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

/**
 * Custom hook to access the ThemeProvider context.
 * @returns {ThemeProviderState} The theme provider state and functions.
 */
export const useTheme = (): ThemeProviderState => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
