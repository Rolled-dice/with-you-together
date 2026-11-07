-- Additive launch ledger. Legacy subscriptions/pools are not reinterpreted.
-- Only trusted server code may issue grants or reserve/settle calls.
create schema if not exists launch_internal;
revoke all on schema launch_internal from public, anon, authenticated;

create table public.launch_catalog_prices (
  catalog_version text not null,
  market text not null,
  plan text not null check (plan in ('care', 'care_plus')),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  amount_minor integer not null check (amount_minor > 0),
  people integer not null,
  monthly_calls integer not null,
  trial_calls integer not null,
  primary key (catalog_version, market, plan),
  check ((plan = 'care' and people = 2 and monthly_calls = 15 and trial_calls = 4)
    or (plan = 'care_plus' and people = 5 and monthly_calls = 30 and trial_calls = 7))
);

insert into public.launch_catalog_prices values
('2026-11-launch', 'in', 'care', 'INR', 300000, 2, 15, 4),
('2026-11-launch', 'in', 'care_plus', 'INR', 500000, 5, 30, 7),
('2026-11-launch', 'us', 'care', 'USD', 4900, 2, 15, 4),
('2026-11-launch', 'us', 'care_plus', 'USD', 7900, 5, 30, 7),
('2026-11-launch', 'gb', 'care', 'GBP', 3900, 2, 15, 4),
('2026-11-launch', 'gb', 'care_plus', 'GBP', 6200, 5, 30, 7),
('2026-11-launch', 'eu', 'care', 'EUR', 4500, 2, 15, 4),
('2026-11-launch', 'eu', 'care_plus', 'EUR', 7200, 5, 30, 7),
('2026-11-launch', 'ca', 'care', 'CAD', 6500, 2, 15, 4),
('2026-11-launch', 'ca', 'care_plus', 'CAD', 10500, 5, 30, 7),
('2026-11-launch', 'au', 'care', 'AUD', 7500, 2, 15, 4),
('2026-11-launch', 'au', 'care_plus', 'AUD', 11900, 5, 30, 7),
('2026-11-launch', 'pl', 'care', 'PLN', 17900, 2, 15, 4),
('2026-11-launch', 'pl', 'care_plus', 'PLN', 28900, 5, 30, 7),
('2026-11-launch', 'mx', 'care', 'MXN', 49900, 2, 15, 4),
('2026-11-launch', 'mx', 'care_plus', 'MXN', 79900, 5, 30, 7),
('2026-11-launch', 'sg', 'care', 'SGD', 6500, 2, 15, 4),
('2026-11-launch', 'sg', 'care_plus', 'SGD', 10500, 5, 30, 7),
('2026-11-launch', 'jp', 'care', 'JPY', 5900, 2, 15, 4),
('2026-11-launch', 'jp', 'care_plus', 'JPY', 9500, 5, 30, 7),
('2026-11-launch', 'kr', 'care', 'KRW', 59000, 2, 15, 4),
('2026-11-launch', 'kr', 'care_plus', 'KRW', 95000, 5, 30, 7),
('2026-11-launch', 'th', 'care', 'THB', 129000, 2, 15, 4),
('2026-11-launch', 'th', 'care_plus', 'THB', 209000, 5, 30, 7),
('2026-11-launch', 'kh', 'care', 'USD', 2500, 2, 15, 4),
('2026-11-launch', 'kh', 'care_plus', 'USD', 3900, 5, 30, 7),
('2026-11-launch', 'ae', 'care', 'AED', 17900, 2, 15, 4),
('2026-11-launch', 'ae', 'care_plus', 'AED', 28900, 5, 30, 7),
('2026-11-launch', 'sa', 'care', 'SAR', 17900, 2, 15, 4),
('2026-11-launch', 'sa', 'care_plus', 'SAR', 29900, 5, 30, 7),
('2026-11-launch', 'qa', 'care', 'QAR', 17900, 2, 15, 4),
('2026-11-launch', 'qa', 'care_plus', 'QAR', 29900, 5, 30, 7),
('2026-11-launch', 'kw', 'care', 'KWD', 14900, 2, 15, 4),
('2026-11-launch', 'kw', 'care_plus', 'KWD', 23900, 5, 30, 7),
('2026-11-launch', 'bh', 'care', 'BHD', 17000, 2, 15, 4),
('2026-11-launch', 'bh', 'care_plus', 'BHD', 27000, 5, 30, 7),
('2026-11-launch', 'om', 'care', 'OMR', 18000, 2, 15, 4),
('2026-11-launch', 'om', 'care_plus', 'OMR', 29000, 5, 30, 7);

create table public.launch_billing_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  family_id uuid references public.families(id) on delete set null,
  environment text not null check (environment in ('test', 'live')),
  provider_subscription_id text not null check (length(provider_subscription_id) > 0),
  catalog_version text not null,
  market text not null,
  plan text not null,
  status text not null default 'pending'
    check (status in ('pending', 'trialing', 'active', 'suspended', 'canceled')),
  first_successful_charge_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (catalog_version, market, plan)
    references public.launch_catalog_prices(catalog_version, market, plan),
  unique (environment, provider_subscription_id),
  unique (id, environment)
);
create unique index launch_one_current_account_per_owner
  on public.launch_billing_accounts(owner_id, environment)
  where status in ('pending', 'trialing', 'active', 'suspended');
create unique index launch_one_current_account_per_family
  on public.launch_billing_accounts(family_id, environment)
  where family_id is not null and status in ('pending', 'trialing', 'active', 'suspended');

create table public.launch_call_grants (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null,
  environment text not null,
  provider_event_id text not null check (length(provider_event_id) > 0),
  phase text not null check (phase in ('trial', 'paid')),
  period_start timestamptz not null,
  period_end timestamptz not null,
  total_calls integer not null check (total_calls between 1 and 30),
  foreign key (account_id, environment) references public.launch_billing_accounts(id, environment),
  check (period_end > period_start),
  unique (environment, provider_event_id),
  unique (account_id, phase, period_start)
);
create unique index launch_one_trial_per_account on public.launch_call_grants(account_id)
  where phase = 'trial';

create table public.launch_call_reservations (
  booking_id uuid primary key references public.listener_bookings(id),
  grant_id uuid not null references public.launch_call_grants(id),
  user_id uuid not null references auth.users(id),
  state text not null default 'reserved' check (state in ('reserved', 'consumed', 'released')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);
create index launch_reservations_grant_state on public.launch_call_reservations(grant_id, state);

-- These tables are server-only; browser access is through authenticated wrappers.
alter table public.launch_catalog_prices enable row level security;
alter table public.launch_billing_accounts enable row level security;
alter table public.launch_call_grants enable row level security;
alter table public.launch_call_reservations enable row level security;
revoke all on public.launch_catalog_prices, public.launch_billing_accounts,
  public.launch_call_grants, public.launch_call_reservations from public, anon, authenticated;
grant select on public.launch_catalog_prices to service_role;
grant select, insert, update, delete on public.launch_billing_accounts,
  public.launch_call_grants, public.launch_call_reservations to service_role;
create policy launch_catalog_server on public.launch_catalog_prices to service_role using (true);
create policy launch_accounts_server on public.launch_billing_accounts to service_role using (true) with check (true);
create policy launch_grants_server on public.launch_call_grants to service_role using (true) with check (true);
create policy launch_reservations_server on public.launch_call_reservations to service_role using (true) with check (true);

create function launch_internal.immutable_catalog() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Published launch terms are immutable; publish a new catalog version';
end;
$$;
create trigger launch_catalog_immutable before update or delete on public.launch_catalog_prices
  for each row execute function launch_internal.immutable_catalog();

create function launch_internal.check_account_terms() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and
    (new.owner_id, new.environment, new.provider_subscription_id, new.catalog_version, new.market, new.plan)
    is distinct from
    (old.owner_id, old.environment, old.provider_subscription_id, old.catalog_version, old.market, old.plan) then
    raise exception 'Purchased launch terms cannot be reassigned';
  end if;
  if tg_op = 'UPDATE' and old.first_successful_charge_at is not null and
    (new.first_successful_charge_at is null or new.first_successful_charge_at > old.first_successful_charge_at) then
    raise exception 'First successful charge cannot be cleared or moved forward';
  end if;
  if new.family_id is not null and not exists (
    select 1 from public.families f where f.id = new.family_id and f.owner_id = new.owner_id
  ) then raise exception 'Launch account must belong to the family owner'; end if;
  return new;
end;
$$;
create trigger launch_account_terms before insert or update on public.launch_billing_accounts
  for each row execute function launch_internal.check_account_terms();

-- Called only after the server verifies the provider event and product mapping.
-- A subscription becoming active during a free trial is NOT proof of payment.
create function public.launch_issue_call_grant(
  p_account uuid, p_event text, p_phase text, p_start timestamptz,
  p_end timestamptz, p_successful_charge_at timestamptz default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  a public.launch_billing_accounts%rowtype;
  terms public.launch_catalog_prices%rowtype;
  g public.launch_call_grants%rowtype;
  grant_id uuid;
begin
  select * into a from public.launch_billing_accounts where id = p_account for update;
  if not found then raise exception 'Launch account not found'; end if;
  if a.status = 'canceled' then raise exception 'Canceled launch account'; end if;
  if p_event is null or length(p_event) = 0 or p_phase is null or p_phase not in ('trial', 'paid')
    or p_start is null or p_end is null or p_end <= p_start then
    raise exception 'Invalid launch grant';
  end if;
  if p_phase = 'trial' and (p_end <> p_start + interval '168 hours' or p_successful_charge_at is not null) then
    raise exception 'A launch trial lasts seven days without a successful charge';
  end if;
  if p_phase = 'paid' and (p_successful_charge_at is null or p_successful_charge_at > now()) then
    raise exception 'A verified successful charge timestamp is required';
  end if;
  select * into terms from public.launch_catalog_prices
    where (catalog_version, market, plan) = (a.catalog_version, a.market, a.plan);
  select * into g from public.launch_call_grants
    where environment = a.environment and provider_event_id = p_event;
  if found then
    if (g.account_id, g.phase, g.period_start, g.period_end)
      is distinct from (p_account, p_phase, p_start, p_end) then
      raise exception 'Conflicting provider event replay';
    end if;
    return g.id;
  end if;
  if p_phase = 'trial' and a.first_successful_charge_at is not null then
    raise exception 'Paid accounts cannot restart a trial';
  end if;
  -- Distinct delivery IDs for the same period cannot replenish spent calls.
  select * into g from public.launch_call_grants
    where account_id = p_account and phase = p_phase and period_start = p_start;
  if found then
    if g.period_end <> p_end then raise exception 'Conflicting billing period'; end if;
    grant_id := g.id;
  else
    if exists (select 1 from public.launch_call_grants
      where account_id = p_account and phase = p_phase
        and period_start < p_end and period_end > p_start) then
      raise exception 'Overlapping launch billing periods';
    end if;
    insert into public.launch_call_grants(account_id, environment, provider_event_id, phase, period_start, period_end, total_calls)
      values (a.id, a.environment, p_event, p_phase, p_start, p_end,
        case when p_phase = 'trial' then terms.trial_calls else terms.monthly_calls end)
      returning id into grant_id;
  end if;
  update public.launch_billing_accounts set
    status = case when p_phase = 'paid' then 'active' else 'trialing' end,
    first_successful_charge_at = case when p_phase = 'paid'
      then least(first_successful_charge_at, p_successful_charge_at) else first_successful_charge_at end
    where id = a.id;
  return grant_id;
end;
$$;

create function public.launch_call_command(p_actor uuid, p_account uuid, p_action text, p_booking uuid default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  a public.launch_billing_accounts%rowtype;
  terms public.launch_catalog_prices%rowtype;
  g public.launch_call_grants%rowtype;
  r public.launch_call_reservations%rowtype;
  used integer;
  result jsonb;
begin
  -- All writers take this same lock; reservations and grants serialize per pool.
  select * into a from public.launch_billing_accounts where id = p_account for update;
  if not found then raise exception 'Launch account unavailable'; end if;
  if p_actor is null or not (p_actor = a.owner_id or exists (
    select 1 from public.family_members where family_id = a.family_id and user_id = p_actor
  )) then raise exception 'Launch account unavailable' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('snapshot', 'reserve', 'consume', 'release') then
    raise exception 'Invalid launch call command';
  end if;
  select * into terms from public.launch_catalog_prices
    where (catalog_version, market, plan) = (a.catalog_version, a.market, a.plan);
  if p_action <> 'snapshot' then
    if p_booking is null or not exists (
      select 1 from public.listener_bookings where id = p_booking and user_id = p_actor
    ) then raise exception 'Booking unavailable' using errcode = '42501'; end if;
    select * into r from public.launch_call_reservations where booking_id = p_booking;
    if found then
      if r.user_id <> p_actor or not exists (
        select 1 from public.launch_call_grants where id = r.grant_id and account_id = a.id
      ) then raise exception 'Booking unavailable' using errcode = '42501'; end if;
      if p_action = 'reserve' then
        if r.state = 'released' then raise exception 'Released booking cannot reserve again'; end if;
      elsif p_action = 'release' then
        if r.state = 'consumed' then raise exception 'Consumed calls cannot be released'; end if;
        update public.launch_call_reservations set state = 'released', settled_at = now() where booking_id = p_booking;
      else
        if r.state = 'released' then raise exception 'Released booking cannot be consumed'; end if;
        update public.launch_call_reservations set state = 'consumed', settled_at = coalesce(settled_at, now()) where booking_id = p_booking;
      end if;
    else
      if p_action <> 'reserve' then raise exception 'Call reservation not found'; end if;
      if a.status not in ('trialing', 'active') then raise exception 'Launch account is inactive'; end if;
      select * into g from public.launch_call_grants
        where account_id = a.id and period_start <= now() and period_end > now()
          and (phase = 'paid' or a.first_successful_charge_at is null)
        order by period_start desc limit 1;
      if not found then raise exception 'No current call allowance'; end if;
      select count(*) into used from public.launch_call_reservations where grant_id = g.id and state <> 'released';
      if used >= g.total_calls then raise exception 'Shared call allowance exhausted'; end if;
      insert into public.launch_call_reservations(booking_id, grant_id, user_id) values (p_booking, g.id, p_actor);
    end if;
  end if;
  select * into g from public.launch_call_grants
    where account_id = a.id and period_start <= now() and period_end > now()
      and (phase = 'paid' or a.first_successful_charge_at is null)
    order by period_start desc limit 1;
  select count(*) into used from public.launch_call_reservations where grant_id = g.id and state <> 'released';
  result := jsonb_build_object('catalogVersion', a.catalog_version, 'plan', a.plan, 'market', a.market,
    'people', terms.people, 'status', a.status, 'phase', g.phase, 'periodEnd', g.period_end,
    'totalCalls', coalesce(g.total_calls, 0), 'usedCalls', used,
    'remainingCalls', case when a.status in ('trialing', 'active') then greatest(0, coalesce(g.total_calls, 0) - used) else 0 end);
  if p_actor = a.owner_id then
    result := result || jsonb_build_object('firstSuccessfulChargeAt', a.first_successful_charge_at,
      'refundDeadline', a.first_successful_charge_at + interval '168 hours');
  end if;
  return result;
end;
$$;

-- Seat backstop for new catalog accounts. Existing consent/invitation commands
-- remain responsible for verifying invitees; these triggers never accept an invite.
create function launch_internal.enforce_family_capacity() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  cap integer;
  occupied integer;
  pending integer;
begin
  -- Reuse the existing family command's lock order: family before account.
  perform 1 from public.families where id = new.family_id for update;
  select c.people into cap from public.launch_billing_accounts a
    join public.launch_catalog_prices c using (catalog_version, market, plan)
    where a.family_id = new.family_id and a.environment = 'live'
      and a.status in ('trialing', 'active', 'suspended') for update of a;
  if not found then return new; end if;
  if tg_table_name = 'family_invitations' then
    if new.status not in ('pending', 'verification_pending') or new.expires_at <= now() then return new; end if;
    select count(*) into pending from public.family_invitations
      where family_id = new.family_id and id <> new.id
        and status in ('pending', 'verification_pending') and expires_at > now();
  else
    -- Invite acceptance can insert membership before marking its invite accepted.
    -- Count only joined members here; invitation writers reserve pending seats.
    pending := 0;
  end if;
  select count(*) into occupied from public.family_members
    where family_id = new.family_id and (tg_table_name = 'family_invitations' or id <> new.id);
  if occupied + pending >= cap then raise exception 'Launch family capacity reached (including owner)'; end if;
  return new;
end;
$$;
create trigger launch_family_member_capacity before insert or update of family_id on public.family_members
  for each row execute function launch_internal.enforce_family_capacity();
create trigger launch_family_invite_capacity before insert or update of family_id, status, expires_at on public.family_invitations
  for each row execute function launch_internal.enforce_family_capacity();

revoke all on all functions in schema launch_internal from public, anon, authenticated;
revoke all on function public.launch_issue_call_grant(uuid, text, text, timestamptz, timestamptz, timestamptz),
  public.launch_call_command(uuid, uuid, text, uuid) from public, anon, authenticated;
grant execute on function public.launch_issue_call_grant(uuid, text, text, timestamptz, timestamptz, timestamptz),
  public.launch_call_command(uuid, uuid, text, uuid) to service_role;
