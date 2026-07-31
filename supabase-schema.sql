-- Run this entire file in the Supabase SQL Editor (Project → SQL Editor → New query)

-- Species table
create table if not exists species (
  id uuid primary key default gen_random_uuid(),
  common_name text not null,
  scientific_name text not null,
  taxon text not null,
  "order" text,
  family text,
  genus text,
  conservation_status text,
  description text,
  sound_description text,
  audio_url text,
  image_url text,
  habitat text,
  frequency_range text,
  recording_location text,
  recording_date text,
  recordist text,
  featured boolean default false,
  created_at timestamptz default now()
);

-- Map recordings table
create table if not exists map_recordings (
  id uuid primary key default gen_random_uuid(),
  species_id uuid references species(id) on delete set null,
  latitude numeric not null,
  longitude numeric not null,
  location_name text,
  elevation numeric,
  audio_url text,
  recording_date text,
  recordist text,
  description text,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table species enable row level security;
alter table map_recordings enable row level security;

-- Public can read everything
create policy "Public read species"
  on species for select using (true);

create policy "Public read map_recordings"
  on map_recordings for select using (true);

-- Authenticated users can write everything
create policy "Auth insert species"
  on species for insert with check (auth.role() = 'authenticated');

create policy "Auth update species"
  on species for update using (auth.role() = 'authenticated');

create policy "Auth delete species"
  on species for delete using (auth.role() = 'authenticated');

create policy "Auth insert map_recordings"
  on map_recordings for insert with check (auth.role() = 'authenticated');

create policy "Auth update map_recordings"
  on map_recordings for update using (auth.role() = 'authenticated');

create policy "Auth delete map_recordings"
  on map_recordings for delete using (auth.role() = 'authenticated');

-- Blog
create table if not exists blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  author_name text,
  slug text unique not null,
  cover_image_url text,
  content jsonb not null default '[]',
  published boolean not null default false,
  created_at timestamptz default now()
);

alter table blog_posts enable row level security;

create policy "Public read published blog_posts"
  on blog_posts for select using (published = true);

create policy "Auth read all blog_posts"
  on blog_posts for select using (auth.role() = 'authenticated');

create policy "Auth insert blog_posts"
  on blog_posts for insert with check (auth.role() = 'authenticated');

create policy "Auth update blog_posts"
  on blog_posts for update using (auth.role() = 'authenticated');

create policy "Auth delete blog_posts"
  on blog_posts for delete using (auth.role() = 'authenticated');
