---
evaluated_at: 2025-12-27
overall_score: 1.9
recommendation: ABANDON
---

# Evaluation Results

**Overall Score:** 1.9/10
**Recommendation:** ABANDON
**Evaluated:** 12/27/2025

## Category Scores

| Category    | Score  | Confidence |
| ----------- | ------ | ---------- |
| Problem     | 4.6/10 | 80%        |
| Solution    | 5.6/10 | 83%        |
| Feasibility | 4.0/10 | 69%        |
| Fit         | 5.0/10 | 37%        |
| Market      | 6.4/10 | 73%        |
| Risk        | 5.2/10 | 60%        |

## Detailed Scores

### Problem

**Problem Clarity:** 7/10

> The problem is reasonably well-articulated: homeowners waste energy due to lack of visibility into consumption. The idea provides specific quantification (20-30% waste, $1,500/year average spend) which adds credibility. However, the problem statement conflates two distinct issues: (1) lack of visibility/awareness, and (2) inability to act on information. It's unclear which is the primary pain point. The causal chain 'no visibility → waste' is assumed but not proven. Additionally, the 20-30% waste figure is cited without source, raising questions about whether this is validated data or an assumption.

**Problem Severity:** 5/10

> The financial impact is moderate but not severe. At $1,500/year with 20-30% waste, we're talking about $300-450 in potential annual savings. This is meaningful but unlikely to be 'unbearable pain.' Most households treat electricity as a fixed cost and don't actively think about optimization. The problem is chronic rather than acute - there's no crisis moment that drives urgency. Environmental concern adds emotional weight for some segments, but for mass market, this is a 'nice to have' optimization rather than a burning need. The pain is diffuse (spread across the year) rather than concentrated.

**Target User Clarity:** 6/10

> The target user is partially defined: 'Environmentally conscious homeowners aged 30-55 who want to reduce energy bills and carbon footprint.' This provides demographics and psychographics, but lacks behavioral specificity. Key questions remain: Are these tech-savvy early adopters? Do they already have smart home devices? What's their income level? The persona combines two potentially conflicting motivations (cost savings vs. environmental concern) - which is primary? The 30-55 age range is quite broad (25 years). Missing: housing type, geographic considerations (energy costs vary dramatically by region), current energy awareness behaviors.

**Problem Validation:** 2/10

> There is zero evidence of user validation in this idea description. No customer interviews, surveys, landing page tests, or any form of problem validation is mentioned. The statistics cited (20-30% waste, $1,500/year) appear to be industry data, not primary research. The existence of competitors (Sense, Emporia, Neurio) suggests the problem resonates with some users, but this is indirect validation at best. The idea reads as a hypothesis built from market research rather than user discovery. This is a significant red flag - the problem may be real, but there's no evidence this founder has validated it firsthand.

**Problem Uniqueness:** 3/10

> This is explicitly NOT a novel problem - the idea itself acknowledges established competitors: Sense, Emporia, and Neurio. The smart home energy monitoring space has been active for 10+ years. Utility companies increasingly offer free energy monitoring through smart meters. The proposed differentiation (AI recommendations, lower price) addresses solution uniqueness, not problem uniqueness. The core problem of 'I don't know what's using my electricity' is well-recognized and has multiple existing solutions at various price points. This is a competitive market entry, not a greenfield opportunity.

### Solution

**Solution Clarity:** 7/10

> The solution is reasonably well-articulated with specific technical components (ESP32, current transformer sensors, TensorFlow Lite, React Native) and clear feature set (appliance identification, real-time tracking, bill prediction, alerts, rate optimization). However, critical implementation details are missing: How does the clip-on installation work on various panel types? What's the data pipeline from device to app? How does the ML model train for new appliance signatures? The $99 price point is stated but not justified against BOM costs. The solution describes WHAT it does but lacks depth on HOW it achieves differentiated results.

**Solution Feasibility:** 8/10

> The core technology is proven and commercially available. Non-Intrusive Load Monitoring (NILM) using current transformers is established science - Sense has been shipping since 2017. ESP32 is a mature, low-cost platform capable of edge ML. TensorFlow Lite runs successfully on ESP32 with adequate optimization. The technical stack is conservative and buildable. The challenge is achieving competitive accuracy in appliance disaggregation - this requires significant training data and algorithm refinement, but it's engineering work, not research. React Native for mobile is standard. The main feasibility question is achieving the $99 price point with acceptable margins while matching $300+ competitor accuracy.

**Solution Uniqueness:** 4/10

> This is fundamentally a me-too product in a crowded space. Sense ($299) already does NILM with appliance disaggregation and has 5+ years of ML training data. Emporia Vue ($99) already hits the target price point with CT clamps. The claimed differentiators - 'AI-powered recommendations' and 'lower price point' - are weak. ALL competitors claim AI/ML. Emporia already matches the $99 price. The 'optimal usage times based on utility rates' is offered by most smart energy monitors and many utility apps. There's no novel technology, unique data source, proprietary algorithm, or innovative UX described. The idea would need a genuine innovation to score higher.

**Solution Scalability:** 6/10

> Hardware businesses face inherent scaling challenges. Each unit requires manufacturing, inventory, and shipping - linear cost scaling for hardware. However, the software/ML side has strong scalability: more devices improve the appliance signature database (network effects), app development amortizes across users, and SaaS upsells (premium features, utility partnerships) could provide high-margin recurring revenue at scale. The on-device ML approach (TensorFlow Lite) reduces cloud compute costs per user. Missing: any mention of subscription model, premium tiers, or ecosystem expansion. The current description is a single hardware product, which limits scaling upside.

**Solution Defensibility:** 3/10

> Defensibility is weak. There's no patent strategy mentioned for a hardware product where IP protection is critical. The technology stack (ESP32, CT sensors, TensorFlow Lite) is completely commodity - any competent team could replicate this in months. Established players like Sense have massive data moats (millions of appliance signatures from years of deployment). Large players (Google Nest, Amazon, utilities) could enter this space with superior distribution. The only potential moat not explored is data network effects - each deployment improves ML models - but this requires achieving significant scale before incumbents, which is unlikely given their head start. No brand, patents, exclusive partnerships, or regulatory advantages are mentioned.

### Feasibility

**Technical Complexity:** 4/10

> This project involves multiple technically challenging domains that must work together seamlessly. The core technical challenges include: (1) **Non-Intrusive Load Monitoring (NILM)** - Disaggregating whole-home power consumption into individual appliances by their electrical signatures is a notoriously difficult ML problem. Even research-grade solutions achieve only 70-85% accuracy. (2) **Hardware design** - Building a reliable, safe device that clips onto electrical panels requires UL certification, careful analog circuit design for current transformers, and robust signal processing. (3) **On-device ML with TensorFlow Lite** - Running NILM on an ESP32's limited memory (520KB RAM) is extremely constrained; most NILM models require significantly more resources. (4) **Real-time data streaming** - Syncing sensor data, processing ML inference, and communicating with a mobile app simultaneously taxes the ESP32. (5) **Mobile app integration** - React Native app with real-time dashboards, push notifications, and utility rate integration adds another complexity layer. While each component uses 'proven tech' as building blocks, the integration and the specific NILM accuracy problem remain genuinely difficult. Competitors like Sense have raised $100M+ and still struggle with appliance identification accuracy.

**Resource Requirements:** 3/10

> The resource requirements for this project are substantial and likely underestimated. **Financial costs**: (1) Hardware prototyping typically runs $10-50K before production (PCB iterations, components, test equipment). (2) UL/CE electrical safety certification costs $15-40K and takes 6-12 months. (3) Injection molding for enclosures requires $10-30K tooling. (4) Initial manufacturing run (MOQ 1000+ units) needs $50-100K upfront. (5) Mobile app development for iOS/Android with backend infrastructure requires significant ongoing investment. **Human resources**: This project needs expertise in analog electronics, embedded systems, ML engineering, mobile development, cloud backend, and product design—a minimum viable team of 3-5 people, or an extremely rare full-stack hardware+software individual. **Time investment**: Realistic timeline is 18-36 months from concept to retail product. The $99 price point claim is concerning—at retail, this leaves perhaps $40-50 for BOM + manufacturing + certification + margin, which is extremely tight for the described capabilities.

**Skill Availability:** 5/10

> **Critical caveat**: No user profile is available, so this assessment carries high uncertainty. The required skill set is unusually broad and deep: (1) **Analog electronics** - CT sensor integration, signal conditioning, ADC design. (2) **Embedded systems** - ESP32 firmware, real-time programming, power management. (3) **Machine Learning** - NILM algorithm development, model optimization for edge devices. (4) **Mobile development** - React Native, state management, real-time data visualization. (5) **Cloud/Backend** - Data storage, utility rate APIs, notification systems. (6) **Product design** - Enclosure design, user experience, safety considerations. (7) **Manufacturing** - DFM, supply chain, quality control. Few individuals possess expertise across all these domains. A solo founder would need to either hire/partner or spend years acquiring skills. Without profile information, I'm scoring this at the midpoint with low confidence—the creator could range from a seasoned IoT professional (score 7-8) to a software developer with no hardware experience (score 2-3).

**Time to Value:** 4/10

> Time to first meaningful value is measured in years, not months. **Phase breakdown**: (1) **Proof of concept** (3-6 months) - Basic CT sensor reading, ESP32 integration, simple power monitoring. This provides _some_ value but no differentiation from existing products. (2) **NILM development** (6-12 months) - Training ML models requires extensive data collection from real homes with known appliances. This is the core value proposition but needs significant iteration. (3) **Hardware refinement** (6-12 months) - Multiple PCB revisions, enclosure design, safety testing. (4) **Certification** (6-12 months) - UL/CE testing, often requires design modifications. (5) **Manufacturing setup** (3-6 months) - Supplier relationships, QC processes. (6) **App development** (4-8 months parallel) - Can progress alongside hardware but needs stable API. **First sellable product**: Realistically 24-36 months. **First customer value**: A working prototype providing basic monitoring (without AI) could exist in 6 months, but this doesn't match the stated value proposition. The AI-powered recommendations that differentiate from competitors require the longest development timeline.

**Dependency Risk:** 4/10

> This project has significant external dependencies that could block or delay progress. **Hardware supply chain**: ESP32 and electronic components are subject to global supply chain volatility (as seen during 2020-2022 chip shortages). Lead times can extend to 52+ weeks during constraints. **Regulatory dependencies**: UL/CE certification is mandatory for consumer electrical products—this is non-negotiable and timeline is controlled by testing labs. **Utility data dependencies**: Optimal rate recommendations require integration with utility rate APIs (if available) or manual rate entry, limiting the 'smart' recommendations feature. **Manufacturing dependencies**: Without in-house manufacturing, reliance on contract manufacturers for quality, timeline, and cost control. **Platform dependencies**: iOS/Android app store approvals, potential policy changes. **Training data dependencies**: NILM accuracy depends on collecting diverse appliance signatures across many homes and appliance types—a cold start problem. **Competitive moat risk**: Sense and others could drop prices or add AI features, undermining the core differentiation. The idea is not fully dependent on any single external factor, but the accumulation of dependencies creates substantial execution risk.

### Fit

**Personal Fit:** 5/10

> Without a user profile, I cannot assess whether this IoT hardware business aligns with the creator's personal or business goals. This idea requires someone whose goals include: building physical products, operating in the consumer electronics space, potentially raising capital for hardware manufacturing, and having a long-term commitment to product support and iteration. If the creator's goals are around quick income, lifestyle business, or staying purely in software, this would be a poor fit. If their goals include building an impactful sustainability-focused company with potential for acquisition in the smart home space, it could be excellent. The idea itself is well-conceived for someone with hardware ambitions, but the alignment is entirely unknown.

**Passion Alignment:** 5/10

> The idea touches on sustainability and energy efficiency, which can be passion-drivers for many people. The technical depth shown (specific microcontroller choice, ML approach, competitive analysis) suggests the creator has at least researched this space thoughtfully. However, I cannot determine if this stems from genuine passion for energy/sustainability problems, excitement about IoT/hardware tinkering, or simply identification of a market opportunity. The 'sustainability' tag and focus on carbon footprint reduction hints at possible environmental motivation, but this could also be market positioning rather than personal conviction. True passion in this space typically comes from either: (1) personal frustration with energy waste, (2) deep interest in IoT/hardware hacking, or (3) strong environmental values. None of these can be confirmed.

**Skill Match:** 5/10

> This idea requires a demanding intersection of skills: embedded systems/hardware engineering (ESP32, current transformers, electrical panel installation), machine learning (TensorFlow Lite, signal processing for appliance signatures), mobile development (React Native), product design, supply chain management, and potentially electrical certifications/safety compliance. The technical specificity in the idea (naming exact components and frameworks) could indicate familiarity, or could be surface-level research. Without knowing the creator's background, I cannot assess if they possess these skills or would need significant outside help. If the creator is a full-stack embedded engineer with ML experience, this is a 9. If they're a business person with no technical background, this is a 2-3. The skill requirements are high and cross-functional.

**Network Leverage:** 5/10

> Success in this space would benefit enormously from connections to: hardware manufacturers (for component sourcing and production), utility companies (for partnerships and rate data), smart home ecosystem players (Google, Amazon, Apple for integrations), retail channels (Home Depot, Best Buy), electrical contractors (for installation partnerships), and early adopter communities (smart home enthusiasts, sustainability advocates). Without a profile, I cannot assess whether the creator has any of these connections. A well-connected person in the IoT or energy space could dramatically accelerate this venture. Someone starting from scratch would face significant cold-start challenges in a market where distribution relationships matter greatly for hardware products.

**Life Stage Fit:** 5/10

> A hardware IoT startup is particularly demanding in terms of life stage requirements. It typically needs: (1) Significant capital runway or ability to raise funds for manufacturing inventory, (2) Time for long development cycles (hardware is slow - 12-24 months to market is optimistic), (3) Risk tolerance for inventory risk and high fixed costs, (4) Availability for intensive periods around manufacturing runs and launches, (5) Patience for slower iteration than software. This is generally better suited for someone with financial cushion, no immediate income pressure, and multi-year time horizons. It's typically harder for someone supporting dependents on their income, in career transition, or needing near-term returns. Without knowing employment status, financial runway, family obligations, or risk tolerance, this is impossible to assess accurately.

### Market

**Market Size:** 7/10

> The idea cites a $15B smart home energy market by 2027, which aligns with industry projections. The TAM is substantial - there are approximately 140 million households in the US alone, with average electricity spending of $1,500/year creating a $210B+ annual electricity market. The addressable portion for monitoring devices is smaller but still significant. At a $99 price point targeting 'environmentally conscious homeowners aged 30-55', the SAM is likely in the single-digit billions. The market is real and substantial, though not enormous compared to broader tech markets. The claim of 20-30% waste suggests real value capture opportunity.

**Market Growth:** 8/10

> Multiple macro trends support strong market growth: (1) Rising electricity costs driving consumer interest in efficiency, (2) Climate awareness and sustainability becoming mainstream concerns, (3) Smart home adoption accelerating with 60%+ of US homes having at least one smart device, (4) Time-of-use utility pricing expanding, making consumption timing optimization valuable, (5) Renewable energy adoption (solar, batteries) requiring monitoring solutions, (6) EV adoption creating new home energy management needs. The projected growth to $15B by 2027 implies healthy double-digit CAGR. Energy costs are unlikely to decrease, providing sustained demand drivers.

**Competition Intensity:** 4/10

> This is a moderately crowded market with established players. Named competitors Sense, Emporia, and Neurio have significant head starts with Sense raising $100M+ in funding. Additional competitors include: Aeotec, Efergy, Eyedro, and utility-provided solutions. Smart plug ecosystems (TP-Link Kasa, Amazon Smart Plugs) offer partial solutions. Major tech players (Google Nest, Amazon) could enter easily. The differentiation claim of 'AI-powered recommendations and lower price point' is not strongly defensible - AI is table stakes and price competition is a race to the bottom. Emporia already offers products under $100. The market is competitive but not yet saturated.

**Entry Barriers:** 6/10

> Entry barriers are moderate. Positive factors: (1) Hardware development has become more accessible with ESP32 and off-the-shelf sensors, (2) No regulatory moat or patents blocking entry, (3) Direct-to-consumer sales possible via Amazon/web, (4) Open-source ML models available. Challenges: (1) Hardware manufacturing requires capital and expertise, (2) Electrical safety certifications needed (UL listing), (3) Building accurate appliance-detection ML requires significant training data, (4) Customer acquisition costs in crowded market, (5) Building trust for a device connected to the electrical panel. The barriers aren't prohibitive but require meaningful investment in hardware development and safety compliance.

**Timing:** 7/10

> Market timing is favorable but not perfect. Positive signals: (1) Energy costs at multi-year highs creating consumer pain point, (2) Smart home adoption mainstream, reducing adoption friction, (3) Climate awareness driving eco-conscious purchases, (4) Time-of-use pricing expanding to more utilities, (5) EV adoption creating new energy management needs, (6) Component costs (ESP32, sensors) at accessible levels. Concerns: (1) Market isn't new - competitors have had years to build brand recognition and refine products, (2) Economic uncertainty may reduce discretionary spending on $99 devices, (3) Utility companies may increasingly provide free or subsidized monitoring. The window is open but not wide - this is a 'good time' rather than 'perfect time' entry.

### Risk

**Execution Risk:** 5/10

> The execution risk is moderate-to-high for this hardware+software+ML product. Building a device that clips onto an electrical panel requires: (1) Hardware engineering for PCB design and manufacturing, (2) Firmware development for ESP32, (3) Machine learning model development for appliance disaggregation (NILM - Non-Intrusive Load Monitoring), (4) Mobile app development in React Native, (5) Cloud infrastructure for data storage and processing, and (6) Supply chain management for hardware production. This is a full-stack hardware startup with 5+ distinct engineering disciplines required. The idea mentions specific technologies (ESP32, TensorFlow Lite, React Native) suggesting some technical familiarity, but executing across hardware, firmware, ML, mobile, and cloud simultaneously is extremely challenging. Existing competitors (Sense, Emporia, Neurio) have spent years and millions of dollars refining their NILM algorithms. The $99 price point vs competitors at $300+ adds additional execution pressure on BOM costs and manufacturing efficiency. Without a known team profile, confidence is reduced significantly.

**Market Risk:** 7/10

> Market risk is relatively low because this is a validated market with proven demand. The smart home energy monitoring category has multiple funded competitors actively selling products, which demonstrates real consumer willingness to pay. The problem statement cites specific data (20-30% waste, $1,500/year spend) that resonates with cost-conscious homeowners, especially given rising energy prices and climate awareness. The $15B market projection by 2027 indicates strong market research coverage. However, there are some market risks: (1) consumer smart home adoption has historically been slower than projected, (2) the target demographic (30-55, environmentally conscious) may be narrower than assumed, (3) utility companies offer free or subsidized monitoring through smart meters in many regions, and (4) the value proposition requires ongoing engagement to realize savings, which has historically been a challenge for energy apps. The existence of Sense, Emporia, and Neurio proves demand but also means the market isn't 'blue ocean' - it's already being served.

**Technical Risk:** 4/10

> Technical risk is HIGH. The core technical challenge - Non-Intrusive Load Monitoring (NILM) using machine learning to disaggregate appliance signatures from aggregate electrical data - is a notoriously difficult problem that has been researched for 30+ years. Key technical risks include: (1) Appliance disaggregation accuracy: Sense, after years of development and millions in funding, still struggles with accuracy for many appliances. Achieving reliable identification is extremely challenging. (2) Edge ML constraints: Running TensorFlow Lite on an ESP32 has significant memory and compute limitations. State-of-the-art NILM models are large and complex. (3) Electrical signature variability: Same appliance models have different signatures; signatures change with age and conditions; modern variable-speed motors and inverter appliances are especially hard to identify. (4) Installation complexity: Clipping onto main electrical panels requires working with high-voltage connections, which limits DIY installation and increases support burden. (5) Data requirements: ML models need extensive labeled training data across thousands of appliance types. Competitors have years of data advantage. The claimed $99 price point while delivering superior AI may be technically unrealistic given these constraints.

**Financial Risk:** 4/10

> Financial risk is HIGH due to the capital-intensive nature of hardware startups. Key financial concerns: (1) Hardware development costs: PCB design iterations, tooling, certifications (UL/CE), and small-batch manufacturing runs typically cost $200K-$500K before first customer ship. (2) BOM economics: At $99 retail, with typical 50% retail margin and 30% BOM target, the hardware cost must be ~$35. ESP32, current transformers, enclosure, and quality components make this extremely tight. (3) Inventory risk: Hardware requires upfront manufacturing investment with long lead times. (4) Long development cycle: 12-24 months typical for hardware product from concept to ship means extended runway requirement. (5) Customer acquisition: Consumer hardware marketing is expensive. (6) Support costs: Electrical panel installation will generate significant support tickets. Without information about the creator's funding, runway, or self-funding capability, this assessment carries low confidence. Hardware startups typically require $1M+ to reach market, making bootstrap extremely difficult.

**Regulatory Risk:** 6/10

> Regulatory risk is MODERATE. The product touches several regulatory domains but none appear to be showstoppers: (1) Electrical safety: Device connecting to electrical panels requires UL listing (US), CE marking (EU), and similar certifications. This is well-understood but adds ~$50K-$100K and 3-6 months to timeline. (2) FCC/radio compliance: ESP32 with WiFi/Bluetooth requires FCC Part 15 certification. This is standard for IoT devices. (3) Data privacy: Collecting detailed energy usage data raises privacy considerations under GDPR, CCPA. Energy usage patterns can reveal occupancy, daily routines, and behavior - sensitive data. However, competitors operate successfully in this space, proving regulatory compliance is achievable. (4) No medical or financial regulations apply. (5) Some regions require licensed electricians for panel installations, which could affect DIY positioning. (6) Utility regulations vary by state but don't prohibit monitoring own usage. The regulatory path is clear but requires investment and expertise in product safety certification.

## Debate Summary

- **Total Rounds:** 90
- **Initial Score:** 5.1/10
- **Final Score:** 1.9/10
- **Score Change:** -3.2

### Score Adjustments from Debate

- **Problem Clarity:** 7 → 2 (-5.0)
- **Target User Clarity:** 6 → 1 (-5.0)
- **Problem Uniqueness:** 3 → 8 (+5.0)
- **Solution Clarity:** 7 → 2 (-5.0)
- **Solution Feasibility:** 8 → 3 (-5.0)
- **Solution Scalability:** 6 → 1 (-5.0)
- **Market Size:** 7 → 2 (-5.0)
- **Market Growth:** 8 → 3 (-5.0)
- **Entry Barriers:** 6 → 1 (-5.0)
- **Timing:** 7 → 2 (-5.0)
- **Market Risk:** 7 → 2 (-5.0)
- **Regulatory Risk:** 6 → 1 (-5.0)
- **Problem Severity:** 5 → 1 (-4.0)
- **Personal Fit:** 5 → 1 (-4.0)
- **Passion Alignment:** 5 → 1 (-4.0)
- **Skill Match:** 5 → 1 (-4.0)
- **Network Leverage:** 5 → 1 (-4.0)
- **Life Stage Fit:** 5 → 1 (-4.0)
- **Execution Risk:** 5 → 1 (-4.0)
- **Solution Uniqueness:** 4 → 1 (-3.0)
- **Technical Complexity:** 4 → 1 (-3.0)
- **Skill Availability:** 5 → 8 (+3.0)
- **Dependency Risk:** 4 → 1 (-3.0)
- **Competition Intensity:** 4 → 1 (-3.0)
- **Technical Risk:** 4 → 1 (-3.0)
- **Solution Defensibility:** 3 → 1 (-2.0)
- **Resource Requirements:** 3 → 1 (-2.0)
- **Problem Validation:** 2 → 1 (-1.0)
- **Financial Risk:** 4 → 3 (-1.0)

### Key Insights from Debate

- Problem clarity requires validated causal mechanisms, not assumed ones. Stating 'X causes Y' without evidence is hypothesis, not clarity.
- The distinction between solving an information problem (visibility/awareness) versus an action problem (behavior change) is fundamental—it determines whether you're building a dashboard or an automation engine, with entirely different product roadmaps, team needs, and success metrics.
- Problem clarity must be judged by the logical coherence and empirical grounding of the problem definition itself, not by the quality of prose or presence of statistics. A problem that conflates issues and assumes causality is inherently unclear, regardless of how articulately it's stated.
- Problem clarity requires more than a well-articulated statement - it demands validated causal mechanisms when cause-effect relationships are central to the problem definition.
- Intentional breadth and confused scope can look identical on paper—the difference is whether the founder understands the distinct technical and business requirements of each capability
- Problem clarity (how well a problem is articulated) is distinct from problem validation (whether causal claims are proven) - a problem can be clearly stated yet unvalidated, and these should be evaluated separately.
- Problem clarity requires validated causal mechanisms, not just specific-sounding statistics. Surface-level specificity (percentages, dollar amounts) can mask fundamental uncertainties in the underlying hypothesis.
- A problem statement that conflates information delivery with action enablement indicates the founder hasn't yet decided which business they're building—a critical clarity gap that affects every downstream decision from feature scoping to success metrics.
- Problem clarity requires internal consistency between stated issues and proposed solutions; conflating multiple distinct problems (visibility vs. actionability, inefficient appliances vs. poor usage habits) is definitionally unclear regardless of how well each individual component is articulated.
- Unit economics (CAC vs. first-year value) is a critical lens for evaluating problem severity - a real pain point becomes unsolvable if acquisition costs exceed the value delivered.
