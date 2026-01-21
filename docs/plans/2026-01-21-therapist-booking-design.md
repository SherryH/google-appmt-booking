# Therapist Appointment Auto-Booking Tool - Design Document

**Date**: 2026-01-21
**Status**: Validated

## Overview

An automated tool that books therapist appointments from Google Calendar Appointment Scheduling at midnight when new slots are released. The tool runs nightly until it successfully books one of your preferred time slots.

## Requirements

### Functional
- Auto-book preferred appointment slots at 12:00am when released
- Support ranked preferences (try in order until one succeeds)
- Retry nightly until successful booking or manual deactivation
- Send email notification on success/failure
- Mobile-friendly trigger via Replit app

### Non-Functional
- Cost: ~$0-2/month
- Secure: No public endpoints exposed
- Testable: Separate test calendar for development

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     YOUR PHONE                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Replit App → Project → Shell → npm run activate │   │
│  └──────────────────────┬──────────────────────────┘   │
└─────────────────────────┼───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│                    REPLIT (Cloud)                       │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │              Booking Service                     │   │
│  │                                                  │   │
│  │  ┌───────────┐  ┌───────────┐  ┌─────────────┐ │   │
│  │  │ Scheduler │→ │ Puppeteer │→ │  Resend     │ │   │
│  │  │ (cron)    │  │ (browser) │  │  (email)    │ │   │
│  │  └───────────┘  └───────────┘  └─────────────┘ │   │
│  │                                                  │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  config.json: preferences, booking_url, active  │   │
│  └─────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼ books slot
┌─────────────────────────────────────────────────────────┐
│         Google Calendar Appointment Page                │
└─────────────────────────────────────────────────────────┘
```

## Components

### 1. Scheduler (Cron Job)
- Runs at 12:00am daily via Replit Deployments
- Checks if job is active before proceeding
- Triggers booking logic

### 2. Booking Logic (Puppeteer)
- Navigates to Google Calendar appointment page
- Scrapes available slots for the newly released month
- Matches slots against ranked preferences (first match wins)
- Fills form and submits booking
- Verifies confirmation page

### 3. Notifier (Resend Email)
- Sends email on successful booking (with details)
- Sends email on errors or repeated failures
- Free tier: 100 emails/day

### 4. Configuration
```json
{
  "booking_url": "https://calendar.google.com/calendar/appointments/...",
  "preferences": ["Tue 3pm", "Thu 2pm", "Wed 4pm"],
  "active": false,
  "email": "your@email.com"
}
```

## Booking Flow

```
START (triggered by cron at 12:00am)
    │
    ▼
┌─────────────────────────────────┐
│ Check: active?                  │──NO──▶ Skip, exit
└───────────────┬─────────────────┘
                │ YES
                ▼
┌─────────────────────────────────┐
│ Load preferences from config    │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│ Navigate to booking page        │
│ (Puppeteer)                     │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│ Scrape available slots          │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│ Match against preferences       │
│ (try in ranked order)           │
└───────────────┬─────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
   [Match found]   [No match]
        │               │
        ▼               ▼
┌──────────────┐  ┌─────────────┐
│ Click slot   │  │ Log result  │
│ Fill form    │  │ Email if    │
│ Submit       │  │ 3+ failures │
└──────┬───────┘  │ Try tomorrow│
       │          └─────────────┘
       ▼
┌─────────────────────────────────┐
│ Verify confirmation             │
└───────────────┬─────────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
   [Success]        [Failed]
        │               │
        ▼               ▼
┌──────────────┐  ┌─────────────┐
│ Send email   │  │ Send alert  │
│ with details │  │ Try tomorrow│
└──────────────┘  └─────────────┘
```

## Mobile Trigger

**Method**: Replit App Shell (secure, no public endpoints)

```
1. Open Replit app on phone
2. Tap project
3. Tap "Shell" tab
4. Type: npm run activate
5. See confirmation message
```

**Alternative**: Configure Run button for interactive menu:
```
What would you like to do?
[1] Activate booking job
[2] Check status
[3] Deactivate
```

## Notification Triggers

| Event | Email |
|-------|-------|
| Booking successful | ✅ With appointment details |
| No slots matched today | ❌ Skip (expected) |
| 3+ consecutive failures | ✅ "Check if something broke" |
| Error (page changed, etc.) | ✅ With error details |

## Testing Strategy

| Phase | Calendar | Purpose |
|-------|----------|---------|
| **Development** | Your own test calendar | Safe to test all flows |
| **Staging** | Test calendar + Replit cron | Verify midnight timing |
| **Production** | Real therapist's calendar | Live booking |

**Test Calendar Setup**:
1. Create Google Calendar (or use throwaway account)
2. Enable "Appointment Schedules"
3. Create fake slots mimicking therapist's pattern
4. Use that link during development

## Tech Stack

| Component | Technology | Cost |
|-----------|------------|------|
| Development | Claude Code (local) | Existing subscription |
| Hosting | Replit | ~$0-2/month (pay-as-you-go) |
| Browser Automation | Puppeteer | Free |
| Scheduling | Replit Cron | Included |
| Email | Resend | Free (100/day) |
| Version Control | GitHub | Free |

## Security

- No public endpoints exposed
- Trigger only via Replit app (authenticated)
- Secrets stored in Replit Secrets (not in code)
- Config file excluded from git where sensitive

## File Structure

```
google-appmt-booking/
├── src/
│   ├── index.js          # Entry point & CLI menu
│   ├── booker.js         # Puppeteer booking logic
│   ├── scraper.js        # Slot scraping & matching
│   ├── notifier.js       # Email notifications
│   └── config.js         # Config loader
├── config/
│   └── config.json       # Preferences & settings
├── docs/
│   └── plans/
│       └── 2026-01-21-therapist-booking-design.md
├── .gitignore
├── package.json
└── README.md
```

## Open Questions (Resolved)

1. ~~Monthly booking limit?~~ → No limit, manual deactivation
2. ~~Push notifications?~~ → Email only (free)
3. ~~Public endpoint security?~~ → No public endpoints, use Replit shell

## Next Steps

1. Create implementation plan with `/superpowers:writing-plans`
2. Set up test Google Calendar with appointment slots
3. Build and test locally with Claude Code
4. Deploy to Replit
5. Test full flow with staging calendar
6. Go live with real therapist calendar
