<div align="center">

<img src="public/images/logos/logo-icon.png" alt="Daily Hacklab Logo" width="120" height="120">

**🌐 Language:** **🇬🇧 English** | [🇮🇹 Italiano](README.it.md)

# Daily Hacklab 🚀

**A Next.js community platform for associations, hackerspaces, and organizations**

**Author: Ricky Morabito**

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Visit_App-blue?style=for-the-badge)](https://daily-hacklab.vercel.app)
[![GitHub](https://img.shields.io/badge/📦_Source_Code-GitHub-black?style=for-the-badge)](https://github.com/riccardomorabito/DailyHacklab)
[![License](https://img.shields.io/badge/📄_License-GPL--3.0-green?style=for-the-badge)](LICENSE)

</div>

---

A complete Next.js application designed for community organizations to document activities, engage members through gamification, and streamline administrative tasks. Built with modern web technologies and comprehensive security features.

## 🌐 Live Preview

🚀 **[Try the Live Demo](https://daily-hacklab.vercel.app/)**

Experience Daily Hacklab in action! The live preview includes:
- 👤 User registration and authentication
- 📸 Content submission with photo galleries
- 🏆 Interactive leaderboards
- 👑 Admin dashboard (create admin account to access)
- 📅 Special events system
- 🌙 Dark/light theme toggle
- 📱 Mobile-responsive design

*Note: This is a demonstration environment. Feel free to create an account and explore all features!*

## 📋 Table of Contents

- [Daily Hacklab 🚀](#daily-hacklab-)
  - [🌐 Live Preview](#-live-preview)
  - [📋 Table of Contents](#-table-of-contents)
  - [✨ Features](#-features)
  - [🗺️ Roadmap](#️-roadmap)
  - [🎯 Perfect For](#-perfect-for)
  - [🛠️ Tech Stack](#️-tech-stack)
  - [🚀 Setup and Installation](#-setup-and-installation)
    - [🔧 Prerequisites](#-prerequisites)
    - [🆕 Create Supabase Project](#-create-supabase-project)
    - [🗄️ Database Setup](#️-database-setup)
      - [Step 1: Run Main SQL Query](#step-1-run-main-sql-query)
    - [🪣 Storage Bucket Setup](#-storage-bucket-setup)
      - [Step 2: Create Storage Buckets](#step-2-create-storage-buckets)
        - [2.1 Create "avatars" Bucket](#21-create-avatars-bucket)
        - [2.2 Create "posts" Bucket](#22-create-posts-bucket)
    - [Step 3: Configure Storage Policies](#step-3-configure-storage-policies)
    - [🔐 Authentication Setup](#-authentication-setup)
      - [Step 4: Configure Authentication](#step-4-configure-authentication)
      - [Step 5: Configure Email Templates](#step-5-configure-email-templates)
    - [⚙️ Environment Configuration](#️-environment-configuration)
      - [Step 6: Get Credentials](#step-6-get-credentials)
      - [Step 7: Configure .env.local](#step-7-configure-envlocal)
    - [✅ Test and Verification](#-test-and-verification)
      - [Step 8: Verify Setup](#step-8-verify-setup)
    - [👑 Create First Admin](#-create-first-admin)
      - [Step 9: Create Admin Account](#step-9-create-admin-account)
  - [📂 Project Structure](#-project-structure)
  - [🔒 Security Features](#-security-features)
  - [🌍 Deployment](#-deployment)
    - [Vercel (Recommended)](#vercel-recommended)
    - [Environment Variables for Production](#environment-variables-for-production)
  - [🤝 Contributing](#-contributing)
  - [📄 License](#-license)
  - [👨‍💻 Author](#-author)
  - [🙏 Acknowledgments](#-acknowledgments)

## ✨ Features

- **🔐 User Authentication** - Complete auth system with registration, login, and profile management
- **📸 Content Submission** - Photo galleries with automatic image processing and cropping
- **🏆 Gamification** - Points system, leaderboards, and star ratings to encourage participation
- **👑 Admin Dashboard** - User management, content moderation, and system configuration
- **📅 Special Events** - Create recurring events with notifications and bonus points
- **🌙 Dark/Light Theme** - Toggle between themes with system preference detection
- **🔒 Security First** - Comprehensive security measures including XSS protection, rate limiting, and input validation
- **🌍 Multi-language** - English and Italian language support
- **📱 Mobile Responsive** - Optimized for all devices with bottom navigation
- **🕐 Timezone Aware** - Automatic timezone detection and conversion for global users

## 🗺️ Roadmap

Here are some of the features planned for future releases:

- **Moderated Registration Approval**: A public registration mode where administrators must approve or reject each new account, providing greater control over access.
- **Auto-Approval of Posts**: A setting to allow automatic approval of new posts created by non-admin users, simplifying moderation.
- **Post Comments**: Introduction of a comments section for posts to encourage discussion and interaction (feature under evaluation).

---

## 🎯 Perfect For

- **Associations & Non-profits** - Document activities for compliance and reporting
- **Hackerspaces & Makerspaces** - Track projects and community engagement
- **University Organizations** - Maintain activity logs for funding and space allocation
- **Community Groups** - Engage members and collect content for social media

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **UI Components**: ShadCN UI, Radix UI primitives
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Authentication**: Supabase Auth with RLS policies
- **Deployment**: Vercel-ready with environment configuration
- **Security**: Input validation, XSS protection, rate limiting, file upload security

## 🚀 Setup and Installation

### 🔧 Prerequisites

- Supabase Account (free tier available)
- Access to Supabase Project Dashboard
- SQL Editor (built into Supabase)

---

### 🆕 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose your organization
4. Enter the following:
   - **Name**: `daily-hacklab` (or your preferred name)
   - **Database Password**: Generate a secure password (SAVE IT!)
   - **Region**: Choose the region closest to you
5. Click "Create new project"
6. Wait for the setup to complete (2-3 minutes)

---

### 🗄️ Database Setup

#### Step 1: Run Main SQL Query

Navigate to the **SQL Editor** in your Supabase dashboard and execute this complete query:

```sql
-- ============================================================================
-- DAILY HACKLAB - DATABASE SETUP (RLS Recursion Fixed)
-- ============================================================================

-- Drop existing tables if present (for a full reset)
DROP TABLE IF EXISTS public.app_settings CASCADE;
DROP TABLE IF EXISTS public.special_events CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;

-- ============================================================================
-- TABLE CREATION
-- ============================================================================

-- profiles table (user profiles)
CREATE TABLE public.profiles (
  id uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  email text UNIQUE,
  name text,
  avatar_url text,
  score integer DEFAULT 0,
  role text DEFAULT 'user',
  starred_submissions jsonb DEFAULT '[]'::jsonb,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text])))
);

-- posts table (user content)
CREATE TABLE public.posts (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name text,
  user_avatar_url text,
  photo_urls jsonb DEFAULT '[]'::jsonb,
  summary text,
  submission_date timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  approved boolean DEFAULT NULL,
  stars_received integer DEFAULT 0,
  CONSTRAINT posts_pkey PRIMARY KEY (id)
);

-- special_events table
CREATE TABLE public.special_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  event_date timestamptz NOT NULL,
  start_time text,
  end_time text,
  bonus_points integer DEFAULT 0,
  show_notification boolean DEFAULT TRUE,
  notification_message text,
  is_recurring boolean DEFAULT FALSE,
  recurring_interval_days integer,
  recurring_end_date timestamptz,
  parent_event_id uuid REFERENCES special_events(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT special_events_pkey PRIMARY KEY (id)
);

-- app_settings table
CREATE TABLE public.app_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  setting_key text NOT NULL UNIQUE,
  setting_value text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT app_settings_pkey PRIMARY KEY (id),
  CONSTRAINT app_settings_setting_key_unique UNIQUE (setting_key)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes for profiles
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_score ON public.profiles(score DESC);

-- Indexes for posts
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_submission_date ON public.posts(submission_date DESC);
CREATE INDEX idx_posts_approved ON public.posts(approved);
CREATE INDEX idx_posts_stars_received ON public.posts(stars_received DESC);
CREATE INDEX idx_posts_approved_date ON public.posts(approved, submission_date DESC) WHERE approved = TRUE;

-- Indexes for special_events
CREATE INDEX idx_special_events_date ON public.special_events(event_date);
CREATE INDEX idx_special_events_recurring ON public.special_events(is_recurring);
CREATE INDEX idx_special_events_parent ON public.special_events(parent_event_id);

-- Indexes for app_settings
CREATE INDEX idx_app_settings_key ON public.app_settings(setting_key);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to handle new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url, role, starred_submissions)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.raw_user_meta_data->>'avatar_url',
    'user',
    '[]'::jsonb
  );
  RETURN NEW;
END;
$$;

-- Trigger for new users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to automatically update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Trigger to update updated_at on profiles
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Trigger to update updated_at on app_settings
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Function to securely get a user's role (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role FROM public.profiles WHERE id = user_id;
  RETURN user_role;
END;
$$;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- RLS POLICIES - PROFILES
-- ============================================================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins can read all profiles
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

-- Admins can update all profiles
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.get_user_role(auth.uid()) = 'admin');

-- Admins can delete profiles (except their own)
CREATE POLICY "Admins can delete other profiles" ON public.profiles
  FOR DELETE USING (public.get_user_role(auth.uid()) = 'admin' AND id != auth.uid());

-- Admins can insert new profiles
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================================
-- RLS POLICIES - POSTS
-- ============================================================================

-- Authenticated users can read approved posts
CREATE POLICY "Authenticated users can read approved posts" ON public.posts
  FOR SELECT USING (approved = TRUE AND auth.role() = 'authenticated');

-- Authenticated users can create their own posts
CREATE POLICY "Users can create own posts" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can read their own posts (even unapproved)
CREATE POLICY "Users can read own posts" ON public.posts
  FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own unapproved posts
CREATE POLICY "Users can update own unapproved posts" ON public.posts
  FOR UPDATE USING (auth.uid() = user_id AND (approved IS NULL OR approved = FALSE));

-- Users can delete their own posts
CREATE POLICY "Users can delete own posts" ON public.posts
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can do anything with posts
CREATE POLICY "Admins can manage all posts" ON public.posts
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================================
-- RLS POLICIES - SPECIAL EVENTS
-- ============================================================================

-- Anyone can read special events
CREATE POLICY "Anyone can read special events" ON public.special_events
  FOR SELECT USING (TRUE);

-- Only admins can manage special events
CREATE POLICY "Admins can manage special events" ON public.special_events
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================================
-- RLS POLICIES - APP SETTINGS
-- ============================================================================

-- Only admins can manage app settings
CREATE POLICY "Admins can manage app settings" ON public.app_settings
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- Anyone can read the public registration setting
CREATE POLICY "Anyone can read public registration setting" ON public.app_settings
  FOR SELECT USING (setting_key = 'public_registration_enabled');

-- ============================================================================
-- INITIAL DATA INSERTION
-- ============================================================================

-- Insert default settings
INSERT INTO public.app_settings (setting_key, setting_value, description) VALUES
  ('public_registration_enabled', 'false', 'Controls whether new users can see the UI to register for the application'),
  ('app_name', 'Daily Hacklab', 'Name of the application displayed in the UI'),
  ('max_photos_per_post', '5', 'Maximum number of photos allowed per post'),
  ('points_per_post', '50', 'Base points awarded for an approved post'),
  ('points_per_star', '10', 'Points awarded for each star received')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- END OF DATABASE SETUP
-- ============================================================================

-- Verify that everything was created correctly
SELECT 'Database setup completed successfully!' as status;

-- Show created tables
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

---

### 🪣 Storage Bucket Setup

#### Step 2: Create Storage Buckets

Navigate to **Storage** in your Supabase dashboard and perform the following steps:

##### 2.1 Create "avatars" Bucket
1. Click "New bucket"
2. **Name of bucket**: `avatars`
3. **Public bucket**: ✅ Check (enabled)
4. **Additional configuration** (expand the section):
   - **Restrict file upload size for bucket**: ✅ Check (enabled)
   - **File size limit**: `5` MB
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp, image/gif`
5. Click "Save"

##### 2.2 Create "posts" Bucket
1. Click "New bucket"
2. **Name of bucket**: `posts`
3. **Public bucket**: ❌ DO NOT check (private) - **IMPORTANT: Private to restrict access to authenticated users**
4. **Additional configuration** (expand the section):
   - **Restrict file upload size for bucket**: ✅ Check (enabled)
   - **File size limit**: `10` MB
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp, image/gif`
5. Click "Save"

> **⚠️ Important Note**:
> - The **"posts"** bucket is PRIVATE: only authenticated users can view post images.
> - The **"avatars"** bucket is public to display user avatars.
> - RLS policies control uploads, updates, and deletions for security.

### Step 3: Configure Storage Policies

Go to the **SQL Editor** and run these queries for storage policies:

```sql
-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Policy for avatars bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policy for posts bucket (private - authenticated users only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'posts',
  'posts',
  false, -- PRIVATE: only authenticated users can access
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- STORAGE RLS POLICIES - AVATARS
-- ============================================================================

-- Anyone can view avatars
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Authenticated users can upload avatars
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Users can update their own avatars
CREATE POLICY "Users can update own avatars" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own avatars
CREATE POLICY "Users can delete own avatars" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins can delete any avatar
CREATE POLICY "Admins can delete any avatar" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND public.get_user_role(auth.uid()) = 'admin');

-- ============================================================================
-- STORAGE RLS POLICIES - POSTS
-- ============================================================================

-- Only authenticated users can view post images
CREATE POLICY "Authenticated users can view post images" ON storage.objects
  FOR SELECT USING (bucket_id = 'posts' AND auth.role() = 'authenticated');

-- Authenticated users can upload post images
CREATE POLICY "Authenticated users can upload post images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'posts' AND auth.role() = 'authenticated');

-- Users can update their own post images
CREATE POLICY "Users can update own post images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own post images
CREATE POLICY "Users can delete own post images" ON storage.objects
  FOR DELETE USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Admins can delete any post image
CREATE POLICY "Admins can delete any post image" ON storage.objects
  FOR DELETE USING (bucket_id = 'posts' AND public.get_user_role(auth.uid()) = 'admin');
```

---

### 🔐 Authentication Setup

#### Step 4: Configure Authentication

1. Go to **Authentication > Settings**
2. **Site URL**: Set your domain
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`
3. **Redirect URLs**: Add:
   - `http://localhost:3000/auth/confirm` (development)
   - `https://yourdomain.com/auth/confirm` (production)

#### Step 5: Configure Email Templates

1. Go to **Authentication > Email Templates**
2. Select "Confirm signup"
3. Customize the template as needed
4. Save

---

### ⚙️ Environment Configuration

#### Step 6: Get Credentials

1. Go to **Settings > API**
2. Copy:
   - **Project URL**
   - **anon public key**
   - **service_role key** (⚠️ Keep this secret!)

#### Step 7: Configure .env.local

Create/update the `.env.local` file in your project root:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Optional: Enable client-side logging
NEXT_PUBLIC_ENABLE_LOGGING_BY_DEFAULT=true
```

---

### ✅ Test and Verification

#### Step 8: Verify Setup

Run this query to verify that everything is configured correctly:

```sql
-- Verify tables
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verify policies
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verify storage buckets
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets;

-- Verify app settings
SELECT
  setting_key,
  setting_value,
  description
FROM public.app_settings
ORDER BY setting_key;
```

---

### 👑 Create First Admin

#### Step 9: Create Admin Account

1. **Go to Supabase Dashboard**:
   - Log in to your Supabase project
   - Navigate to **Authentication** in the sidebar

2. **Add new user**:
   - Click **"Add user"**
   - Enter **Email** and **Password** for the admin
   - ✅ **Check "Auto confirm user?"** (skips email confirmation)
   - Click **"Create user"**

3. **Promote to Admin**:
   - Go to **Table Editor** in the sidebar
   - Open the **"profiles"** table
   - Find the row with the newly created user's email
   - Change the **"role"** field from `user` to `admin`
   - Save the changes

4. **Test Login**:
   - Start the application: `npm run dev`
   - Log in with the admin credentials
   - Verify that you have access to administrative functions

## 📂 Project Structure

```
src/
├── app/                    # Next.js App Router pages
├── components/             # React components
│   ├── ui/                # ShadCN UI components
│   ├── admin-*.tsx        # Admin-specific components
│   └── *.tsx             # App components
├── contexts/              # React context providers
├── hooks/                 # Custom React hooks
├── lib/                   # Utility functions and configurations
├── actions/               # Next.js Server Actions
└── types/                 # TypeScript type definitions
```

## 🔒 Security Features

- **Input Validation**: All user inputs are validated and sanitized
- **XSS Protection**: Comprehensive protection against cross-site scripting
- **Rate Limiting**: Action-specific limits to prevent abuse
- **File Upload Security**: Binary analysis and secure processing
- **Authentication**: Row Level Security (RLS) with Supabase
- **CSRF Protection**: Built-in protection with Next.js

## 🌍 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect repository to Vercel
3. Add environment variables in Vercel dashboard
4. Deploy automatically

### Environment Variables for Production

```env
NEXT_PUBLIC_SUPABASE_URL=your_production_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_production_service_role_key
NEXT_PUBLIC_ENABLE_LOGGING_BY_DEFAULT=false
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the GPL-3.0 License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Author

**Ricky Morabito**

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org/) for the amazing React framework
- [Supabase](https://supabase.com/) for the backend infrastructure
- [ShadCN](https://ui.shadcn.com/) for the beautiful UI components
- [Tailwind CSS](https://tailwindcss.com/) for utility-first CSS

---

<div align="center">

**⭐ Star this repository if you find it useful! ⭐**

Made with ❤️ for the open source community

</div>
