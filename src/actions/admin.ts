"use server";

import { createServerSupabaseClient, createAdminClient } from '@/lib/supabase/server';
import type { User } from '@/types';
import { logger } from '@/lib/logger';
import { cleanupOldAvatarAsync } from '@/lib/avatar-utils';

/** Context identifier for logging admin-related operations */
const ADMIN_ACTIONS_CONTEXT = "AdminActions";

/**
 * Timeout wrapper utility function that prevents infinite loading states
 * @param promiseFunction - Function that returns a promise to wrap with timeout
 * @param timeoutMs - Timeout in milliseconds (default: 12000ms = 12 seconds)
 * @returns Promise that either resolves with the original result or rejects with timeout error
 */
function withTimeout<T>(promiseFunction: () => Promise<T>, timeoutMs: number = 8000): Promise<T> {
  return Promise.race([
    promiseFunction(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timed out after 8 seconds')), timeoutMs)
    )
  ]);
}

/**
 * Retrieves all user profiles.
 * This action requires the calling user to be an admin.
 * @returns {Promise<{ data?: User[]; error?: string }>} A promise that resolves to an object containing an array of users or an error message.
 */
export async function getAllUsers(): Promise<{ data?: User[]; error?: string }> {
  logger.info(ADMIN_ACTIONS_CONTEXT, "getAllUsers: Starting retrieval of all users.");
  
  // Wrap the entire function execution with timeout
  return withTimeout(async () => {
    const supabase = await createServerSupabaseClient();

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError) {
        logger.error(ADMIN_ACTIONS_CONTEXT, "getAllUsers: Authentication error", authError.message);
        return { error: `Authentication error: ${authError.message}`};
    }
    if (!authUser) {
      logger.warn(ADMIN_ACTIONS_CONTEXT, "getAllUsers: Authentication required, no user found.");
      return { error: 'Authentication required' };
    }
    logger.info(ADMIN_ACTIONS_CONTEXT, `getAllUsers: Authenticated user ID: ${authUser.id}`);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', authUser.id)
      .single();

    if (profileError || !profile) {
      logger.error(ADMIN_ACTIONS_CONTEXT, "getAllUsers: Error retrieving admin profile or profile not found.", profileError?.message);
      return { error: `Error retrieving admin profile: ${profileError?.message || 'Profile not found'}` };
    }
     if (profile.role !== 'admin') {
      logger.warn(ADMIN_ACTIONS_CONTEXT, `getAllUsers: User ${authUser.id} is not admin, role: ${profile.role}`);
      return { error: 'Administrator privileges required' };
    }

    logger.info(ADMIN_ACTIONS_CONTEXT, "getAllUsers: Admin verified. Retrieving all profiles.");
    
    // Use admin client for getAllUsers since this is an admin-only function
    let supabaseAdmin;
    try {
      supabaseAdmin = createAdminClient();
    } catch (e: any) {
      logger.error(ADMIN_ACTIONS_CONTEXT, "getAllUsers: Failed to create Supabase Admin Client:", e.message);
      return { error: `Server configuration error: ${e.message}. Contact support.` };
    }

    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, name, email, role, score, avatar_url, starred_submissions, updated_at');

    if (profilesError) {
      logger.error(ADMIN_ACTIONS_CONTEXT, 'getAllUsers: Error during user retrieval:', profilesError.message);
      return { error: profilesError.message };
    }

    // Transform database fields to match User interface
    const transformedProfiles: User[] = profiles.map((profile: any) => ({
      ...profile,
      avatarUrl: profile.avatar_url || undefined, // Transform avatar_url to avatarUrl
      avatar_url: undefined // Remove the original field to avoid confusion
    })).map(({ avatar_url, ...rest }: any) => rest); // Clean up the avatar_url field completely

    logger.info(ADMIN_ACTIONS_CONTEXT, `getAllUsers: Successfully retrieved ${transformedProfiles?.length || 0} users.`);
    return { data: transformedProfiles };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 8 seconds') {
      logger.error(ADMIN_ACTIONS_CONTEXT, "getAllUsers: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(ADMIN_ACTIONS_CONTEXT, "getAllUsers: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Adds a new user by an admin.
 * Creates an auth user and a corresponding profile.
 * Handles avatar upload if provided.
 * @param {FormData} formData - The form data containing user details (name, email, password, role, avatarFile).
 * @returns {Promise<{ data?: User; error?: string }>} A promise that resolves to an object containing the new user or an error message.
 */
export async function addUserByAdmin(
  formData: FormData
): Promise<{ data?: User; error?: string }> {
  logger.info(ADMIN_ACTIONS_CONTEXT, "addUserByAdmin: Starting user addition with FormData.");
  
  return withTimeout(async () => {
    const supabase = await createServerSupabaseClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    logger.warn(ADMIN_ACTIONS_CONTEXT, "addUserByAdmin: Authentication required.");
    return { error: 'Authentication required' };
  }
  logger.info(ADMIN_ACTIONS_CONTEXT, `addUserByAdmin: Authenticated admin ID: ${authUser.id}`);
  
  const { data: adminProfile, error: adminProfileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authUser.id)
    .single();

  if (adminProfileError || !adminProfile || adminProfile.role !== 'admin') {
    logger.warn(ADMIN_ACTIONS_CONTEXT, "addUserByAdmin: Administrator privileges required.");
    return { error: 'Administrator privileges required to add users.' };
  }

  const name = formData.get('name') as string;
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const role = formData.get('role') as 'user' | 'admin';
  const avatarFile = formData.get('avatarFile') as File | null;

  logger.debug(ADMIN_ACTIONS_CONTEXT, `addUserByAdmin: Received data - Name: ${name}, Email: ${email}, Role: ${role}, Avatar present: ${!!avatarFile}`);

  let avatarUrl: string | undefined = undefined;
  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (e: any) {
    logger.error(ADMIN_ACTIONS_CONTEXT, "addUserByAdmin: Failed to create Supabase Admin Client:", e.message);
    return { error: `Server configuration error: ${e.message}. Contact support.` };
  }

  if (avatarFile && avatarFile.size > 0) {
    logger.info(ADMIN_ACTIONS_CONTEXT, `addUserByAdmin: Avatar file provided: ${avatarFile.name}, size: ${avatarFile.size}`);
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `public/temp_avatar_${Date.now()}.${fileExt}`; 
    
    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(fileName, avatarFile, { upsert: true }); 

    if (uploadError) {
      logger.error(ADMIN_ACTIONS_CONTEXT, 'addUserByAdmin: Avatar upload error:', uploadError.message);
      return { error: `Avatar upload error: ${uploadError.message}` };
    } else {
      const { data: publicUrlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(fileName);
      if (publicUrlData) {
        avatarUrl = publicUrlData.publicUrl;
        logger.info(ADMIN_ACTIONS_CONTEXT, 'addUserByAdmin: Avatar uploaded successfully. Public URL:', avatarUrl);
      } else {
        logger.warn(ADMIN_ACTIONS_CONTEXT, 'addUserByAdmin: Avatar uploaded, but failed to retrieve public URL.');
      }
    }
  }
  
  const { data: newAuthUserResponse, error: signUpError } = await supabaseAdmin.auth.admin.createUser({
    email: email,
    password: password,
    email_confirm: true, 
    user_metadata: { 
      name: name,
      avatar_url: avatarUrl, 
    }
  });

  if (signUpError) {
    logger.error(ADMIN_ACTIONS_CONTEXT, 'addUserByAdmin: Error creating auth user from admin:', signUpError.message);
    return { error: signUpError.message };
  }

  if (!newAuthUserResponse || !newAuthUserResponse.user) {
    logger.error(ADMIN_ACTIONS_CONTEXT, 'addUserByAdmin: Failed to create auth user (no user object in response).');
    return { error: 'Failed to create auth user.'};
  }
  const newUserId = newAuthUserResponse.user.id;
  logger.info(ADMIN_ACTIONS_CONTEXT, `addUserByAdmin: Auth user created with ID: ${newUserId}`);

  if (role === 'admin') {
    logger.info(ADMIN_ACTIONS_CONTEXT, `addUserByAdmin: Updating role to admin for user ID: ${newUserId}`);
    const { error: roleUpdateError } = await supabaseAdmin
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', newUserId);
    
    if (roleUpdateError) {
      logger.error(ADMIN_ACTIONS_CONTEXT, `addUserByAdmin: Error updating role to admin for ${email}:`, roleUpdateError.message);
    }
  }
  
  const { data: newProfile, error: profileFetchError } = await supabaseAdmin
    .from('profiles')
    .select('id, name, email, role, score, avatar_url, starred_submissions, updated_at')
    .eq('id', newUserId)
    .single();

  if (profileFetchError) {
    logger.error(ADMIN_ACTIONS_CONTEXT, `addUserByAdmin: Error retrieving created profile for ${email}:`, profileFetchError.message);
    return { error: `Failed to retrieve created profile: ${profileFetchError.message}` };
  }

  // Transform database fields to match User interface
  const transformedProfile: User = {
    ...newProfile,
    avatarUrl: newProfile.avatar_url || undefined,
  };
  // Remove avatar_url field from the result since User interface uses avatarUrl
  delete (transformedProfile as any).avatar_url;

    logger.info(ADMIN_ACTIONS_CONTEXT, `addUserByAdmin: User ${name} (${email}) created successfully with role ${newProfile?.role}.`);
    return { data: transformedProfile };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 8 seconds') {
      logger.error(ADMIN_ACTIONS_CONTEXT, "addUserByAdmin: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(ADMIN_ACTIONS_CONTEXT, "addUserByAdmin: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Updates an existing user by an admin.
 * Handles profile updates, password changes, role modifications, and avatar management.
 * @param {FormData} formData - The form data containing user update details (userId, name, email, role, newPassword, avatarFile, removeAvatar).
 * @returns {Promise<{ data?: User; error?: string }>} A promise that resolves to an object containing the updated user or an error message.
 */
export async function updateUserByAdmin(
  formData: FormData
): Promise<{ data?: User; error?: string }> {
  logger.info(ADMIN_ACTIONS_CONTEXT, "updateUserByAdmin: Starting user update with FormData.");
  
  return withTimeout(async () => {
    const supabase = await createServerSupabaseClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    logger.warn(ADMIN_ACTIONS_CONTEXT, "updateUserByAdmin: Authentication required.");
    return { error: 'Authentication required' };
  }
  logger.info(ADMIN_ACTIONS_CONTEXT, `updateUserByAdmin: Authenticated admin ID: ${authUser.id}`);

  const { data: adminProfileData, error: adminProfileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authUser.id)
    .single();
  if (adminProfileError || !adminProfileData || adminProfileData.role !== 'admin') {
    logger.warn(ADMIN_ACTIONS_CONTEXT, "updateUserByAdmin: Administrator privileges required.");
    return { error: 'Administrator privileges required' };
  }
  
  const userId = formData.get('userId') as string;
  const name = formData.get('name') as string | undefined;
  const email = formData.get('email') as string | undefined;
  const role = formData.get('role') as 'user' | 'admin' | undefined;
  const newPassword = formData.get('newPassword') as string | undefined;
  const avatarFile = formData.get('avatarFile') as File | null;
  const removeAvatar = formData.get('removeAvatar') === 'true';

  logger.debug(ADMIN_ACTIONS_CONTEXT, `updateUserByAdmin: Data for user ID ${userId} - Name: ${name}, Email: ${email}, Role: ${role}, Avatar present: ${!!avatarFile}, Remove avatar: ${removeAvatar}`);

  if (authUser.id === userId && role && role !== 'admin' && adminProfileData.role === 'admin') {
    logger.warn(ADMIN_ACTIONS_CONTEXT, "updateUserByAdmin: Admin cannot remove their own admin role.");
    return { error: "You cannot remove your own admin role." };
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (e: any) {
    logger.error(ADMIN_ACTIONS_CONTEXT, "updateUserByAdmin: Failed to create Supabase Admin Client:", e.message);
    return { error: `Server configuration error: ${e.message}. Contact support.` };
  }

  const authUpdates: any = {};
  if (newPassword && newPassword.length > 0) authUpdates.password = newPassword;
  if (email) authUpdates.email = email; 
  
  const userMetadataUpdates: any = {};
  if (name) userMetadataUpdates.name = name;
  
  let newAvatarUrl: string | null | undefined = undefined; 

  if (removeAvatar) {
    newAvatarUrl = null;
    logger.info(ADMIN_ACTIONS_CONTEXT, `updateUserByAdmin: Removing avatar for user ${userId}.`);
  } else if (avatarFile && avatarFile.size > 0) {
    logger.info(ADMIN_ACTIONS_CONTEXT, `updateUserByAdmin: New avatar file provided for user ${userId}: ${avatarFile.name}`);
    const fileExt = avatarFile.name.split('.').pop();
    const fileName = `public/${userId}/avatar_${Date.now()}.${fileExt}`; 

    const { error: uploadError } = await supabaseAdmin.storage
      .from('avatars')
      .upload(fileName, avatarFile, { upsert: true }); 

    if (uploadError) {
      logger.error(ADMIN_ACTIONS_CONTEXT, `updateUserByAdmin: Avatar upload error for user ${userId}:`, uploadError.message);
      return { error: `Avatar upload failed: ${uploadError.message}` };
    }
    const { data: publicUrlData } = supabaseAdmin.storage.from('avatars').getPublicUrl(fileName);
    newAvatarUrl = publicUrlData?.publicUrl || undefined; 
    if(newAvatarUrl) logger.info(ADMIN_ACTIONS_CONTEXT, `updateUserByAdmin: Avatar for user ${userId} uploaded. URL: ${newAvatarUrl}`);
    else logger.warn(ADMIN_ACTIONS_CONTEXT, `updateUserByAdmin: Avatar for user ${userId} uploaded, but no public URL obtained.`);
  }

  // Start avatar cleanup in background (non-blocking) if avatar is being updated or removed
  if (newAvatarUrl !== undefined) {
    logger.info(ADMIN_ACTIONS_CONTEXT, `updateUserByAdmin: Starting background avatar cleanup for user ${userId}`);
    // Fire and forget - don't wait for cleanup to complete
    cleanupOldAvatarAsync(userId, newAvatarUrl).catch(error => {
      logger.warn(ADMIN_ACTIONS_CONTEXT, `updateUserByAdmin: Background avatar cleanup failed for user ${userId}:`, error.message);
    });
    userMetadataUpdates.avatar_url = newAvatarUrl;
  }

  if (Object.keys(userMetadataUpdates).length > 0) {
    const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
    authUpdates.data = { ...targetUser?.user_metadata, ...userMetadataUpdates };
  }
  
  if (Object.keys(authUpdates).length > 0) {
    const { error: userUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      authUpdates
    );
    if (userUpdateError) {
      logger.error(ADMIN_ACTIONS_CONTEXT, `updateUserByAdmin: Error updating auth user ${userId}:`, userUpdateError.message);
      return { error: `Failed to update auth user: ${userUpdateError.message}` };
    }
    logger.info(ADMIN_ACTIONS_CONTEXT, `updateUserByAdmin: Auth user ${userId} updated.`);
  }

  const profileUpdates: Partial<User> & { avatar_url?: string | null } = {};
  if (name) profileUpdates.name = name;
  if (email) profileUpdates.email = email; 
  if (role) profileUpdates.role = role;
  if (newAvatarUrl !== undefined) { 
    profileUpdates.avatar_url = newAvatarUrl;
  }

  if (Object.keys(profileUpdates).length > 0) {
    const { data: updatedProfile, error: profileUpdateError } = await supabaseAdmin
      .from('profiles')
      .update(profileUpdates)
      .eq('id', userId)
      .select('id, name, email, role, score, avatar_url, starred_submissions, updated_at')
      .single();

    if (profileUpdateError) {
      logger.error(ADMIN_ACTIONS_CONTEXT, `updateUserByAdmin: Error updating profile for user ${userId}:`, profileUpdateError.message);
      return { error: profileUpdateError.message };
    }
    // Transform database fields to match User interface
    const transformedProfile: User = {
      ...updatedProfile,
      avatarUrl: updatedProfile.avatar_url || undefined,
    };
    // Remove avatar_url field from the result since User interface uses avatarUrl
    delete (transformedProfile as any).avatar_url;

    logger.info(ADMIN_ACTIONS_CONTEXT, `updateUserByAdmin: Profile for user ${userId} updated.`);
    return { data: transformedProfile };
  }
  
  const { data: currentProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('id, name, email, role, score, avatar_url, starred_submissions, updated_at')
    .eq('id', userId)
    .single();

  if (fetchError) {
    logger.error(ADMIN_ACTIONS_CONTEXT, `updateUserByAdmin: Error retrieving current profile for user ${userId} after potential auth-only update:`, fetchError.message);
    return { error: fetchError.message };
  }

  // Transform database fields to match User interface for current profile
  const transformedCurrentProfile: User = {
    ...currentProfile,
    avatarUrl: currentProfile.avatar_url || undefined,
  };
  // Remove avatar_url field from the result since User interface uses avatarUrl
  delete (transformedCurrentProfile as any).avatar_url;

    logger.info(ADMIN_ACTIONS_CONTEXT, `updateUserByAdmin: User ${userId} processed, returning current profile data.`);
    return { data: transformedCurrentProfile };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 8 seconds') {
      logger.error(ADMIN_ACTIONS_CONTEXT, "updateUserByAdmin: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(ADMIN_ACTIONS_CONTEXT, "updateUserByAdmin: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}

/**
 * Deletes a user by admin.
 * Removes the user from authentication system and cascades profile deletion.
 * Prevents admin from deleting their own account.
 * @param {string} userId - The ID of the user to delete.
 * @returns {Promise<{ success?: boolean; error?: string }>} A promise that resolves to an object indicating success or containing an error message.
 */
export async function deleteUserByAdmin(userId: string): Promise<{ success?: boolean; error?: string }> {
  logger.info(ADMIN_ACTIONS_CONTEXT, `deleteUserByAdmin: Starting deletion for user ID: ${userId}.`);
  
  return withTimeout(async () => {
    const supabase = await createServerSupabaseClient();

    const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) {
    logger.warn(ADMIN_ACTIONS_CONTEXT, "deleteUserByAdmin: Authentication required.");
    return { error: 'Authentication required' };
  }
  logger.info(ADMIN_ACTIONS_CONTEXT, `deleteUserByAdmin: Authenticated admin ID: ${authUser.id}`);
  
  const { data: adminProfileData, error: adminProfileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authUser.id)
    .single();

  if (adminProfileError || !adminProfileData || adminProfileData.role !== 'admin') {
    logger.warn(ADMIN_ACTIONS_CONTEXT, "deleteUserByAdmin: Administrator privileges required.");
    return { error: 'Administrator privileges required' };
  }

  if (authUser.id === userId) {
    logger.warn(ADMIN_ACTIONS_CONTEXT, "deleteUserByAdmin: Admin cannot delete their own account.");
    return { error: "You cannot delete your own admin account." };
  }

  let supabaseAdmin;
  try {
    supabaseAdmin = createAdminClient();
  } catch (e: any) {
    logger.error(ADMIN_ACTIONS_CONTEXT, "deleteUserByAdmin: Failed to create Supabase Admin Client:", e.message);
    return { error: `Server configuration error: ${e.message}. Contact support.` };
  }

  const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (authDeleteError) {
    if (authDeleteError.message.toLowerCase().includes('user not found')) {
        logger.warn(ADMIN_ACTIONS_CONTEXT, `deleteUserByAdmin: User ${userId} not found in auth, possibly already deleted. Profile should have cascaded.`);
    } else {
        logger.error(ADMIN_ACTIONS_CONTEXT, `deleteUserByAdmin: Error deleting user ${userId} from auth:`, authDeleteError.message);
        return { error: `Failed to delete user from authentication: ${authDeleteError.message}` };
    }
  } else {
    logger.info(ADMIN_ACTIONS_CONTEXT, `deleteUserByAdmin: User ${userId} deleted from auth.`);
  }
  
    logger.info(ADMIN_ACTIONS_CONTEXT, `deleteUserByAdmin: User ${userId} deletion process completed.`);
    return { success: true };
  }).catch((error: any) => {
    if (error.message === 'Request timed out after 8 seconds') {
      logger.error(ADMIN_ACTIONS_CONTEXT, "deleteUserByAdmin: Request timed out");
      return { error: 'The request took too long. Please try again later.' };
    }
    logger.error(ADMIN_ACTIONS_CONTEXT, "deleteUserByAdmin: Unexpected error:", error.message);
    return { error: `Unexpected error: ${error.message}` };
  });
}
