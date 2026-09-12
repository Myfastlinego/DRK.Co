# Supabase Admin Authentication

The `safe/supabase-admin-login` branch is prepared for Supabase Authentication.

## Security
- Browser code must use only the Supabase publishable key.
- Never put a Supabase secret/service-role key in `index.html` or any browser-loaded file.
- Authentication should use `supabase.auth.signInWithPassword()`.
- The accounting app continues to use its existing localStorage data model; Supabase Auth controls access only.

## Required login identity
Supabase password login authenticates by email/password. The UI can label the field `User ID / Email`, or the app can map a chosen User ID to the email address of the Supabase Auth user.

## Existing branch state
`index.html` currently contains the legacy frontend-only admin gate and must be migrated to the Supabase Auth flow before this branch is merged into `main`.
