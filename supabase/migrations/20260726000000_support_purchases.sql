-- Phase 17: optional, one-time product-support purchases.
--
-- This table is intentionally account-scoped. It has no workspace_id and no
-- relationship to any workspace financial table, so support purchases can
-- never participate in income, expense, balance, report, or history queries.

create table public.support_purchases (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.user_profiles(id) on delete cascade,
    tier_id text not null,
    channel text not null
        constraint support_purchases_channel_check
        check (channel in ('web', 'ios', 'android')),
    provider_transaction_id text not null,
    amount_minor_units bigint not null
        constraint support_purchases_positive_amount_check
        check (amount_minor_units > 0),
    currency text not null,
    status text not null default 'pending'
        constraint support_purchases_status_check
        check (status in ('pending', 'completed', 'failed', 'refunded')),
    failure_reason text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint support_purchases_channel_transaction_unique
        unique (channel, provider_transaction_id)
);

create index support_purchases_user_created_at_idx
    on public.support_purchases (user_id, created_at desc);

revoke all on public.support_purchases from anon, authenticated;
grant select on public.support_purchases to authenticated;

alter table public.support_purchases enable row level security;

create policy "Users can read own support purchases"
on public.support_purchases
for select
to authenticated
using (user_id = auth.uid());
