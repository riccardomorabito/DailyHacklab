
"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type { User } from '@/types';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableCaption,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { UserPlus, Edit3, Trash2, Shield, User as UserIconLucide, Loader2, Image as ImageIconLucide, Clock } from 'lucide-react';
import { useForm, type SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { logger } from '@/lib/logger';
import NextImage from 'next/image';
import ErrorDisplay from './error-display'; 
import { Skeleton } from '@/components/ui/skeleton'; 
import DynamicBoringAvatar from '@/components/dynamic-boring-avatar';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDate } from '@/lib/utils';
import { useAvatarLoader } from '@/hooks/use-avatar-loader';
import ImageCropDialog from '@/components/image-crop-dialog';

const USER_MANAGEMENT_CONTEXT = "UserManagementDashboard";

/**
 * UserAvatar component - Handles robust avatar loading with fallback for admin panel
 * Uses the avatar loader hook for proper error handling and CORS recovery
 */
const UserAvatar: React.FC<{
  avatarUrl?: string | null;
  userId: string;
  userName?: string | null;
  size?: number;
  className?: string;
}> = ({ avatarUrl, userId, userName, size = 40, className = "h-10 w-10" }) => {
  const {
    shouldShowImage,
    shouldShowFallback,
    handleImageError,
    handleImageLoad,
  } = useAvatarLoader({
    avatarUrl,
    userId,
    userName: userName || undefined,
    enableDebugLogging: false,
  });

  return (
    <Avatar className={className}>
      {shouldShowImage && avatarUrl && (
        <AvatarImage
          src={avatarUrl}
          alt={userName || "User Avatar"}
          onError={handleImageError}
          onLoad={handleImageLoad}
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      )}
      <AvatarFallback>
        <DynamicBoringAvatar
          size={size}
          name={userName || userId}
          variant="beam"
          colors={['#F0A884', '#F0C0A4', '#F0D8C4', '#F0E8E4', '#F0F0F0']}
        />
      </AvatarFallback>
    </Avatar>
  );
};

/** Maximum allowed avatar file size in MB */
const MAX_AVATAR_SIZE_MB = 2;
/** Maximum allowed avatar file size in bytes */
const MAX_AVATAR_SIZE_BYTES = MAX_AVATAR_SIZE_MB * 1024 * 1024;

/**
 * Schema for validating file uploads for avatars
 */
const fileUploadSchema = z.any()
  .nullable()
  .optional()
  .refine((val): val is File | null | undefined => {
    if (val === null || val === undefined) return true;
    return val instanceof File;
  }, "A valid file or no file is required.")
  .refine((val) => {
    if (val instanceof File) return val.size <= MAX_AVATAR_SIZE_BYTES;
    return true;
  }, `Avatar cannot exceed ${MAX_AVATAR_SIZE_MB}MB.`)
  .refine((val) => {
    if (val instanceof File) return ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(val.type);
    return true;
  }, "Unsupported file format for avatar (allowed: JPG, PNG, WEBP, GIF).");

/**
 * Schema for validating add user form data
 */
const addUserSchema = z.object({
  name: z.string().min(2, "Name is required (min 2 characters)."),
  email: z.string().email("Invalid email address."),
  password: z.string().min(6, "Password must contain at least 6 characters."),
  role: z.enum(['user', 'admin']).default('user'),
  avatarFile: fileUploadSchema,
});
/** Type definition for add user form data */
type AddUserFormData = z.infer<typeof addUserSchema>;

/**
 * Schema for validating edit user form data
 */
const editUserSchema = z.object({
  id: z.string(), 
  name: z.string().min(2, "Name is required (min 2 characters)."),
  email: z.string().email("Invalid email address."),
  newPassword: z.string().optional(), 
  confirmPassword: z.string().optional(),
  role: z.enum(['user', 'admin']).default('user'),
  avatarFile: fileUploadSchema, 
  removeAvatar: z.boolean().optional(), 
}).refine(data => { 
    if (data.newPassword && data.newPassword.length > 0) {
        return data.newPassword.length >= 6;
    }
    return true;
}, {
    message: "New password must contain at least 6 characters.",
    path: ["newPassword"],
})
.refine(data => { 
    if (data.newPassword && data.newPassword.length > 0) {
        return data.newPassword === data.confirmPassword;
    }
    return true;
}, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});
/** Type definition for edit user form data */
type EditUserFormData = z.infer<typeof editUserSchema>;

/**
 * User Management Dashboard component for managing users in the admin panel
 * Provides functionality to view, add, edit, and delete users
 * @returns The user management dashboard component
 */
export default function UserManagementDashboard(): React.JSX.Element {
  const { getAllUsers, addUserByAdmin, updateUserByAdmin, deleteUserByAdmin, loading: authLoading, currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [errorFetchingUsers, setErrorFetchingUsers] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<string | undefined>(undefined);
  const [isMounted, setIsMounted] = useState(false);

  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  
  const [addAvatarPreview, setAddAvatarPreview] = useState<string | null>(null);
  const addAvatarInputRef = useRef<HTMLInputElement>(null);
  const [editAvatarPreview, setEditAvatarPreview] = useState<string | null>(null);
  const editAvatarInputRef = useRef<HTMLInputElement>(null);

  // Crop dialog state for add user
  const [showAddCropDialog, setShowAddCropDialog] = useState(false);
  const [addFileToProcess, setAddFileToProcess] = useState<File | null>(null);
  const [addCroppedFile, setAddCroppedFile] = useState<File | null>(null);
  
  // Crop dialog state for edit user
  const [showEditCropDialog, setShowEditCropDialog] = useState(false);
  const [editFileToProcess, setEditFileToProcess] = useState<File | null>(null);
  const [editCroppedFile, setEditCroppedFile] = useState<File | null>(null);

  const { register: registerAdd, handleSubmit: handleSubmitAdd, reset: resetAddForm, control: addControl, formState: { errors: addErrors, isSubmitting: isAddingUser }, watch: watchAdd } = useForm<AddUserFormData>({
    resolver: zodResolver(addUserSchema) as any,
    defaultValues: { role: 'user', avatarFile: null },
  });

  const { register: registerEdit, handleSubmit: handleSubmitEdit, reset: resetEditForm, setValue: setEditValue, control: editControl, formState: { errors: editErrors, isSubmitting: isEditingUser }, watch: watchEdit } = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema) as any,
  });
  
  const watchedAddAvatarFile = watchAdd("avatarFile");
  const watchedEditAvatarFile = watchEdit("avatarFile");

  useEffect(() => {
    setIsMounted(true); 
  }, []);

  const fetchUsersList = useCallback(async () => {
    if (!isMounted) return; 
    logger.info(USER_MANAGEMENT_CONTEXT, "fetchUsersList: Starting user list retrieval.");
    setIsLoadingUsers(true);
    setErrorFetchingUsers(null);
    setErrorDetails(undefined);
    const { data, error } = await getAllUsers();
    if (error) {
      logger.error(USER_MANAGEMENT_CONTEXT, "fetchUsersList: Error during user retrieval:", error);
      setErrorFetchingUsers("Unable to load user list.");
      setUsers([]);
    } else if (data) {
      const currentUserId = currentUser?.id;
      const sortedUsers = [...data].sort((a, b) => {
          if (currentUserId && a.id === currentUserId) return -1;
          if (currentUserId && b.id === currentUserId) return 1;
          if (a.role === 'admin' && b.role !== 'admin') return -1;
          if (a.role !== 'admin' && b.role === 'admin') return 1;
          return (a.name || "").localeCompare(b.name || "");
      });
      setUsers(sortedUsers);
      logger.info(USER_MANAGEMENT_CONTEXT, `fetchUsersList: Retrieved and sorted ${sortedUsers.length} users.`);
    }
    setIsLoadingUsers(false);
  }, [getAllUsers, currentUser?.id, isMounted]);

  useEffect(() => {
    if (isMounted) {
      logger.debug(USER_MANAGEMENT_CONTEXT, "Component mounted, calling fetchUsersList.");
      fetchUsersList();
    }
  }, [fetchUsersList, isMounted]);

  const handleAddAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setAddFileToProcess(file);
      setShowAddCropDialog(true);
    } else {
      setAddAvatarPreview(null);
    }
  };

  const handleEditAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setEditFileToProcess(file);
      setShowEditCropDialog(true);
    } else {
      setEditAvatarPreview(userToEdit?.avatarUrl || null); 
    }
  };

  /**
   * Handles completion of image cropping for add user
   * @param croppedImageFile - The cropped image file
   */
  const handleAddCropComplete = (croppedImageFile: File) => {
    setAddCroppedFile(croppedImageFile);
    setShowAddCropDialog(false);
    
    // Create a new FileList with the cropped file
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(croppedImageFile);
    const newFileList = dataTransfer.files;
    
    // Update the form field with the cropped file
    if (addAvatarInputRef.current) {
      addAvatarInputRef.current.files = newFileList;
    }
    
    // Set the preview
    const reader = new FileReader();
    reader.onloadend = () => setAddAvatarPreview(reader.result as string);
    reader.readAsDataURL(croppedImageFile);
    
    logger.debug(USER_MANAGEMENT_CONTEXT, "handleAddCropComplete: Add user avatar cropping completed successfully.");
  };

  /**
   * Handles closing of the add user crop dialog
   */
  const handleAddCropDialogClose = () => {
    setShowAddCropDialog(false);
    setAddFileToProcess(null);
    
    // Reset the file input if user cancels cropping
    if (addAvatarInputRef.current) {
      addAvatarInputRef.current.value = '';
    }
    
    logger.debug(USER_MANAGEMENT_CONTEXT, "handleAddCropDialogClose: Add user crop dialog closed.");
  };

  /**
   * Handles completion of image cropping for edit user
   * @param croppedImageFile - The cropped image file
   */
  const handleEditCropComplete = (croppedImageFile: File) => {
    setEditCroppedFile(croppedImageFile);
    setShowEditCropDialog(false);
    
    // Create a new FileList with the cropped file
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(croppedImageFile);
    const newFileList = dataTransfer.files;
    
    // Update the form field with the cropped file
    if (editAvatarInputRef.current) {
      editAvatarInputRef.current.files = newFileList;
    }
    
    // Set the preview
    const reader = new FileReader();
    reader.onloadend = () => setEditAvatarPreview(reader.result as string);
    reader.readAsDataURL(croppedImageFile);
    
    logger.debug(USER_MANAGEMENT_CONTEXT, "handleEditCropComplete: Edit user avatar cropping completed successfully.");
  };

  /**
   * Handles closing of the edit user crop dialog
   */
  const handleEditCropDialogClose = () => {
    setShowEditCropDialog(false);
    setEditFileToProcess(null);
    
    // Reset the file input if user cancels cropping
    if (editAvatarInputRef.current) {
      editAvatarInputRef.current.value = '';
    }
    
    logger.debug(USER_MANAGEMENT_CONTEXT, "handleEditCropDialogClose: Edit user crop dialog closed.");
  };

  const handleAddUserSubmit: SubmitHandler<AddUserFormData> = async (data) => {
    logger.info(USER_MANAGEMENT_CONTEXT, "handleAddUserSubmit: Attempting to add user:", data.email);
    const formData = new FormData();
    formData.append('name', data.name);
    formData.append('email', data.email);
    formData.append('password', data.password);
    formData.append('role', data.role);
    // Use the cropped file if available, otherwise use the original file
    const fileToUpload = addCroppedFile || data.avatarFile;
    if (fileToUpload instanceof File) { 
      formData.append('avatarFile', fileToUpload);
    }

    const {data: newUser, error} = await addUserByAdmin(formData);
    if (error) {
      logger.error(USER_MANAGEMENT_CONTEXT, "handleAddUserSubmit: Error during user creation:", error);
      toast({ title: "User Creation Error", description: error || "The email might already be in use or an error occurred.", variant: "destructive" });
    } else if (newUser) {
      logger.info(USER_MANAGEMENT_CONTEXT, "handleAddUserSubmit: User added successfully:", newUser.name);
      toast({ title: "User Added", description: `User ${newUser.name} has been created.` });
      fetchUsersList(); 
      resetAddForm({name: '', email: '', password: '', role: 'user', avatarFile: null});
      setAddAvatarPreview(null);
      setAddCroppedFile(null); // Clear cropped file state
      if (addAvatarInputRef.current) addAvatarInputRef.current.value = ""; 
      setIsAddUserDialogOpen(false);
    }
  };

  const openEditDialog = (user: User) => {
    logger.debug(USER_MANAGEMENT_CONTEXT, "openEditDialog: Opening edit dialog for user:", user.name);
    setUserToEdit(user);
    setEditValue("id", user.id);
    setEditValue("name", user.name);
    setEditValue("email", user.email);
    setEditValue("role", user.role);
    setEditValue("newPassword", ""); 
    setEditValue("confirmPassword", "");
    setEditValue("avatarFile", null); 
    setEditValue("removeAvatar", false);
    setEditAvatarPreview(user.avatarUrl || null); 
    if (editAvatarInputRef.current) editAvatarInputRef.current.value = ""; 
    setIsEditUserDialogOpen(true);
  };

  const handleEditUserSubmit: SubmitHandler<EditUserFormData> = async (data) => {
    if (!userToEdit) return;
    logger.info(USER_MANAGEMENT_CONTEXT, `handleEditUserSubmit: Attempting to edit user ID ${data.id}:`, data.email);
    
    const formData = new FormData();
    formData.append('userId', data.id);
    formData.append('name', data.name);
    formData.append('email', data.email);
    formData.append('role', data.role);
    if (data.newPassword && data.newPassword.length > 0) {
      formData.append('newPassword', data.newPassword);
    }
    // Use the cropped file if available, otherwise use the original file
    const fileToUpload = editCroppedFile || data.avatarFile;
    if (fileToUpload instanceof File) { 
      formData.append('avatarFile', fileToUpload);
    }
    if (data.removeAvatar) {
        formData.append('removeAvatar', 'true');
    }
    
    const {data: updatedUser, error} = await updateUserByAdmin(formData);
    
    if (error) {
        logger.error(USER_MANAGEMENT_CONTEXT, `handleEditUserSubmit: Error during user edit ID ${data.id}:`, error);
        toast({ title: "Update Error", description: error || "Unable to update user.", variant: "destructive" });
    } else if (updatedUser) {
        logger.info(USER_MANAGEMENT_CONTEXT, `handleEditUserSubmit: User ID ${updatedUser.id} (${updatedUser.name}) edited successfully.`);
        toast({ title: "User Updated", description: `${updatedUser.name}'s details have been updated.` });
        fetchUsersList(); 
        resetEditForm();
        setIsEditUserDialogOpen(false);
        setUserToEdit(null);
        setEditAvatarPreview(null);
        setEditCroppedFile(null); // Clear cropped file state
        if (editAvatarInputRef.current) editAvatarInputRef.current.value = ""; 
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;
    logger.info(USER_MANAGEMENT_CONTEXT, `handleDeleteUser: Attempting to delete user ID ${userToDelete.id}:`, userToDelete.name);
    if (currentUser && currentUser.id === userToDelete.id) {
        logger.warn(USER_MANAGEMENT_CONTEXT, "handleDeleteUser: Admin self-deletion attempt blocked.");
        toast({ title: "Action Not Allowed", description: "You cannot delete your own admin account.", variant: "destructive" });
        setUserToDelete(null);
        return;
    }
    const { error, success } = await deleteUserByAdmin(userToDelete.id);
    if (error) {
      logger.error(USER_MANAGEMENT_CONTEXT, `handleDeleteUser: Error during user deletion ID ${userToDelete.id}:`, error);
      toast({ title: "Deletion Error", description: error || "Unable to delete user.", variant: "destructive" });
    } else if (success) {
      logger.info(USER_MANAGEMENT_CONTEXT, `handleDeleteUser: User ID ${userToDelete.id} (${userToDelete.name}) deleted successfully.`);
      toast({ title: "User Deleted", description: `User ${userToDelete.name} has been deleted.` });
      fetchUsersList(); 
    }
    setUserToDelete(null); 
  };

  const isLoadingAnything = authLoading || isLoadingUsers; 

  if (!isMounted) {
    return (
      <Card className="shadow-lg">
        <CardHeader><CardTitle>Registered Users List</CardTitle></CardHeader>
        <CardContent><p className="p-4 text-center">Initializing dashboard...</p></CardContent>
      </Card>
    );
  }
  
  if (isLoadingAnything && users.length === 0 && !errorFetchingUsers) {
    return (
      <Card className="shadow-lg">
        <CardHeader><CardTitle>Registered Users List</CardTitle></CardHeader>
        <CardContent className="space-y-2 p-4">
            <div className="flex justify-end mb-4"><Skeleton className="h-10 w-28" /></div>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (errorFetchingUsers) {
    return <ErrorDisplay message={errorFetchingUsers} details={errorDetails} title="Error Loading Users" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={isAddUserDialogOpen} onOpenChange={(open) => {
            setIsAddUserDialogOpen(open);
            if (!open) { 
                resetAddForm({name: '', email: '', password: '', role: 'user', avatarFile: null});
                setAddAvatarPreview(null);
                setAddCroppedFile(null); // Clear cropped file state
                if (addAvatarInputRef.current) addAvatarInputRef.current.value = "";
            }
        }}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-5 w-5" /> Add User</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Enter details to create a new account.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmitAdd(handleAddUserSubmit as any)} className="space-y-4 py-2">
              <div>
                <Label htmlFor="add-name">Full Name</Label>
                <Input id="add-name" {...registerAdd("name")} disabled={isAddingUser} />
                {addErrors.name && <p className="text-sm text-destructive mt-1">{addErrors.name.message}</p>}
              </div>
              <div>
                <Label htmlFor="add-email">Email</Label>
                <Input id="add-email" type="email" {...registerAdd("email")} disabled={isAddingUser} />
                {addErrors.email && <p className="text-sm text-destructive mt-1">{addErrors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="add-password">Password</Label>
                <Input id="add-password" type="password" {...registerAdd("password")} disabled={isAddingUser} />
                {addErrors.password && <p className="text-sm text-destructive mt-1">{addErrors.password.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-avatarFile">Avatar (Optional)</Label>
                {addAvatarPreview && (
                  <NextImage src={addAvatarPreview} alt="Avatar Preview" width={60} height={60} className="rounded-full object-cover aspect-square my-2" data-ai-hint="admin add avatar preview"/>
                )}
                <Controller
                    name="avatarFile"
                    control={addControl}
                    render={({ field: { onChange, onBlur, name, ref } }) => (
                        <Input 
                            id="add-avatarFile" 
                            type="file" 
                            accept="image/*" 
                            onBlur={onBlur}
                            name={name}
                            ref={(e) => {
                              ref(e); 
                              if (addAvatarInputRef) (addAvatarInputRef.current as any) = e; 
                            }}
                            onChange={(e) => {
                                onChange(e.target.files ? e.target.files[0] : null);
                                handleAddAvatarChange(e); 
                            }}
                            disabled={isAddingUser} 
                        />
                    )}
                />
                {addErrors.avatarFile && <p className="text-sm text-destructive mt-1">{typeof addErrors.avatarFile.message === 'string' ? addErrors.avatarFile.message : 'File error'}</p>}
              </div>
              <div className="flex items-center space-x-2">
                <Controller
                    name="role"
                    control={addControl}
                    render={({ field }) => (
                        <Checkbox
                            id="add-role"
                            checked={field.value === 'admin'}
                            onCheckedChange={(checked) => field.onChange(checked ? 'admin' : 'user')}
                            disabled={isAddingUser}
                        />
                    )}
                />
                <Label htmlFor="add-role" className="text-sm font-normal">Make Administrator</Label>
              </div>
              <DialogFooter>
                <DialogClose asChild><Button type="button" variant="outline" disabled={isAddingUser}>Cancel</Button></DialogClose>
                <Button type="submit" disabled={isAddingUser}>
                  {isAddingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isAddingUser ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="shadow-lg">
        <CardHeader><CardTitle>Registered Users List</CardTitle></CardHeader>
        <CardContent>
            <Table>
            <TableCaption>{users.length > 0 ? `A total of ${users.length} users.` : 'No users found.'}</TableCaption>
            <TableHeader>
                <TableRow>
                <TableHead>Avatar</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Last Modified</TableHead>
                <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {users.map((user) => (
                <TableRow key={user.id} className={currentUser?.id === user.id ? 'bg-muted/50' : ''}>
                    <TableCell>
                      <UserAvatar
                        avatarUrl={user.avatarUrl}
                        userId={user.id}
                        userName={user.name || user.email}
                        size={40}
                        className="h-10 w-10"
                      />
                    </TableCell>
                    <TableCell className="font-medium">{user.name} {currentUser?.id === user.id && <span className="text-xs text-primary ml-1">(You)</span>}</TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>
                    {user.role === 'admin' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/20 text-primary">
                        <Shield className="mr-1 h-3 w-3" /> Admin
                        </span>
                    ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                        <UserIconLucide className="mr-1 h-3 w-3" /> User
                        </span>
                    )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                        {user.updated_at ? formatDate(user.updated_at, "dd/MM/yy HH:mm") : '-'}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(user)} disabled={isEditingUser || isAddingUser}>
                        <Edit3 className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" onClick={() => setUserToDelete(user)} disabled={currentUser?.id === user.id || isEditingUser || isAddingUser}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        </AlertDialogTrigger>
                        {userToDelete && userToDelete.id === user.id && ( 
                        <AlertDialogContent>
                            <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                                This action cannot be undone. This will permanently delete <strong>{userToDelete.name}</strong>'s account and all associated data.
                            </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setUserToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDeleteUser} className="bg-destructive hover:bg-destructive/90">
                                Yes, delete user
                            </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                        )}
                    </AlertDialog>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
        </CardContent>
      </Card>

      {userToEdit && (<Dialog open={isEditUserDialogOpen} onOpenChange={(open) => { 
            if (!open) { 
                setUserToEdit(null); 
                resetEditForm(); 
                setEditAvatarPreview(null);
                setEditCroppedFile(null); // Clear cropped file state
                if (editAvatarInputRef.current) editAvatarInputRef.current.value = "";
            }
            setIsEditUserDialogOpen(open); 
        }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User: {userToEdit?.name}</DialogTitle>
            <DialogDescription>Update user details. Leave password fields empty to keep current password.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitEdit(handleEditUserSubmit as any)} className="space-y-4 py-2">
            <Input type="hidden" {...registerEdit("id")} /> 
            <div>
              <Label htmlFor="edit-name">Full Name</Label>
              <Input id="edit-name" {...registerEdit("name")} disabled={isEditingUser} />
              {editErrors.name && <p className="text-sm text-destructive mt-1">{editErrors.name.message}</p>}
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input id="edit-email" type="email" {...registerEdit("email")} disabled={isEditingUser} />
              {editErrors.email && <p className="text-sm text-destructive mt-1">{editErrors.email.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-avatarFile">New Avatar (Optional)</Label>
               {editAvatarPreview ? (
                  <NextImage src={editAvatarPreview} alt="Avatar Preview" width={60} height={60} className="rounded-full object-cover aspect-square my-2" data-ai-hint="admin edit avatar preview"/>
                ) : userToEdit?.avatarUrl ? ( 
                    <NextImage src={userToEdit.avatarUrl} alt="Current Avatar" width={60} height={60} className="rounded-full object-cover aspect-square my-2" data-ai-hint="admin edit avatar current"/>
                ) : ( 
                  <div className="w-[60px] h-[60px] rounded-full bg-muted flex items-center justify-center my-2">
                     <DynamicBoringAvatar
                        size={60}
                        name={userToEdit?.name || userToEdit?.email || userToEdit?.id || "default"}
                        variant="beam"
                        colors={['#F0A884', '#F0C0A4', '#F0D8C4', '#F0E8E4', '#F0F0F0']}
                      />
                  </div>
                )}
              <Controller
                  name="avatarFile"
                  control={editControl}
                  render={({ field: { onChange, onBlur, name, ref } }) => (
                      <Input 
                          id="edit-avatarFile" 
                          type="file" 
                          accept="image/*" 
                          onBlur={onBlur}
                          name={name}
                          ref={(e) => {
                            ref(e); 
                            if (editAvatarInputRef) (editAvatarInputRef.current as any) = e; 
                          }}
                          onChange={(e) => {
                              onChange(e.target.files ? e.target.files[0] : null); 
                              handleEditAvatarChange(e); 
                          }}
                          disabled={isEditingUser}
                      />
                  )}
              />
              {editErrors.avatarFile && <p className="text-sm text-destructive mt-1">{typeof editErrors.avatarFile.message === "string" ? editErrors.avatarFile.message : "File error"}</p>}
            </div>
            <div className="flex items-center space-x-2">
                 <Controller
                    name="removeAvatar"
                    control={editControl}
                    render={({ field }) => (
                        <Checkbox
                            id="edit-removeAvatar"
                            checked={!!field.value} 
                            onCheckedChange={field.onChange}
                            disabled={isEditingUser || !userToEdit?.avatarUrl} 
                        />
                    )}
                />
              <Label htmlFor="edit-removeAvatar" className="text-sm font-normal">Remove current avatar</Label>
            </div>
            <div>
              <Label htmlFor="edit-newPassword">New Password (optional)</Label>
              <Input id="edit-newPassword" type="password" {...registerEdit("newPassword")} placeholder="Leave empty to keep current" disabled={isEditingUser} />
              {editErrors.newPassword && <p className="text-sm text-destructive mt-1">{editErrors.newPassword.message}</p>}
            </div>
            <div>
              <Label htmlFor="edit-confirmPassword">Confirm New Password</Label>
              <Input id="edit-confirmPassword" type="password" {...registerEdit("confirmPassword")} placeholder="Repeat if changed" disabled={isEditingUser} />
              {editErrors.confirmPassword && <p className="text-sm text-destructive mt-1">{editErrors.confirmPassword.message}</p>}
            </div>
            <div className="flex items-center space-x-2">
                <Controller
                    name="role"
                    control={editControl}
                    defaultValue={userToEdit.role} 
                    render={({ field }) => (
                        <Checkbox
                            id="edit-role"
                            checked={field.value === 'admin'}
                            onCheckedChange={(checked) => field.onChange(checked ? 'admin' : 'user')}
                            disabled={isEditingUser || (currentUser?.id === userToEdit?.id && userToEdit?.role === 'admin')}
                        />
                    )}
                />
              <Label htmlFor="edit-role" className="text-sm font-normal">Make Administrator</Label>
            </div>
            {currentUser?.id === userToEdit?.id && userToEdit?.role === 'admin' && (
                <p className="text-xs text-muted-foreground">You cannot remove your administrator role.</p>
            )}
            <DialogFooter>
              <DialogClose asChild><Button type="button" variant="outline" disabled={isEditingUser}>Cancel</Button></DialogClose>
              <Button type="submit" disabled={isEditingUser}>
                {isEditingUser && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEditingUser ? "Saving..." : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>)}
      
      {/* Image Crop Dialogs */}
      <ImageCropDialog
        isOpen={showAddCropDialog}
        imageFile={addFileToProcess}
        onCropComplete={handleAddCropComplete}
        onClose={handleAddCropDialogClose}
      />
      
      <ImageCropDialog
        isOpen={showEditCropDialog}
        imageFile={editFileToProcess}
        onCropComplete={handleEditCropComplete}
        onClose={handleEditCropDialogClose}
      />
    </div>
  );
}

