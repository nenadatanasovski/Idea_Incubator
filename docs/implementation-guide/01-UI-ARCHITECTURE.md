# UI Architecture: Cohesive Design System

> **Focus:** Transforming disjointed components into a unified experience
> **Key Insight:** Chat is the primary interaction method — it should be persistent, not hidden

---

## Part 1: The Problem

### Current State: Disjointed Components

The existing UI treats each phase as a separate page with isolated components:

```
Current Flow:
┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐
│ Ideation│ → │ Clarify │ → │ Evaluate│ → │ Position│
│  Page   │    │  Page   │    │  Page   │    │  Page   │
└─────────┘    └─────────┘    └─────────┘    └─────────┘
     ↓              ↓              ↓              ↓
  Chat here    Forms here    Results here   Strategy here

Problem: User loses context switching between pages
Problem: Chat disappears after ideation
Problem: No persistent view of idea state
```

### What Users Actually Need

1. **Persistent chat** — The primary interaction throughout ALL phases
2. **Context visibility** — Always know what idea you're working on
3. **Progress tracking** — Where am I in the journey?
4. **Agent activity** — What's happening behind the scenes?

---

## Part 2: The Vision

### Layout: Chat-Left, Content-Right

```
┌────────────────────────────────────────────────────────────────┐
│  Logo    [Idea Dropdown ▾]    [Phase: Ideation]    [User ▾]    │
├─────────────────┬──────────────────────────────────────────────┤
│                 │                                               │
│   💬 CHAT       │   📊 CONTENT AREA                            │
│   PANEL         │                                               │
│   (persistent)  │   [Memory Graph] [Artifacts] [Evaluation]    │
│                 │   ─────────────────────────────────────────   │
│   ┌───────────┐ │   ┌─────────────────────────────────────────┐│
│   │ Messages  │ │   │                                         ││
│   │           │ │   │   Context-appropriate content:          ││
│   │ User: ... │ │   │   - Memory graph during ideation        ││
│   │ AI: ...   │ │   │   - Spec preview during specification   ││
│   │           │ │   │   - Task progress during build          ││
│   │           │ │   │   - Evaluation results after eval       ││
│   └───────────┘ │   │                                         ││
│   ┌───────────┐ │   └─────────────────────────────────────────┘│
│   │ Input...  │ │                                               │
│   └───────────┘ │                                               │
│                 │                                               │
└─────────────────┴──────────────────────────────────────────────┘
     ~320px                      ~Flexible
```

### Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Chat position | Left panel, always visible | Primary interaction method |
| Content area | Right panel, tabs for views | Context without navigation |
| Phase indicator | Header, always visible | User always knows where they are |
| Agent activity | Integrated into chat | Transparency about what's happening |

---

## Part 3: Component Architecture

### 3.1 Layout Component

**File:** `frontend/src/components/UnifiedLayout.tsx`

```tsx
interface UnifiedLayoutProps {
  ideaId: string;
  currentPhase: Phase;
  children: React.ReactNode;
}

export function UnifiedLayout({ ideaId, currentPhase, children }: UnifiedLayoutProps) {
  const [chatExpanded, setChatExpanded] = useState(true);
  
  return (
    <div className="h-screen flex flex-col">
      {/* Fixed Header */}
      <header className="h-14 border-b bg-white flex items-center px-4 shrink-0">
        <Logo />
        <IdeaSelector currentIdeaId={ideaId} />
        <PhaseIndicator phase={currentPhase} />
        <UserMenu />
      </header>
      
      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Panel */}
        <aside 
          className={cn(
            "border-r bg-gray-50 transition-all duration-200 flex flex-col",
            chatExpanded ? "w-80" : "w-12"
          )}
        >
          <ChatPanel 
            ideaId={ideaId}
            expanded={chatExpanded}
            onToggle={() => setChatExpanded(!chatExpanded)}
          />
        </aside>
        
        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
```

### 3.2 Chat Panel

**File:** `frontend/src/components/ChatPanel.tsx`

The chat panel is the **primary interaction point** for all phases:

```tsx
interface ChatPanelProps {
  ideaId: string;
  expanded: boolean;
  onToggle: () => void;
}

export function ChatPanel({ ideaId, expanded, onToggle }: ChatPanelProps) {
  const { messages, sendMessage, isStreaming } = useChat(ideaId);
  const { currentPhase, agentActivity } = useIdeaState(ideaId);
  
  if (!expanded) {
    return (
      <button onClick={onToggle} className="w-full h-full flex items-center justify-center">
        <MessageSquare className="w-5 h-5" />
      </button>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="h-12 border-b flex items-center justify-between px-3">
        <span className="font-medium">Chat</span>
        <button onClick={onToggle}>
          <ChevronLeft className="w-4 h-4" />
        </button>
      </div>
      
      {/* Agent Activity Indicator */}
      {agentActivity && (
        <div className="px-3 py-2 bg-blue-50 border-b text-sm">
          <div className="flex items-center gap-2">
            <Loader className="w-3 h-3 animate-spin" />
            <span>{agentActivity}</span>
          </div>
        </div>
      )}
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map(msg => (
          <ChatMessage key={msg.id} message={msg} />
        ))}
        {isStreaming && <StreamingIndicator />}
      </div>
      
      {/* Input */}
      <div className="border-t p-3">
        <ChatInput 
          onSend={sendMessage}
          disabled={isStreaming}
          placeholder={getPlaceholderForPhase(currentPhase)}
        />
      </div>
    </div>
  );
}

function getPlaceholderForPhase(phase: Phase): string {
  switch (phase) {
    case 'ideation': return "Share your thoughts...";
    case 'specification': return "Ask about requirements...";
    case 'build': return "Give feedback on progress...";
    default: return "Type a message...";
  }
}
```

### 3.3 Content Area Tabs

**File:** `frontend/src/components/ContentArea.tsx`

The content area shows different views based on phase and user selection:

```tsx
type ContentTab = 'graph' | 'artifacts' | 'spec' | 'tasks' | 'evaluation';

interface ContentAreaProps {
  ideaId: string;
  phase: Phase;
}

export function ContentArea({ ideaId, phase }: ContentAreaProps) {
  const availableTabs = getTabsForPhase(phase);
  const [activeTab, setActiveTab] = useState(availableTabs[0]);
  
  return (
    <div className="h-full flex flex-col">
      {/* Tab Header */}
      <div className="h-12 border-b flex items-center px-4 gap-2 shrink-0">
        {availableTabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm font-medium transition",
              activeTab === tab 
                ? "bg-primary-100 text-primary-700"
                : "text-gray-600 hover:bg-gray-100"
            )}
          >
            {getTabLabel(tab)}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'graph' && <MemoryGraphView ideaId={ideaId} />}
        {activeTab === 'artifacts' && <ArtifactsView ideaId={ideaId} />}
        {activeTab === 'spec' && <SpecificationView ideaId={ideaId} />}
        {activeTab === 'tasks' && <TaskProgressView ideaId={ideaId} />}
        {activeTab === 'evaluation' && <EvaluationView ideaId={ideaId} />}
      </div>
    </div>
  );
}

function getTabsForPhase(phase: Phase): ContentTab[] {
  switch (phase) {
    case 'ideation':
      return ['graph', 'artifacts'];
    case 'clarify':
      return ['graph', 'artifacts', 'evaluation'];
    case 'specification':
      return ['spec', 'graph', 'artifacts'];
    case 'build':
      return ['tasks', 'spec', 'artifacts'];
    case 'deployed':
      return ['tasks', 'evaluation', 'artifacts'];
    default:
      return ['graph'];
  }
}
```

---

## Part 4: Memory Graph as Primary View

The Memory Graph is the **visual representation of the idea's knowledge**. During ideation, it's the primary content view.

### 4.1 Graph Integration

**File:** `frontend/src/components/graph/MemoryGraphView.tsx`

```tsx
interface MemoryGraphViewProps {
  ideaId: string;
}

export function MemoryGraphView({ ideaId }: MemoryGraphViewProps) {
  const { nodes, edges, loading } = useMemoryGraph(ideaId);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  
  if (loading) {
    return <GraphSkeleton />;
  }
  
  return (
    <div className="h-full flex">
      {/* Graph Visualization */}
      <div className="flex-1">
        <ForceGraph
          nodes={nodes}
          edges={edges}
          onNodeClick={setSelectedNode}
          selectedNode={selectedNode}
        />
      </div>
      
      {/* Node Inspector (when selected) */}
      {selectedNode && (
        <aside className="w-72 border-l p-4 overflow-y-auto">
          <NodeInspector 
            nodeId={selectedNode}
            onClose={() => setSelectedNode(null)}
          />
        </aside>
      )}
    </div>
  );
}
```

### 4.2 Graph-Chat Integration

When a user clicks a node in the graph, they can ask about it in the chat:

```tsx
// In NodeInspector
function NodeInspector({ nodeId, onClose }: NodeInspectorProps) {
  const node = useNode(nodeId);
  const { sendMessage } = useChat();
  
  const askAboutNode = () => {
    sendMessage(`Tell me more about: ${node.title}`);
  };
  
  return (
    <div>
      <div className="flex justify-between items-start">
        <h3 className="font-medium">{node.title}</h3>
        <button onClick={onClose}>×</button>
      </div>
      
      <p className="text-sm text-gray-600 mt-2">{node.content}</p>
      
      <div className="mt-4 space-y-2">
        <button 
          onClick={askAboutNode}
          className="w-full btn btn-secondary btn-sm"
        >
          Ask about this
        </button>
      </div>
    </div>
  );
}
```

---

## Part 5: Phase-Specific Views

### 5.1 Ideation Phase

Primary: Chat + Memory Graph

```tsx
export function IdeationPhaseContent({ ideaId }: { ideaId: string }) {
  return (
    <ContentArea ideaId={ideaId} phase="ideation">
      {/* Default view: Memory Graph */}
      {/* Shows knowledge extracted from conversation */}
      {/* User can see graph grow as they chat */}
    </ContentArea>
  );
}
```

### 5.2 Specification Phase

Primary: Chat + Spec Preview

```tsx
export function SpecificationPhaseContent({ ideaId }: { ideaId: string }) {
  const { spec, isGenerating } = useSpec(ideaId);
  
  return (
    <div className="h-full flex flex-col">
      {/* Spec generation status */}
      {isGenerating && (
        <div className="p-4 bg-blue-50 border-b">
          <p className="text-sm">Generating specification from your idea...</p>
          <Progress value={spec?.progress || 0} />
        </div>
      )}
      
      {/* Spec preview */}
      <div className="flex-1 overflow-auto p-4">
        {spec ? (
          <SpecPreview spec={spec} />
        ) : (
          <div className="text-center text-gray-500 py-12">
            Chat with the spec agent to define requirements
          </div>
        )}
      </div>
    </div>
  );
}
```

### 5.3 Build Phase

Primary: Chat + Task Progress

```tsx
export function BuildPhaseContent({ ideaId }: { ideaId: string }) {
  const { tasks, currentTask, buildStatus } = useBuildProgress(ideaId);
  
  return (
    <div className="h-full flex flex-col">
      {/* Build status header */}
      <div className="p-4 border-b">
        <BuildStatusBanner status={buildStatus} />
      </div>
      
      {/* Task list */}
      <div className="flex-1 overflow-auto">
        <TaskList tasks={tasks} currentTask={currentTask} />
      </div>
      
      {/* Current task details (if any) */}
      {currentTask && (
        <div className="border-t p-4">
          <CurrentTaskDetails task={currentTask} />
        </div>
      )}
    </div>
  );
}
```

---

## Part 6: Agent Activity Transparency

### 6.1 Activity Feed in Chat

Show what agents are doing within the chat stream:

```tsx
// Message types
type ChatMessageType = 
  | 'user'           // User message
  | 'assistant'      // AI response
  | 'system'         // System notification
  | 'agent-activity' // Agent doing something
  | 'phase-change'   // Phase transition

interface AgentActivityMessage {
  type: 'agent-activity';
  agent: string;        // 'ideation' | 'spec' | 'build' | 'sia'
  action: string;       // 'extracting-knowledge' | 'generating-tasks' | etc.
  details?: string;
  timestamp: Date;
}

// Render in chat
function ChatMessage({ message }: { message: ChatMessage }) {
  if (message.type === 'agent-activity') {
    return (
      <div className="flex items-center gap-2 py-2 px-3 bg-gray-50 rounded text-sm text-gray-600">
        <AgentIcon agent={message.agent} className="w-4 h-4" />
        <span>{message.action}</span>
        {message.details && (
          <span className="text-gray-400">— {message.details}</span>
        )}
      </div>
    );
  }
  
  // ... other message types
}
```

### 6.2 Phase Transition Notifications

```tsx
function PhaseChangeMessage({ from, to, reason }: PhaseChangeProps) {
  return (
    <div className="my-4 flex items-center gap-3">
      <div className="flex-1 h-px bg-gray-200" />
      <div className="flex items-center gap-2 px-3 py-1.5 bg-primary-50 rounded-full">
        <ArrowRight className="w-4 h-4 text-primary-500" />
        <span className="text-sm font-medium text-primary-700">
          Moving to {to}
        </span>
      </div>
      <div className="flex-1 h-px bg-gray-200" />
    </div>
  );
}
```

---

## Part 7: Implementation Tasks

### Task UI-001: Create UnifiedLayout Component

**File:** `frontend/src/components/UnifiedLayout.tsx`

**Acceptance Criteria:**
- [ ] Fixed header with logo, idea selector, phase indicator, user menu
- [ ] Resizable chat panel (min 280px, max 400px)
- [ ] Content area fills remaining space
- [ ] Responsive: chat collapses to icon on mobile

**Test:**
```typescript
describe('UnifiedLayout', () => {
  it('renders header with all elements', () => {
    render(<UnifiedLayout ideaId="test" currentPhase="ideation">content</UnifiedLayout>);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByTestId('idea-selector')).toBeInTheDocument();
    expect(screen.getByTestId('phase-indicator')).toBeInTheDocument();
  });
  
  it('toggles chat panel', async () => {
    render(<UnifiedLayout ideaId="test" currentPhase="ideation">content</UnifiedLayout>);
    const toggleBtn = screen.getByTestId('chat-toggle');
    await userEvent.click(toggleBtn);
    expect(screen.getByTestId('chat-panel')).toHaveClass('w-12');
  });
});
```

---

### Task UI-002: Create Persistent ChatPanel Component

**File:** `frontend/src/components/ChatPanel.tsx`

**Acceptance Criteria:**
- [ ] Displays message history
- [ ] Shows streaming responses
- [ ] Agent activity indicator when agents are working
- [ ] Input adapts placeholder based on phase
- [ ] Scrolls to bottom on new message

**Test:**
```typescript
describe('ChatPanel', () => {
  it('shows agent activity when active', () => {
    const { rerender } = render(
      <ChatPanel ideaId="test" expanded={true} onToggle={jest.fn()} />
    );
    
    // Simulate agent activity
    mockUseIdeaState.mockReturnValue({ agentActivity: 'Extracting knowledge...' });
    rerender(<ChatPanel ideaId="test" expanded={true} onToggle={jest.fn()} />);
    
    expect(screen.getByText('Extracting knowledge...')).toBeInTheDocument();
  });
});
```

---

### Task UI-003: Integrate Memory Graph with Chat

**File:** `frontend/src/components/graph/MemoryGraphView.tsx`

**Acceptance Criteria:**
- [ ] Graph displays nodes and edges from API
- [ ] Click node to select and show inspector
- [ ] Inspector has "Ask about this" button
- [ ] Button sends message to chat
- [ ] Graph updates when new knowledge is extracted

**Test:**
```typescript
describe('MemoryGraphView', () => {
  it('allows asking about a node via chat', async () => {
    const sendMessage = jest.fn();
    mockUseChat.mockReturnValue({ sendMessage, messages: [], isStreaming: false });
    
    render(<MemoryGraphView ideaId="test" />);
    
    // Click a node
    await userEvent.click(screen.getByTestId('node-1'));
    
    // Click "Ask about this"
    await userEvent.click(screen.getByText('Ask about this'));
    
    expect(sendMessage).toHaveBeenCalledWith(expect.stringContaining('Tell me more about'));
  });
});
```

---

### Task UI-004: Phase-Aware Content Tabs

**File:** `frontend/src/components/ContentArea.tsx`

**Acceptance Criteria:**
- [ ] Shows correct tabs for each phase
- [ ] Default tab is appropriate for phase
- [ ] Tab content loads lazily
- [ ] Switching tabs preserves scroll position

**Test:**
```typescript
describe('ContentArea', () => {
  it('shows graph and artifacts tabs during ideation', () => {
    render(<ContentArea ideaId="test" phase="ideation" />);
    expect(screen.getByText('Memory Graph')).toBeInTheDocument();
    expect(screen.getByText('Artifacts')).toBeInTheDocument();
    expect(screen.queryByText('Tasks')).not.toBeInTheDocument();
  });
  
  it('shows tasks tab during build', () => {
    render(<ContentArea ideaId="test" phase="build" />);
    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Spec')).toBeInTheDocument();
  });
});
```

---

### Task UI-005: Build Progress View

**File:** `frontend/src/components/BuildProgressView.tsx`

**Acceptance Criteria:**
- [ ] Shows task list with status indicators
- [ ] Current task is highlighted
- [ ] Completed tasks show checkmark
- [ ] Failed tasks show error with retry option
- [ ] Progress bar shows overall completion

**Test:**
```typescript
describe('BuildProgressView', () => {
  it('highlights current task', () => {
    const tasks = [
      { id: '1', name: 'Setup', status: 'completed' },
      { id: '2', name: 'Database', status: 'running' },
      { id: '3', name: 'API', status: 'pending' },
    ];
    
    render(<BuildProgressView tasks={tasks} currentTaskId="2" />);
    
    expect(screen.getByTestId('task-1')).toHaveClass('bg-green-50');
    expect(screen.getByTestId('task-2')).toHaveClass('bg-blue-50', 'ring-2');
    expect(screen.getByTestId('task-3')).toHaveClass('bg-gray-50');
  });
});
```

---

## Part 8: Migration Path

### From Current UI to Unified Layout

1. **Create new components** alongside existing ones
2. **Route new ideas** to new layout
3. **Migrate existing ideas** gradually
4. **Remove old components** once migration complete

```tsx
// In App.tsx routing
<Route path="/idea/:slug" element={
  <FeatureFlag flag="unified-layout">
    <UnifiedIdeaPage />
    <FallbackComponent>
      <IdeaDetailPhased />
    </FallbackComponent>
  </FeatureFlag>
} />
```

---

## Summary

The cohesive UI design centers on:

1. **Chat as persistent left panel** — always visible, primary interaction
2. **Phase-aware content area** — shows relevant views for current phase
3. **Agent activity transparency** — users see what's happening
4. **Memory graph integration** — visual representation of knowledge

This creates a unified experience where users can:
- Chat throughout the entire journey
- See their idea grow in the graph
- Track progress through phases
- Understand what agents are doing

---

*Next: [02-PIPELINE-ORCHESTRATION.md](./02-PIPELINE-ORCHESTRATION.md) — Critical integration layer*
