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
