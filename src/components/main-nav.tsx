"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/contexts/theme-provider';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Menu, Home, UploadCloud, ListChecks, BarChart2, Server as ServerIcon, ShieldCheck, LogIn, LogOut, Cog, Sun, Moon, CalendarDays, Sparkles, Settings as SettingsIcon, Users } from 'lucide-react';
import Image from 'next/image';
import React from 'react';

/**
 * Interface for navigation link items.
 */
interface NavLinkItem {
  href: string;
  label: string;
  icon: React.ElementType; // Lucide icon component
  requiresAuth: boolean;
  requiresAdmin: boolean;
  isSubItem?: boolean; // For potential future nested menus
}

// Definition of all navigation links
const navLinksDefinition: NavLinkItem[] = [
  { href: '/', label: 'Home', icon: Home, requiresAuth: false, requiresAdmin: false, isSubItem: false },
  { href: '/submit', label: 'Publish Clip', icon: UploadCloud, requiresAuth: true, requiresAdmin: false, isSubItem: false },
  { href: '/posts', label: 'Posts', icon: CalendarDays, requiresAuth: true, requiresAdmin: false, isSubItem: false },
  { href: '/events', label: 'Events', icon: Sparkles, requiresAuth: true, requiresAdmin: false, isSubItem: false },
  { href: '/leaderboard', label: 'Leaderboard', icon: BarChart2, requiresAuth: false, requiresAdmin: false, isSubItem: false },
  { href: '/server-farm', label: 'My Datacenter', icon: ServerIcon, requiresAuth: true, requiresAdmin: false, isSubItem: false },
  { href: '/admin', label: 'Main Control', icon: ShieldCheck, requiresAuth: true, requiresAdmin: true, isSubItem: false },
  { href: '/admin/events', label: 'Manage Events', icon: Sparkles, requiresAuth: true, requiresAdmin: true, isSubItem: false },
  { href: '/admin/user-management', label: 'User Management', icon: Users, requiresAuth: true, requiresAdmin: true, isSubItem: false },
  { href: '/admin/app-settings', label: 'App Settings', icon: SettingsIcon, requiresAuth: true, requiresAdmin: true, isSubItem: false },
];

/**
 * MainNav component.
 * Provides the main navigation for the application, typically rendered as a side sheet (mobile menu).
 * Filters links based on authentication and admin status, and includes theme toggle and auth actions.
 * @returns {JSX.Element} The main navigation component.
 */
export default function MainNav() {
  const pathname = usePathname();
  const { currentUser, isAdmin, loading: authLoading, logout } = useAuth();
  const { appliedTheme, toggleTheme, isThemeMounted } = useTheme();

  /**
   * Handles user logout.
   */
  const handleLogout = async () => {
    await logout();
    // Navigation redirection after logout is handled by AuthProvider or ProtectedRoute.
  };

  /**
   * Toggles the application theme.
   */
  const toggleThemeHandler = () => {
    if (isThemeMounted) {
      toggleTheme();
    }
  };

  // Filter links based on auth status, admin status, and sort admin links
  const filteredLinks = navLinksDefinition.filter(link => {
    if (authLoading && (link.requiresAuth || link.requiresAdmin)) return false;
    if (link.requiresAuth && !currentUser) return false;
    if (link.requiresAdmin && !isAdmin) return false;
    return true;
  }).sort((a, b) => {
    // Custom sort for admin links: /admin first, then specific sub-routes
    if (a.href === '/admin' && b.href.startsWith('/admin/')) return -1;
    if (b.href === '/admin' && a.href.startsWith('/admin/')) return 1;
    if (a.href.startsWith('/admin/') && b.href.startsWith('/admin/')) {
      const order = ['/admin/events', '/admin/user-management', '/admin/app-settings'];
      const aIndex = order.indexOf(a.href);
      const bIndex = order.indexOf(b.href);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1; // Known admin sub-route comes before unknown
      if (bIndex !== -1) return 1;  // Unknown admin sub-route comes after known
    }
    return 0; // Default sort order (based on definition)
  });

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="ml-auto" aria-label="Open menu">
          <Menu className="h-6 w-6" />
          <span className="sr-only">Open menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[300px] p-0 flex flex-col bg-background">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="text-left text-xl font-headline flex items-center pr-8">
            <Image
              src="/images/logos/logo-icon.png"
              alt="Daily Hacklab Logo"
              width={24}
              height={24}
              className="mr-2 rounded-sm"
            />
            Daily Hacklab
          </SheetTitle>
        </SheetHeader>

        {/* Scrollable Navigation Links */}
        <ScrollArea className="flex-grow">
          <nav className="p-4 space-y-1">
            {filteredLinks.map((link) => (
              <SheetClose asChild key={link.href}>
                <Link href={link.href} passHref>
                  <Button
                    variant="ghost"
                    className={cn(
                      "justify-start w-full text-left text-base py-2.5",
                      pathname === link.href ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                      link.isSubItem && "pl-10" // Style for sub-items if any
                    )}
                    aria-current={pathname === link.href ? "page" : undefined}
                  >
                    <link.icon className="mr-3 h-5 w-5" />
                    {link.label}
                  </Button>
                </Link>
              </SheetClose>
            ))}
          </nav>
        </ScrollArea>

        {/* Footer Section of the Menu */}
        <div className="p-4 border-t mt-auto space-y-1 bg-background">
          {/* User Settings Link */}
          <SheetClose asChild>
            <Link href="/settings" passHref>
              <Button variant="ghost" className="justify-start w-full text-left text-base py-2.5 hover:bg-accent/50">
                <Cog className="mr-3 h-5 w-5" /> User Settings
              </Button>
            </Link>
          </SheetClose>

          {/* Theme Toggle Button */}
          <Button variant="ghost" onClick={toggleThemeHandler} disabled={!isThemeMounted} className="justify-start w-full text-left text-base py-2.5 hover:bg-accent/50">
            {isThemeMounted && appliedTheme === 'light' ? <Sun className="mr-3 h-5 w-5" /> : <Moon className="mr-3 h-5 w-5" />}
            {isThemeMounted ? `Theme (${appliedTheme === 'light' ? 'Light' : 'Dark'})` : 'Loading Theme...'}
          </Button>

          <Separator className="my-2 bg-border" />

          {/* Auth Status and Actions */}
          {authLoading ? (
            <Button variant="ghost" className="justify-start w-full text-left text-base py-2.5" disabled>
              <div className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-transparent border-t-primary border-l-primary"></div>
              Loading...
            </Button>
          ) : currentUser ? (
            <>
              <div className="px-3 py-2 text-sm text-muted-foreground truncate" title={currentUser.email}>
                {currentUser.name}
              </div>
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  onClick={handleLogout}
                  className="justify-start w-full text-left text-base py-2.5 text-destructive hover:bg-destructive/10 hover:text-destructive-foreground dark:hover:text-destructive"
                >
                  <LogOut className="mr-3 h-5 w-5" /> Logout
                </Button>
              </SheetClose>
            </>
          ) : (
            <SheetClose asChild>
              <Link href="/login" passHref>
                <Button variant="ghost" className="justify-start w-full text-left text-base py-2.5 hover:bg-accent/50">
                  <LogIn className="mr-3 h-5 w-5" /> Login
                </Button>
              </Link>
            </SheetClose>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
