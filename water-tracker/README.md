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
3b. Run `supabase/migration_03_food_and_admin_delete.sql`, then
   `supabase/migration_04_goals.sql` (adds editable water goals). Real
   push notifications need one more setup step outside the
   database — see "Real push notifications" below.
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
3. Framework preset: Vite. Add the env vars (`VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`, and `VITE_ONESIGNAL_APP_ID` if you're
   using push notifications) in the project settings.
4. Deploy. You'll get a free `*.vercel.app` HTTPS URL — camera and
   notifications need HTTPS, so this matters.

**Netlify** works the same way — `netlify.toml` in this repo already
has the build command (`npm run build`) and publish directory
(`dist`) set up, plus the redirect rule a single-page app needs. Add
the same env vars in Site settings → Environment variables.

## 5. Install it as an app on the phone

- **Android (Chrome):** open the deployed URL → menu → "Add to Home
  screen." Push notifications work in the background from there.
- **iPhone (Safari):** open the URL → Share → "Add to Home Screen."
  This step is required on iOS — web push notifications do not work
  in a normal Safari tab, only in an installed PWA.

## Editable per-user water goals

Each user sets their own schedule from the Profile screen — no more
fixed 9am–9pm hourly grid for everyone. Three numbers, saved to their
`profiles` row (`water_start_hour`, `water_end_hour`,
`water_slot_count`): a start hour, an end hour, and how many reminders
to spread evenly across that window (1–24). `src/lib/schedule.js`
turns those three numbers into the day's actual slot times, rounded
to the nearest 15 minutes. There's also a per-user calorie goal
(`calorie_goal`) next to it in the same form.

## Weekly/monthly charts

The Profile screen's "History" section now has three views: **List**
(the original day-by-day rows), **Weekly** (last 7 days), and
**Monthly** (last 30 days) — each as a small bar chart for water
breaks and one for calories, with a dashed goal line. These are
hand-rolled SVG (`src/components/WaterChart.jsx`), not a charting
library, so there's no new npm dependency to install.

## Admin calendar JPEG export

From the admin **Overview** tab, tap the 📅 button on any user to open
a month picker. It draws a calendar grid on an HTML canvas — 💧 plus
that day's water-break count, 🔥 plus that day's total calories — and
lets you preview it before downloading it as a JPEG
(`src/components/CalendarExport.jsx`). No server round-trip beyond
the normal Supabase queries; the image is generated entirely in the
browser.

## Real push notifications (background, even when the app is closed)

While the app/PWA is open or backgrounded, `useReminders.js` polls
every 20s and fires a local notification when a slot goes overdue —
that part doesn't need any setup. But a closed app can't run
JavaScript, so that local check alone can't wake it back up. Real
background push needs a server to send the notification *to* the
closed app, which is what this adds:

- **[OneSignal](https://onesignal.com)** (free tier, no card
  required) handles the actual push delivery and device subscriptions
  — no server code needed on your side for that part.
- A small **Node script** (`scripts/send-reminders.mjs`) checks every
  user's own goal settings (start hour, end hour, reminders/day —
  same ones they set in Profile) and, for anyone with a due, unlogged
  slot, asks OneSignal to push them a notification.
- A **GitHub Actions workflow** (`.github/workflows/reminders.yml`)
  runs that script every 15 minutes for free — no separate server or
  cron host needed.

Setup, one time:

1. **Create a free OneSignal app:** onesignal.com → New App → choose
   "Web Push" as the platform. Fill in your site's URL (the deployed
   one, e.g. `https://your-app.vercel.app`). You'll land on a
   settings page with your **App ID** and, under Keys & IDs, a
   **REST API Key**.
2. **Frontend:** add `VITE_ONESIGNAL_APP_ID=...` to `.env` (and to
   your host's env vars if deployed), then redeploy/rebuild. This is
   what `index.html` uses to initialize the OneSignal SDK.
3. **GitHub Actions secrets:** in your repo → Settings → Secrets and
   variables → Actions, add four secrets:
   - `SUPABASE_URL` — your project URL
   - `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API →
     service_role key (bypasses RLS so the script can read every
     user's schedule and logs — keep this out of the frontend, it
     only ever lives here as a GitHub secret)
   - `ONESIGNAL_APP_ID` — same value as `VITE_ONESIGNAL_APP_ID`
   - `ONESIGNAL_REST_API_KEY` — from OneSignal's Keys & IDs page
4. **That's it** — the workflow runs automatically every 15 minutes
   once it's on GitHub's default branch. You can also trigger it by
   hand from the repo's Actions tab (`workflow_dispatch`) to test it
   right away instead of waiting.
5. **Turn it on per user:** in the app, Profile → "Push
   notifications" → Enable. This is a separate, explicit step from
   just being logged in — the app links your OneSignal subscription
   to your account on login (`App.jsx`), but doesn't prompt for
   notification permission until you actually opt in here.

Each user's local timezone (`profiles.timezone`, an IANA name like
`Asia/Kolkata`, defaulting to that) is what the script uses to work
out when their slots are actually due — there's no UI for changing it
yet, so update it directly in the `profiles` table via the SQL editor
if a user is somewhere else.

**Limitations to know about:**
- iOS requires the site to be installed as a home-screen PWA before
  push permission can even be requested — a plain Safari tab can't do
  background push at all. Android Chrome works from either a normal
  tab or an installed PWA.
- GitHub Actions' scheduled workflows are "best effort" — under
  load, a run can be delayed by several minutes past its scheduled
  time (GitHub's own documentation notes this). For a personal
  water-reminder app that's a non-issue; if it ever matters, the
  Supabase-edge-function + pg_cron approach (an earlier version of
  this file used it) runs on a tighter, dedicated schedule instead —
  ask if you'd rather switch back to that.

## Verification is manual by design

There's no drinking-detection AI in this build, per your call: any
clip that uploads successfully counts immediately and silences the
alarm until the next slot. You review clips afterward in the admin
panel and mark them reviewed. If you ever want to add lightweight
auto-flagging later (e.g. "no bottle/cup visible → flag for review"),
that can be layered on without changing this core flow.

## Calorie tracking

Simple manual log — quick-add buttons (100/250/400/600 kcal) plus a
custom amount field or the Indian-food search, with a daily total
against each user's own calorie goal (set from Profile → "Your goal",
defaults to 2000 kcal).

## Project structure

```
src/
  components/
    WaterTank.jsx         the animated fill/wave progress visual
    TrackWaterModal.jsx   camera capture + upload flow
    CalorieTracker.jsx    daily calorie log widget
    WaterChart.jsx         dependency-free SVG bar chart (weekly/monthly)
    CalendarExport.jsx     admin canvas -> JPEG calendar export
    Dashboard.jsx          main screen for a regular user
    Profile.jsx             avatar/name, streak, goal settings, charts, push toggle
    Avatar.jsx               photo-or-initials avatar, shared
    AdminPanel.jsx           Overview (per-user stats + export) + Clips (review), role = admin
    Login.jsx               email/password auth
  lib/
    date.js                 local-time date helpers
    schedule.js              builds a day's slots from a user's goal settings
    oneSignalPush.js         OneSignal subscribe/unsubscribe helpers
    indianFoodDb.js           calorie lookup data
  useReminders.js          in-app (foreground/backgrounded) notification polling
  supabaseClient.js
supabase/
  schema.sql                          run once in Supabase's SQL editor
  migration_02_profile.sql            adds name/avatar + avatars bucket
  migration_03_food_and_admin_delete.sql
  migration_04_goals.sql              adds editable per-user water/calorie goals
scripts/send-reminders.mjs   checks due slots per user, sends via OneSignal's REST API
.github/workflows/reminders.yml   runs that script every 15 min via GitHub Actions
public/manifest.json, sw.js  PWA install + local reminders + OneSignal's worker
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
name, and see a streak counter. Below that: an editable water/calorie
goal form, a push-notification toggle, and a History section with
List/Weekly/Monthly views of their water + calorie activity.

## Admin panel

Two tabs:
- **Overview** — every tracked user with today's water count and
  calorie total at a glance, plus a 📅 button to export that user's
  monthly calendar as a JPEG.
- **Clips** — the original clip-by-clip video review, with a badge
  showing how many are still unreviewed.

## Cost

Everything here runs on free tiers: Supabase's free project tier
(database, auth, storage), a free static host (Vercel/Netlify),
OneSignal's free plan (covers push notifications for a small number
of users comfortably), and GitHub Actions' free minutes for public
(or low-usage private) repos to run the reminder cron. No new npm
packages were added for the charts or the calendar export — both are
hand-rolled (SVG and Canvas respectively) to avoid extra dependencies.
The only things worth watching as usage grows are Supabase's free-tier
storage/bandwidth caps for the video clips, and OneSignal's free-tier
subscriber limit if this ever goes beyond a handful of people.
