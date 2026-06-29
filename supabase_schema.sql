-- Run this in your Supabase SQL editor (Dashboard → SQL Editor → New query)

-- Weight logs (weekly weigh-ins)
create table if not exists weight_logs (
  id uuid default gen_random_uuid() primary key,
  logged_date date not null unique,
  weight_kg decimal(5,2) not null,
  created_at timestamptz default now()
);

-- Exercise working weights — per-set JSONB e.g. {"1": 80, "2": 85, "3": 90}
create table if not exists exercise_weights (
  id uuid default gen_random_uuid() primary key,
  exercise_id text not null unique,
  weights jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- Exercise weight history — one row per exercise per day for progress tracking
create table if not exists exercise_weight_history (
  id uuid default gen_random_uuid() primary key,
  exercise_id text not null,
  log_date date not null default current_date,
  weights jsonb not null default '{}',
  created_at timestamptz default now(),
  unique(exercise_id, log_date)
);

-- Session comments per exercise per day
create table if not exists exercise_comments (
  id uuid default gen_random_uuid() primary key,
  exercise_id text not null,
  log_date date not null default current_date,
  comment text not null,
  created_at timestamptz default now(),
  unique(exercise_id, log_date)
);

-- Daily supplement tick-offs
create table if not exists supplement_logs (
  id uuid default gen_random_uuid() primary key,
  log_date date not null unique,
  supplements jsonb not null default '{}',
  created_at timestamptz default now()
);

-- Meal plan overrides (when user edits a meal)
create table if not exists meal_overrides (
  id uuid default gen_random_uuid() primary key,
  meal_id integer not null unique,
  foods jsonb not null,
  updated_at timestamptz default now()
);

-- Daily meal log — ticked meals + eat-out entries + computed totals
create table if not exists meal_logs (
  id          uuid        default gen_random_uuid() primary key,
  log_date    date        not null unique,
  meals_eaten jsonb       not null default '[]',   -- array of meal IDs (integers)
  eat_out     jsonb       not null default '[]',   -- array of { name, protein, carbs, fat, calories }
  protein     integer     not null default 0,
  carbs       integer     not null default 0,
  fat         integer     not null default 0,
  calories    integer     not null default 0,
  saved       boolean     not null default false,
  created_at  timestamptz default now()
);

-- Per-set difficulty ratings — drives progressive overload flags
create table if not exists set_ratings (
  id          uuid        default gen_random_uuid() primary key,
  exercise_id text        not null,
  log_date    date        not null default current_date,
  set_number  integer     not null,
  rating      text        not null check (rating in ('easy', 'good', 'hard')),
  created_at  timestamptz default now(),
  unique(exercise_id, log_date, set_number)
);

-- Saved workout sessions — one row per save, bundled snapshot with timestamp
create table if not exists workout_sessions (
  id        uuid        default gen_random_uuid() primary key,
  saved_at  timestamptz default now(),
  day_type  text        not null,
  day_name  text        not null,
  exercises jsonb       not null default '[]'
);

-- Disable RLS on all tables (personal single-user app, no auth required)
alter table weight_logs             disable row level security;
alter table exercise_weights        disable row level security;
alter table exercise_weight_history disable row level security;
alter table exercise_comments       disable row level security;
alter table supplement_logs         disable row level security;
alter table meal_overrides          disable row level security;
alter table workout_sessions        disable row level security;
alter table set_ratings             disable row level security;
alter table meal_logs               disable row level security;
