# Museo Bioacústico — Sitio Web

A web application for exploring and cataloging bioacoustic recordings of wildlife species. Built with React, Vite, Tailwind CSS, and Supabase.

## Features

- Species catalog with taxonomic filtering
- Audio playback with spectrogram visualization
- Interactive biophony map
- Admin panel for managing species and recordings
- Authentication (login, register, password reset)

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project

## Getting Started

1. Clone the repository:
   ```bash
   git clone https://github.com/panchorivasf/museo_website.git
   cd museo_website
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the example env file and fill in your Supabase credentials:
   ```bash
   cp .env.example .env.local
   ```

   Required variables:
   ```
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

## Database

The Supabase schema is defined in [supabase-schema.sql](supabase-schema.sql). Run it in your Supabase SQL editor to set up the required tables.

## Tech Stack

- [React](https://react.dev) + [Vite](https://vitejs.dev)
- [Tailwind CSS](https://tailwindcss.com) + [shadcn/ui](https://ui.shadcn.com)
- [Supabase](https://supabase.com) (database + auth)
