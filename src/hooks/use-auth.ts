"use client";

import { useContext } from 'react';
import { AuthContext } from '@/contexts/auth-provider';

/**
 * Custom hook to access the authentication context.
 * Provides an easy way to get the current user, authentication status, and auth functions.
 * Throws an error if used outside of an AuthProvider.
 * @returns The authentication context value.
 * @throws {Error} If used outside of an AuthProvider.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
