# MVP Feature List: AI Fridge-to-Meal Recipe App

> **Idea:** AI-powered app that scans fridge contents and suggests personalized meal recipes based on available ingredients
> **Document Type:** MVP Feature Specification
> **Created:** 2026-01-05
> **Target MVP Timeline:** 12-16 weeks

---

## Executive Summary

This MVP delivers the core "scan fridge, get dinner ideas" experience that solves the universal "what should I cook?" problem. Our primary personas (Weeknight Warriors, Macro Trackers, Budget Families) share one need: **eliminating the friction between "what do I have" and "what can I make."**

**Core Value Proposition:** "Open your fridge. Point your camera. Get dinner in 30 minutes."

**Key Differentiator:** Unlike manual ingredient-entry apps (SuperCook, Yummly), we use AI vision to recognize ingredients instantly, reducing the friction from minutes to seconds.

---

## MVP Scope Definition

### In Scope (MVP)

| Category            | Included                                            |
| ------------------- | --------------------------------------------------- |
| **Platforms**       | iOS 16.0+ (primary), Android 10+ (fast-follow)      |
| **Core Feature**    | AI-powered fridge/ingredient scanning               |
| **Recipe Engine**   | Ingredient-based matching with overlap scoring      |
| **Personalization** | Dietary filters, time constraints, allergens        |
| **Food Waste**      | Expiration tracking with "use first" prioritization |
| **Utility**         | Shopping list for missing ingredients               |
| **Accounts**        | User profiles with preference storage               |

### Out of Scope (Post-MVP)

- Smart refrigerator hardware integration
- Grocery delivery partnerships (Instacart, Amazon Fresh)
- Full weekly meal planning calendar
- Social/community recipe sharing
- Voice-guided step-by-step cooking
- Macro tracking with MyFitnessPal sync
- B2B/enterprise features
- Video cooking tutorials

---

## Feature Categories

### 1. AI Fridge Scanning (Hero Feature)

**Why it matters:** This is our 10x differentiator. Manual ingredient entry is the #1 friction point with existing apps. Users abandon the process before seeing recipes.

| Feature                            | Priority | Effort | User Story                                                        |
| ---------------------------------- | -------- | ------ | ----------------------------------------------------------------- |
| **Camera ingredient scan**         | P0       | L      | Point camera at fridge/counter, AI identifies visible ingredients |
| **Multi-angle guidance**           | P0       | M      | Guide user to capture 2-3 photos for complete coverage            |
| **Real-time detection overlay**    | P0       | L      | Show ingredient labels on camera view as items are recognized     |
| **Ingredient confirmation screen** | P0       | M      | Review, add, or remove detected ingredients before search         |
| **Manual ingredient add**          | P0       | S      | Search and add items the AI missed                                |
| **Pantry staples toggle**          | P1       | S      | Auto-include common items (salt, oil, spices) unless disabled     |
| **Scan history**                   | P1       | S      | Quick re-scan using recent ingredient lists                       |
| **Lighting guidance**              | P1       | S      | Tips when image quality is poor                                   |
| **Barcode scanning**               | P2       | M      | Scan product barcodes for precise identification                  |

**Acceptance Criteria:**

- Scan completes in < 5 seconds on iPhone 13+
- 85%+ accuracy on 100 most common grocery items
- User can confirm/edit ingredients in < 15 seconds
- Works with fridge door open OR ingredients on counter
- Graceful fallback to manual entry if camera denied

**Technical Approach:**

- On-device Vision Transformer model (Core ML / TensorFlow Lite)
- Fine-tuned on Food-101 + custom grocery image dataset
- Cloud fallback for complex scenes (< 10% of scans)
- No images stored on servers (privacy-first)

---

### 2. Recipe Discovery & Matching

**Why it matters:** Speed to value is critical. Users need to see useful recipes within seconds, not minutes.

| Feature                           | Priority | Effort | User Story                                     |
| --------------------------------- | -------- | ------ | ---------------------------------------------- |
| **Ingredient-to-recipe matching** | P0       | M      | Find recipes using detected ingredients        |
| **Match percentage display**      | P0       | S      | "You have 8/10 ingredients (80% match)"        |
| **Missing ingredients list**      | P0       | S      | Clear display of what's needed for each recipe |
| **Cook time filter**              | P0       | S      | Filter: <15, <30, <45, 60+ minutes             |
| **Difficulty filter**             | P0       | S      | Beginner / Intermediate / Advanced             |
| **Recipe detail view**            | P0       | M      | Full recipe with ingredients, steps, photos    |
| **"Use First" recipes**           | P0       | M      | Prioritize recipes using expiring ingredients  |
| **"Almost there" section**        | P1       | S      | Recipes missing only 1-2 items                 |
| **Save/favorite recipes**         | P1       | S      | Personal recipe collection                     |
| **Recipe ratings**                | P1       | S      | User-submitted 1-5 star ratings                |
| **Serving size scaling**          | P1       | M      | Adjust recipe from 1-8 servings                |
| **Meal type filter**              | P1       | S      | Breakfast / Lunch / Dinner / Snack             |
| **Cuisine filter**                | P2       | S      | Italian, Mexican, Asian, American, etc.        |
| **Nutritional summary**           | P2       | M      | Calories, protein, carbs, fat per serving      |

**Acceptance Criteria:**

- Recipe results appear in < 3 seconds after ingredient confirmation
- Minimum 10 recipes shown for any 5+ ingredient combination
- Match percentage is mathematically accurate
- "Use First" recipes appear at top of results

---

### 3. Dietary Preferences & Restrictions

**Why it matters:** 60%+ of users have some dietary consideration. Wrong suggestions destroy trust immediately.

| Feature                   | Priority | Effort | User Story                                |
| ------------------------- | -------- | ------ | ----------------------------------------- |
| **Dietary profile setup** | P0       | M      | One-time setup during onboarding          |
| **Allergen exclusions**   | P0       | M      | Filter recipes containing allergens       |
| **Diet type filtering**   | P0       | M      | Apply dietary constraints to all searches |
| **Disliked ingredients**  | P1       | S      | Never show recipes with hated foods       |
| **Household profiles**    | P2       | M      | Multiple preference profiles per account  |

**Supported Allergens (P0):**

1. Peanuts
2. Tree nuts
3. Milk/Dairy
4. Eggs
5. Fish
6. Shellfish
7. Soy
8. Wheat/Gluten
9. Sesame
10. Custom entry

**Supported Diets (P0):**
| Diet | Description |
|------|-------------|
| Vegetarian | No meat or fish |
| Vegan | No animal products |
| Pescatarian | Fish but no meat |
| Keto/Low-carb | < 20g carbs |
| Paleo | No grains, dairy, legumes |
| Gluten-free | No wheat, barley, rye |
| Dairy-free | No milk products |
| Halal | Halal-compliant |
| Kosher | Kosher-compliant |

**Acceptance Criteria:**

- Allergen-containing recipes NEVER appear when allergen is excluded
- Diet filters persist across sessions
- Visual badges show diet compatibility on recipe cards

---

### 4. Expiration Tracking & Food Waste Prevention

**Why it matters:** Our personas throw away $75-400/year in food waste. This is the hook that drives daily engagement.

| Feature                          | Priority | Effort | User Story                                   |
| -------------------------------- | -------- | ------ | -------------------------------------------- |
| **Expiration date entry**        | P0       | M      | Set expiration for scanned items             |
| **AI expiration estimation**     | P1       | M      | Suggest typical shelf life by item type      |
| **"Use First" prioritization**   | P0       | M      | Surface recipes using soon-to-expire items   |
| **Expiration alerts**            | P0       | S      | Push notification 2 days before expiry       |
| **"Last Chance" recipes**        | P1       | M      | Special suggestions for items expiring today |
| **Food waste dashboard**         | P1       | M      | Track items used vs. wasted over time        |
| **Waste reduction gamification** | P2       | M      | Streaks and achievements for using items     |

**Push Notification Strategy:**
| Trigger | Timing | Message Example |
|---------|--------|-----------------|
| 2 days before | Morning | "Your spinach expires in 2 days. Here are 3 quick recipes." |
| Day before | 5pm | "Last chance! Use your chicken today. Tap for dinner ideas." |
| Day of | 11am | "Your tomatoes expire today. Quick lunch idea inside." |

**Acceptance Criteria:**

- Expiration entry takes < 5 seconds per item
- "Use First" recipes prominently displayed on home screen
- Push notifications are actionable (deep link to relevant recipes)
- Optional: Disable notifications per-item or globally

---

### 5. Shopping List

**Why it matters:** Completing the loop from "I want to make this" to "I have everything I need."

| Feature                     | Priority | Effort | User Story                                |
| --------------------------- | -------- | ------ | ----------------------------------------- |
| **Add missing ingredients** | P0       | S      | One-tap add all missing items from recipe |
| **Manual item add**         | P0       | S      | Add any item to list                      |
| **Check off items**         | P0       | S      | Mark items as purchased                   |
| **Quantity editing**        | P1       | S      | Adjust amounts needed                     |
| **Aisle organization**      | P1       | M      | Auto-group by store section               |
| **List sharing**            | P2       | S      | Share via text/email/messaging            |
| **Price estimation**        | P2       | M      | Estimated cost of shopping list           |

**Acceptance Criteria:**

- One tap adds ALL missing ingredients from a recipe
- Shopping list accessible from any screen (persistent FAB or tab)
- Checked items persist and can be cleared in bulk

---

### 6. User Accounts & Personalization

| Feature                   | Priority | Effort | User Story                           |
| ------------------------- | -------- | ------ | ------------------------------------ |
| **Email signup**          | P0       | M      | Standard email/password registration |
| **Apple Sign-In**         | P0       | M      | Frictionless iOS signup              |
| **Google Sign-In**        | P0       | M      | Frictionless Android signup          |
| **Profile setup**         | P0       | S      | Name, household size, skill level    |
| **Dietary preferences**   | P0       | M      | Stored per account                   |
| **Notification settings** | P1       | S      | Control alert frequency and types    |
| **Preference learning**   | P2       | L      | Algorithm improves based on behavior |
| **Account deletion**      | P1       | S      | GDPR/CCPA compliant data removal     |

**Acceptance Criteria:**

- Sign up completes in < 90 seconds
- Preferences sync across devices
- Guest mode available for immediate value (delayed signup)

---

### 7. Onboarding Experience

**Why it matters:** First-time user experience determines retention. Target: recipe suggestion within 60 seconds of download.

| Step             | Priority | Content                                  |
| ---------------- | -------- | ---------------------------------------- |
| 1. Welcome       | P0       | Value proposition in 3 screens (<30 sec) |
| 2. Permissions   | P0       | Camera access with clear explanation     |
| 3. Dietary Setup | P0       | Quick visual selection (optional skip)   |
| 4. First Scan    | P0       | Guided tutorial overlay                  |
| 5. First Recipe  | P0       | Celebrate success, encourage save        |

**Acceptance Criteria:**

- Complete onboarding in < 3 minutes
- First recipe suggestion within 60 seconds
- Skip options for experienced users
- Works without camera (manual entry fallback)

---

## User Flows

### Flow 1: First-Time User (Critical Path)

```
Download App
    |
Open App (< 2 sec cold start)
    |
3 Value Screens (< 30 sec)
    |
Sign Up or "Skip for Now"
    |
Camera Permission Request
    |
Quick Dietary Setup (or Skip)
    |
First Scan Tutorial
    |
Scan Fridge (< 5 sec)
    |
Confirm Ingredients (< 15 sec)
    |
See Recipe Suggestions (< 3 sec)
    |
Tap Recipe -> Cook!
```

**Target:** First recipe in < 4 minutes from download

### Flow 2: Daily Returning User

```
Open App (< 1 sec warm start)
    |
See "Use First" alert (expiring ingredients)
    |
Tap Scan
    |
Capture Fridge
    |
Confirm Ingredients
    |
Select Recipe from Results
    |
Cook!
```

**Target:** Recipe selection in < 60 seconds

### Flow 3: Expiration Alert Response

```
Receive Push Notification
    |
Tap Notification
    |
Open App to Expiring Item Detail
    |
See "Recipes Using This Item"
    |
Select Recipe -> Cook!
```

**Target:** Recipe selection in < 30 seconds

---

## Technical Architecture (MVP)

### Frontend

| Component        | Technology              |
| ---------------- | ----------------------- |
| Framework        | React Native            |
| State Management | Redux Toolkit           |
| Navigation       | React Navigation        |
| Camera           | react-native-camera-kit |
| AI/ML (iOS)      | Core ML                 |
| AI/ML (Android)  | TensorFlow Lite         |

### Backend

| Component         | Technology                      |
| ----------------- | ------------------------------- |
| API               | Node.js + Express               |
| Database          | PostgreSQL (users, preferences) |
| Cache             | Redis (recipe cache)            |
| Auth              | Firebase Authentication         |
| Push              | Firebase Cloud Messaging        |
| CDN               | CloudFront (recipe images)      |
| Cloud ML Fallback | AWS SageMaker                   |

### Performance Targets

| Metric             | Target                           |
| ------------------ | -------------------------------- |
| App launch (cold)  | < 2 seconds                      |
| App launch (warm)  | < 1 second                       |
| Fridge scan time   | < 5 seconds                      |
| Recipe search      | < 3 seconds                      |
| API response (p95) | < 300ms                          |
| App size           | < 80MB                           |
| Offline mode       | View saved recipes, recent scans |

---

## Recipe Database Strategy

### MVP Approach (Recommended)

**License existing API:**
| Provider | Recipes | Cost | Notes |
|----------|---------|------|-------|
| Spoonacular | 5,000+ | $29-149/mo | Good structured data |
| Edamam | 2M+ | Pay-per-call | Excellent nutrition data |
| Tasty (RapidAPI) | 1,000+ | $0-50/mo | Video-friendly |

**Recommendation:** Spoonacular API for MVP with plan to build proprietary database post-launch.

### Post-MVP

- Partner with food bloggers for original content
- User-contributed recipes with moderation
- AI-generated recipes with human curation

---

## MVP Success Metrics

### Primary KPIs (8 weeks post-launch)

| Metric                 | Target | Measurement                   |
| ---------------------- | ------ | ----------------------------- |
| Downloads              | 10,000 | App Store Analytics           |
| Day 1 Retention        | 50%    | Users returning next day      |
| Day 7 Retention        | 25%    | Users returning after 1 week  |
| Day 30 Retention       | 15%    | Users returning after 1 month |
| Scans/user/week        | 3+     | Backend analytics             |
| Recipes viewed/session | 4+     | Backend analytics             |
| App Store rating       | 4.2+   | App Store reviews             |

### Secondary KPIs

| Metric                        | Target             |
| ----------------------------- | ------------------ |
| Scan accuracy (user-reported) | 85%+               |
| Dietary filter usage          | 40% of users       |
| Expiration alerts clicked     | 30% CTR            |
| Shopping lists created        | 2,000/week         |
| Recipes saved                 | 5+ per active user |

### North Star Metric

**Recipes Cooked Per User Per Month:** Target 8+

---

## Monetization Strategy

### Freemium Model (Recommended)

| Tier               | Price     | Features                                                  |
| ------------------ | --------- | --------------------------------------------------------- |
| **Free**           | $0        | 5 scans/day, basic recipes, ads                           |
| **Premium**        | $7.99/mo  | Unlimited scans, no ads, nutrition info, advanced filters |
| **Premium Annual** | $59.99/yr | ~37% discount                                             |
| **Family**         | $11.99/mo | Premium + 5 profiles, shared lists                        |

### Conversion Strategy

- Free tier provides real value (not crippled)
- Premium features target power users (Maya, Jordan personas)
- Annual discount encourages commitment
- Family plan captures household decision-makers

---

## MVP Development Timeline

### Phase 1: Foundation (Weeks 1-3)

- [ ] Project setup (React Native, backend infrastructure)
- [ ] User authentication (email, Apple, Google)
- [ ] Basic UI shell and navigation
- [ ] Recipe API integration (Spoonacular)
- [ ] CI/CD pipeline setup

### Phase 2: Core Scanning (Weeks 4-7)

- [ ] Camera integration and capture flow
- [ ] AI model integration (Core ML)
- [ ] Ingredient detection and overlay
- [ ] Ingredient confirmation UI
- [ ] Manual add fallback

### Phase 3: Recipe Engine (Weeks 8-10)

- [ ] Ingredient-to-recipe matching algorithm
- [ ] Recipe list and detail views
- [ ] Dietary filtering system
- [ ] Match percentage calculation
- [ ] Save/favorite functionality

### Phase 4: Food Waste Features (Weeks 11-12)

- [ ] Expiration tracking system
- [ ] "Use First" prioritization
- [ ] Push notification infrastructure
- [ ] Expiration alert implementation

### Phase 5: Shopping & Polish (Weeks 13-14)

- [ ] Shopping list feature
- [ ] Onboarding flow
- [ ] Performance optimization
- [ ] Beta testing (500 users)

### Phase 6: Launch (Weeks 15-16)

- [ ] Bug fixes from beta
- [ ] App Store submission
- [ ] Launch marketing
- [ ] Post-launch monitoring

---

## Risk Assessment

| Risk                             | Likelihood | Impact   | Mitigation                                                        |
| -------------------------------- | ---------- | -------- | ----------------------------------------------------------------- |
| AI scanning accuracy < 85%       | Medium     | Critical | Manual entry fallback, user correction loop, expectation setting  |
| Low retention after first use    | High       | High     | Focus on expiration alerts for re-engagement, quick time-to-value |
| Recipe API limitations           | Medium     | High     | Multi-provider backup, build toward proprietary database          |
| Camera permission denial         | Medium     | Medium   | Clear value explanation, graceful manual entry fallback           |
| Poor performance in bad lighting | High       | Medium   | Lighting guidance, flash option, multi-photo capture              |
| Competition from Apple/Google    | Medium     | Medium   | Privacy differentiation, cross-platform, speed to market          |

---

## Feature Priority Summary

### P0 - Launch Blockers (Must Have)

1. AI fridge scanning with ingredient detection
2. Ingredient confirmation and editing UI
3. Recipe search by available ingredients
4. Match percentage display
5. Cook time and difficulty filters
6. Dietary allergen filtering
7. Expiration date tracking
8. "Use First" recipe prioritization
9. Expiration push notifications
10. Shopping list from missing ingredients
11. User authentication
12. Onboarding flow

### P1 - Fast Follow (Weeks 4-8 Post-Launch)

1. Barcode scanning
2. AI expiration estimation
3. "Last Chance" recipes
4. Food waste dashboard
5. Recipe ratings
6. Serving size scaling
7. Cuisine filtering
8. Enhanced onboarding analytics

### P2 - Future Releases

1. Waste reduction gamification
2. Household profiles
3. Shopping list sharing
4. Price estimation
5. Preference learning algorithm
6. Nutritional macro display
7. Recipe comments

---

## Appendix: Persona-to-Feature Mapping

| Feature                | Maya (Weeknight) | Jordan (Macro) | Angela (Family) | Ethan (Novice) | Priya (Celiac) | Robert (Retired) |
| ---------------------- | ---------------- | -------------- | --------------- | -------------- | -------------- | ---------------- |
| AI fridge scanning     | Essential        | High           | Essential       | High           | High           | High             |
| Quick-filter (<30 min) | Essential        | Medium         | Essential       | High           | Medium         | Low              |
| Dietary filters        | Medium           | Essential      | Medium          | Low            | Essential      | High             |
| Expiration tracking    | Essential        | Medium         | Essential       | Medium         | Medium         | Medium           |
| "Use First" recipes    | Essential        | High           | Essential       | Medium         | Medium         | Medium           |
| Shopping list          | Essential        | High           | Essential       | Medium         | High           | Medium           |
| Skill level filter     | Low              | Low            | Low             | Essential      | Low            | Medium           |
| Cost per serving       | Low              | Low            | Essential       | High           | Low            | Medium           |

---

## Next Steps

1. **User Validation:** Conduct 15-20 interviews with target personas
2. **Technical Feasibility:** Prototype AI scanning accuracy with real fridge photos
3. **Recipe API Evaluation:** Test Spoonacular, Edamam for data quality
4. **Design Sprint:** Create high-fidelity prototypes for key flows
5. **Engineering Planning:** Sprint breakdown and team allocation

---

_This MVP feature list should be validated through user research and revised based on testing feedback._

_Version 1.0 | Created: 2026-01-05_
