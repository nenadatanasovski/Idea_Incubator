---
evaluated_at: 2025-12-28
overall_score: 5.1
recommendation: REFINE
---

# Evaluation Results

**Overall Score:** 5.1/10
**Recommendation:** REFINE
**Evaluated:** 12/28/2025

## Category Scores

| Category | Score | Confidence |
|----------|-------|------------|
| Problem | 4.0/10 | 80% |
| Solution | 4.8/10 | 87% |
| Feasibility | 5.6/10 | 81% |
| Fit | 5.6/10 | 83% |
| Market | 5.6/10 | 86% |
| Risk | 7.6/10 | 78% |

## Detailed Scores

### Problem

**Problem Clarity:** 6/10
> The problem statement identifies two distinct issues: (1) difficulty finding available coworking spaces, and (2) fragmentation of existing platforms without real-time availability. While these are understandable pain points, the problem lacks specificity. What does 'struggle to find' mean exactly? Is it discovery of spaces that exist, or availability at desired times, or pricing transparency, or quality assessment? The 'especially on short notice' qualifier hints at a time-sensitive booking problem, but this isn't developed. The problem is stated but not deeply articulated.

**Problem Severity:** 4/10
> The severity of this problem is questionable. Finding a coworking space is a 'nice to have' solved problem for most - people can work from home, cafes, libraries, or simply book ahead. The 'short notice' use case suggests urgency, but how often does this actually occur? The idea doesn't demonstrate that this is a hair-on-fire problem. Users have alternatives (book in advance, use existing platforms, call spaces directly, work elsewhere). The pain seems more like mild inconvenience than acute suffering. No evidence of users abandoning work or losing significant money due to this problem.

**Target User Clarity:** 5/10
> The target market section lists four segments: remote workers, freelancers/consultants, small business owners, and corporate teams. This is too broad and unfocused. The 'estimated 500,000+' remote workers figure is unsubstantiated and likely inflated (this would be ~10% of Sydney's entire metro population). More critically, these segments have vastly different needs: a freelancer looking for a daily hot desk is nothing like a corporate team booking meeting rooms. No primary persona is identified. Which segment has the most acute need? Who will pay for this? The idea tries to serve everyone, which typically means serving no one well.

**Problem Validation:** 2/10
> There is zero evidence of problem validation in this idea document. No user interviews, surveys, forum complaints, or even anecdotal evidence is presented. The problem appears to be assumed based on the founder's intuition or personal experience (which isn't even stated). Market size numbers are provided, but market size doesn't validate that the specific problem exists or that users would pay for a solution. This is a critical gap - the entire premise rests on an unvalidated assumption that this fragmentation is a real pain point worth solving.

**Problem Uniqueness:** 3/10
> This problem space is far from novel. The idea itself acknowledges competitors: WeWork, Hub Australia, Tank Stream Labs, Fishburners, and Google Maps. These aren't just competitors - they ARE solutions to this exact problem. WeWork has a booking app. Hub Australia has online booking. Google Maps shows coworking spaces with hours and reviews. Platforms like Deskpass, Coworker.com, and LiquidSpace already aggregate coworking globally. The 'real-time availability' angle is the only potentially unique aspect, but even this exists in various forms. The problem isn't unique - it's actively being addressed by multiple well-funded players.

### Solution

**Solution Clarity:** 5/10
> The solution is described at a high level but lacks critical specifics. We know it's a 'mobile-first platform' with 'real-time availability, instant booking, and location-based search' - these are feature categories, not specifications. Missing: How does real-time availability work? Direct API integration with spaces? Manual updates? Scraping? What does the booking flow look like? Payment processing details? User account system? The description reads more like a pitch deck bullet point than a technical specification. Compare this to proven solutions like Optix or OfficeRnD which have detailed feature sets including white-labeling, member management, access control integration, and analytics dashboards.

**Solution Feasibility:** 8/10
> The technology is definitively proven. Multiple production systems demonstrate every claimed capability: Optix launched in 2016 with white-labeled mobile apps, LiquidSpace operates across 13,000+ locations in 130 countries, Spacebring delivers 80% self-served bookings. Real-time availability, instant booking, and location-based search are all commodity features in 2025. The technical stack (mobile app + booking backend + maps integration) is well-understood. The only feasibility question is the business/partnership challenge of getting Sydney spaces to integrate - but this is a go-to-market problem, not a technical one. Modern solutions even include AI voice agents and predictive analytics, suggesting the basic feature set described is very achievable.

**Solution Uniqueness:** 3/10
> This is effectively a geographic subset of existing global solutions. LiquidSpace already covers 13,000+ locations across 130 countries - presumably including Sydney. Deskpass operates in 290+ cities. The only differentiation mentioned is 'Sydney' and 'Greater Sydney suburbs' - geographic focus is not a product innovation. The feature set (aggregation, real-time availability, instant booking, location search) is identical to at least 6 proven competitors identified in the research. No unique capabilities are proposed: no AI matching, no community features, no loyalty program, no unique pricing model, no integration with Australian-specific services (Opal card for transit, Australian business registration lookup, etc.). This is a me-too play with a geographic label.

**Solution Scalability:** 6/10
> As a marketplace platform, the solution has reasonable scalability characteristics. Software marginal costs are near-zero per additional user. However, scalability is constrained in several ways: (1) Geographic limitation to Sydney caps the addressable market, (2) Each new coworking space requires onboarding effort - this is a two-sided marketplace where supply-side scaling requires sales/partnership work, (3) Real-time availability integration with each space's systems may require custom work per venue. The platform could theoretically expand to Melbourne, Brisbane, etc., but there's no network effect that makes Sydney success translate automatically to other cities. Spacebring's case study showing 20+ hours/month admin time reduction suggests spaces need incentives to integrate - this is a scaling friction.

**Solution Defensibility:** 2/10
> The solution has virtually no moat. (1) No technology barrier - proven solutions exist and could launch in Sydney overnight. LiquidSpace/Deskpass could focus marketing on Sydney with zero product changes. (2) No network effects articulated - users don't benefit from other users. (3) No data advantage - booking data isn't proprietary or unique. (4) No exclusive supply partnerships mentioned - any space could list on multiple platforms. (5) No brand or community moat - no reason for loyalty. (6) No regulatory advantage - no licensing requirements that create barriers. The only potential moat would be exclusive partnerships with Sydney spaces, but this isn't mentioned and would be difficult to enforce. A well-funded competitor (or existing global player) could replicate this in weeks.

### Feasibility

**Technical Complexity:** 6/10
> This is a moderately complex application requiring several integrated components: (1) Mobile app for iOS/Android, (2) Backend API for aggregation, (3) Real-time availability system, (4) Booking/payment integration, (5) Location-based search with mapping, (6) Integration with multiple coworking space providers. The 'real-time availability' feature is the most technically challenging aspect - it requires either API integrations with each coworking provider (many don't have public APIs) or manual inventory management. Location-based search and mapping are well-solved problems with mature libraries. The core CRUD functionality is straightforward, but the real-time sync and multi-provider integration adds significant complexity. With 10 years of app development experience, the creator has strong foundations, though aggregation platforms have hidden complexity in data synchronization.

**Resource Requirements:** 5/10
> Building a quality mobile aggregation platform requires substantial resources: (1) Development costs: MVP likely 3-6 months of full-time work or $50-100K if outsourced; (2) Business development: Significant time needed to partner with coworking spaces for availability data; (3) Ongoing costs: Hosting, API calls, mapping services (Google Maps API can be expensive at scale), payment processing fees; (4) Marketing: Competing against Google Maps and established players requires marketing budget; (5) Legal: Terms of service, privacy policy, potentially dealing with booking disputes. The creator has 38 hours/week which is substantial, but this is essentially a solo founder building a marketplace - these typically require either significant capital or much longer timelines. No mention of funding or budget available.

**Skill Availability:** 7/10
> The creator has 10 years of app-building experience, which is a strong foundation for the core technical work. Fintech experience is valuable for payment integration and handling transactions. Healthcare experience suggests exposure to compliance and data handling. However, there are notable gaps: (1) No explicit mobile development experience mentioned (could be web apps); (2) Fintech/Healthcare domains don't directly translate to marketplace/aggregation patterns; (3) No mention of business development or sales experience, which is critical for signing up coworking spaces; (4) No marketing or growth experience mentioned. The 'Not specified' skill gaps is concerning - self-awareness about gaps is important. Real estate/proptech domain experience would be more relevant here.

**Time to Value:** 6/10
> A realistic timeline: (1) MVP with manual listings (no real-time): 6-8 weeks at 38 hrs/week; (2) First partnerships with 5-10 spaces: 2-4 weeks concurrent with dev; (3) Beta with real-time for select partners: 3-4 months; (4) Full launch with 50+ spaces: 6-9 months. First value (a working app with some listings) could be achieved in 2-3 months, which is reasonable. However, 'real-time availability' pushes this out significantly - that feature requires either sophisticated integrations or manual processes. The chicken-and-egg problem of marketplaces applies: users want many spaces, spaces want many users. A geo-focused approach (Sydney only) helps constrain scope. The creator could launch a simpler 'directory' version quickly, then iterate toward real-time.

**Dependency Risk:** 4/10
> This idea has significant external dependencies: (1) Coworking space partnerships - CRITICAL: Without spaces agreeing to list and share availability, the product has no value. This is entirely dependent on external parties agreeing to participate, potentially for free initially; (2) API/data access - Many spaces use booking systems like Nexudus, Optix, or OfficeRnD - integration depends on their API access policies; (3) App store approval - Standard dependency but manageable; (4) Mapping services - Dependent on Google Maps or Apple Maps APIs and pricing; (5) Payment processors - Standard integrations available; (6) Competitive response - WeWork or Hub Australia could easily build this feature if it gains traction. The coworking space dependency is the killer - this is a B2B2C model where the 'middle B' (coworking spaces) must actively participate. Some competitors (WeWork, Hub) have no incentive to list on an aggregator.

### Fit

**Personal Fit:** 7/10
> The creator's primary goal is 'Revenue/Income Generation' with success defined as 'generating passive income.' A coworking space finder app has moderate alignment with this goal. On the positive side, a marketplace/aggregator model can generate recurring commission revenue from bookings, and once established, could become relatively passive. However, this type of platform requires significant upfront effort to build supply-side relationships with coworking spaces, ongoing maintenance for real-time availability integrations, and continuous customer acquisition. True 'passive income' is unlikely in the early years - this would be more of an active business that could eventually become semi-passive. The model does support recurring revenue through repeat bookings, which aligns with income generation goals.

**Passion Alignment:** 4/10
> The stated motivation is 'Financial Freedom' with no indication of genuine interest in the coworking industry, remote work culture, or the specific problem of workspace discovery. The creator's domain expertise is in Fintech and Healthcare - completely unrelated to real estate, coworking, or workplace solutions. This suggests the idea may be opportunistic rather than passion-driven. While financial motivation can sustain effort, the absence of any stated connection to the problem space (e.g., being a frustrated remote worker themselves, knowing people in the coworking industry, or having interest in the future of work) is a concern. Passion-driven founders typically persist through the inevitable challenges of marketplace businesses; financially-motivated founders without domain passion often pivot or abandon when difficulties arise.

**Skill Match:** 8/10
> The creator has '10 years of building apps' which is highly relevant for a 'mobile-first platform.' This is a strong technical skill match. Building a coworking finder app requires mobile development expertise, which the creator demonstrably has. The app would need location-based services, booking systems, payment processing, and real-time availability - all standard mobile app patterns that a 10-year veteran would be familiar with. However, the domain expertise in 'Fintech, Healthcare' doesn't directly transfer to real estate/workspace aggregation. The creator would need to learn: partnership development with coworking spaces, real estate SaaS dynamics, and local market operations. Technical execution should be straightforward; business model execution is where skill gaps exist.

**Network Leverage:** 2/10
> The profile explicitly states 'No network information provided' and the creator's domain expertise is in 'Fintech, Healthcare' - neither of which connects to coworking, commercial real estate, or the Sydney workspace market. This is essentially a cold start. To succeed, this business would need: relationships with coworking space operators (WeWork, Hub Australia, Tank Stream Labs, Fishburners, and smaller independents), connections to commercial real estate decision-makers, access to the Sydney remote worker community, and potentially investors familiar with proptech. Starting without any of these connections significantly increases time to market and customer acquisition costs. The creator would need to build an entirely new professional network from scratch.

**Life Stage Fit:** 7/10
> The creator has strong foundational capacity: 38 hours/week available (essentially full-time) and 33 months of financial runway. This is substantial runway - nearly 3 years to build and validate a marketplace business. However, key context is missing: employment status is 'undefined' (are they employed and planning to quit, already freelancing, or unemployed?) and risk tolerance is 'undefined.' The 38 hours suggests this could be full-time dedication, which is appropriate for a marketplace startup that requires significant hustle in early stages to secure supply-side partnerships. The long runway mitigates financial pressure. The unknowns prevent a higher confidence score, but available data suggests reasonable life stage fit.

### Market

**Market Size:** 6/10
> LOCAL: The Australian coworking market is AUD $537M (2025), with Sydney and Melbourne accounting for ~70% (~AUD $376M combined). This is a reasonable local market for a Sydney-focused app. However, the user's claim of '$450M AUD Sydney coworking market' appears inflated - the verified figure is likely closer to AUD $180-200M for Sydney specifically. The app is a marketplace/aggregator, not a space operator, so the real TAM is the transaction/booking fees on this market (typically 10-20%), reducing effective TAM to AUD $18-40M locally. GLOBAL: The global coworking market is verified at $17-30B USD (2025), growing to $46-87B by 2030. Existing marketplace players like LiquidSpace (13,000+ locations), Coworker (25,000+ listings), and Deskpass already capture significant share. OVERALL: For a Sydney-first app, the local SAM is modest but viable. Expansion potential exists but faces entrenched global competitors. The marketplace model has thinner margins than actual space operation.

**Market Growth:** 8/10
> LOCAL: Australia's coworking market shows strong growth at 15-23.6% CAGR through 2030. The market doubled from AUD $270M (2020) to AUD $537M (2025). Key drivers include: 69% of Australian employers offering hybrid work, 55% of Sydney workers working from home at least part-time, and geographic decentralization to Parramatta, North Sydney, and Richmond. Sydney CBD office investment hit $4.3B in 2024 (highest since 2020). GLOBAL: Global CAGR of 8.2-16.8% (2025-2030). Freelancer economy growing at 18.9% CAGR with 4.1M+ freelancers in Australia alone. OVERALL: Strong tailwinds from hybrid work adoption post-pandemic. The shift is structural, not temporary. Mobile-first solutions seeing 20% increase in purchasing behavior. This is a growing market with sustained momentum.

**Competition Intensity:** 3/10
> LOCAL: High competition intensity verified. Sydney has major players including WeWork (15+ Australian locations), Hub Australia, Tank Stream Labs, Fishburners, Regus/IWG (79 Australian spaces), The Commons, Worksmith, and Studio Society. Many of these have their own booking systems. GLOBAL: Intense competition from established marketplace players: LiquidSpace (13,000+ locations, 3,000 cities), Deskpass (290+ cities), Coworker (25,000+ listings, 172 countries), plus software platforms like Optix, Nexudus, Spacebring, OfficeRnD, and Cobot that spaces already use. These platforms have significant network effects and existing relationships with space operators. OVERALL: This is a crowded space with well-funded incumbents. The user identified only 5 competitors but research revealed 15+ significant players globally and 8+ locally. Google Maps and individual space websites provide partial solutions. Differentiation would require superior real-time availability data, which requires operator partnerships that competitors already have.

**Entry Barriers:** 4/10
> LOCAL: Technical barriers are low for building a basic aggregator app. However, the real barriers are partnership-based: getting coworking spaces to provide real-time availability data requires API integrations or manual partnerships with each operator. Existing software platforms (Optix, Nexudus, etc.) already have these relationships. Regulatory barriers are minimal for an aggregator (ABN registration, ACL compliance). The creator has NO stated industry connections, network, or community access - this is a significant handicap for a business model that relies entirely on B2B partnerships with space operators. GLOBAL: LiquidSpace and Coworker have 10+ years of operator relationships. Breaking into markets where incumbents have existing partnership networks is extremely difficult without either capital or relationships. OVERALL: While technically easy to build, the marketplace model requires two-sided network effects. Without operator partnerships, the app has no inventory. Without inventory, it has no users. Without users, operators won't prioritize integration. Creator's lack of stated network is a major liability.

**Timing:** 7/10
> LOCAL: Timing fundamentals are favorable. Sydney CBD office investment at 5-year high ($4.3B in 2024), hybrid work entrenched (69% of employers, 55% of workers), geographic decentralization creating demand outside CBD. Premium vacancy tightening to 10.9% suggests supply constraints that favor booking platforms. Freelancer economy booming (4.1M+ in Australia, 18.9% CAGR). GLOBAL: Post-pandemic hybrid work adoption is structural. AI integration is reshaping operations. Mobile-first experiences driving 20% increase in purchasing behavior - aligns with 'mobile-first platform' positioning. However, this also means the opportunity window for first-movers has passed - LiquidSpace, Coworker, and others established dominance 5-10 years ago. OVERALL: Good timing for the market category, but late timing for a new entrant. The structural shift to flexible work happened 2020-2022; incumbents captured that wave. A new entrant needs a differentiated angle, not just 'real-time availability.'

### Risk

**Execution Risk:** 7/10
> The creator has 10 years of app building experience, which significantly reduces execution risk for a mobile-first platform. This is a straightforward aggregator app requiring: (1) mobile development, (2) API integrations with coworking spaces, (3) real-time availability systems, and (4) booking/payment processing. None of these are technically novel. However, execution risk remains due to: (a) the challenge of signing up coworking spaces to participate, (b) building and maintaining integrations with multiple providers who may lack APIs, and (c) the operational complexity of real-time availability syncing. The 33-month runway provides comfortable time to iterate. The main execution challenge is the 'cold start' problem - needing both spaces and users to create value.

**Market Risk:** 7/10
> The market exists and is growing - coworking is an established industry with $450M AUD in Sydney alone. The problem statement is credible: fragmentation and lack of real-time availability are genuine pain points. However, several market risks exist: (1) The 'remote workers in Sydney (estimated 500,000+)' figure needs validation - how many actually need coworking vs. working from home? (2) Post-pandemic work patterns are still evolving and could shift. (3) The aggregator model requires coworking spaces to participate, and they may prefer direct bookings to preserve margin. (4) The casual/on-demand segment may be smaller than assumed - many users commit to monthly memberships. The existence of WeWork, Hub Australia, and others proves demand exists, but also suggests the market may consolidate around major players.

**Technical Risk:** 8/10
> This is a low technical risk venture. The core technology stack is well-established: mobile apps (React Native/Flutter), mapping/location services, booking systems, and payment processing all have mature solutions. Real-time availability is the most challenging technical element, but this can be solved through: (1) API integrations where available, (2) manual calendar syncing, or (3) POS integrations. The creator's 10 years of app experience de-risks implementation. No AI, ML, hardware, or novel algorithms are required. The main technical challenges are operational rather than fundamental: maintaining data accuracy across many venues, handling edge cases in bookings, and scaling integrations.

**Financial Risk:** 8/10
> With 33 months of runway, the creator has exceptional financial cushion for this type of venture. This is a software business with relatively low capital requirements - no hardware, no inventory, no physical assets. Key cost drivers would be: (1) development time (offset by creator's skills), (2) marketing to acquire users and venues, and (3) infrastructure/hosting (minimal at scale). The business model (likely commission on bookings) provides recurring revenue potential. The main financial risks are: (a) customer acquisition costs in a competitive market, (b) time-to-revenue if the cold start problem is hard to solve, and (c) unknown risk tolerance and employment status means we can't assess if runway is being depleted by living expenses. The undefined risk tolerance is a gap in assessing financial pressure tolerance.

**Regulatory Risk:** 8/10
> This is a low regulatory risk business. It's a booking platform operating in an established industry with clear legal frameworks. Key considerations: (1) Australian Consumer Law applies to bookings - standard terms and refund policies needed. (2) Privacy Act 1988 compliance for user data - well-documented requirements. (3) Payment processing through regulated gateways (Stripe/PayPal) handles financial compliance. (4) No special licenses required for a booking aggregator. Minor considerations include: (a) ensuring proper liability framing (platform vs. service provider), (b) accessibility compliance for mobile apps, and (c) potential future regulation around gig economy/flexible work. This is far from a regulatory minefield - it's a standard digital marketplace.

## Debate Summary

- **Total Rounds:** 30
- **Initial Score:** 5.4/10
- **Final Score:** 5.1/10
- **Score Change:** -0.4

### Score Adjustments from Debate

- **Problem Clarity:** 6 → 1 (-5.0)
- **Problem Validation:** 2 → 7 (+5.0)
- **Problem Uniqueness:** 3 → 8 (+5.0)
- **Solution Feasibility:** 8 → 3 (-5.0)
- **Solution Uniqueness:** 3 → 8 (+5.0)
- **Solution Scalability:** 6 → 1 (-5.0)
- **Target User Clarity:** 5 → 1 (-4.0)
- **Problem Severity:** 4 → 1 (-3.0)
- **Solution Clarity:** 5 → 4 (-1.0)
- **Solution Defensibility:** 2 → 1 (-1.0)

### Key Insights from Debate

- Problem clarity should be scored on whether the statement is actionable enough to build from - a score of 6/10 implies reasonable clarity, but if you can't determine what type of product to build, the score should reflect that fundamental ambiguity.
- Market fragmentation in aggregator plays must be analyzed for whether it represents genuine inefficiency or intentional competitive moats - misdiagnosing this undermines the entire problem thesis.
- Ambiguous time-sensitivity claims ('short notice', 'urgent', 'immediate') in problem statements must be quantified - different time horizons imply entirely different products, technical requirements, and competitive positions.
- Problem clarity isn't just about articulating pain points—it must be specific enough to determine what you're actually building. Vague problems that could spawn multiple solution architectures indicate the founder hasn't done the thinking required to execute.
- Fragmentation in marketplaces can be a deliberate moat strategy by incumbents, not just a market inefficiency to be solved. Problem clarity must distinguish between 'problem exists for users' and 'problem is addressable given market structure.'
- A problem statement built around an undefined timeframe ('short notice') cannot be validated until that timeframe is specified - different definitions lead to completely different competitive landscapes and technical requirements.
- Problem clarity must be specific enough to determine product architecture - 'struggle to find' could mean 4+ entirely different products requiring different tech stacks and partnerships.
- Problem clarity requires understanding whether an observed 'problem' is market inefficiency or intentional competitive strategy - misdiagnosing deliberate fragmentation as accidental inefficiency undermines the entire value proposition.
- A problem statement's core differentiator ('short notice') that lacks definition isn't a minor omission—it's a fundamental clarity failure that makes the problem unverifiable.
- Problem severity must be evaluated not just by intensity of pain, but by whether that pain exists in a population with willingness AND ability to pay. A problem affecting price-sensitive, infrequent users may not be commercially viable to solve.

## External Research

*Research conducted: 2025-12-28*

### Sources Referenced

- https://straitsresearch.com/report/coworking-spaces-market
- https://www.coherentmarketinsights.com/industry-reports/coworking-spaces-market
- https://www.thebusinessresearchcompany.com/report/coworking-space-global-market-report
- https://www.researchandmarkets.com/report/coworking-space
- https://factualhubs.com/10-best-coworking-spaces-in-sydney/
- https://manofmany.com/culture/best-co-working-spaces-in-sydney
- https://www.whitepeakdigital.com/blog/best-sydney-coworking-spaces/
- https://www.instantoffices.com/blog/instant-offices-news/coworking-down-under/
- https://www.optixapp.com/blog/best-coworking-apps/
- https://liquidspace.com/
- https://nomad-magazine.com/blog/7-apps-like-getcroissant-to-access-coworking-spaces-around-the-world/

### Market Research Findings

**Verified Market Size:** $17.42 billion to $30.45 billion globally in 2025 (various sources report different estimates; most common range is $17-25 billion USD)

*User claimed: $450M*


### Market Trends

**Direction:** growing

**Evidence:** Global CAGR ranges from 8.2% to 16.8% (2025-2030+); Australia specifically shows 15-23.6% CAGR through 2030; Australia's coworking market doubled from AUD $270M (2020) to AUD $537M (2025)


### Additional Competitors Discovered

- Regus/IWG
- Spaces (by IWG)
- The Commons
- Worksmith
- Studio Society
- Bond Collective
- The Office Space
- Industrious
- LiquidSpace (marketplace app)
- Deskpass (marketplace app)
- Coworker (marketplace platform)
- Optix (software/app platform)
- Nexudus (software/app platform)
- Spacebring (software/app platform)
- OfficeRnD (software/app platform)
- Cobot (software/app platform)

### Technology Feasibility

**Assessment:** proven

**Production Examples:**
- Optix - white-labeled mobile app launched 2016, rated #1 in user experience
- Spacebring - reduced admin time by 20+ hours/month for Impact Hub Ljubljana, 80% self-served bookings
- OfficeRnD Members - white-labeled app for resource booking on-the-go
- LiquidSpace - marketplace app covering 13,000+ locations in 3,000 cities across 130 countries
- Deskpass - pay-as-you-go app in 290+ cities, hot desks from $15/day
- Cobot - native mobile app for workspace bookings
- AI integration proven in 2025 with voice agents, predictive analytics, automated pricing optimization

*7 web searches performed*
