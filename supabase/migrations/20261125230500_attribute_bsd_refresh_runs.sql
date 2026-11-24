alter table public.bsd_api_usage_events add column if not exists job_type text not null default 'full_refresh',add column if not exists fixture_id bigint;
alter table public.bsd_api_refresh_runs add column if not exists job_type text not null default 'full_refresh',add column if not exists fixture_id bigint;
create index if not exists bsd_api_usage_events_job_type_requested_at_idx on public.bsd_api_usage_events(job_type,requested_at desc);
create index if not exists bsd_api_refresh_runs_job_type_started_at_idx on public.bsd_api_refresh_runs(job_type,started_at desc);
