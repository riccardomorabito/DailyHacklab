"use client";

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, LogIn, UserCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

/**
 * AuthButton component.
 * Displays a login button if the user is not authenticated,
 * or user information and a logout button if the user is authenticated.
 * Handles the logout process.
 * @returns {JSX.Element} The authentication button or user info display.
 */
export default function AuthButton() {
  const { currentUser, logout, loading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  /**
   * Handles the user logout process.
   * Calls the logout method from AuthContext, displays a toast message,
   * and redirects to the login page.
   */
  const handleLogout = async () => {
    const { error } = await logout();
    if (error) {
      toast({ title: "Logout Error", description: error.message, variant: "destructive"});
    } else {
      toast({ title: "Logged Out", description: "See you soon!"});
      router.push('/login'); // Redirect to login page after logout
      router.refresh(); // Force refresh to update layout/server components if needed
    }
  };

  // Display loading state
  if (loading) {
    return <Button variant="ghost" size="sm" disabled>Loading...</Button>;
  }

  // Display user info and logout button if authenticated
  if (currentUser) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm hidden sm:inline">{currentUser.name}</span>
        <UserCircle className="h-5 w-5 sm:hidden" /> {/* Icon for smaller screens */}
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="mr-1 h-4 w-4" /> Logout
        </Button>
      </div>
    );
  }

  // Display login button if not authenticated
  return (
    <Link href="/login" passHref>
      <Button variant="ghost" size="sm">
        <LogIn className="mr-1 h-4 w-4" /> Login
      </Button>
    </Link>
  );
}
