# VIBE-P16-006: User Satisfaction Metrics System

**Phase**: 16 - Analytics & Optimization
**Priority**: P1
**Estimated Effort**: High (8-10 hours)
**Dependencies**: PHASE6-TASK-01 (Task Dashboard), PHASE7-TASK-02 (Health Checks), WebSocket infrastructure
**Created**: February 9, 2026
**Status**: Specification Complete

---

## Overview

This specification defines a comprehensive user satisfaction measurement system for the Vibe platform, enabling continuous monitoring of user experience through NPS (Net Promoter Score), CSAT (Customer Satisfaction), and in-app feedback collection. The system tracks satisfaction trends, cohort analysis, automated alerts for satisfaction drops, and provides actionable insights for platform improvement through integration with the self-improvement feedback loop.

### Context

The Vibe platform is a complex multi-agent orchestration system where users:
1. **Submit tasks** to autonomous agents via dashboard, CLI, or Telegram
2. **Monitor progress** through real-time WebSocket updates and dashboard views
3. **Receive deliverables** from Spec, Build, QA, and other agents
4. **Intervene when needed** through the SIA (Self-Improvement Agent) system

Understanding user satisfaction at each interaction point is critical for:
- **Product Improvement**: Identifying pain points in agent execution, UI/UX, and task workflows
- **Retention**: Detecting at-risk users before churn
- **Agent Optimization**: Correlating satisfaction with agent performance metrics
- **Self-Improvement Loop**: Feeding satisfaction signals into Planning Agent task prioritization
- **Business Metrics**: Tracking product-market fit and feature adoption

### Current State

**Existing Infrastructure**:
- ✅ Task completion tracking (`task_state_history`, `task_test_results`)
- ✅ WebSocket event system for real-time notifications
- ✅ Dashboard UI with widget system (React 19 + Tailwind CSS 4)
- ✅ Telegram bot for notifications and commands
- ✅ User session tracking (`execution_sessions`, `task_executions`)
- ✅ Feedback loop integration tests (VIBE-P16-010)

**Missing Components** (this task):
- ❌ User satisfaction survey system (NPS, CSAT)
- ❌ In-app feedback collection widget
- ❌ Satisfaction trend analysis and visualization
- ❌ Cohort-based satisfaction segmentation
- ❌ Automated satisfaction drop alerts
- ❌ Satisfaction data integration with Planning Agent
- ❌ Survey trigger logic and timing optimization

---

## Requirements

### Functional Requirements

**FR-1: NPS Survey System**
- NPS survey component displays at configurable intervals (default: 30 days)
- Survey question: "On a scale of 0-10, how likely are you to recommend Vibe to a colleague?"
- Survey triggered based on:
  - Time since last survey (default: 30 days)
  - Task completion milestone (every 10th task)
  - Manual trigger via API
- Survey appears as modal overlay with dismissal option
- Survey includes optional comment field: "What's the primary reason for your score?"
- NPS score categorization:
  - **Promoters**: 9-10 (positive advocates)
  - **Passives**: 7-8 (satisfied but unenthusiastic)
  - **Detractors**: 0-6 (unhappy, risk of churn)
- NPS calculation: `(Promoters - Detractors) / Total Responses × 100`
- Survey responses stored with timestamp, score, comment, user context

**FR-2: CSAT Micro-Surveys**
- CSAT survey triggered after key interactions:
  - Task completion (Build Agent delivers code)
  - Support ticket resolution (SIA intervention completed)
  - Feature usage (first time using new agent type)
  - Agent failure recovery (orchestrator resolves blocked task)
- Survey question: "How satisfied are you with [interaction]?"
- 5-point scale: Very Dissatisfied, Dissatisfied, Neutral, Satisfied, Very Satisfied
- Survey appears as toast notification (dismissible)
- Survey includes context metadata (task_id, agent_type, interaction_type)
- CSAT score: `(Satisfied + Very Satisfied) / Total Responses × 100`
- Optional comment field for negative scores (<3)

**FR-3: In-App Feedback Button**
- Global feedback button accessible from all dashboard pages
- Fixed position (bottom-right corner)
- Feedback form includes:
  - **Type**: Bug Report, Feature Request, General Feedback, Usability Issue
  - **Priority**: Low, Medium, High, Critical
  - **Description**: Free-text (required, min 20 chars)
  - **Context**: Auto-captured (current page, active tasks, recent errors)
  - **Screenshot**: Optional file upload (PNG/JPG, max 5MB)
- Feedback submission creates record in `user_feedback` table
- Feedback integrated with intake agent for triage
- Email confirmation sent to user
- WebSocket event: `feedback:submitted`

**FR-4: Satisfaction Trend Analysis**
- Trend chart showing satisfaction over time (weekly/monthly granularity)
- Metrics visualized:
  - NPS score (line chart)
  - CSAT average score (line chart)
  - Response rate (bar chart overlay)
  - Feedback volume (bar chart)
- Configurable date range selector (7d, 30d, 90d, 1y, custom)
- Trend line with moving average (7-day, 30-day)
- Color-coded zones: green (>50 NPS), yellow (0-50), red (<0)
- Export to CSV/PNG for reporting

**FR-5: Cohort Analysis**
- Satisfaction segmented by:
  - **User tier**: Free, Pro, Enterprise
  - **Tenure**: <1 month, 1-3 months, 3-6 months, >6 months
  - **Feature usage**: High (>20 tasks/month), Medium (5-20), Low (<5)
  - **Agent preference**: Spec-heavy, Build-heavy, QA-heavy, mixed
  - **Geography**: Timezone-based clustering
- Cohort comparison table with:
  - Average NPS per cohort
  - Average CSAT per cohort
  - Response rate per cohort
  - Sample size (n= responses)
- Statistical significance indicators (p<0.05)
- Drill-down capability into cohort feedback comments
- Export cohort data for external analysis

**FR-6: Automated Satisfaction Alerts**
- Alert triggered when satisfaction drops >10% week-over-week
- Alert includes:
  - Metric affected (NPS or CSAT)
  - Previous value vs. current value
  - Percentage drop
  - Sample size (responses in each period)
  - Top 3 negative comments
  - Recommended actions (auto-generated)
- Alert channels:
  - Telegram notification to admin channel
  - Dashboard alert badge (red dot on feedback icon)
  - Email to stakeholders
  - WebSocket event: `satisfaction:alert`
- Alert acknowledgment system (mark as reviewed)
- Alert history log in database

**FR-7: Survey Response Linkage**
- Survey responses linked to user profile (anonymized for analytics)
- User profile enrichment:
  - Task history (completed, failed, blocked)
  - Agent usage patterns
  - Error frequency
  - Session duration metrics
  - Feature adoption timeline
- Anonymous mode: responses tracked without user_id for privacy
- GDPR compliance: user can request data deletion
- Aggregated analytics exclude personally identifiable information

**FR-8: Response Rate Tracking**
- Track survey presentation vs. completion rate
- Metrics:
  - Survey shown count
  - Survey dismissed count
  - Survey completed count
  - Response rate: `(Completed / Shown) × 100`
  - Time to completion (seconds)
- Segmented by survey type (NPS, CSAT)
- Segmented by trigger event (time-based, task-based, manual)
- A/B test capability for survey timing and copy
- Export response rate data for optimization

**FR-9: Feedback Integration with Planning Agent**
- Satisfaction data exported to Planning Agent feed
- Satisfaction signals:
  - Low NPS score (<6) creates `type: improvement` task
  - Negative comment themes aggregated weekly
  - CSAT drop for specific agent triggers agent review task
  - Feature request feedback creates `type: feature` task
- Planning Agent prioritizes satisfaction-driven tasks higher
- Feedback loop: satisfaction improvement tracked after task completion
- Dashboard shows "Driven by User Feedback" badge on related tasks

**FR-10: Export and Analytics API**
- API endpoint: `GET /api/satisfaction/export`
- Export formats: CSV, JSON, Excel
- Filterable by:
  - Date range
  - User tier
  - Satisfaction type (NPS, CSAT)
  - Score range
  - Cohort
- Supports pagination for large datasets
- Rate limited: 100 requests/hour
- Requires admin authentication

### Non-Functional Requirements

**NFR-1: Privacy and Security**
- Survey responses encrypted at rest
- PII (email, name) stored separately from satisfaction scores
- Anonymized data for aggregate analytics
- GDPR-compliant data retention (2 years default, configurable)
- User consent collected before first survey
- Opt-out mechanism in settings
- Data deletion API for user requests

**NFR-2: Performance**
- Survey modal loads in <500ms
- Satisfaction trend chart renders in <1 second
- Cohort analysis completes in <3 seconds for 10k responses
- Real-time alert triggers within 30 seconds of threshold breach
- Database queries use indexes for fast lookups
- No performance impact on core task execution

**NFR-3: Reliability**
- Survey system failure does not block task workflows
- Graceful degradation: surveys disabled if backend unavailable
- Survey responses queued locally if network fails
- Automatic retry with exponential backoff
- Survey state persisted across page refreshes
- No data loss during high-load periods

**NFR-4: Usability**
- Survey completion time <30 seconds average
- Clear, non-technical language in survey questions
- Mobile-responsive design (works on phone, tablet)
- Keyboard navigation support (accessibility)
- Color-blind friendly visualizations
- Multi-language support (future: i18n ready)

**NFR-5: Observability**
- All survey interactions logged (shown, dismissed, completed)
- Satisfaction metrics exported to Prometheus
- Dashboard health check includes survey system status
- WebSocket events for real-time monitoring
- Error tracking for survey submission failures
- Audit log for satisfaction data access

---

## Technical Design

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              User Satisfaction Metrics System                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              SatisfactionManager                          │  │
│  │                                                            │  │
│  │  + triggerNPS(userId, trigger)                           │  │
│  │  + triggerCSAT(userId, context)                          │  │
│  │  + submitResponse(surveyId, response)                    │  │
│  │  + calculateNPS(startDate, endDate)                      │  │
│  │  + getTrend(metric, granularity, range)                  │  │
│  │  + getCohortAnalysis(cohortType)                         │  │
│  │  + checkAlerts()                                          │  │
│  └───────────┬──────────────────────────┬────────────────────┘  │
│              │                          │                        │
│   ┌──────────▼────────┐      ┌─────────▼─────────┐             │
│   │   Survey Trigger   │      │  Response Storage │             │
│   │   Logic Engine     │      │                   │             │
│   │                    │      │  - Database       │             │
│   │  - Time-based      │      │  - Encryption     │             │
│   │  - Event-based     │      │  - Anonymization  │             │
│   │  - Manual          │      │  - GDPR tools     │             │
│   └──────────┬─────────┘      └─────────┬─────────┘             │
│              │                          │                        │
│   ┌──────────▼──────────────────────────▼─────────┐             │
│   │           Analytics Engine                     │             │
│   │                                                 │             │
│   │  - Trend calculation                           │             │
│   │  - Cohort segmentation                         │             │
│   │  - Alert detection                             │             │
│   │  - Statistical analysis                        │             │
│   └────────────────────────────────────────────────┘             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Frontend Components                          │  │
│  │                                                            │  │
│  │  - NPSSurveyModal (React component)                      │  │
│  │  - CSATToast (React component)                           │  │
│  │  - FeedbackButton (global widget)                        │  │
│  │  - SatisfactionDashboard (analytics view)                │  │
│  │  - TrendChart (D3.js visualization)                      │  │
│  │  - CohortTable (data grid)                               │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Integration Points                           │  │
│  │                                                            │  │
│  │  - Planning Agent (satisfaction → improvement tasks)     │  │
│  │  - WebSocket (real-time alerts)                          │  │
│  │  - Telegram Bot (admin notifications)                    │  │
│  │  - Intake Agent (feedback triage)                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Database Schema

**Table: `user_satisfaction_surveys`**

```sql
CREATE TABLE user_satisfaction_surveys (
  id TEXT PRIMARY KEY, -- UUID
  user_id TEXT NOT NULL,
  survey_type TEXT NOT NULL CHECK(survey_type IN ('nps', 'csat')),
  trigger_type TEXT NOT NULL CHECK(trigger_type IN ('time_based', 'task_based', 'manual')),
  trigger_context TEXT, -- JSON: {task_id, agent_type, event_type}
  shown_at TEXT NOT NULL,
  completed_at TEXT,
  dismissed_at TEXT,
  response_status TEXT NOT NULL CHECK(response_status IN ('shown', 'dismissed', 'completed')),
  score INTEGER, -- NPS: 0-10, CSAT: 1-5
  comment TEXT,
  time_to_complete_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX idx_surveys_user ON user_satisfaction_surveys(user_id);
CREATE INDEX idx_surveys_type ON user_satisfaction_surveys(survey_type);
CREATE INDEX idx_surveys_status ON user_satisfaction_surveys(response_status);
CREATE INDEX idx_surveys_shown_at ON user_satisfaction_surveys(shown_at);
CREATE INDEX idx_surveys_completed_at ON user_satisfaction_surveys(completed_at);
```

**Table: `user_feedback`**

```sql
CREATE TABLE user_feedback (
  id TEXT PRIMARY KEY, -- UUID
  user_id TEXT NOT NULL,
  feedback_type TEXT NOT NULL CHECK(feedback_type IN ('bug', 'feature', 'general', 'usability')),
  priority TEXT NOT NULL CHECK(priority IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  page_context TEXT, -- JSON: {page, url, active_tasks}
  screenshot_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'triaged', 'in_progress', 'resolved', 'wont_fix')),
  intake_task_id TEXT, -- Link to intake agent task
  resolution_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(intake_task_id) REFERENCES tasks(id)
);

CREATE INDEX idx_feedback_user ON user_feedback(user_id);
CREATE INDEX idx_feedback_type ON user_feedback(feedback_type);
CREATE INDEX idx_feedback_status ON user_feedback(status);
CREATE INDEX idx_feedback_priority ON user_feedback(priority);
CREATE INDEX idx_feedback_created ON user_feedback(created_at);
```

**Table: `satisfaction_alerts`**

```sql
CREATE TABLE satisfaction_alerts (
  id TEXT PRIMARY KEY, -- UUID
  metric TEXT NOT NULL CHECK(metric IN ('nps', 'csat')),
  alert_type TEXT NOT NULL CHECK(alert_type IN ('drop', 'threshold', 'anomaly')),
  previous_value REAL NOT NULL,
  current_value REAL NOT NULL,
  change_percent REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  top_comments TEXT, -- JSON array of top 3 negative comments
  recommended_actions TEXT, -- JSON array
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'acknowledged', 'resolved')),
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  resolution_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(acknowledged_by) REFERENCES users(id)
);

CREATE INDEX idx_alerts_metric ON satisfaction_alerts(metric);
CREATE INDEX idx_alerts_status ON satisfaction_alerts(status);
CREATE INDEX idx_alerts_created ON satisfaction_alerts(created_at);
```

**Table: `satisfaction_metrics_cache`**

```sql
CREATE TABLE satisfaction_metrics_cache (
  id TEXT PRIMARY KEY,
  metric_type TEXT NOT NULL CHECK(metric_type IN ('nps', 'csat', 'response_rate')),
  cohort_filter TEXT, -- JSON: {tier, tenure, usage_level}
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  value REAL NOT NULL,
  sample_size INTEGER NOT NULL,
  calculated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_metrics_cache_type ON satisfaction_metrics_cache(metric_type);
CREATE INDEX idx_metrics_cache_period ON satisfaction_metrics_cache(period_start, period_end);
CREATE INDEX idx_metrics_cache_expires ON satisfaction_metrics_cache(expires_at);
```

### Component Details

#### 1. SatisfactionManager Class

**File**: `parent-harness/orchestrator/src/satisfaction/manager.ts`

```typescript
import { db } from '../db/index.js';
import { events } from '../db/events.js';
import * as telegram from '../telegram/index.js';

export interface SurveyTrigger {
  type: 'time_based' | 'task_based' | 'manual';
  context?: {
    taskId?: string;
    agentType?: string;
    eventType?: string;
  };
}

export interface SurveyResponse {
  surveyId: string;
  score: number;
  comment?: string;
  timeToCompleteMs: number;
}

export interface NPSResult {
  score: number; // -100 to 100
  promoters: number;
  passives: number;
  detractors: number;
  totalResponses: number;
  responseRate: number;
}

export interface CSATResult {
  score: number; // 0 to 100
  satisfied: number; // 4-5 stars
  neutral: number; // 3 stars
  dissatisfied: number; // 1-2 stars
  totalResponses: number;
  responseRate: number;
}

export interface TrendPoint {
  date: string;
  value: number;
  sampleSize: number;
}

export interface CohortMetrics {
  cohortName: string;
  npsScore: number;
  csatScore: number;
  responseRate: number;
  sampleSize: number;
  isSignificant: boolean; // p < 0.05
}

export class SatisfactionManager {
  /**
   * Trigger NPS survey for user
   */
  async triggerNPS(userId: string, trigger: SurveyTrigger): Promise<string> {
    // 1. Check if user is eligible (last survey >30 days ago)
    const lastSurvey = await this.getLastSurvey(userId, 'nps');
    if (lastSurvey && this.daysSince(lastSurvey.shown_at) < 30) {
      return null; // Skip if too soon
    }

    // 2. Create survey record
    const surveyId = this.generateId();
    await db.run(`
      INSERT INTO user_satisfaction_surveys (
        id, user_id, survey_type, trigger_type, trigger_context,
        shown_at, response_status
      ) VALUES (?, ?, 'nps', ?, ?, datetime('now'), 'shown')
    `, [surveyId, userId, trigger.type, JSON.stringify(trigger.context)]);

    // 3. Emit WebSocket event to show survey
    events.surveyTriggered?.(surveyId, userId, 'nps');

    return surveyId;
  }

  /**
   * Trigger CSAT micro-survey after interaction
   */
  async triggerCSAT(userId: string, context: {
    taskId?: string;
    agentType?: string;
    interactionType: string;
  }): Promise<string> {
    // CSAT can be shown more frequently (no cooldown)
    const surveyId = this.generateId();

    await db.run(`
      INSERT INTO user_satisfaction_surveys (
        id, user_id, survey_type, trigger_type, trigger_context,
        shown_at, response_status
      ) VALUES (?, ?, 'csat', 'task_based', ?, datetime('now'), 'shown')
    `, [surveyId, userId, JSON.stringify(context)]);

    events.surveyTriggered?.(surveyId, userId, 'csat');

    return surveyId;
  }

  /**
   * Submit survey response
   */
  async submitResponse(response: SurveyResponse): Promise<void> {
    await db.run(`
      UPDATE user_satisfaction_surveys
      SET response_status = 'completed',
          score = ?,
          comment = ?,
          time_to_complete_ms = ?,
          completed_at = datetime('now')
      WHERE id = ?
    `, [response.score, response.comment, response.timeToCompleteMs, response.surveyId]);

    // Check if response is negative (detractor or dissatisfied)
    const survey = await this.getSurvey(response.surveyId);
    const isNegative = survey.survey_type === 'nps'
      ? response.score <= 6
      : response.score <= 2;

    if (isNegative) {
      // Create improvement task for Planning Agent
      await this.createImprovementTask(survey, response);
    }

    events.surveyCompleted?.(response.surveyId, response.score);
  }

  /**
   * Calculate NPS score for date range
   */
  async calculateNPS(startDate: string, endDate: string): Promise<NPSResult> {
    // Check cache first
    const cached = await this.getCachedMetric('nps', null, startDate, endDate);
    if (cached && !this.isCacheExpired(cached.expires_at)) {
      return JSON.parse(cached.value);
    }

    // Calculate from raw data
    const responses = await db.all(`
      SELECT score, response_status
      FROM user_satisfaction_surveys
      WHERE survey_type = 'nps'
        AND shown_at >= ?
        AND shown_at <= ?
    `, [startDate, endDate]);

    const completed = responses.filter(r => r.response_status === 'completed');
    const promoters = completed.filter(r => r.score >= 9).length;
    const passives = completed.filter(r => r.score >= 7 && r.score <= 8).length;
    const detractors = completed.filter(r => r.score <= 6).length;
    const total = completed.length;

    const npsScore = total > 0
      ? Math.round(((promoters - detractors) / total) * 100)
      : 0;

    const result: NPSResult = {
      score: npsScore,
      promoters,
      passives,
      detractors,
      totalResponses: total,
      responseRate: responses.length > 0
        ? Math.round((total / responses.length) * 100)
        : 0,
    };

    // Cache result
    await this.cacheMetric('nps', null, startDate, endDate, result, 3600); // 1 hour TTL

    return result;
  }

  /**
   * Get satisfaction trend over time
   */
  async getTrend(
    metric: 'nps' | 'csat',
    granularity: 'daily' | 'weekly' | 'monthly',
    range: number // days
  ): Promise<TrendPoint[]> {
    const points: TrendPoint[] = [];
    const now = new Date();

    // Generate date buckets based on granularity
    const buckets = this.generateDateBuckets(now, range, granularity);

    for (const bucket of buckets) {
      const result = metric === 'nps'
        ? await this.calculateNPS(bucket.start, bucket.end)
        : await this.calculateCSAT(bucket.start, bucket.end);

      points.push({
        date: bucket.start,
        value: result.score,
        sampleSize: result.totalResponses,
      });
    }

    return points;
  }

  /**
   * Get cohort-based satisfaction analysis
   */
  async getCohortAnalysis(cohortType: 'tier' | 'tenure' | 'usage'): Promise<CohortMetrics[]> {
    const cohorts = await this.getCohorts(cohortType);
    const results: CohortMetrics[] = [];

    for (const cohort of cohorts) {
      const nps = await this.calculateNPSForCohort(cohort);
      const csat = await this.calculateCSATForCohort(cohort);

      results.push({
        cohortName: cohort.name,
        npsScore: nps.score,
        csatScore: csat.score,
        responseRate: nps.responseRate,
        sampleSize: nps.totalResponses,
        isSignificant: nps.totalResponses >= 30, // Minimum sample size for significance
      });
    }

    return results;
  }

  /**
   * Check for satisfaction drop alerts
   */
  async checkAlerts(): Promise<void> {
    // Get current week NPS
    const currentWeekStart = this.getWeekStart(new Date());
    const currentWeekEnd = this.getWeekEnd(new Date());
    const currentNPS = await this.calculateNPS(currentWeekStart, currentWeekEnd);

    // Get previous week NPS
    const prevWeekStart = this.getWeekStart(this.addDays(new Date(), -7));
    const prevWeekEnd = this.getWeekEnd(this.addDays(new Date(), -7));
    const prevNPS = await this.calculateNPS(prevWeekStart, prevWeekEnd);

    // Check for >10% drop
    if (prevNPS.score > 0 && currentNPS.score > 0) {
      const changePercent = ((currentNPS.score - prevNPS.score) / Math.abs(prevNPS.score)) * 100;

      if (changePercent <= -10) {
        await this.createAlert({
          metric: 'nps',
          alertType: 'drop',
          previousValue: prevNPS.score,
          currentValue: currentNPS.score,
          changePercent,
          sampleSize: currentNPS.totalResponses,
          periodStart: currentWeekStart,
          periodEnd: currentWeekEnd,
        });
      }
    }

    // Repeat for CSAT
    const currentCSAT = await this.calculateCSAT(currentWeekStart, currentWeekEnd);
    const prevCSAT = await this.calculateCSAT(prevWeekStart, prevWeekEnd);

    if (prevCSAT.score > 0 && currentCSAT.score > 0) {
      const changePercent = ((currentCSAT.score - prevCSAT.score) / prevCSAT.score) * 100;

      if (changePercent <= -10) {
        await this.createAlert({
          metric: 'csat',
          alertType: 'drop',
          previousValue: prevCSAT.score,
          currentValue: currentCSAT.score,
          changePercent,
          sampleSize: currentCSAT.totalResponses,
          periodStart: currentWeekStart,
          periodEnd: currentWeekEnd,
        });
      }
    }
  }

  private async createAlert(alert: any): Promise<void> {
    // Get top negative comments
    const topComments = await this.getTopNegativeComments(
      alert.metric,
      alert.periodStart,
      alert.periodEnd,
      3
    );

    const alertId = this.generateId();

    await db.run(`
      INSERT INTO satisfaction_alerts (
        id, metric, alert_type, previous_value, current_value,
        change_percent, sample_size, period_start, period_end,
        top_comments, recommended_actions, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `, [
      alertId,
      alert.metric,
      alert.alertType,
      alert.previousValue,
      alert.currentValue,
      alert.changePercent,
      alert.sampleSize,
      alert.periodStart,
      alert.periodEnd,
      JSON.stringify(topComments),
      JSON.stringify(this.generateRecommendedActions(alert, topComments)),
    ]);

    // Send Telegram notification
    telegram.send(
      `⚠️ Satisfaction Alert\n\n` +
      `Metric: ${alert.metric.toUpperCase()}\n` +
      `Change: ${alert.previousValue} → ${alert.currentValue} (${alert.changePercent.toFixed(1)}%)\n` +
      `Sample: n=${alert.sampleSize}\n\n` +
      `Top issues:\n${topComments.map((c, i) => `${i + 1}. ${c.slice(0, 100)}`).join('\n')}`
    );

    // Emit WebSocket event
    events.satisfactionAlert?.(alertId, alert.metric, alert.changePercent);
  }

  private async createImprovementTask(survey: any, response: SurveyResponse): Promise<void> {
    // Create task for Planning Agent to address low satisfaction
    const context = JSON.parse(survey.trigger_context || '{}');

    await db.run(`
      INSERT INTO tasks (
        id, type, title, description, priority, status,
        agent_type, created_by
      ) VALUES (?, 'improvement', ?, ?, 'high', 'pending', 'planning', 'satisfaction_system')
    `, [
      this.generateId(),
      `Low satisfaction score: ${response.score}`,
      `User gave ${survey.survey_type.toUpperCase()} score of ${response.score}.\n` +
      `Context: ${JSON.stringify(context)}\n` +
      `Comment: ${response.comment || 'No comment provided'}\n\n` +
      `Investigate root cause and propose improvements.`,
    ]);
  }

  // Helper methods
  private generateId(): string {
    return `sat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private daysSince(dateStr: string): number {
    const date = new Date(dateStr);
    const now = new Date();
    return Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  }

  private async getLastSurvey(userId: string, type: string): Promise<any> {
    return await db.get(`
      SELECT * FROM user_satisfaction_surveys
      WHERE user_id = ? AND survey_type = ?
      ORDER BY shown_at DESC
      LIMIT 1
    `, [userId, type]);
  }

  private async getSurvey(surveyId: string): Promise<any> {
    return await db.get(`
      SELECT * FROM user_satisfaction_surveys WHERE id = ?
    `, [surveyId]);
  }

  private generateDateBuckets(end: Date, range: number, granularity: string): any[] {
    // Implementation for date bucketing
    return [];
  }

  private getWeekStart(date: Date): string {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    return d.toISOString().split('T')[0];
  }

  private getWeekEnd(date: Date): string {
    const d = new Date(date);
    d.setDate(d.getDate() + (6 - d.getDay()));
    return d.toISOString().split('T')[0];
  }

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  private async getCachedMetric(type: string, cohort: any, start: string, end: string): Promise<any> {
    return await db.get(`
      SELECT * FROM satisfaction_metrics_cache
      WHERE metric_type = ? AND period_start = ? AND period_end = ?
    `, [type, start, end]);
  }

  private isCacheExpired(expiresAt: string): boolean {
    return new Date(expiresAt) < new Date();
  }

  private async cacheMetric(type: string, cohort: any, start: string, end: string, value: any, ttlSeconds: number): Promise<void> {
    const expires = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await db.run(`
      INSERT INTO satisfaction_metrics_cache (
        id, metric_type, period_start, period_end, value,
        sample_size, calculated_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'), ?)
    `, [this.generateId(), type, start, end, JSON.stringify(value), value.totalResponses, expires]);
  }

  private async calculateCSAT(startDate: string, endDate: string): Promise<CSATResult> {
    const responses = await db.all(`
      SELECT score, response_status
      FROM user_satisfaction_surveys
      WHERE survey_type = 'csat'
        AND shown_at >= ?
        AND shown_at <= ?
    `, [startDate, endDate]);

    const completed = responses.filter(r => r.response_status === 'completed');
    const satisfied = completed.filter(r => r.score >= 4).length;
    const neutral = completed.filter(r => r.score === 3).length;
    const dissatisfied = completed.filter(r => r.score <= 2).length;
    const total = completed.length;

    return {
      score: total > 0 ? Math.round((satisfied / total) * 100) : 0,
      satisfied,
      neutral,
      dissatisfied,
      totalResponses: total,
      responseRate: responses.length > 0 ? Math.round((total / responses.length) * 100) : 0,
    };
  }

  private async getCohorts(type: string): Promise<any[]> {
    // Implementation for cohort fetching
    return [];
  }

  private async calculateNPSForCohort(cohort: any): Promise<NPSResult> {
    // Implementation for cohort NPS calculation
    return null;
  }

  private async calculateCSATForCohort(cohort: any): Promise<CSATResult> {
    // Implementation for cohort CSAT calculation
    return null;
  }

  private async getTopNegativeComments(metric: string, start: string, end: string, limit: number): Promise<string[]> {
    const rows = await db.all(`
      SELECT comment
      FROM user_satisfaction_surveys
      WHERE survey_type = ?
        AND shown_at >= ?
        AND shown_at <= ?
        AND response_status = 'completed'
        AND score <= ?
        AND comment IS NOT NULL
        AND comment != ''
      ORDER BY shown_at DESC
      LIMIT ?
    `, [metric, start, end, metric === 'nps' ? 6 : 2, limit]);

    return rows.map(r => r.comment);
  }

  private generateRecommendedActions(alert: any, comments: string[]): string[] {
    const actions = [];

    // Analyze comments for common themes
    const themes = this.extractThemes(comments);

    if (themes.includes('slow')) {
      actions.push('Investigate performance bottlenecks in task execution');
    }
    if (themes.includes('confusing')) {
      actions.push('Review UI/UX with Human Sim Agent personas');
    }
    if (themes.includes('error') || themes.includes('bug')) {
      actions.push('Audit recent error logs and create bug fix tasks');
    }
    if (themes.includes('missing')) {
      actions.push('Review feature requests for commonly requested features');
    }

    if (actions.length === 0) {
      actions.push('Review individual comments and create targeted improvement tasks');
    }

    return actions;
  }

  private extractThemes(comments: string[]): string[] {
    const themes = [];
    const text = comments.join(' ').toLowerCase();

    if (text.includes('slow') || text.includes('performance')) themes.push('slow');
    if (text.includes('confus') || text.includes('unclear')) themes.push('confusing');
    if (text.includes('error') || text.includes('bug') || text.includes('fail')) themes.push('error');
    if (text.includes('missing') || text.includes('need')) themes.push('missing');

    return themes;
  }
}
```

#### 2. Frontend Components

**File**: `parent-harness/dashboard/src/components/satisfaction/NPSSurveyModal.tsx`

```typescript
import React, { useState } from 'react';
import { X } from 'lucide-react';

interface NPSSurveyModalProps {
  surveyId: string;
  onSubmit: (score: number, comment: string) => void;
  onDismiss: () => void;
}

export function NPSSurveyModal({ surveyId, onSubmit, onDismiss }: NPSSurveyModalProps) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [showComment, setShowComment] = useState(false);

  const handleScoreClick = (value: number) => {
    setScore(value);
    setShowComment(true);
  };

  const handleSubmit = () => {
    if (score !== null) {
      onSubmit(score, comment);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-xl font-semibold">We'd love your feedback!</h2>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-gray-600 dark:text-gray-300 mb-6">
          On a scale of 0-10, how likely are you to recommend Vibe to a colleague?
        </p>

        <div className="flex gap-2 justify-center mb-6">
          {Array.from({ length: 11 }, (_, i) => (
            <button
              key={i}
              onClick={() => handleScoreClick(i)}
              className={`
                w-12 h-12 rounded-lg border-2 font-semibold transition-all
                ${score === i
                  ? 'bg-blue-500 text-white border-blue-500'
                  : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-blue-400'
                }
              `}
            >
              {i}
            </button>
          ))}
        </div>

        <div className="flex justify-between text-sm text-gray-500 mb-6">
          <span>Not likely</span>
          <span>Very likely</span>
        </div>

        {showComment && (
          <div className="mb-6">
            <label className="block text-sm font-medium mb-2">
              What's the primary reason for your score? (optional)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700"
              rows={3}
              placeholder="Tell us more..."
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleSubmit}
            disabled={score === null}
            className={`
              flex-1 py-2 px-4 rounded-lg font-medium transition-colors
              ${score !== null
                ? 'bg-blue-500 hover:bg-blue-600 text-white'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }
            `}
          >
            Submit Feedback
          </button>
          <button
            onClick={onDismiss}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
```

**File**: `parent-harness/dashboard/src/components/satisfaction/FeedbackButton.tsx`

```typescript
import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import { FeedbackForm } from './FeedbackForm';

export function FeedbackButton() {
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowForm(true)}
        className="fixed bottom-6 right-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full p-4 shadow-lg transition-transform hover:scale-110 z-40"
        title="Send feedback"
      >
        <MessageSquare size={24} />
      </button>

      {showForm && (
        <FeedbackForm onClose={() => setShowForm(false)} />
      )}
    </>
  );
}
```

#### 3. API Endpoints

**File**: `parent-harness/orchestrator/src/api/satisfaction.ts`

```typescript
import { Router } from 'express';
import { SatisfactionManager } from '../satisfaction/manager.js';

export const satisfactionRouter = Router();
const manager = new SatisfactionManager();

/**
 * POST /api/satisfaction/surveys/nps
 * Trigger NPS survey for user
 */
satisfactionRouter.post('/surveys/nps', async (req, res) => {
  const { userId, trigger } = req.body;

  try {
    const surveyId = await manager.triggerNPS(userId, trigger);

    if (!surveyId) {
      return res.status(429).json({
        success: false,
        message: 'User surveyed too recently',
      });
    }

    res.json({
      success: true,
      surveyId,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/satisfaction/surveys/:surveyId/response
 * Submit survey response
 */
satisfactionRouter.post('/surveys/:surveyId/response', async (req, res) => {
  const { surveyId } = req.params;
  const { score, comment, timeToCompleteMs } = req.body;

  try {
    await manager.submitResponse({
      surveyId,
      score,
      comment,
      timeToCompleteMs,
    });

    res.json({
      success: true,
      message: 'Response recorded',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/satisfaction/surveys/:surveyId/dismiss
 * Mark survey as dismissed
 */
satisfactionRouter.post('/surveys/:surveyId/dismiss', async (req, res) => {
  const { surveyId } = req.params;

  try {
    await manager.dismissSurvey(surveyId);

    res.json({
      success: true,
      message: 'Survey dismissed',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/satisfaction/metrics/nps
 * Get NPS metrics for date range
 */
satisfactionRouter.get('/metrics/nps', async (req, res) => {
  const { startDate, endDate } = req.query;

  try {
    const result = await manager.calculateNPS(
      startDate as string,
      endDate as string
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/satisfaction/trends
 * Get satisfaction trend data
 */
satisfactionRouter.get('/trends', async (req, res) => {
  const { metric, granularity, range } = req.query;

  try {
    const trend = await manager.getTrend(
      metric as 'nps' | 'csat',
      granularity as 'daily' | 'weekly' | 'monthly',
      parseInt(range as string)
    );

    res.json({ trend });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/satisfaction/cohorts
 * Get cohort analysis
 */
satisfactionRouter.get('/cohorts', async (req, res) => {
  const { cohortType } = req.query;

  try {
    const cohorts = await manager.getCohortAnalysis(
      cohortType as 'tier' | 'tenure' | 'usage'
    );

    res.json({ cohorts });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/satisfaction/feedback
 * Submit general feedback
 */
satisfactionRouter.post('/feedback', async (req, res) => {
  const { userId, feedbackType, priority, description, pageContext, screenshotUrl } = req.body;

  try {
    const feedbackId = await manager.submitFeedback({
      userId,
      feedbackType,
      priority,
      description,
      pageContext,
      screenshotUrl,
    });

    res.json({
      success: true,
      feedbackId,
      message: 'Feedback submitted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/satisfaction/alerts
 * Get active satisfaction alerts
 */
satisfactionRouter.get('/alerts', async (req, res) => {
  const { status } = req.query;

  try {
    const alerts = await manager.getAlerts(status as string);

    res.json({ alerts });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/satisfaction/export
 * Export satisfaction data
 */
satisfactionRouter.get('/export', async (req, res) => {
  const { format, startDate, endDate, cohort } = req.query;

  try {
    // Requires admin authentication (implement in middleware)
    const data = await manager.exportData({
      format: format as 'csv' | 'json' | 'excel',
      startDate: startDate as string,
      endDate: endDate as string,
      cohort: cohort as string,
    });

    res.setHeader('Content-Type', format === 'json' ? 'application/json' : 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="satisfaction-${Date.now()}.${format}"`);
    res.send(data);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
```

#### 4. Cron Scheduler for Alert Checking

**File**: `parent-harness/orchestrator/src/satisfaction/scheduler.ts`

```typescript
import { CronJob } from 'cron';
import { SatisfactionManager } from './manager.js';

export class SatisfactionScheduler {
  private manager: SatisfactionManager;
  private job: CronJob;

  constructor() {
    this.manager = new SatisfactionManager();
  }

  start(): void {
    // Run daily at 9 AM to check for satisfaction drops
    this.job = new CronJob('0 9 * * *', async () => {
      await this.manager.checkAlerts();
    });
    this.job.start();
    console.log('📊 Satisfaction alert scheduler started (daily at 9 AM)');
  }

  stop(): void {
    this.job?.stop();
  }
}
```

#### 5. WebSocket Events

**File**: `parent-harness/orchestrator/src/db/events.ts` (additions)

```typescript
export const events = {
  // ... existing events ...

  surveyTriggered: (surveyId: string, userId: string, type: string) => {
    broadcast({
      type: 'satisfaction:survey_triggered',
      data: { surveyId, userId, surveyType: type },
    });
  },

  surveyCompleted: (surveyId: string, score: number) => {
    broadcast({
      type: 'satisfaction:survey_completed',
      data: { surveyId, score },
    });
  },

  satisfactionAlert: (alertId: string, metric: string, changePercent: number) => {
    broadcast({
      type: 'satisfaction:alert',
      data: { alertId, metric, changePercent },
    });
  },

  feedbackSubmitted: (feedbackId: string, type: string, priority: string) => {
    broadcast({
      type: 'satisfaction:feedback_submitted',
      data: { feedbackId, type, priority },
    });
  },
};
```

---

## Pass Criteria

| # | Criterion | Validation Method | Target |
|---|-----------|-------------------|--------|
| 1 | NPS survey modal appears at 30-day intervals | Trigger survey via API, verify modal shows | Modal visible in UI |
| 2 | NPS score calculated correctly | Submit test responses (promoters, passives, detractors), verify calculation | Correct NPS formula |
| 3 | CSAT micro-survey after task completion | Complete task, verify CSAT toast appears | Toast visible within 5s |
| 4 | In-app feedback button accessible | Navigate to all pages, verify button present | Button on all pages |
| 5 | Satisfaction trend chart renders | Load trends page, verify chart displays data | Chart shows 30-day trend |
| 6 | Cohort analysis shows tier segmentation | Request cohort data, verify segmentation logic | Cohorts by tier exist |
| 7 | Automated alert on >10% drop | Simulate satisfaction drop, verify alert triggers | Alert sent to Telegram |
| 8 | Survey responses linked to user profile | Submit survey, verify user_id stored | Database record linked |
| 9 | Response rate tracking works | Show/complete surveys, calculate rate | Accurate rate calculation |
| 10 | Export satisfaction data to CSV | Request export, verify CSV format | Valid CSV file |

### Validation Commands

```bash
# Test NPS survey trigger
curl -X POST http://localhost:3333/api/satisfaction/surveys/nps \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "trigger": {"type": "time_based"}}'

# Test survey response submission
curl -X POST http://localhost:3333/api/satisfaction/surveys/{surveyId}/response \
  -H "Content-Type: application/json" \
  -d '{"score": 9, "comment": "Great platform!", "timeToCompleteMs": 15000}'

# Get NPS metrics
curl "http://localhost:3333/api/satisfaction/metrics/nps?startDate=2026-01-01&endDate=2026-02-09"

# Get satisfaction trends
curl "http://localhost:3333/api/satisfaction/trends?metric=nps&granularity=weekly&range=90"

# Get cohort analysis
curl "http://localhost:3333/api/satisfaction/cohorts?cohortType=tier"

# Submit feedback
curl -X POST http://localhost:3333/api/satisfaction/feedback \
  -H "Content-Type: application/json" \
  -d '{"userId": "test-user", "feedbackType": "bug", "priority": "high", "description": "Dashboard freezes on large datasets"}'

# Check database records
sqlite3 parent-harness/data/harness.db "SELECT * FROM user_satisfaction_surveys WHERE response_status = 'completed';"

# Export data
curl "http://localhost:3333/api/satisfaction/export?format=csv&startDate=2026-01-01&endDate=2026-02-09" > satisfaction.csv
```

---

## Dependencies

### External Dependencies

| Dependency | Version | Purpose | Installation |
|------------|---------|---------|--------------|
| `cron` | ^3.0.0 | Alert scheduler | Already installed |
| `recharts` | ^2.10.0 | Trend visualization (React) | `npm install recharts` |
| `@tanstack/react-table` | ^8.11.0 | Cohort data grid | `npm install @tanstack/react-table` |
| `csv-stringify` | ^6.4.0 | CSV export | `npm install csv-stringify` |

### Internal Dependencies

| Module | Purpose |
|--------|---------|
| `src/db/events.ts` | WebSocket event broadcasting |
| `src/telegram/index.ts` | Alert notifications |
| `parent-harness/dashboard/src/hooks/useWebSocket.tsx` | Frontend WebSocket integration |
| `parent-harness/orchestrator/src/db/index.ts` | Database operations |

### Upstream Dependencies

| Component | Description | Status |
|-----------|-------------|--------|
| User authentication | User ID for survey linking | ✅ Exists |
| Task completion tracking | Trigger CSAT after tasks | ✅ Exists (`task_state_history`) |
| WebSocket infrastructure | Real-time survey triggers | ✅ Exists |
| Dashboard widget system | Survey modal integration | ✅ Exists |
| Telegram bot | Alert notifications | ✅ Exists |

### Downstream Dependencies

| Component | How It Benefits |
|-----------|----------------|
| Planning Agent | Receives satisfaction-driven improvement tasks |
| Intake Agent | Processes feedback for triage |
| Dashboard Analytics | Shows satisfaction metrics |
| Admin Reports | Exports satisfaction data |

---

## Implementation Plan

### Phase 1: Core Infrastructure (2 hours)

1. **Database Schema** (30 min)
   - Create migrations for `user_satisfaction_surveys`, `user_feedback`, `satisfaction_alerts`, `satisfaction_metrics_cache`
   - Add indexes for performance
   - Test CRUD operations

2. **SatisfactionManager Class** (1 hour)
   - Implement basic structure
   - Database integration
   - Implement `triggerNPS()`, `triggerCSAT()`, `submitResponse()`

3. **API Endpoints** (30 min)
   - Implement REST routes
   - Request validation
   - Error handling

### Phase 2: Survey System (2 hours)

4. **NPS Survey Modal** (1 hour)
   - React component with 0-10 scale
   - Comment field
   - Dismissal logic
   - WebSocket integration

5. **CSAT Toast Notification** (30 min)
   - React toast component
   - 5-star rating
   - Auto-dismiss after 30 seconds

6. **Feedback Button & Form** (30 min)
   - Fixed position button
   - Feedback form modal
   - Screenshot upload
   - Context capture

### Phase 3: Analytics & Visualization (2 hours)

7. **Trend Calculation** (1 hour)
   - Implement `getTrend()` method
   - Date bucketing logic
   - Moving average calculation
   - Cache system

8. **Cohort Analysis** (1 hour)
   - Implement `getCohortAnalysis()` method
   - User segmentation logic
   - Statistical significance testing

### Phase 4: Alerting & Integration (2 hours)

9. **Alert Detection** (1 hour)
   - Implement `checkAlerts()` method
   - Week-over-week comparison
   - Threshold checking
   - Telegram notification

10. **Planning Agent Integration** (1 hour)
    - Negative score → improvement task
    - Theme extraction from comments
    - Task priority assignment

### Phase 5: Frontend Dashboard (1 hour)

11. **Satisfaction Dashboard Page** (1 hour)
    - Trend chart component (Recharts)
    - Cohort table component
    - Alert list component
    - Export button

### Phase 6: Testing & Documentation (1 hour)

12. **Integration Testing**
    - Test full survey workflow
    - Test alert triggering
    - Test cohort analysis

13. **Documentation**
    - Update README with satisfaction system
    - API documentation
    - Admin runbook

**Total Estimated Effort:** 10 hours (~1.5 days)

---

## Security Considerations

1. **Privacy Protection**
   - PII stored separately from satisfaction scores
   - Anonymized data for aggregate analytics
   - User consent before first survey
   - GDPR-compliant data deletion

2. **Data Access Control**
   - Export API requires admin authentication
   - Individual responses not exposed via public API
   - Dashboard views show only aggregate data
   - Audit log for data access

3. **Rate Limiting**
   - Export API: 100 requests/hour
   - Survey trigger API: 10 requests/minute per user
   - Feedback submission: 5 per hour per user

4. **Input Validation**
   - Survey scores validated (0-10 for NPS, 1-5 for CSAT)
   - Comment length limited (max 1000 chars)
   - Feedback description minimum 20 chars
   - Screenshot file type and size validation

---

## Monitoring and Metrics

### Prometheus Metrics

```typescript
satisfaction_nps_score{period="7d"} 45
satisfaction_csat_score{period="7d"} 78
satisfaction_response_rate{type="nps"} 42
satisfaction_surveys_shown_total{type="nps"} 1234
satisfaction_surveys_completed_total{type="nps"} 518
satisfaction_feedback_submitted_total{type="bug"} 87
satisfaction_alerts_triggered_total{metric="nps"} 3
```

### Dashboard Widgets

1. **NPS Score Card** - Current NPS with 7d/30d comparison
2. **CSAT Score Card** - Current CSAT with trend indicator
3. **Response Rate Card** - Completion rate with goal (>40%)
4. **Active Alerts Badge** - Red dot if pending alerts exist

---

## Future Enhancements (Out of Scope)

1. **Sentiment Analysis** - NLP analysis of free-text comments
2. **Predictive Churn Model** - ML model predicting churn from satisfaction
3. **In-Product Walkthrough** - Contextual help based on negative feedback
4. **Video Feedback** - Screen recording for usability issues
5. **Multi-Language Surveys** - i18n support for global users
6. **Agent-Specific CSAT** - Per-agent satisfaction tracking
7. **Real-Time Satisfaction Heatmap** - Geographic visualization

---

## Related Documentation

- **VIBE-P16-010**: Feedback Loop Integration Tests (test pattern reference)
- **PHASE6-TASK-01**: Task Tracking Dashboard (dashboard widget pattern)
- **PHASE7-TASK-02**: Health Checks & Monitoring (observability pattern)
- **STRATEGIC_PLAN.md**: Phase 6 (Dashboard & Visualization)

---

## Conclusion

This specification defines a comprehensive user satisfaction metrics system for the Vibe platform. The system enables:

✅ **NPS Surveys** - Periodic net promoter score collection with configurable triggers
✅ **CSAT Micro-Surveys** - Post-interaction satisfaction measurement
✅ **In-App Feedback** - Always-accessible feedback submission
✅ **Trend Analysis** - Satisfaction tracking over time with moving averages
✅ **Cohort Segmentation** - Satisfaction analysis by user tier, tenure, and usage
✅ **Automated Alerts** - Proactive notification of satisfaction drops
✅ **Planning Integration** - Satisfaction signals feed into self-improvement loop
✅ **Export & Analytics** - Data export for external analysis

**Implementation Effort:** 10 hours (~1.5 days)
**Dependencies:** WebSocket, Dashboard, Task tracking, Telegram bot
**Database Tables:** 4 new tables with indexes
**API Endpoints:** 10 REST endpoints
**Frontend Components:** 5 React components
**CI/CD Integration**: Existing test infrastructure

**Status:** Specification Complete - Ready for Implementation
**Next Steps:**
1. Create database migrations (Phase 1)
2. Implement SatisfactionManager class (Phase 1)
3. Build survey UI components (Phase 2)
4. Integrate with Planning Agent (Phase 4)
5. Create dashboard analytics views (Phase 5)

---

**Document Version:** 1.0
**Created:** 2026-02-09
**Author:** Spec Agent (Autonomous)
**Specification Duration:** Comprehensive analysis and design
