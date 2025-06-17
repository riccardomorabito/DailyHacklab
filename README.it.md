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
  - [🎯 Perfetto Per](#-perfetto-per)
  - [🛠️ Stack Tecnologico](#️-stack-tecnologico)
  - [🚀 Avvio Rapido](#-avvio-rapido)
    - [Prerequisiti](#prerequisiti)
    - [1. Clona \& Installa](#1-clona--installa)
    - [2. Setup Environment](#2-setup-environment)
    - [3. Setup Supabase](#3-setup-supabase)
    - [4. Avvia Server Sviluppo](#4-avvia-server-sviluppo)
    - [5. Crea Utente Admin](#5-crea-utente-admin)
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

## 🚀 Avvio Rapido

### Prerequisiti

- Node.js 18+
- npm, yarn, o pnpm
- Account Supabase

### 1. Clona & Installa

```bash
git clone https://github.com/riccardomorabito/DailyHacklab.git
cd DailyHacklab
npm install
```

### 2. Setup Environment

Crea file `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=url_progetto_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=chiave_anon_supabase
SUPABASE_SERVICE_ROLE_KEY=chiave_service_role_supabase

# Opzionale: Abilita logging client-side
NEXT_PUBLIC_ENABLE_LOGGING_BY_DEFAULT=true
```

### 3. Setup Supabase

1. **Crea Progetto Supabase** su [supabase.com](https://supabase.com)

2. **Esegui Setup SQL** nel tuo SQL Editor Supabase:

```sql
-- Crea tabella profiles
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

-- Crea tabella submissions
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

-- Crea tabella special_events
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

-- Crea tabella app_settings (impostazioni dell'app)
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

-- Crea trigger per nuovi profili utente
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

-- Abilita RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Crea policy RLS (esempi base - personalizza secondo necessità)
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can read approved submissions" ON public.submissions
  FOR SELECT USING (approved = TRUE);

CREATE POLICY "Users can create own submissions" ON public.submissions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy per app_settings (solo admin possono gestire le impostazioni)
CREATE POLICY "Admins can manage app settings" ON public.app_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.role = 'admin'
    )
  );

-- Policy speciale per leggere l'impostazione di registrazione pubblica
CREATE POLICY "Anyone can read public registration setting" ON public.app_settings
  FOR SELECT USING (setting_key = 'public_registration_enabled');

-- Inserisci impostazioni predefinite
INSERT INTO public.app_settings (setting_key, setting_value, description) VALUES
  ('public_registration_enabled', 'false', 'Controls whether new users can see the UI to register for the application')
ON CONFLICT (setting_key) DO NOTHING;
```

3. **Crea Bucket Storage**:
   - Crea bucket `avatars` (pubblico)
   - Crea bucket `submissions` (pubblico)
   - Imposta policy RLS appropriate per upload file

### 4. Avvia Server Sviluppo

```bash
npm run dev
```

Apri [http://localhost:3000](http://localhost:3000) per vedere l'applicazione.

### 5. Crea Utente Admin

1. Registra un account normale attraverso l'app
2. Trova il tuo ID utente in Dashboard Supabase > Authentication > Users
3. Esegui questo SQL per promuovere ad admin:

```sql
UPDATE public.profiles 
SET role = 'admin' 
WHERE id = 'il_tuo_user_id_qui';
```

4. Fai logout e login di nuovo per accedere alle funzionalità admin

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