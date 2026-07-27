# 🎬 Cinema Platform — Strategic Questions

**Purpose:** These 12 questions will directly shape the PRD. Each answer removes ambiguity and influences architecture, scope, or roadmap.  
**Action Required:** Please answer each question. Short answers are fine — we'll follow up if we need depth.

---

## Category A: Business & Strategy

### Q1. What is the monetization model?

**Options to consider:**
- **(a)** Freemium (free tier + paid Pro with advanced stats, lists, etc.) — *Letterboxd model*
- **(b)** Fully free + advertising revenue
- **(c)** Fully free + affiliate revenue (earn commission when users click through to streaming services)
- **(d)** Subscription-only (paid from day one)
- **(e)** Open-source / non-commercial passion project
- **(f)** Combination / other

**Why this matters:** Monetization determines whether we need a paywall system, ad infrastructure, affiliate tracking, or none of the above. It also determines how aggressively we need to gate features, which changes the entire UX. If this is non-commercial, TMDB's API is free. If commercial, we need a license (~$$).

---

### Q2. What is your target scale for Year 1?

**Options to consider:**
- **(a)** Personal project / small community (< 1,000 users)
- **(b)** Niche product (1,000 – 50,000 users)
- **(c)** Growth product (50,000 – 500,000 users)
- **(d)** Scale product (500,000+ users, venture-backed ambition)

**Why this matters:** This single answer changes everything: hosting costs, database choice, caching strategy, CDN requirements, team size, and whether we need infrastructure like Kubernetes vs. a single server. The vision says "millions of users" but the *timeline* to get there determines what we build now vs. later. Over-engineering for millions on day one wastes resources. Under-engineering forces painful rewrites.

---

### Q3. Is this a solo/small-team project or do you have (or plan to hire) a team?

**Why this matters:** Architecture decisions differ dramatically:
- **Solo developer:** Simplicity is survival. Managed services over self-hosted. Monolith over microservices. Ship fast.
- **Small team (2-5):** Can handle moderate complexity. Some service separation makes sense.
- **Larger team (5+):** Microservices, CI/CD pipelines, code review processes become necessary.

The brief describes a multi-year production system, but if you're building this initially as a one-person team, we must scope accordingly or the project dies from complexity.

---

## Category B: Product Scope

### Q4. What is the MVP you'd be proud to launch?

The vision includes 50+ features. We need to know: **what is the ONE thing the product must do on launch day to prove its value?**

**Candidates:**
- **(a)** "I can search for any movie and see beautiful, deep information about it" — *the database play*
- **(b)** "I can track every movie I've watched and see stunning statistics about my cinema history" — *the personal archive play*
- **(c)** "I can discover what to watch tonight through an enjoyable, intelligent experience" — *the discovery play*
- **(d)** Something else?

**Why this matters:** Each option leads to a fundamentally different first sprint. Option (a) prioritizes data ingestion. Option (b) prioritizes user systems. Option (c) prioritizes recommendation algorithms. We cannot do all three well simultaneously in an MVP.

---

### Q5. How important is TV/Series support in the initial launch?

- **(a)** Essential — movies and TV are equal priorities
- **(b)** Movies first, TV added in V1
- **(c)** Movies only for now, TV is future

**Why this matters:** TV data is structurally different (seasons → episodes → airing schedules). Supporting it doubles the data model complexity, the ingestion pipeline work, and the UI surface area. Every successful platform in this space (Letterboxd) started with one content type and expanded later.

---

### Q6. Should the platform have social features?

- **(a)** Yes, social is core — follow users, see friends' activity, comments on reviews
- **(b)** Light social — share lists publicly, but no feed/follow system
- **(c)** No social — purely personal tool
- **(d)** Start personal, add social later

**Why this matters:** Social features introduce moderation needs, abuse prevention, privacy considerations, notification systems, and content ranking algorithms. They also change the data model significantly (activity feeds, follower graphs). Getting this wrong either way is expensive — building social that nobody uses wastes effort; not building social when users want it leaves growth on the table.

---

## Category C: User Experience

### Q7. The "Intelligent Movie Picker" — how committed are you to the swipe/Tinder metaphor specifically?

**Our analysis (see discovery document):** Swipe-for-movies has been attempted many times and has a poor track record. Movies are contextual decisions (mood, time, company), not binary yes/no like dating. 

**Alternatives we'd like to explore:**
- **(a)** Mood-based discovery ("I'm feeling nostalgic + want something under 2 hours")
- **(b)** Visual browsing (curated "shelves" with cinematic presentation)
- **(c)** "Surprise me" with smart constraints (genre, decade, rating, runtime)
- **(d)** Swipe mechanic but for movie *attributes* (poster, synopsis, genre) not full commitment
- **(e)** You want us to prototype multiple approaches and test

**Why this matters:** This is described as a flagship feature. Getting the UX wrong on the signature feature undermines the entire product identity. We'd rather spend time prototyping 2-3 approaches than committing to one based on assumption.

---

### Q8. What is the design reference point?

**Not** "copy this website" — but what *feeling* should the product evoke?

- **(a)** Criterion Channel — scholarly, minimal, black & white, film-focused
- **(b)** Apple TV app — polished, spacious, content-forward, premium consumer product
- **(c)** Spotify Wrapped — data-as-entertainment, bold, dynamic, shareable
- **(d)** A physical cinema lobby — warm, atmospheric, immersive
- **(e)** Something entirely different (describe)

**Why this matters:** "Premium and cinematic" can mean many things. The difference between (a) and (c) produces completely different typography, color palettes, animation budgets, and component libraries. We need to align on emotional direction before designing a single pixel.

---

## Category D: Data & Technical

### Q9. Do you have a preferred deployment target?

- **(a)** Cloud provider (AWS, GCP, Azure) — specify if preference
- **(b)** Self-hosted / VPS (DigitalOcean, Hetzner, etc.)
- **(c)** Serverless / edge (Vercel, Cloudflare Workers, etc.)
- **(d)** No preference — recommend the best option
- **(e)** Start cheap, migrate when needed

**Why this matters:** Hosting choice affects the entire backend architecture. Serverless functions have different constraints than a traditional server. VPS has different scaling characteristics than managed cloud. Cost profiles vary 10-100x between approaches. And the choice interacts directly with Q2 (target scale).

---

### Q10. What is your budget range for infrastructure (monthly)?

- **(a)** $0 – $20/month (hobby tier)
- **(b)** $20 – $100/month (small production)
- **(c)** $100 – $500/month (serious production)
- **(d)** $500+/month (scale infrastructure)
- **(e)** Not yet determined

**Why this matters:** This constrains database choice (managed vs. self-hosted), search infrastructure (Algolia at ~$1/1K requests vs. self-hosted Meilisearch at $0), image hosting (CDN costs for millions of poster images), and whether we can use managed services or must self-host everything.

---

## Category E: Design & Brand

### Q11. Is "The Alan's Data Base" the intended public product name?

**Why this matters:** The name is the first thing users encounter. The current name reads as a personal project, which directly conflicts with the "premium, world-class platform" positioning. If this is a placeholder, no action needed. If it's intentional (e.g., a personal brand play), we'll design around it. If you're open to alternatives, naming should happen before we design the brand system.

---

### Q12. Do you have existing brand assets or design preferences?

- **(a)** No — design from scratch, give me options
- **(b)** I have color preferences (specify)
- **(c)** I have a logo / brand direction already
- **(d)** I want to be involved in every design decision
- **(e)** I trust your design judgment — surprise me within the "cinematic premium" direction

**Why this matters:** If you have brand preferences, we design the system around them. If we have creative freedom, we'll develop 2-3 design directions for you to choose from. Either way, the design system is the foundation everything is built on — it must be decided before components.

---

## Next Steps

After you provide your answers, we will:

1. ✅ Finalize the **Product Requirements Document (PRD)** — the official source of truth
2. ✅ Lock the **MVP feature set**
3. ✅ Define the **architecture**
4. ✅ Select **technologies** (based on your answers, not trends)
5. ✅ Create the **development roadmap**
6. ✅ Begin **design system** creation
7. ✅ Start **implementation** of Sprint 1

> [!IMPORTANT]
> No code will be written until you approve the PRD. Take your time with these answers — they are the foundation of everything we build.
