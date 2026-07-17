# Aqua — water tracker

A mobile PWA for logging hourly water breaks with a short video clip,
reviewed later in an admin panel. Free to run forever on Supabase's
free tier + a free static host (Vercel/Netlify).

## 1. Create the Supabase project (free)

1. Go to https://supabase.com → New project. No credit card needed.
2. Once it's created, open **SQL Editor** → New query, paste the
   contents of `supabase/schema.sql`, and run it.
3. Open a second new query, paste the contents of
   `supabase/migration_02_profile.sql`, and run it too — this adds
   the name/avatar fields and the avatars storage bucket used by the
   profile screen.
4. Go to **Project Settings → API** (or **Settings → Data API** /
   **Settings → API Keys** depending on your project's dashboard
   version) and copy the **Project URL** and **anon/publishable
   key**.
4. Go to **Authentication → Providers** and make sure **Email** is
   enabled (it is by default). Turn off "Confirm email" under
   Authentication → Settings if you want sign-up to work instantly
   without an email confirmation step (fine for a 1-2 person app).

## 2. Set up the project locally in VS Code

```bash
npm install
cp .env.example .env
```

Open `.env` and paste in your Supabase URL + anon key from step 1.

```bash
npm run dev
```

Open the printed `localhost` URL. To test the camera flow on your
phone: make sure your phone and laptop are on the same wifi, then
open the printed **Network** URL (something like
`http://192.168.x.x:5173`) on your phone. Camera access requires
either `localhost` or HTTPS, so this local-network testing is fine on
Chrome; Safari on iOS is stricter and may want HTTPS — testing after
deploying (step 4) is the reliable way to check it there.

## 3. Make yourself admin

After you sign up once through the app's login screen, go back to
Supabase's SQL Editor and run:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

Now when that account logs in, it lands on the Admin panel instead of
the tracker. Create a second account (your own email + a "+alias",
e.g. `you+partner@gmail.com`, works fine for testing) for the actual
user being tracked — it'll default to the regular tracker view.

## 4. Deploy for free

**Vercel** (recommended, simplest):
1. Push this folder to a GitHub repo.
2. Go to vercel.com → New Project → import the repo.
3. Framework preset: Vite. Add the two env vars
   (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) in the project
   settings.
4. Deploy. You'll get a free `*.vercel.app` HTTPS URL — camera and
   notifications need HTTPS, so this matters.

**Netlify** works the same way (`npm run build`, publish directory
`dist`).

## 5. Install it as an app on the phone

- **Android (Chrome):** open the deployed URL → menu → "Add to Home
  screen." Push notifications work in the background from there.
- **iPhone (Safari):** open the URL → Share → "Add to Home Screen."
  This step is required on iOS — web push notifications do not work
  in a normal Safari tab, only in an installed PWA.

## How the schedule/alarm actually works right now

The default schedule is hourly, 9am–9pm (edit `DEFAULT_HOURS` in
`src/components/Dashboard.jsx` to change it). While the app/PWA is
open or backgrounded, it checks once a minute and fires a local
notification when a slot's time arrives and hasn't been logged yet.

## Real push notifications (work even when the app is fully closed)

The in-app reminder (`useReminders.js`) only fires while the app is open
or backgrounded. For reminders that arrive no matter what — app closed,
phone locked — this project uses **OneSignal** (free push delivery) plus
a **GitHub Actions cron job** (free scheduled server) that checks every
hour who hasn't logged their water break yet and pushes them a
notification directly.

### A. Create a OneSignal app (free)

1. Go to https://onesignal.com → sign up → **New App/Website**
2. Platform: **Web Push** → Integration: **Typescript/Javascript (Custom Code)**
3. Site name: anything. Site URL: your deployed Vercel URL (you can
   update this later once deployed)
4. Finish setup, then go to **Settings → Keys & IDs**. Copy:
   - **OneSignal App ID**
   - **REST API Key**

### B. Add the App ID to the frontend

In your local `.env`:
```
VITE_ONESIGNAL_APP_ID=paste-your-app-id-here
```
Add the same variable in **Vercel → Project Settings → Environment
Variables**, then redeploy (Vercel → Deployments → ⋯ → Redeploy) so the
live site picks it up.

### C. Get your Supabase service role key

This is different from the anon key — it can bypass Row Level Security,
so it's only ever used server-side, never in the frontend `.env`.

Supabase → **Settings → API Keys** → copy the **`service_role`** key
(under "Legacy API Keys" if your project shows that tab, otherwise the
**secret key**).

### D. Add secrets to your GitHub repo

Your repo → **Settings → Secrets and variables → Actions → New
repository secret**. Add each of these:

| Secret name | Value |
|---|---|
| `SUPABASE_URL` | same as `VITE_SUPABASE_URL` |
| `SUPABASE_SERVICE_ROLE_KEY` | the `service_role` key from step C |
| `ONESIGNAL_APP_ID` | same as `VITE_ONESIGNAL_APP_ID` |
| `ONESIGNAL_REST_API_KEY` | the REST API Key from step A |

### E. That's it — the workflow is already in the repo

`.github/workflows/reminders.yml` runs `scripts/send-reminders.mjs`
every hour automatically, for free, as long as the repo exists on
GitHub (no server for you to host or pay for). It:
- Checks the current hour against the schedule (`SCHEDULE_HOURS` in
  the script, same hours as `DEFAULT_HOURS` in `Dashboard.jsx` —
  keep them in sync if you change one)
- Looks up who hasn't logged that slot yet in Supabase
- Sends them a push via OneSignal's API, targeted by their user ID

You can test it immediately without waiting for the clock: go to your
repo's **Actions** tab → **Hourly water reminders** → **Run workflow**.
Check the run's logs to see who it would've messaged.

**Notes:**
- GitHub's free cron isn't millisecond-precise — it can run a few
  minutes late under load. Fine for an hourly reminder.
- The script assumes users are in the `Asia/Kolkata` timezone
  (`TIMEZONE` constant at the top of `scripts/send-reminders.mjs`) —
  change it if that's not right for your users.
- A user only starts receiving push notifications after they've opened
  the deployed app at least once and accepted the browser's
  notification permission prompt (this happens automatically on login
  now — see `App.jsx`).

The old in-app reminder (`useReminders.js`) still runs too — it's a
harmless, redundant backup for while the app happens to be open.

## Two other things worth knowing

**"Confirm email" toggle** — Supabase → **Authentication → Providers →
Email** → toggle off **Confirm email**, then Save. (Some project
versions show this under **Authentication → Settings** instead — same
setting, different location depending on your dashboard version.) With
it off, `signUp()` logs the user in immediately instead of waiting on a
confirmation email.

**Being asked to log in again after reopening the app** — this build
now explicitly configures Supabase to persist your session in
`localStorage` (see `src/supabaseClient.js`), which should keep you
logged in indefinitely. If it still happens after redeploying:
- Make sure you're always opening the app from the same installed
  home-screen icon, not sometimes from a plain browser tab — on iOS
  those can be treated as separate storage.
- Avoid private/incognito browsing, which never persists storage.
- iOS Safari can clear site data for installed PWAs that go
  completely unopened for roughly a week — unavoidable at the
  platform level, not something the app's code controls.

## Verification is manual by design

There's no drinking-detection AI in this build, per your call: any
clip that uploads successfully counts immediately and silences the
alarm until the next slot. You review clips afterward in the admin
panel and mark them reviewed. If you ever want to add lightweight
auto-flagging later (e.g. "no bottle/cup visible → flag for review"),
that can be layered on without changing this core flow.

## Calorie tracking

Simple manual log for now — quick-add buttons (100/250/400/600 kcal)
plus a custom amount field, with a daily total against a 2000 kcal
default goal (change `goal` prop on `<CalorieTracker />` in
`Dashboard.jsx`).

## Project structure

```
src/
  components/
    WaterTank.jsx        the animated fill/wave progress visual
    TrackWaterModal.jsx   camera capture + upload flow
    CalorieTracker.jsx    daily calorie log widget
    Dashboard.jsx          main screen for a regular user
    Profile.jsx             avatar/name, streak, 14-day history
    Avatar.jsx               photo-or-initials avatar, shared
    AdminPanel.jsx           Overview (per-user stats) + Clips (review), role = admin
    Login.jsx               email/password auth
  useReminders.js          hourly notification polling
  supabaseClient.js
supabase/
  schema.sql                run once in Supabase's SQL editor
  migration_02_profile.sql  run second — adds name/avatar + avatars bucket
public/manifest.json, sw.js  PWA install + notification plumbing
```

## Design

Playful/vibrant direction: electric aqua (`#00C2FF`) + coral, sunshine
yellow, and grape accents on a pale sky-blue background, Fredoka for
headlines and Nunito for body text. The signature element is still
the wave-filling tank, now with floating bubble decorations and
bouncier "press-pop" button motion throughout. All the new tokens
live in `tailwind.config.js` if you want to nudge the palette.

## Profile screen

Tap the avatar in the top-right of the dashboard. Users can upload a
photo (falls back to colored initials if they don't), set a display
name, and see a streak counter plus their last 14 days of water +
calorie activity.

## Admin panel

Two tabs now:
- **Overview** — every tracked user with today's water count and
  calorie total at a glance.
- **Clips** — the original clip-by-clip video review, with a badge
  showing how many are still unreviewed.
