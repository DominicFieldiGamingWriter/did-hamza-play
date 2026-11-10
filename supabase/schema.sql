create table if not exists public.player_page (
  id bigint primary key default 1,
  player_id integer,
  player_name text not null default 'Hamza Choudhury',
  team_id integer,
  team_name text,
  team_logo text,
  player_photo text,
  last_fixture jsonb,
  next_fixtures jsonb not null default '[]'::jsonb,
  player_status jsonb,
  updated_at timestamptz not null default now(),
  constraint player_page_singleton check (id = 1)
);

alter table public.player_page enable row level security;

-- The website reads through the server using the Supabase service-role key.
-- Do not create a public SELECT policy for this table.

create table if not exists public.bsd_api_circuit_breaker (
  id smallint primary key default 1,
  blocked_until timestamptz,
  last_triggered_at timestamptz not null default now(),
  http_status smallint,
  provider_code text,
  reason text,
  updated_at timestamptz not null default now(),
  constraint bsd_api_circuit_breaker_singleton check (id = 1)
);

alter table public.bsd_api_circuit_breaker enable row level security;

-- The breaker state is accessed only from trusted server-side code.
revoke all privileges on table public.bsd_api_circuit_breaker
  from public, anon, authenticated;
grant select, insert, update on table public.bsd_api_circuit_breaker
  to service_role;
