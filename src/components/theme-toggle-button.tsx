"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/contexts/theme-provider"; 
import { JSX } from "react";

/**
 * ThemeToggleButton component.
 * Allows users to toggle between light and dark themes.
 * Displays a sun icon for light theme and a moon icon for dark theme.
 * @returns {JSX.Element} The theme toggle button.
 */
export function ThemeToggleButton(): JSX.Element {
  const { theme, toggleTheme, isThemeMounted } = useTheme();

  // Display a disabled button while theme is mounting to prevent hydration issues
  if (!isThemeMounted) {
    return (
        <Button variant="outline" size="icon" disabled aria-label="Toggle theme (loading)">
            <Sun className="h-[1.2rem] w-[1.2rem]" /> {/* Default to Sun icon during loading */}
        </Button>
    );
  }

  // Display the appropriate icon based on the current theme
  return (
    <Button variant="outline" size="icon" onClick={toggleTheme} aria-label="Toggle theme">
      {theme === "light" ? <Sun className="h-[1.2rem] w-[1.2rem]" /> : <Moon className="h-[1.2rem] w-[1.2rem]" />}
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
