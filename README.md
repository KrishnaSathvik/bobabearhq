# Boba Bear HQ

A calm private workspace for planning and operating Boba Bear Khammam.

## Run locally

```bash
npm install
npm run dev
```

Without Supabase environment variables, the frontend stores changes in the browser for local design testing.

## Shared workspace setup

1. Create a Supabase project.
2. Run `supabase/migrations/202608200001_initial_workspace.sql` in the SQL editor.
3. Copy `.env.example` to `.env.local` and add the project URL and public anonymous key.
4. Create the shared authentication user `bobabearkhammam@gmail.com` in Supabase Auth.

When the environment variables are present, the private login boundary is enabled. Shared item synchronization and Storage uploads are the next connection step.
