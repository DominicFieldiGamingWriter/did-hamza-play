alter table public.player_page add column if not exists last_full_refresh_at timestamptz, add column if not exists last_fixture_discovery_at timestamptz;
update public.player_page set last_full_refresh_at=coalesce(last_full_refresh_at,updated_at),last_fixture_discovery_at=coalesce(last_fixture_discovery_at,updated_at) where id=1;
create table if not exists public.bsd_worker_locks(job_key text primary key,lease_until timestamptz not null default to_timestamp(0),last_started_at timestamptz,last_completed_at timestamptz,last_error text,updated_at timestamptz not null default now());
alter table public.bsd_worker_locks enable row level security;
revoke all privileges on table public.bsd_worker_locks from public,anon,authenticated;
grant select,insert,update,delete on table public.bsd_worker_locks to service_role;
create or replace function public.claim_bsd_worker_lock(p_job_key text,p_lease_seconds integer default 300) returns boolean language plpgsql security invoker set search_path=public as $$
declare v_claimed boolean;
begin
if p_job_key is null or length(trim(p_job_key))=0 then return false; end if;
insert into public.bsd_worker_locks(job_key,lease_until,last_started_at,updated_at)
values(p_job_key,now()+make_interval(secs=>greatest(30,least(coalesce(p_lease_seconds,300),900))),now(),now())
on conflict(job_key) do update set lease_until=excluded.lease_until,last_started_at=excluded.last_started_at,last_error=null,updated_at=excluded.updated_at
where public.bsd_worker_locks.lease_until<=now()
returning true into v_claimed;
return coalesce(v_claimed,false);
end; $$;
revoke all on function public.claim_bsd_worker_lock(text,integer) from public,anon,authenticated;
grant execute on function public.claim_bsd_worker_lock(text,integer) to service_role;
