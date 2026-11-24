-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  credits int not null default 100 check (credits >= 0),
  credits_reset_at timestamptz not null default (now() + interval '1 month'),
  created_at timestamptz not null default now()
);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('chat','image','voice','video')),
  prompt text not null,
  style text,
  result_text text,
  file_path text,
  result_url text,
  status text not null default 'done' check (status in ('pending','done','failed')),
  meta jsonb,
  created_at timestamptz not null default now()
);
create index generations_user_created on public.generations (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.generations enable row level security;

-- Users can read only their own rows. They can never change credits.
create policy "read own profile" on public.profiles for select using (id = auth.uid());
create policy "rename own profile" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (display_name) on public.profiles to authenticated;

-- Generations are written only by the server function (service role), never by the browser.
create policy "read own generations" on public.generations for select using (user_id = auth.uid());
create policy "delete own generations" on public.generations for delete using (user_id = auth.uid());

-- Create a profile automatically for every new user (email or Google)
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Credits: only the server (service role) can spend or refund
create function public.spend_credits(p_user uuid, p_amount int) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set credits = 100, credits_reset_at = now() + interval '1 month'
    where id = p_user and now() >= credits_reset_at;          -- monthly refill
  update public.profiles set credits = credits - p_amount
    where id = p_user and credits >= p_amount;
  return found;
end $$;

create function public.refund_credits(p_user uuid, p_amount int) returns void
language sql security definer set search_path = public as $$
  update public.profiles set credits = credits + p_amount where id = p_user;
$$;

revoke all on function public.spend_credits(uuid, int), public.refund_credits(uuid, int) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid, int), public.refund_credits(uuid, int) to service_role;

-- Private file storage: each user can only see and delete files in their own folder
insert into storage.buckets (id, name, public) values ('media', 'media', false) on conflict do nothing;
create policy "read own media" on storage.objects for select to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "delete own media" on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
