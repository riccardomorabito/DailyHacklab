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
  - [🎯 Perfect For](#-perfect-for)
  - [🛠️ Tech Stack](#️-tech-stack)
  - [🚀 Quick Start](#-quick-start)
    - [Prerequisites](#prerequisites)
    - [1. Clone \& Install](#1-clone--install)
    - [2. Environment Setup](#2-environment-setup)
    - [3. Supabase Setup](#3-supabase-setup)
    - [4. Run Development Server](#4-run-development-server)
    - [5. Create Admin User](#5-create-admin-user)
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

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm, yarn, or pnpm
- Supabase account

### 1. Clone & Install

```bash
git clone https://github.com/riccardomorabito/DailyHacklab.git
cd DailyHacklab
npm install
```

### 2. Environment Setup

Create `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Optional: Enable client-side logging
NEXT_PUBLIC_ENABLE_LOGGING_BY_DEFAULT=true
```

### 3. Supabase Setup

1. **Create Supabase Project** at [supabase.com](https://supabase.com)

2. **Run SQL Setup** in your Supabase SQL Editor:

```sql
-- Create profiles table
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

-- Create submissions table
CREATE TABLE public.submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name text,
  user_avatar_url text,
  photo_urls jsonb,
  summary text,
  submission_date timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  approved boolean,
  stars_received integer DEFAULT 0,
  CONSTRAINT submissions_pkey PRIMARY KEY (id)
);

-- Create special_events table
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
  parent_event_id uuid REFERENCES special_events(id),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT special_events_pkey PRIMARY KEY (id)
);

-- Create app_settings table (application settings)
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

-- Create trigger for new user profiles
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
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'avatar_url',
    'user',
    '[]'::jsonb
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (basic examples - customize as needed)
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can read approved submissions" ON public.submissions
  FOR SELECT USING (approved = TRUE);

CREATE POLICY "Users can create own submissions" ON public.submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for app_settings (only admins can manage settings)
CREATE POLICY "Admins can manage app settings" ON public.app_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Special policy to allow anyone to read public registration setting
CREATE POLICY "Anyone can read public registration setting" ON public.app_settings
  FOR SELECT USING (setting_key = 'public_registration_enabled');

-- Insert default settings
INSERT INTO public.app_settings (setting_key, setting_value, description) VALUES
  ('public_registration_enabled', 'false', 'Controls whether new users can see the UI to register for the application')
ON CONFLICT (setting_key) DO NOTHING;
```

3. **Create Storage Buckets**:
   - Create `avatars` bucket (public)
   - Create `submissions` bucket (public)
   - Set up appropriate RLS policies for file uploads

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

### 5. Create Admin User

1. Register a normal account through the app
2. Find your user ID in Supabase Dashboard > Authentication > Users
3. Run this SQL to promote to admin:

```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE id = 'your_user_id_here';
```

4. Logout and login again to access admin features

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
