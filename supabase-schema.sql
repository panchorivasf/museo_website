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
  -- Bibliographic references shown as an appendix on the species page.
  -- Array of { "citation": text, "url": text|null }. "references" is a reserved
  -- word in SQL, so it must always be double-quoted here (same as "order" above).
  "references" jsonb not null default '[]',
  created_at timestamptz default now()
);

-- Migration for databases created before the references column existed
alter table species add column if not exists "references" jsonb not null default '[]';

-- Link to the GBIF taxon this species corresponds to, for the case where the
-- authority used here (e.g. Birds of the World) places it in a different genus
-- than GBIF does. scientific_name always keeps this museum's chosen name; when
-- gbif_usage_key is set, GBIF and IUCN are queried by that key instead of by name.
-- gbif_scientific_name records the accepted name under that key, so the equivalence
-- is visible in the admin and stated in the citations.
alter table species add column if not exists gbif_usage_key bigint;
alter table species add column if not exists gbif_scientific_name text;

-- Global IUCN Red List category (EX/EW/CR/EN/VU/NT/LC/DD), fetched in the admin.
-- Kept separate from conservation_status, which records the classification used
-- locally: a species can be Least Concern globally and threatened nationally.
alter table species add column if not exists iucn_global_status text;

-- Pre-rendered spectrogram picture, baked in the admin from the row's own
-- spectrogram_min / spectrogram_max / fft_size settings so visitors download an
-- image instead of running an FFT in the browser. Shape (see src/lib/spectrogram.js):
--   { "url", "audio_url", "min_hz", "max_hz", "fft_size",
--     "vis_min_hz", "vis_max_hz", "resolved_fft_size",
--     "width", "height", "duration", "built_at" }
-- The audio_url / min_hz / max_hz / fft_size fields record what the image was built
-- from: when they no longer match the row, the players ignore it and compute live.
alter table species add column if not exists spectrogram_image jsonb;

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

-- Same pre-rendered picture as above, for pins that carry their own audio.
alter table map_recordings add column if not exists spectrogram_image jsonb;

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

grant select on table blog_posts to anon;
grant select, insert, update, delete on table blog_posts to authenticated;

-- Conceptos (bioacoustics theory/concept articles, same shape as blog_posts)
create table if not exists concepts (
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

alter table concepts enable row level security;

create policy "Public read published concepts"
  on concepts for select using (published = true);

create policy "Auth read all concepts"
  on concepts for select using (auth.role() = 'authenticated');

create policy "Auth insert concepts"
  on concepts for insert with check (auth.role() = 'authenticated');

create policy "Auth update concepts"
  on concepts for update using (auth.role() = 'authenticated');

create policy "Auth delete concepts"
  on concepts for delete using (auth.role() = 'authenticated');

grant select on table concepts to anon;
grant select, insert, update, delete on table concepts to authenticated;

-- Publicaciones (peer-reviewed articles and other outputs by the museum's team).
-- Flat records rather than block-based like blog_posts/concepts: everything a
-- visitor needs -- title, abstract, figure, and the links out -- fits on one card,
-- so there is no per-publication detail page and therefore no slug column.
create table if not exists publications (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  authors text,
  -- Journal / conference / publisher, shown next to the year.
  venue text,
  year integer,
  abstract text,
  -- Representative figure. figure_caption doubles as the img alt text.
  figure_url text,
  figure_caption text,
  -- Either or both may be set; the card renders one button per populated link.
  article_url text,
  pdf_url text,
  published boolean not null default false,
  -- Manual display order. Null everywhere means "sort by year", which is the
  -- default; the admin's custom mode numbers every row and drag-and-drop
  -- rewrites those numbers. Both lists order by sort_order first (nulls last),
  -- then year desc, so one query serves either mode.
  sort_order integer,
  created_at timestamptz default now()
);

-- Migration for databases created before the manual ordering existed
alter table publications add column if not exists sort_order integer;

alter table publications enable row level security;

create policy "Public read published publications"
  on publications for select using (published = true);

create policy "Auth read all publications"
  on publications for select using (auth.role() = 'authenticated');

create policy "Auth insert publications"
  on publications for insert with check (auth.role() = 'authenticated');

create policy "Auth update publications"
  on publications for update using (auth.role() = 'authenticated');

create policy "Auth delete publications"
  on publications for delete using (auth.role() = 'authenticated');

grant select on table publications to anon;
grant select, insert, update, delete on table publications to authenticated;
