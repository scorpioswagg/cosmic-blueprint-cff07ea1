

# Cosmic Blueprint — Full MVP Plan

## Overview
A dark, cosmic-themed astrology SaaS platform with landing page, user accounts, birth chart input, report generation, Stripe payments, and PDF delivery. The astrology engine will call your externally-hosted FastAPI + pyswisseph backend via API.

---

## Phase 1: Foundation & Design System

### Dark Cosmic Theme
- Deep space background (#0a0a1a), gold (#D4AF37) and violet (#7C3AED) accents
- Starfield/constellation decorative elements
- Custom CSS variables for the cosmic palette

### Enable Lovable Cloud
- Required for auth, database, and payments
- Set up Supabase tables for users, birth charts, reports, and payments

---

## Phase 2: Landing Page (Conversion-Optimized)

### Hero Section
- "Unlock Your Cosmic Blueprint" headline with animated starfield background
- Subheadline about destiny and life purpose
- Two CTA buttons: "Get Your Free Chart" and "Unlock Full Report"

### Feature Sections
1. **What We Offer** — birth chart calculations, personalized reports, relationship insights, career guidance
2. **Reports Available** — Natal Chart, Compatibility, Transit Forecast, Soul Purpose (cards with cosmic icons)
3. **Pricing** — Free tier (basic chart summary) vs Premium ($9.99–$29.99)
4. **Testimonials** — placeholder testimonials with avatars
5. **Email Capture** — newsletter signup section

---

## Phase 3: Authentication & User Accounts

- Email/password + Google sign-in via Lovable Cloud
- User profiles table
- Admin role for astro.butt84@gmail.com (stored in separate user_roles table per security best practices)
- Protected routes for dashboard, reports, admin

---

## Phase 4: Birth Chart Input Flow

### Input Form
- Name, birth date, birth time, city, country fields
- City geocoding via OpenCage API (stored as a secret, not in code)
- Validation and timezone resolution

### External Astrology API Integration
- Server function that calls your FastAPI backend (you'll provide the URL)
- Sends lat/lng/datetime, receives planetary positions, houses, aspects
- Stores results in the birth_charts table

---

## Phase 5: Report Generation

### Free Summary
- Basic planet positions and sun/moon/rising signs
- Displayed on-screen after chart calculation

### Premium Reports (30–100 pages)
- Planet interpretations, house meanings, aspects, life themes, career, relationships
- AI interpretation layer using Lovable AI Gateway for narrative text
- PDF generation using jsPDF (JavaScript-based, runs on the server)
- Stored in Supabase Storage, downloadable via signed URLs

---

## Phase 6: Stripe Payments

- Enable Lovable's built-in Stripe integration
- Products: Natal Chart Report, Compatibility Report, Transit Forecast, Soul Purpose Report
- Checkout flow → payment confirmation → unlock premium report
- Transaction records in payments table

---

## Phase 7: Admin Dashboard

- Protected admin route (role-based access)
- View all users, charts, reports, and payments
- Basic analytics (total users, revenue, reports generated)

---

## Database Schema

| Table | Purpose |
|-------|---------|
| profiles | User display name, email |
| user_roles | Admin/user roles (separate table) |
| birth_charts | Birth data + calculated positions |
| reports | Generated report metadata + storage paths |
| payments | Transaction records linked to users/reports |
| email_signups | Newsletter captures |

---

## Architecture Note

The astrology calculation engine (FastAPI + pyswisseph) must be hosted by you on Render/Railway. This app will call it via a server function. Once you have it deployed, you'll provide the API URL as a secret, and the app will be fully functional.

