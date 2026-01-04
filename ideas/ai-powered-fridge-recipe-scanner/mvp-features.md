# MVP Feature List: AI Fridge-to-Meal Recipe App

**Idea:** AI-Powered Fridge Recipe Scanner
**Document Type:** MVP Feature Specification
**Created:** 2026-01-05
**Target MVP Timeline:** 4-5 months

---

## Executive Summary

This MVP focuses on delivering the core "scan fridge, get recipes" experience that differentiates us from manual ingredient-entry competitors. We're prioritizing fast time-to-value: users should discover a cookable recipe within 60 seconds of opening the app. Advanced features like meal planning, grocery delivery integration, and smart appliance connectivity are intentionally deferred.

**Core Value Proposition:** "Point your camera at your fridge. Get dinner ideas in seconds."

---

## MVP Scope Definition

### In Scope (MVP)
- Mobile app (iOS first, Android fast-follow)
- AI-powered fridge/ingredient scanning
- Recipe suggestions based on available ingredients
- Basic dietary filtering
- Expiration date tracking (manual + AI-assisted)
- Shopping list for missing ingredients
- User accounts with preference learning

### Out of Scope (Post-MVP)
- Smart refrigerator hardware integration
- Grocery delivery partnerships (Instacart, Amazon Fresh)
- Full meal planning calendar
- Social/community features
- Voice-guided cooking mode
- B2B/enterprise features
- Apple Watch / wearable companion apps

---

## Core Features

### 1. AI Fridge Scanning (The Hero Feature)

| Feature | Priority | Effort | Description |
|---------|----------|--------|-------------|
| Camera ingredient scan | P0 | L | Point camera at fridge/counter, AI identifies visible ingredients |
| Multi-angle capture | P0 | M | Guide user to capture 2-3 photos for full fridge coverage |
| Real-time ingredient detection | P0 | L | Overlay ingredient labels on camera view as items are recognized |
| Ingredient confirmation | P0 | M | User can add/remove/correct AI-detected ingredients before search |
| Manual ingredient add | P0 | S | Search and add ingredients the AI missed |
| Scan history | P1 | S | Review and re-use previous scans |
| Pantry staples assumption | P1 | M | Auto-include common items (salt, pepper, oil) unless user opts out |
| Barcode scanning | P2 | M | Scan product barcodes for precise identification |
| Receipt scanning | P2 | L | Import ingredients from grocery receipt photos |

**Acceptance Criteria:**
- Scanning completes in under 5 seconds
- Minimum 85% accuracy on common grocery items in good lighting
- User can confirm/edit ingredients in under 15 seconds
- Works with fridge door open or ingredients on counter

**Technical Notes:**
- Leverage Vision Transformer models (NoisyViT achieving 99.5% on Food-101)
- Local on-device processing for privacy and speed
- Fallback to cloud processing for complex scenes

---

### 2. Recipe Discovery & Matching

| Feature | Priority | Effort | Description |
|---------|----------|--------|-------------|
| Ingredient-based recipe search | P0 | M | Find recipes using detected ingredients |
| Match percentage display | P0 | S | Show % of recipe ingredients user has (e.g., "You have 8/10 ingredients") |
| Missing ingredient list | P0 | S | Clearly show what's needed for each recipe |
| Recipe difficulty filter | P0 | S | Filter by Easy/Medium/Advanced |
| Cook time filter | P0 | S | Filter by 15/30/45/60+ minutes |
| Recipe detail view | P0 | M | Full recipe with ingredients, steps, nutrition, tips |
| Recipe sorting | P1 | S | Sort by match %, cook time, rating, or "use it first" (expiring ingredients) |
| "Almost there" recipes | P1 | S | Surface recipes missing only 1-2 ingredients |
| Recipe ratings | P1 | S | Display average user rating (1-5 stars) |
| Save/favorite recipes | P1 | S | Bookmark recipes to personal collection |
| Recipe categories | P1 | S | Browse by meal type (breakfast, lunch, dinner, snack) |
| Cuisine filter | P2 | S | Filter by Italian, Mexican, Asian, etc. |
| Serving size adjustment | P2 | M | Scale ingredients for 1-8 servings |

**Acceptance Criteria:**
- Recipe suggestions appear within 3 seconds of scan confirmation
- Minimum 10 recipe suggestions for any combination of 5+ ingredients
- Recipe detail view loads in under 1 second
- Match percentage calculation is accurate and understandable

---

### 3. Dietary Preferences & Restrictions

| Feature | Priority | Effort | Description |
|---------|----------|--------|-------------|
| Dietary profile setup | P0 | M | One-time setup: allergies, diet type, dislikes |
| Allergen filtering | P0 | M | Filter out recipes with selected allergens (8 major + custom) |
| Diet type filtering | P0 | M | Vegetarian, Vegan, Keto, Paleo, Gluten-free, Dairy-free |
| Disliked ingredients | P1 | S | Never suggest recipes with specific ingredients |
| Macro preferences | P2 | M | Filter by protein/carb/fat targets |
| Calorie range filter | P2 | S | Filter by calorie count per serving |

**Supported Allergens (P0):**
- Peanuts, Tree nuts, Milk/Dairy, Eggs, Fish, Shellfish, Soy, Wheat/Gluten
- Plus custom allergen entry

**Supported Diets (P0):**
- Vegetarian, Vegan, Pescatarian
- Keto, Low-carb, Paleo
- Gluten-free, Dairy-free
- Halal, Kosher (basic filtering)

**Acceptance Criteria:**
- Dietary preferences persist across sessions
- Filtered recipes NEVER include excluded allergens
- Diet filtering is clearly visible on all recipe cards

---

### 4. Expiration & Food Waste Prevention

| Feature | Priority | Effort | Description |
|---------|----------|--------|-------------|
| Expiration date tracking | P0 | M | Set expiration dates on scanned items |
| "Use it first" priority | P0 | M | Prioritize recipes using soon-to-expire ingredients |
| Expiration alerts | P0 | S | Push notification 2 days before item expires |
| AI expiration estimation | P1 | L | Estimate expiry based on item type and purchase date |
| Waste tracker dashboard | P1 | M | Show items used vs. wasted, potential savings |
| "Last chance" recipes | P1 | M | Special recipe suggestions for items expiring today/tomorrow |
| Food waste gamification | P2 | M | Streaks, badges for using ingredients before expiry |

**Acceptance Criteria:**
- User can set expiration date in under 5 seconds per item
- "Use it first" recipes appear prominently on home screen
- Push notifications are actionable (tap to see recipe using that item)

---

### 5. Shopping List Generation

| Feature | Priority | Effort | Description |
|---------|----------|--------|-------------|
| Generate from recipe | P0 | S | One-tap add missing ingredients to shopping list |
| Manual item add | P0 | S | Add any item to shopping list |
| Check off items | P0 | S | Mark items as purchased |
| Aisle organization | P1 | M | Auto-organize by grocery store sections |
| Quantity editing | P1 | S | Adjust quantities needed |
| List sharing | P2 | S | Share list via text/email |
| Price estimation | P2 | M | Estimate cost of shopping list |

**Acceptance Criteria:**
- One-tap add of all missing ingredients
- Shopping list accessible from any screen
- Checked items persist between sessions

---

### 6. User Account & Personalization

| Feature | Priority | Effort | Description |
|---------|----------|--------|-------------|
| Email/password signup | P0 | M | Standard authentication |
| Apple/Google sign-in | P0 | M | Social login options |
| Profile setup | P0 | S | Name, dietary preferences, household size |
| Preference learning | P1 | L | Algorithm learns from recipe views, saves, and cooking completions |
| Cooking skill level | P1 | S | Beginner/Intermediate/Advanced for recipe suggestions |
| Notification settings | P1 | S | Control push notification types |
| Data export | P2 | M | Export personal data (GDPR compliance) |
| Account deletion | P1 | S | Full data deletion option |

**Acceptance Criteria:**
- Sign up completes in under 90 seconds
- Preferences sync across devices
- Learning algorithm shows improved relevance after 10+ interactions

---

### 7. Onboarding Flow

| Feature | Priority | Effort | Description |
|---------|----------|--------|-------------|
| Value proposition screens | P0 | S | 3-screen intro showing key benefits |
| First scan tutorial | P0 | M | Guided first scan experience with tips |
| Dietary setup wizard | P0 | M | Simple, visual diet preference selection |
| Permission requests | P0 | S | Camera + notifications with clear explanations |
| Quick win | P0 | S | Show first recipe suggestion immediately after first scan |
| Skip option | P1 | S | Allow experienced users to skip onboarding |

**Acceptance Criteria:**
- Onboarding completes in under 3 minutes
- First recipe suggestion appears within 60 seconds of app download
- Permission denial handled gracefully with manual input fallback

---

## User Flows

### Flow 1: First-Time User (Critical Path)
```
Download App → Open App → 3 Value Screens → Sign Up/Skip →
Dietary Preferences (optional) → First Scan Tutorial →
Scan Fridge → Confirm Ingredients → See Recipe Suggestions →
Tap Recipe → View Details → Start Cooking!
```
**Target Time:** Under 4 minutes to first recipe

### Flow 2: Returning User Daily Use
```
Open App → Tap Scan → Capture Fridge → Confirm Ingredients →
View "Use First" Recipes → Select Recipe → Cook
```
**Target Time:** Under 60 seconds to recipe selection

### Flow 3: Expiration Alert Response
```
Receive Push Notification → Tap to Open →
See Expiring Item + Recipes Using It → Select Recipe → Cook
```
**Target Time:** Under 30 seconds to recipe

### Flow 4: Shopping List Creation
```
View Recipe → Tap "Add Missing to List" →
Review List → Share/Take to Store → Check Off Items
```
**Target Time:** Under 20 seconds to generate list

---

## Technical Requirements

### Platform Support
- **MVP:** iOS 16.0+ (73% of app subscription revenue is iOS)
- **Fast-follow (Week 8):** Android 10.0+ (API 29)
- **Framework:** React Native with native modules for camera/AI

### AI/ML Infrastructure
- **On-device model:** Core ML (iOS) / TensorFlow Lite (Android)
- **Model type:** Fine-tuned Vision Transformer (based on Food-101/Food2K)
- **Cloud fallback:** AWS Lambda + SageMaker for complex scenes
- **Training data:** License Food-101 dataset + custom grocery images

### Backend Infrastructure
- **API:** Node.js/Express REST API
- **Database:** PostgreSQL (user data, preferences) + Redis (caching)
- **Recipe data:** Licensed recipe database OR custom scraping + attribution
- **Auth:** Firebase Authentication
- **Push:** Firebase Cloud Messaging
- **CDN:** CloudFront for recipe images

### Performance Targets

| Metric | Target |
|--------|--------|
| App launch (cold) | < 2 seconds |
| Fridge scan time | < 5 seconds |
| Recipe search | < 3 seconds |
| API response (p95) | < 300ms |
| Offline capability | View saved recipes, cached results |
| App size | < 80MB (includes ML model) |

### Privacy & Security
- On-device image processing (photos never uploaded unless cloud fallback needed)
- No fridge images stored on servers
- Ingredient data encrypted at rest
- GDPR and CCPA compliant
- Transparent privacy policy (key differentiator vs. big tech)

---

## Recipe Database Strategy

### MVP Approach (Option A - Recommended)
**License existing database:**
- Spoonacular API: 5,000+ recipes, $29-79/month
- Edamam API: 2M+ recipes, pay-per-call
- BigOven API: 1M+ recipes

**Pros:** Fast to market, structured data, nutritional info included
**Cons:** Ongoing API costs, limited customization

### Post-MVP Approach (Option B)
**Build proprietary database:**
- Partner with food bloggers/creators for content
- AI-generated recipes (with human review)
- User-contributed recipes

**Pros:** Full control, unique content, no licensing fees
**Cons:** Longer to build, quality control challenges

---

## MVP Success Metrics

### Primary KPIs (8 weeks post-launch)

| Metric | Target | Measurement |
|--------|--------|-------------|
| Downloads | 10,000 | App Store Analytics |
| Day 1 retention | 50% | Users returning Day 1 |
| Day 7 retention | 25% | Users returning Day 7 |
| Scans per user/week | 3+ | Backend analytics |
| Recipes viewed per session | 4+ | Backend analytics |
| App Store rating | 4.2+ | App Store reviews |

### Secondary KPIs

| Metric | Target |
|--------|--------|
| Scan accuracy (user-reported) | 85%+ |
| Dietary filter usage | 40% of users |
| Expiration alerts sent | 5,000/week |
| Shopping lists generated | 2,000/week |
| Premium conversion (if applicable) | 5% |

### North Star Metric
**Recipes cooked per user per month:** Target 8+ recipes cooked (not just viewed)

---

## Monetization Strategy (MVP)

### Recommended: Freemium Model

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | 5 scans/day, basic recipes, ads |
| **Premium** | $7.99/month | Unlimited scans, no ads, nutrition info, advanced filters |
| **Family** | $11.99/month | Premium + 5 profiles, shared shopping lists |
| **Annual** | $59.99/year | Premium features, ~40% discount |

### Alternative: Ad-Supported Free
- Full features free
- Interstitial ads between recipe views
- Banner ads on recipe detail pages
- Lower conversion but higher volume potential

### Revenue Projections (Conservative)

| Month | Downloads | Paying Users | MRR |
|-------|-----------|--------------|-----|
| 1 | 5,000 | 150 (3%) | $1,200 |
| 3 | 20,000 | 800 (4%) | $6,400 |
| 6 | 50,000 | 2,500 (5%) | $20,000 |
| 12 | 150,000 | 9,000 (6%) | $72,000 |

---

## Feature Prioritization Matrix

```
                    HIGH VALUE
                        |
    +-------------------+-------------------+
    |                   |                   |
    |  P1: DO NEXT      |  P0: MVP CORE     |
    |  - Barcode scan   |  - AI fridge scan |
    |  - Waste tracking |  - Recipe matching|
    |  - Preference     |  - Dietary filters|
    |    learning       |  - Expiration     |
    |  - Receipt scan   |    tracking       |
    |                   |  - Shopping list  |
LOW +-------------------+-------------------+ HIGH
EFFORT                  |                   EFFORT
    |  P2: NICE TO HAVE |  DEFER            |
    |  - Cuisine filter |  - Voice cooking  |
    |  - Gamification   |  - Meal planning  |
    |  - Social sharing |  - Grocery        |
    |  - Price estimate |    delivery       |
    |                   |  - Smart fridge   |
    |                   |    integration    |
    +-------------------+-------------------+
                        |
                    LOW VALUE
```

---

## MVP Development Phases

### Phase 1: Foundation (Weeks 1-4)
- [ ] Project setup (React Native, backend infrastructure)
- [ ] User authentication (email, Apple, Google)
- [ ] Basic UI shell and navigation
- [ ] Recipe database integration (API licensing)
- [ ] CI/CD pipeline and TestFlight setup

### Phase 2: Core Scanning (Weeks 5-8)
- [ ] Camera integration with capture flow
- [ ] AI model integration (Core ML)
- [ ] Ingredient detection and labeling
- [ ] Ingredient confirmation/editing UI
- [ ] Initial scanning accuracy tuning

### Phase 3: Recipe Engine (Weeks 9-12)
- [ ] Ingredient-to-recipe matching algorithm
- [ ] Recipe detail views
- [ ] Dietary filtering system
- [ ] Match percentage calculation
- [ ] Save/favorite functionality

### Phase 4: Food Waste Features (Weeks 13-15)
- [ ] Expiration date tracking system
- [ ] "Use it first" prioritization
- [ ] Push notification system
- [ ] Expiration alerts implementation

### Phase 5: Polish & Launch (Weeks 16-18)
- [ ] Onboarding flow optimization
- [ ] Performance optimization
- [ ] Beta testing (500 users)
- [ ] Bug fixing and refinement
- [ ] App Store submission
- [ ] Launch marketing preparation

### Phase 6: Post-MVP Iteration (Weeks 19-22)
- [ ] Analyze user feedback and metrics
- [ ] Android version launch
- [ ] Top 3 user-requested features
- [ ] Scanning accuracy improvements
- [ ] Premium tier refinements

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| AI scanning accuracy below 85% | Medium | Critical | Extensive testing, manual add fallback, user correction loop |
| Low retention after first use | High | High | Focus onboarding, quick time-to-value, expiration alerts for re-engagement |
| Recipe database licensing issues | Medium | High | Negotiate multi-provider, build towards proprietary database |
| Apple/Samsung competitive pressure | Medium | Medium | Differentiate on waste reduction, cross-platform, privacy focus |
| Camera permission denial | Medium | Medium | Clear value explanation, graceful fallback to manual entry |
| Scan works poorly in bad lighting | High | Medium | Lighting guidance, flash option, multiple photo captures |

---

## Competitive Differentiation (MVP)

| Competitor | Their Strength | Our MVP Differentiation |
|------------|---------------|-------------------------|
| SuperCook | Large recipe database (11M+) | AI scanning vs. manual entry |
| Yummly | Whirlpool appliance integration | Cross-platform, no hardware lock-in |
| Samsung Food (Whisk) | Samsung ecosystem | Privacy-first, works on any device |
| Tasty | Huge brand, video content | Ingredient-first approach |
| Mealime | Meal planning | Real-time "what's in my fridge" |
| NoWaste | Food waste tracking | Scanning + recipes + waste (all-in-one) |

**MVP Positioning:** The only app that sees what's in your fridge and tells you what to cook before food goes bad.

---

## Open Questions for Validation

1. **Scan accuracy threshold:** What's the minimum accuracy users will tolerate? 80%? 85%? 90%?
2. **Recipe database:** License vs. build? Partner with food bloggers?
3. **Monetization timing:** Paywall from day 1 or free launch then paywall?
4. **Geographic focus:** US-only MVP or international from start?
5. **Barcode vs. visual:** Should barcode scanning be P0 or P1?
6. **Cooking completion tracking:** How do we know if a user actually cooked a recipe?

---

## Appendix A: User Segment Feature Mapping

| Feature | Busy Professionals | Health-Conscious | Budget Families | Students |
|---------|-------------------|------------------|-----------------|----------|
| AI scanning | Critical | High | High | High |
| Quick recipes (<30 min) | Critical | Medium | High | High |
| Dietary filtering | Medium | Critical | Medium | Low |
| Expiration tracking | High | Medium | Critical | Medium |
| Nutritional info | Low | Critical | Low | Low |
| Cost per serving | Low | Low | Critical | High |
| Shopping list | High | High | Critical | Medium |

---

## Appendix B: MVP Feature Summary Checklist

### Must Have (P0) - Launch Blockers
- [ ] AI fridge scanning with ingredient detection
- [ ] Ingredient confirmation and editing
- [ ] Recipe search by available ingredients
- [ ] Match percentage display
- [ ] Cook time and difficulty filters
- [ ] Basic dietary filtering (8+ allergens, 6+ diets)
- [ ] Expiration date tracking
- [ ] "Use it first" recipe prioritization
- [ ] Shopping list generation from recipes
- [ ] User authentication
- [ ] Dietary preference profile
- [ ] Push notifications for expiration alerts
- [ ] Onboarding flow

### Should Have (P1) - Week 4-8 Post-Launch
- [ ] Preference learning algorithm
- [ ] Waste tracker dashboard
- [ ] Barcode scanning
- [ ] Recipe ratings
- [ ] Scan history
- [ ] Advanced sorting options

### Nice to Have (P2) - Future Releases
- [ ] Gamification (streaks, badges)
- [ ] Receipt scanning
- [ ] Social sharing
- [ ] Price estimation
- [ ] Cuisine filtering
- [ ] Voice-guided cooking

---

*This MVP feature list should be validated through user interviews and revised based on beta testing feedback.*

**Next Steps:**
1. User validation interviews (15-20 target users)
2. Technical feasibility assessment for AI scanning
3. Recipe database partner evaluation
4. Design wireframes and prototypes
5. Engineering team sprint planning
