<div align="center">

<img src="public/images/logos/logo-icon.png" alt="Logo Daily Hacklab" width="120" height="120">

**🌐 Lingua:** [🇬🇧 English](README.md) | **🇮🇹 Italiano**

# Daily Hacklab 🚀

**Una piattaforma community Next.js per associazioni, hackerspace e organizzazioni**

**Autore: Ricky Morabito**

[![Demo Live](https://img.shields.io/badge/🌐_Demo_Live-Visita_App-blue?style=for-the-badge)](https://daily-hacklab.vercel.app)
[![GitHub](https://img.shields.io/badge/📦_Codice_Sorgente-GitHub-black?style=for-the-badge)](https://github.com/riccardomorabito/DailyHacklab)
[![Licenza](https://img.shields.io/badge/📄_Licenza-GPL--3.0-green?style=for-the-badge)](LICENSE)

</div>

---

Un'applicazione Next.js completa progettata per organizzazioni comunitarie per documentare attività, coinvolgere membri attraverso la gamification e semplificare compiti amministrativi. Costruita con tecnologie web moderne e funzionalità di sicurezza complete.

## 🌐 Anteprima Live

🚀 **[Prova il Demo Live](https://daily-hacklab.vercel.app/)**

Sperimenta Daily Hacklab in azione! L'anteprima live include:
- 👤 Registrazione utente e autenticazione
- 📸 Invio contenuti con gallerie foto
- 🏆 Classifiche interattive
- 👑 Dashboard admin (crea account admin per accedere)
- 📅 Sistema eventi speciali
- 🌙 Toggle tema scuro/chiaro
- 📱 Design mobile-responsive

*Nota: Questo è un ambiente di dimostrazione. Sentiti libero di creare un account ed esplorare tutte le funzionalità!*

## 📋 Indice

- [Daily Hacklab 🚀](#daily-hacklab-)
  - [🌐 Anteprima Live](#-anteprima-live)
  - [📋 Indice](#-indice)
  - [✨ Caratteristiche](#-caratteristiche)
  - [🗺️ Roadmap](#️-roadmap)
  - [🎯 Perfetto Per](#-perfetto-per)
  - [🛠️ Stack Tecnologico](#️-stack-tecnologico)
  - [🚀 Setup e Installazione](#-setup-e-installazione)
    - [🔧 Prerequisiti](#-prerequisiti)
    - [🆕 Creazione Progetto Supabase](#-creazione-progetto-supabase)
    - [🗄️ Setup Database](#️-setup-database)
      - [Passo 1: Esegui Query SQL Principale](#passo-1-esegui-query-sql-principale)
    - [🪣 Setup Storage Buckets](#-setup-storage-buckets)
      - [Passo 2: Crea Buckets Storage](#passo-2-crea-buckets-storage)
        - [2.1 Crea Bucket "avatars"](#21-crea-bucket-avatars)
        - [2.2 Crea Bucket "posts"](#22-crea-bucket-posts)
      - [Passo 3: Configura Policy Storage](#passo-3-configura-policy-storage)
    - [🔐 Setup Authentication](#-setup-authentication)
      - [Passo 4: Configura Authentication](#passo-4-configura-authentication)
      - [Passo 5: Configura Email Templates](#passo-5-configura-email-templates)
    - [⚙️ Configurazione Environment](#️-configurazione-environment)
      - [Passo 6: Ottieni Credenziali](#passo-6-ottieni-credenziali)
      - [Passo 7: Configura .env.local](#passo-7-configura-envlocal)
    - [✅ Test e Verifica](#-test-e-verifica)
      - [Passo 8: Verifica Setup](#passo-8-verifica-setup)
    - [👑 Creazione Primo Admin](#-creazione-primo-admin)
      - [Passo 9: Crea Account Admin](#passo-9-crea-account-admin)
  - [📂 Struttura Progetto](#-struttura-progetto)
  - [🔒 Funzionalità Sicurezza](#-funzionalità-sicurezza)
  - [🌍 Deployment](#-deployment)
    - [Vercel (Raccomandato)](#vercel-raccomandato)
    - [Variabili Environment per Produzione](#variabili-environment-per-produzione)
  - [🤝 Contribuire](#-contribuire)
  - [📄 Licenza](#-licenza)
  - [👨‍💻 Autore](#-autore)
  - [🙏 Riconoscimenti](#-riconoscimenti)

## ✨ Caratteristiche

- **🔐 Autenticazione Utenti** - Sistema auth completo con registrazione, login e gestione profilo
- **📸 Invio Contenuti** - Gallerie foto con elaborazione automatica immagini e ritaglio
- **🏆 Gamification** - Sistema punti, classifiche e valutazioni a stelle per incoraggiare partecipazione
- **👑 Dashboard Admin** - Gestione utenti, moderazione contenuti e configurazione sistema
- **📅 Eventi Speciali** - Crea eventi ricorrenti con notifiche e punti bonus
- **🌙 Tema Scuro/Chiaro** - Cambia tra temi con rilevamento preferenze sistema
- **🔒 Sicurezza Prima** - Misure sicurezza complete incluse protezione XSS, rate limiting e validazione input
- **🌍 Multi-lingua** - Supporto lingue inglese e italiano
- **📱 Mobile Responsive** - Ottimizzato per tutti i dispositivi con navigazione inferiore
- **🕐 Timezone Aware** - Rilevamento automatico timezone e conversione per utenti globali

## 🗺️ Roadmap

Ecco alcune delle funzionalità pianificate per le future versioni:

- ** approvazione Registrazione Moderata**: Una modalità di registrazione pubblica in cui gli amministratori devono approvare o rifiutare ogni nuovo account, offrendo un controllo maggiore sugli accessi.
- **Auto-Approvazione dei Post**: Un'impostazione per consentire l'approvazione automatica dei nuovi post creati da utenti non amministratori, per semplificare la moderazione.
- **Commenti ai Post**: Introduzione di una sezione commenti per i post, per favorire la discussione e l'interazione (funzionalità in fase di valutazione).

---

## 🎯 Perfetto Per

- **Associazioni & No-profit** - Documenta attività per conformità e reportistica
- **Hackerspace & Makerspace** - Traccia progetti e coinvolgimento community
- **Organizzazioni Universitarie** - Mantieni log attività per finanziamenti e allocazione spazi
- **Gruppi Community** - Coinvolgi membri e raccogli contenuti per social media

## 🛠️ Stack Tecnologico

- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS
- **Componenti UI**: ShadCN UI, primitive Radix UI
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Autenticazione**: Supabase Auth con policy RLS
- **Deployment**: Pronto per Vercel con configurazione environment
- **Sicurezza**: Validazione input, protezione XSS, rate limiting, sicurezza upload file

## 🚀 Setup e Installazione

### 🔧 Prerequisiti

- Account Supabase (gratuito)
- Accesso al progetto Supabase Dashboard
- Editor SQL (integrato in Supabase)

---

### 🆕 Creazione Progetto Supabase

1. Vai su [supabase.com](https://supabase.com)
2. Clicca "New Project"
3. Scegli organizzazione
4. Inserisci:
   - **Name**: `daily-hacklab` (o nome a tua scelta)
   - **Database Password**: Genera password sicura (SALVALA!)
   - **Region**: Scegli regione più vicina
5. Clicca "Create new project"
6. Attendi completamento setup (2-3 minuti)

---

### 🗄️ Setup Database

#### Passo 1: Esegui Query SQL Principale

Vai su **SQL Editor** nel dashboard Supabase e esegui questa query completa:

```sql
-- ============================================================================
-- DAILY HACKLAB - DATABASE SETUP COMPLETO (Corretto per Ricorsione RLS)
-- ============================================================================

-- Elimina tabelle esistenti se presenti (per reset completo)
DROP TABLE IF EXISTS public.app_settings CASCADE;
DROP TABLE IF EXISTS public.special_events CASCADE;
DROP TABLE IF EXISTS public.posts CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Elimina funzioni esistenti
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.get_user_role(uuid) CASCADE;

-- ============================================================================
-- CREAZIONE TABELLE
-- ============================================================================

-- Tabella profiles (profili utenti)
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

-- Tabella posts (contenuti utenti)
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

-- Tabella special_events (eventi speciali)
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

-- Tabella app_settings (impostazioni applicazione)
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
-- INDICI PER PERFORMANCE
-- ============================================================================

-- Indici per profiles
CREATE INDEX idx_profiles_email ON public.profiles(email);
CREATE INDEX idx_profiles_role ON public.profiles(role);
CREATE INDEX idx_profiles_score ON public.profiles(score DESC);

-- Indici per posts
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_submission_date ON public.posts(submission_date DESC);
CREATE INDEX idx_posts_approved ON public.posts(approved);
CREATE INDEX idx_posts_stars_received ON public.posts(stars_received DESC);
CREATE INDEX idx_posts_approved_date ON public.posts(approved, submission_date DESC) WHERE approved = TRUE;

-- Indici per special_events
CREATE INDEX idx_special_events_date ON public.special_events(event_date);
CREATE INDEX idx_special_events_recurring ON public.special_events(is_recurring);
CREATE INDEX idx_special_events_parent ON public.special_events(parent_event_id);

-- Indici per app_settings
CREATE INDEX idx_app_settings_key ON public.app_settings(setting_key);

-- ============================================================================
-- FUNZIONI E TRIGGER
-- ============================================================================

-- Funzione per gestire nuovi utenti
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

-- Trigger per nuovi utenti
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Funzione per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

-- Trigger per aggiornare updated_at su profiles
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Trigger per aggiornare updated_at su app_settings
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Funzione per ottenere il ruolo di un utente in modo sicuro (evita ricorsione RLS)
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
-- ABILITAZIONE ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- POLICY RLS - PROFILES
-- ============================================================================

-- Gli utenti possono leggere il proprio profilo
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Gli utenti possono aggiornare il proprio profilo
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Gli admin possono leggere tutti i profili
CREATE POLICY "Admins can read all profiles" ON public.profiles
  FOR SELECT USING (public.get_user_role(auth.uid()) = 'admin');

-- Gli admin possono aggiornare tutti i profili
CREATE POLICY "Admins can update all profiles" ON public.profiles
  FOR UPDATE USING (public.get_user_role(auth.uid()) = 'admin');

-- Gli admin possono eliminare profili (eccetto se stessi)
CREATE POLICY "Admins can delete other profiles" ON public.profiles
  FOR DELETE USING (public.get_user_role(auth.uid()) = 'admin' AND id != auth.uid());

-- Gli admin possono inserire nuovi profili
CREATE POLICY "Admins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================================
-- POLICY RLS - POSTS
-- ============================================================================

-- Solo gli utenti autenticati possono leggere i post approvati
CREATE POLICY "Authenticated users can read approved posts" ON public.posts
  FOR SELECT USING (approved = TRUE AND auth.role() = 'authenticated');

-- Gli utenti autenticati possono creare i propri post
CREATE POLICY "Users can create own posts" ON public.posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Gli utenti possono leggere i propri post (anche non approvati)
CREATE POLICY "Users can read own posts" ON public.posts
  FOR SELECT USING (auth.uid() = user_id);

-- Gli utenti possono aggiornare i propri post (solo se non approvati)
CREATE POLICY "Users can update own unapproved posts" ON public.posts
  FOR UPDATE USING (auth.uid() = user_id AND (approved IS NULL OR approved = FALSE));

-- Gli utenti possono eliminare i propri post
CREATE POLICY "Users can delete own posts" ON public.posts
  FOR DELETE USING (auth.uid() = user_id);

-- Gli admin possono fare tutto sui post
CREATE POLICY "Admins can manage all posts" ON public.posts
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================================
-- POLICY RLS - SPECIAL EVENTS
-- ============================================================================

-- Tutti possono leggere gli eventi
CREATE POLICY "Anyone can read special events" ON public.special_events
  FOR SELECT USING (TRUE);

-- Solo gli admin possono gestire gli eventi
CREATE POLICY "Admins can manage special events" ON public.special_events
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================================
-- POLICY RLS - APP SETTINGS
-- ============================================================================

-- Solo gli admin possono gestire le impostazioni
CREATE POLICY "Admins can manage app settings" ON public.app_settings
  FOR ALL USING (public.get_user_role(auth.uid()) = 'admin');

-- Tutti possono leggere l'impostazione di registrazione pubblica
CREATE POLICY "Anyone can read public registration setting" ON public.app_settings
  FOR SELECT USING (setting_key = 'public_registration_enabled');

-- ============================================================================
-- INSERIMENTO DATI INIZIALI
-- ============================================================================

-- Inserisci impostazioni predefinite
INSERT INTO public.app_settings (setting_key, setting_value, description) VALUES
  ('public_registration_enabled', 'false', 'Controls whether new users can see the UI to register for the application'),
  ('app_name', 'Daily Hacklab', 'Name of the application displayed in the UI'),
  ('max_photos_per_post', '5', 'Maximum number of photos allowed per post'),
  ('points_per_post', '50', 'Base points awarded for an approved post'),
  ('points_per_star', '10', 'Points awarded for each star received')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================================================
-- FINE SETUP DATABASE
-- ============================================================================

-- Verifica che tutto sia stato creato correttamente
SELECT 'Database setup completed successfully!' as status;

-- Mostra tabelle create
SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

---

### 🪣 Setup Storage Buckets

#### Passo 2: Crea Buckets Storage

Vai su **Storage** nel dashboard Supabase e esegui questi passaggi:

##### 2.1 Crea Bucket "avatars"
1. Clicca "New bucket"
2. **Name of bucket**: `avatars`
3. **Public bucket**: ✅ Spunta (abilitato)
4. **Additional configuration** (espandi la sezione):
   - **Restrict file upload size for bucket**: ✅ Spunta (abilitato)
   - **File size limit**: `5` MB
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp, image/gif`
5. Clicca "Save"

##### 2.2 Crea Bucket "posts"
1. Clicca "New bucket"
2. **Name of bucket**: `posts`
3. **Public bucket**: ❌ NON spuntare (privato) - **IMPORTANTE: Privato per limitare accesso solo agli utenti autenticati**
4. **Additional configuration** (espandi la sezione):
   - **Restrict file upload size for bucket**: ✅ Spunta (abilitato)
   - **File size limit**: `10` MB
   - **Allowed MIME types**: `image/jpeg, image/png, image/webp, image/gif`
5. Clicca "Save"

> **⚠️ Nota Importante**:
> - Il bucket **"posts"** è PRIVATO: solo gli utenti autenticati possono visualizzare le immagini dei post
> - Il bucket **"avatars"** è pubblico per mostrare gli avatar degli utenti
> - Le policy RLS controllano upload, aggiornamenti ed eliminazioni per sicurezza

#### Passo 3: Configura Policy Storage

Vai su **SQL Editor** ed esegui queste query per le policy storage:

```sql
-- ============================================================================
-- STORAGE POLICIES
-- ============================================================================

-- Policy per bucket avatars
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

-- Policy per bucket posts (privato - solo utenti autenticati)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'posts',
  'posts',
  false, -- PRIVATO: solo utenti autenticati possono accedere
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- STORAGE RLS POLICIES - AVATARS
-- ============================================================================

-- Tutti possono vedere gli avatar
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- Gli utenti autenticati possono caricare avatar
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');

-- Gli utenti possono aggiornare i propri avatar
CREATE POLICY "Users can update own avatars" ON storage.objects
  FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Gli utenti possono eliminare i propri avatar
CREATE POLICY "Users can delete own avatars" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Gli admin possono eliminare qualsiasi avatar
CREATE POLICY "Admins can delete any avatar" ON storage.objects
  FOR DELETE USING (bucket_id = 'avatars' AND public.get_user_role(auth.uid()) = 'admin');

-- ============================================================================
-- STORAGE RLS POLICIES - POSTS
-- ============================================================================

-- Solo gli utenti autenticati possono vedere le immagini dei post
CREATE POLICY "Authenticated users can view post images" ON storage.objects
  FOR SELECT USING (bucket_id = 'posts' AND auth.role() = 'authenticated');

-- Gli utenti autenticati possono caricare immagini per i post
CREATE POLICY "Authenticated users can upload post images" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'posts' AND auth.role() = 'authenticated');

-- Gli utenti possono aggiornare le proprie immagini dei post
CREATE POLICY "Users can update own post images" ON storage.objects
  FOR UPDATE USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Gli utenti possono eliminare le proprie immagini dei post
CREATE POLICY "Users can delete own post images" ON storage.objects
  FOR DELETE USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Gli admin possono eliminare qualsiasi immagine dei post
CREATE POLICY "Admins can delete any post image" ON storage.objects
  FOR DELETE USING (bucket_id = 'posts' AND public.get_user_role(auth.uid()) = 'admin');
```

---

### 🔐 Setup Authentication

#### Passo 4: Configura Authentication

1. Vai su **Authentication > Settings**
2. **Site URL**: Imposta il tuo dominio
   - Sviluppo: `http://localhost:3000`
   - Produzione: `https://tuodominio.com`
3. **Redirect URLs**: Aggiungi:
   - `http://localhost:3000/auth/confirm` (sviluppo)
   - `https://tuodominio.com/auth/confirm` (produzione)

#### Passo 5: Configura Email Templates

1. Vai su **Authentication > Email Templates**
2. Seleziona "Confirm signup"
3. Personalizza il template se necessario
4. Salva

---

### ⚙️ Configurazione Environment

#### Passo 6: Ottieni Credenziali

1. Vai su **Settings > API**
2. Copia:
   - **Project URL**
   - **anon public key**
   - **service_role key** (⚠️ Mantieni segreta!)

#### Passo 7: Configura .env.local

Crea/aggiorna il file `.env.local` nella root del progetto:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://tuo-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tua-anon-key-qui
SUPABASE_SERVICE_ROLE_KEY=tua-service-role-key-qui

# Optional: Enable client-side logging
NEXT_PUBLIC_ENABLE_LOGGING_BY_DEFAULT=true
```

---

### ✅ Test e Verifica

#### Passo 8: Verifica Setup

Esegui questa query per verificare che tutto sia configurato correttamente:

```sql
-- Verifica tabelle
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Verifica policy
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Verifica buckets storage
SELECT
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
FROM storage.buckets;

-- Verifica impostazioni app
SELECT
  setting_key,
  setting_value,
  description
FROM public.app_settings
ORDER BY setting_key;
```

---

### 👑 Creazione Primo Admin

#### Passo 9: Crea Account Admin

1. **Vai su Supabase Dashboard**:
   - Accedi al tuo progetto Supabase
   - Vai su **Authentication** nel menu laterale

2. **Aggiungi nuovo utente**:
   - Clicca **"Add user"**
   - Inserisci **Email** e **Password** per l'admin
   - ✅ **Spunta "Auto confirm user?"** (evita l'invio dell'email di conferma)
   - Clicca **"Create user"**

3. **Promuovi a Admin**:
   - Vai su **Table Editor** nel menu laterale
   - Apri la tabella **"profiles"**
   - Trova la riga con l'email dell'utente appena creato
   - Cambia il campo **"role"** da `user` a `admin`
   - Salva le modifiche

4. **Test Login**:
   - Avvia l'applicazione: `npm run dev`
   - Effettua login con le credenziali admin
   - Verifica che hai accesso alle funzioni amministrative

## 📂 Struttura Progetto

```
src/
├── app/                    # Pagine Next.js App Router
├── components/             # Componenti React
│   ├── ui/                # Componenti ShadCN UI
│   ├── admin-*.tsx        # Componenti specifici admin
│   └── *.tsx             # Componenti app
├── contexts/              # Provider contesto React
├── hooks/                 # Hook React personalizzati
├── lib/                   # Funzioni utility e configurazioni
├── actions/               # Server Actions Next.js
└── types/                 # Definizioni tipi TypeScript
```

## 🔒 Funzionalità Sicurezza

- **Validazione Input**: Tutti gli input utente sono validati e sanificati
- **Protezione XSS**: Protezione completa contro cross-site scripting
- **Rate Limiting**: Limiti specifici per azione per prevenire abusi
- **Sicurezza Upload File**: Analisi binaria ed elaborazione sicura
- **Autenticazione**: Row Level Security (RLS) con Supabase
- **Protezione CSRF**: Protezione integrata con Next.js

## 🌍 Deployment

### Vercel (Raccomandato)

1. Pusha il tuo codice su GitHub
2. Connetti repository a Vercel
3. Aggiungi variabili environment in dashboard Vercel
4. Deploy automaticamente

### Variabili Environment per Produzione

```env
NEXT_PUBLIC_SUPABASE_URL=url_supabase_produzione
NEXT_PUBLIC_SUPABASE_ANON_KEY=chiave_anon_produzione
SUPABASE_SERVICE_ROLE_KEY=chiave_service_role_produzione
NEXT_PUBLIC_ENABLE_LOGGING_BY_DEFAULT=false
```

## 🤝 Contribuire

1. Fai fork del repository
2. Crea un branch feature (`git checkout -b feature/funzionalita-incredibile`)
3. Commit le tue modifiche (`git commit -m 'Aggiungi funzionalità incredibile'`)
4. Push al branch (`git push origin feature/funzionalita-incredibile`)
5. Apri una Pull Request

## 📄 Licenza

Questo progetto è sotto licenza GPL-3.0 - vedi il file [LICENSE](LICENSE) per dettagli.

## 👨‍💻 Autore

**Ricky Morabito**

## 🙏 Riconoscimenti

- [Next.js](https://nextjs.org/) per l'incredibile framework React
- [Supabase](https://supabase.com/) per l'infrastruttura backend
- [ShadCN](https://ui.shadcn.com/) per i bellissimi componenti UI
- [Tailwind CSS](https://tailwindcss.com/) per il CSS utility-first

---

<div align="center">

**⭐ Metti una stella a questo repository se lo trovi utile! ⭐**

Fatto con ❤️ per la community open source

</div>