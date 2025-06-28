"use client";

import type { User } from '@/types';
import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { createClient as createBrowserClient } from '@/lib/supabase/client';
import type { AuthChangeEvent, Session, User as SupabaseUser } from '@supabase/supabase-js';
import { 
  getAllUsers as serverGetAllUsers, 
  deleteUserByAdmin as serverDeleteUserByAdmin 
} from '@/actions/admin'; 
import { logger } from '@/lib/logger';
import { updateUserProfileAndRevalidate } from '@/actions/user';
import { useRouter } from 'next/navigation'; 

/**
 * @fileoverview Authentication Provider for managing user authentication state and operations
 * 
 * This module provides a comprehensive authentication context for the application,
 * handling user login, logout, registration, profile updates, and admin operations.
 * It integrates with Supabase for authentication and user management.
 * 
 * @author Studio Team
 * @version 1.0.0
 */

/** Context identifier for logging purposes */
const AUTH_PROVIDER_CONTEXT = "AuthProvider";

/**
 * Authentication context type definition
 * 
 * Provides all authentication and user management functionality including:
 * - User authentication (login/logout/register)
 * - Profile management and updates
 * - Admin operations for user management
 * - Real-time authentication state management
 * 
 * @interface AuthContextType
 */
interface AuthContextType {
  /** Current authenticated user data, null if not logged in */
  currentUser: User | null;
  
  /** Whether current user has admin privileges */
  isAdmin: boolean;
  
  /** 
   * Authenticates user with email and password
   * @param email - User's email address
   * @param password - User's password (optional for OAuth flows)
   * @returns Promise with authentication result
   */
  login: (email: string, password?: string) => Promise<{ error: any | null; user: User | null }>;
  
  /** 
   * Logs out the current user
   * @returns Promise with logout result
   */
  logout: () => Promise<{ error: any | null }>;
  
  /** 
   * Registers a new user account
   * @param name - User's display name
   * @param email - User's email address
   * @param password - User's password (optional for OAuth flows)
   * @param avatarUrl - User's avatar URL (optional)
   * @returns Promise with registration result
   */
  register: (name: string, email: string, password?: string, avatarUrl?: string) => Promise<{ error: any | null; user: User | null }>;
  
  /** Loading state for authentication operations */
  loading: boolean;
  
  /** 
   * Updates current user's profile data
   * @param updatedData - Partial user data to update
   * @returns Promise with update result
   */
  updateCurrentUserData: (updatedData: Partial<Pick<User, 'name' | 'avatarUrl' | 'starredSubmissions' | 'updated_at'>>) => Promise<{error: any | null; user: User | null}>;
  
  /** 
   * Retrieves all users (admin only)
   * @returns Promise with users data or error
   */
  getAllUsers: () => Promise<{ data?: User[]; error?: string }>;
  
  /** 
   * Adds a new user via admin privileges
   * @param formData - Form data containing user information
   * @returns Promise with new user data or error
   */
  addUserByAdmin: (formData: FormData) => Promise<{data?: User; error?: string}>;
  
  /** 
   * Updates an existing user via admin privileges
   * @param formData - Form data containing updated user information
   * @returns Promise with updated user data or error
   */
  updateUserByAdmin: (formData: FormData) => Promise<{data?: User; error?: string}>;
  
  /** 
   * Deletes a user via admin privileges
   * @param userId - ID of the user to delete
   * @returns Promise with deletion result
   */
  deleteUserByAdmin: (userId: string) => Promise<{success?: boolean; error?: string}>;
}

/** Authentication context instance */
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Authentication Provider Component
 * 
 * Manages the entire authentication lifecycle for the application including:
 * - User session management with Supabase
 * - Real-time authentication state synchronization
 * - Profile data fetching and caching
 * - Authentication event handling
 * - Admin operations delegation
 * 
 * This component wraps the application tree and provides authentication
 * context to all child components through React Context API.
 * 
 * @component
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components to wrap with authentication context
 * @returns {JSX.Element} JSX element providing authentication context to children
 * 
 * @example
 * ```tsx
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const supabase = createBrowserClient();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter(); 

  /**
   * Fetches user profile data from the database
   * 
   * This function retrieves the complete user profile from the profiles table
   * and creates a fallback profile if the database profile is not found.
   * It handles various edge cases including:
   * - Missing profiles for new users
   * - RLS (Row Level Security) access restrictions
   * - Database connection errors
   * - Inconsistent user metadata
   * 
   * @param {SupabaseUser} supabaseUser - Supabase user object from authentication
   * @returns {Promise<User | null>} Promise resolving to User profile data or null if failed
   * 
   * @example
   * ```tsx
   * const profile = await fetchUserProfile(supabaseUser);
   * if (profile) {
   *   setCurrentUser(profile);
   * }
   * ```
   */
  const fetchUserProfile = useCallback(async (supabaseUser: SupabaseUser): Promise<User | null> => {
    logger.info(AUTH_PROVIDER_CONTEXT, `fetchUserProfile: Starting profile retrieval for user ID: ${supabaseUser.id}.`);
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, email, name, avatar_url, score, role, starred_submissions, updated_at')
      .eq('id', supabaseUser.id)
      .single(); 

    if (error) {
      if (error.code === 'PGRST116') { 
        logger.warn(AUTH_PROVIDER_CONTEXT, `fetchUserProfile: Profile not found for user ID ${supabaseUser.id} (PGRST116). This can be normal for new users or if RLS prevents access.`);
      } else {
        logger.error(AUTH_PROVIDER_CONTEXT, `fetchUserProfile: Profile retrieval error. Code: ${error.code}, Message: ${error.message}`);
      }
      
      const fallbackProfile: User = {
          id: supabaseUser.id,
          email: supabaseUser.email!,
          name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'New User',
          role: 'user' as 'user' | 'admin', 
          score: 0,
          avatarUrl: supabaseUser.user_metadata?.avatar_url || undefined, 
          starredSubmissions: [],
          updated_at: supabaseUser.updated_at || new Date().toISOString(),
      };
      logger.info(AUTH_PROVIDER_CONTEXT, `fetchUserProfile: Completed for user ID: ${supabaseUser.id} (error or not found, returning fallback profile)`);
      return fallbackProfile;
    }

    if (!profile) { 
        logger.warn(AUTH_PROVIDER_CONTEXT, `fetchUserProfile: Profile not found for user ${supabaseUser.id}. Supabase user email: ${supabaseUser.email}.`);
        const fallbackProfile: User = {
            id: supabaseUser.id,
            email: supabaseUser.email!,
            name: supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'New User',
            role: 'user' as 'user' | 'admin',
            score: 0,
            avatarUrl: supabaseUser.user_metadata?.avatar_url || undefined,
            starredSubmissions: [],
            updated_at: supabaseUser.updated_at || new Date().toISOString(),
        };
        logger.info(AUTH_PROVIDER_CONTEXT, `fetchUserProfile: Completed for user ID: ${supabaseUser.id} (profile explicitly null, returning fallback profile)`);
        return fallbackProfile;
    }

    logger.info(AUTH_PROVIDER_CONTEXT, `fetchUserProfile: Role from DB for user ${profile.id}: '${profile.role}'`);

    const userProfileObject: User = {
      id: profile.id,
      name: profile.name || supabaseUser.user_metadata?.name || supabaseUser.email?.split('@')[0] || 'User',
      email: profile.email || supabaseUser.email!, 
      role: profile.role as ('user' | 'admin'),
      score: profile.score || 0,
      avatarUrl: profile.avatar_url || undefined,
      starredSubmissions: profile.starred_submissions || [],
      updated_at: profile.updated_at || supabaseUser.updated_at || new Date().toISOString(),
    };
    logger.info(AUTH_PROVIDER_CONTEXT, `fetchUserProfile: Completed for user ID: ${supabaseUser.id} (profile successfully processed)`);
    return userProfileObject;
  }, [supabase]);

  /**
   * Authentication state change effect
   * 
   * Sets up a listener for Supabase authentication state changes and manages
   * the component's authentication state accordingly. This effect:
   * - Listens for login, logout, and session refresh events
   * - Fetches user profile data when a user logs in
   * - Updates local state (currentUser, isAdmin) based on auth changes
   * - Handles component unmounting to prevent memory leaks
   * - Manages loading states during authentication operations
   * 
   * The effect uses a mounted flag to prevent state updates after component unmounting,
   * which can occur during rapid navigation or authentication state changes.
   * 
   * @effect
   * @dependencies [supabase, fetchUserProfile]
   */
  useEffect(() => {
    logger.info(AUTH_PROVIDER_CONTEXT, 'useEffect (onAuthStateChange): Setting up onAuthStateChange listener.');
    setLoading(true);
    let mounted = true;

    // Timeout fallback to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (mounted) {
        logger.warn(AUTH_PROVIDER_CONTEXT, 'useEffect: Authentication initialization timeout after 5 seconds, stopping loading state.');
        setLoading(false);
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;
        logger.info(AUTH_PROVIDER_CONTEXT, `onAuthStateChange event: ${event}`);
        
        if (session) {
          const userProfile = await fetchUserProfile(session.user);
          setCurrentUser(userProfile);
          setIsAdmin(userProfile?.role === 'admin');
        } else {
          setCurrentUser(null);
          setIsAdmin(false);
        }
        
        setLoading(false);
        clearTimeout(timeoutId);
      }
    );

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription?.unsubscribe();
    };
  }, [supabase, fetchUserProfile]);

  /**
   * Authenticates a user with email and password
   * @param email - User's email address
   * @param password - User's password (optional for OAuth flows)
   * @returns Promise containing error (if any) and user profile data
   */
  const login = useCallback(async (email: string, password?: string) => {
    logger.info(AUTH_PROVIDER_CONTEXT, 'login: Login attempt for email:', email);
    
    // Ensure any previous session is cleared before a new login attempt
    await supabase.auth.signOut();
    logger.info(AUTH_PROVIDER_CONTEXT, 'login: Cleared any existing session before new login.');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password: password! });
    if (error) {
      logger.error(AUTH_PROVIDER_CONTEXT, 'login: Login error:', error.message);
      return { error, user: null };
    }
    if (data.user) {
      logger.info(AUTH_PROVIDER_CONTEXT, 'login: Supabase login successful for user ID:', data.user.id);
      const userProfile = await fetchUserProfile(data.user);
      return { error: null, user: userProfile };
    }
    logger.warn(AUTH_PROVIDER_CONTEXT, 'login: Login failed, no user data returned from Supabase.');
    return { error: { message: "Login failed, no user data." }, user: null };
  }, [supabase, fetchUserProfile]);

  /**
   * Logs out the current user
   * @returns Promise containing error (if any)
   */
  const logout = useCallback(async () => {
    logger.info(AUTH_PROVIDER_CONTEXT, 'logout: Logout called.');
    const { error } = await supabase.auth.signOut();
    if (error) logger.error(AUTH_PROVIDER_CONTEXT, 'logout: Logout error:', error.message);
    else logger.info(AUTH_PROVIDER_CONTEXT, "logout: User logged out.");
    return { error };
  }, [supabase]);

  /**
   * Registers a new user account
   * @param name - User's display name
   * @param email - User's email address
   * @param password - User's password (optional for OAuth flows)
   * @param avatarUrl - User's avatar URL (optional)
   * @returns Promise containing error (if any) and user profile data
   */
  const register = useCallback(async (name: string, email: string, password?: string, avatarUrl?: string) => {
    logger.info(AUTH_PROVIDER_CONTEXT, 'register: Registration attempt for email:', email, 'with avatarUrl:', avatarUrl ? 'present' : 'absent');
    
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password: password!,
      options: {
        data: { 
          name: name, 
          avatar_url: avatarUrl, 
        },
      },
    });
    
    if (signUpError) {
      logger.error(AUTH_PROVIDER_CONTEXT, 'register: Registration error:', signUpError.message);
      return { error: signUpError, user: null };
    }
    
    if (signUpData.user) {
        logger.info(AUTH_PROVIDER_CONTEXT, "register: Supabase user created via signUp:", signUpData.user.id, signUpData.user.email);
        return { error: null, user: null }; 
    }

    logger.warn(AUTH_PROVIDER_CONTEXT, 'register: Registration failed, no user data returned from Supabase signUp.');
    return { error: { message: "Registration failed, no user data from Supabase." }, user: null };
  }, [supabase]);

  /**
   * Updates the current user's profile data
   * Handles both profile changes (name, avatar) and starred submissions
   * @param updatedData - Partial user data to update
   * @returns Promise containing error (if any) and updated user profile data
   */
  const updateCurrentUserData = useCallback(async (updatedData: Partial<Pick<User, 'name' | 'avatarUrl' | 'starredSubmissions' | 'updated_at'>>) => {
    if (!currentUser) {
      logger.warn(AUTH_PROVIDER_CONTEXT, 'updateCurrentUserData: Called but no current user.');
      return { error: {message: "No current user to update"}, user: null };
    }
    logger.info(AUTH_PROVIDER_CONTEXT, 'updateCurrentUserData: Called for user ID:', currentUser.id, 'with data:', updatedData);

    const serverActionUpdates: { name?: string; avatarUrl?: string | null } = {};
    let hasProfileChangesForServer = false;

    if (updatedData.name !== undefined && updatedData.name !== currentUser.name) {
      serverActionUpdates.name = updatedData.name;
      hasProfileChangesForServer = true;
    }
    if (updatedData.avatarUrl !== undefined && updatedData.avatarUrl !== currentUser.avatarUrl) {
      serverActionUpdates.avatarUrl = updatedData.avatarUrl;
      hasProfileChangesForServer = true;
    }
    
    let serverResult;
    if (hasProfileChangesForServer) {
      logger.info(AUTH_PROVIDER_CONTEXT, 'updateCurrentUserData: Calling server action to update profile data:', serverActionUpdates);
      serverResult = await updateUserProfileAndRevalidate(currentUser.id, serverActionUpdates);
      
      if (serverResult.error || !serverResult.data) {
        logger.error(AUTH_PROVIDER_CONTEXT, "updateCurrentUserData: Error from server action updateUserProfileAndRevalidate:", serverResult.error);
        return { error: { message: serverResult.error || "Failed to update profile via server action." }, user: null };
      }
      logger.info(AUTH_PROVIDER_CONTEXT, "updateCurrentUserData: Profile data updated via server action. New data from server:", serverResult.data);
      
      // Directly update currentUser with the fresh data from the server action
      setCurrentUser(serverResult.data);
      setIsAdmin(serverResult.data.role === 'admin');
      logger.info(AUTH_PROVIDER_CONTEXT, 'updateCurrentUserData: currentUser state updated with serverResult.data.');
      
      router.refresh();
      logger.info(AUTH_PROVIDER_CONTEXT, "updateCurrentUserData: router.refresh() called after successful profile update.");
    }

    if (updatedData.starredSubmissions !== undefined) {
        // Use the potentially updated currentUser from serverResult.data or fallback to the existing currentUser
        const baseProfileForStarUpdate = serverResult?.data || currentUser;
        const currentStarred = baseProfileForStarUpdate.starredSubmissions || [];

        if (JSON.stringify(updatedData.starredSubmissions) !== JSON.stringify(currentStarred)) {
            const { error: starUpdateError } = await supabase
                .from('profiles')
                .update({ starred_submissions: updatedData.starredSubmissions })
                .eq('id', currentUser.id); // Use currentUser.id for the DB update
            if (starUpdateError) {
                logger.error(AUTH_PROVIDER_CONTEXT, "updateCurrentUserData: Error updating starred_submissions in profiles table:", starUpdateError.message);
            } else {
                logger.info(AUTH_PROVIDER_CONTEXT, "updateCurrentUserData: starred_submissions updated in profiles table.");
                // Update the local currentUser state with the new starred submissions
                setCurrentUser(prevUser => prevUser ? ({ ...prevUser, starredSubmissions: updatedData.starredSubmissions }) : null);
            }
        }
    }
    
    // Fetch the final state of the profile to ensure full consistency, especially if only starredSubmissions changed
    // or to confirm the state after server action + router.refresh() has settled.
    // Get the current Supabase user to pass to fetchUserProfile
    const { data: { user: supabaseUser } } = await supabase.auth.getUser();
    if (!supabaseUser) {
      logger.error(AUTH_PROVIDER_CONTEXT, 'updateCurrentUserData: No Supabase user found for final refresh.');
      return { error: { message: "No authenticated user found." }, user: serverResult?.data || currentUser };
    }
    
    const finalRefreshedProfile = await fetchUserProfile(supabaseUser);

    if (finalRefreshedProfile) {
        setCurrentUser(finalRefreshedProfile);
        setIsAdmin(finalRefreshedProfile.role === 'admin');
        logger.info(AUTH_PROVIDER_CONTEXT, 'updateCurrentUserData: currentUser state updated with final refreshed profile.');
        return { error: null, user: finalRefreshedProfile };
    } else {
        logger.error(AUTH_PROVIDER_CONTEXT, 'updateCurrentUserData: Failed to fetch final refreshed profile.');
        // Return the most recent version of currentUser we have
        return { error: { message: "Failed to refresh user data after update." }, user: serverResult?.data || currentUser }; 
    }
  }, [supabase, currentUser, fetchUserProfile, router]);

  /**
   * Retrieves all users from the system (admin only)
   * @returns Promise containing user data array or error message
   */
  const getAllUsers = useCallback(async () => {
    logger.info(AUTH_PROVIDER_CONTEXT, 'getAllUsers: Called (will call server action).');
    return serverGetAllUsers();
  }, []);

  /**
   * Adds a new user via admin privileges
   * @param formData - Form data containing user information
   * @returns Promise containing new user data or error message
   */
  const addUserByAdmin = useCallback(async (formData: FormData) => {
    logger.info(AUTH_PROVIDER_CONTEXT, 'addUserByAdmin: Called with FormData (will call server action).');
    const { addUserByAdmin: serverActionAddUserByAdmin } = await import('@/actions/admin');
    return serverActionAddUserByAdmin(formData);
  }, []);

  /**
   * Updates an existing user via admin privileges
   * @param formData - Form data containing updated user information
   * @returns Promise containing updated user data or error message
   */
  const updateUserByAdmin = useCallback(async (formData: FormData) => {
    logger.info(AUTH_PROVIDER_CONTEXT, 'updateUserByAdmin: Called with FormData (will call server action).');
     const { updateUserByAdmin: serverActionUpdateUserByAdmin } = await import('@/actions/admin');
    return serverActionUpdateUserByAdmin(formData);
  }, []);

  /**
   * Deletes a user via admin privileges
   * @param userId - ID of the user to delete
   * @returns Promise containing success status or error message
   */
  const deleteUserByAdmin = useCallback(async (userId: string) => {
    logger.info(AUTH_PROVIDER_CONTEXT, 'deleteUserByAdmin: Called for user ID:', userId, '(will call server action).');
    return serverDeleteUserByAdmin(userId);
  }, []);

  /**
   * Provider value object containing all authentication context data and methods
   * 
   * This object is provided to all child components through React Context
   * and contains the complete authentication API for the application.
   * 
   * @returns {AuthContextType} Complete authentication context value
   */
  return (
    <AuthContext.Provider value={{ 
      currentUser, 
      isAdmin, 
      login, 
      logout, 
      register, 
      loading, 
      updateCurrentUserData,
      getAllUsers,
      addUserByAdmin,
      updateUserByAdmin,
      deleteUserByAdmin
    }}>
      {children}
    </AuthContext.Provider>
  );
};


    