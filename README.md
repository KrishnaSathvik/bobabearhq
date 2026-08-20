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
2. Run the SQL files in `supabase/migrations/` in filename order.
3. Copy `.env.example` to `.env.local` and add the project URL and public anonymous key.
4. Create the shared authentication user `bobabearkhammam@gmail.com` in Supabase Auth.

When the environment variables are present, the private login boundary, shared synchronization, file uploads, and reference-pack import are enabled.

## Import the planning references

After the migrations are applied, sign in, open **Library**, and choose **Add references**. The import is safe to run again: each reference has a stable import key, so it will not create duplicates. Imported planning information is labeled as reference, researching, testing, or sample needed—never selected automatically.
