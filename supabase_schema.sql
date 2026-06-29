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
