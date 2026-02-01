import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import IdeaList from "./pages/IdeaList";
import IdeaDetail from "./pages/IdeaDetail";
import IdeaDetailPhased from "./pages/IdeaDetailPhased";
import NewIdea from "./pages/NewIdea";
import EditIdea from "./pages/EditIdea";
import Comparison from "./pages/Comparison";
import DebateList from "./pages/DebateList";
import DebateSession from "./pages/DebateSession";
import DebateViewer from "./pages/DebateViewer";
import Profile from "./pages/Profile";
import AgentDashboard from "./pages/AgentDashboard";
import AgentDetailPage from "./pages/AgentDetailPage";
import KanbanBoard from "./pages/KanbanBoard";
import TaskListBrowser from "./pages/TaskListBrowser";
import IdeationPageWrapper from "./pages/IdeationPageWrapper";
import NotificationPreferences from "./pages/NotificationPreferences";
import ObservabilityPage from "./pages/ObservabilityPage";
import ExecutionReviewPage from "./pages/ExecutionReviewPage";
import PipelineDashboard from "./pages/PipelineDashboard";
import ObjectsPage from "./pages/ObjectsPage";
import ProjectListPage from "./pages/ProjectListPage";
import ProjectsPage from "./pages/ProjectsPage";
import NotFound from "./pages/NotFound";
import ClusterDemoPage from "./pages/ClusterDemoPage";

// Projects sub-tab components
import ProjectOverview from "./components/projects/ProjectOverview";
import ProjectSpec from "./components/projects/ProjectSpec";
import ProjectBuild from "./components/projects/ProjectBuild";
import TraceabilityView from "./components/projects/TraceabilityView";

// Observability sub-tab components
import OverviewDashboard from "./components/observability/OverviewDashboard";
import EventLogTab from "./components/observability/EventLogTab";
import ExecutionsTab from "./components/observability/ExecutionsTab";
import AgentsTab from "./components/observability/AgentsTab";
import AnalyticsTab from "./components/observability/AnalyticsTab";
import AllEventsViewer from "./components/observability/AllEventsViewer";
import MemoryGraphTab from "./components/observability/MemoryGraphTab";

// Observability detail pages (deep links)
import {
  TaskDetailPage,
  ToolUseDetailPage,
  AssertionDetailPage,
  WaveDetailPage,
  SkillTraceDetailPage,
  TranscriptEntryPage,
} from "./pages/observability";

// Feature flag: Set to true to use the new phase-based UI
const USE_PHASED_UI = true;

function App() {
  // Use the appropriate IdeaDetail component based on feature flag
  const IdeaDetailComponent = USE_PHASED_UI ? IdeaDetailPhased : IdeaDetail;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/ideas" element={<IdeaList />} />
        <Route path="/ideas/new" element={<NewIdea />} />
        <Route path="/ideas/:slug" element={<IdeaDetailComponent />} />
        <Route path="/ideas/:slug/edit" element={<EditIdea />} />
        {/* Projects with sub-tabs */}
        <Route path="/projects" element={<ProjectListPage />} />
        <Route path="/projects/:slug" element={<ProjectsPage />}>
          <Route index element={<ProjectOverview />} />
          <Route path="spec" element={<ProjectSpec />} />
          <Route path="traceability" element={<TraceabilityView />} />
          <Route path="build" element={<ProjectBuild />} />
        </Route>
        <Route path="/compare" element={<Comparison />} />
        <Route path="/debate" element={<DebateList />} />
        <Route path="/debate/live" element={<DebateViewer />} />
        <Route path="/debate/live/:slug" element={<DebateViewer />} />
        <Route path="/debate/session/:runId" element={<DebateSession />} />
        {/* Redirect old /events to new location */}
        <Route
          path="/events"
          element={<Navigate to="/observability/events" replace />}
        />
        <Route path="/profile" element={<Profile />} />
        <Route
          path="/settings/notifications"
          element={<NotificationPreferences />}
        />
        <Route path="/agents" element={<AgentDashboard />} />
        <Route path="/agents/:agentId" element={<AgentDetailPage />} />
        <Route path="/tasks" element={<TaskListBrowser />} />
        <Route path="/tasks/kanban" element={<KanbanBoard />} />
        <Route path="/ideate" element={<IdeationPageWrapper />} />
        <Route path="/ideate/:sessionId" element={<IdeationPageWrapper />} />
        {/* Database Objects browser */}
        <Route path="/objects" element={<ObjectsPage />} />
        {/* Observability with sub-tabs and deep links */}
        <Route path="/observability" element={<ObservabilityPage />}>
          <Route index element={<OverviewDashboard />} />
          <Route path="events" element={<EventLogTab />} />
          <Route path="executions" element={<ExecutionsTab />} />
          <Route path="executions/:id" element={<ExecutionReviewPage />} />
          {/* Deep link routes for entities within execution */}
          <Route
            path="executions/:id/tasks/:taskId"
            element={<TaskDetailPage />}
          />
          <Route
            path="executions/:id/tools/:toolId"
            element={<ToolUseDetailPage />}
          />
          <Route
            path="executions/:id/assertions/:assertId"
            element={<AssertionDetailPage />}
          />
          <Route
            path="executions/:id/waves/:waveNum"
            element={<WaveDetailPage />}
          />
          <Route
            path="executions/:id/skills/:skillId"
            element={<SkillTraceDetailPage />}
          />
          <Route
            path="executions/:id/transcript/:entryId"
            element={<TranscriptEntryPage />}
          />
          <Route path="agents" element={<AgentsTab />} />
          <Route path="agents/:agentId" element={<AgentDetailPage />} />
          <Route path="analytics" element={<AnalyticsTab />} />
          <Route path="platform-events" element={<AllEventsViewer />} />
          <Route path="memory-graph" element={<MemoryGraphTab />} />
        </Route>
        <Route path="/pipeline" element={<PipelineDashboard />} />
        <Route path="/pipeline/conflicts" element={<PipelineDashboard />} />
        <Route path="/pipeline/stream" element={<PipelineDashboard />} />
        {/* Test pages */}
        <Route path="/test/cluster-demo" element={<ClusterDemoPage />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Layout>
  );
}

export default App;
