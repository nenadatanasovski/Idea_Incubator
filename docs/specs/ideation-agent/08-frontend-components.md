# Spec 8: Frontend Components (Architecture & Implementation)

## Overview

This specification covers all React frontend components for the Ideation Agent system. It includes the component tree, TypeScript interfaces, state management, SSE streaming implementation, and comprehensive test plans.

**Dependencies:**
- Spec 1: Database & Data Models (TypeScript types)
- Spec 7: API Endpoints (API client functions)

---

## 1. Component Tree

```
IdeationPage
├── IdeationEntryModal (entry point choice)
│   ├── EntryOption (I have an idea)
│   └── EntryOption (Help me discover)
│
└── IdeationSession (main container)
    ├── SessionHeader
    │   ├── SessionTitle
    │   ├── TokenUsageIndicator
    │   └── SessionActions (abandon, minimize)
    │
    ├── ConversationPanel (left side)
    │   ├── MessageList
    │   │   ├── AgentMessage
    │   │   │   ├── MessageText
    │   │   │   ├── ButtonGroup (if buttons)
    │   │   │   ├── FormRenderer (if form)
    │   │   │   └── SourceCitations (if web search results)
    │   │   └── UserMessage
    │   │
    │   ├── TypingIndicator
    │   │
    │   └── InputArea
    │       ├── TextInput
    │       └── SendButton
    │
    └── IdeaCandidatePanel (right side)
        ├── EmptyState
        ├── FormingState
        ├── ActiveState
        │   ├── CandidateTitle
        │   ├── CandidateSummary
        │   ├── ConfidenceMeter
        │   ├── ViabilityMeter
        │   ├── RisksList
        │   └── ActionButtons
        └── WarningState
            ├── WarningBanner
            ├── RiskDetails
            └── InterventionOptions
```

---

## 2. TypeScript Interfaces

### 2.1 Component Props Interfaces

```typescript
// =============================================================================
// FILE: frontend/src/types/ideation.ts
// =============================================================================

import type {
  IdeationMessage,
  IdeaCandidate,
  ViabilityRisk,
  ButtonOption,
  FormDefinition,
  WebSearchResult,
} from './index';

// -----------------------------------------------------------------------------
// Page Level
// -----------------------------------------------------------------------------

export interface IdeationPageProps {
  profileId: string;
  onComplete: (ideaId: string) => void;
  onExit: () => void;
}

export type EntryMode = 'have_idea' | 'discover' | null;

export interface IdeationEntryModalProps {
  isOpen: boolean;
  onSelect: (mode: EntryMode) => void;
  onClose: () => void;
}

export interface EntryOptionProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  mode: EntryMode;
  onSelect: (mode: EntryMode) => void;
}

// -----------------------------------------------------------------------------
// Session Level
// -----------------------------------------------------------------------------

export interface IdeationSessionProps {
  sessionId: string;
  profileId: string;
  entryMode: EntryMode;
  onComplete: (ideaId: string) => void;
  onExit: () => void;
}

export interface SessionHeaderProps {
  sessionId: string;
  tokenUsage: TokenUsageInfo;
  onAbandon: () => void;
  onMinimize: () => void;
}

export interface TokenUsageInfo {
  total: number;
  limit: number;
  percentUsed: number;
  shouldHandoff: boolean;
}

export interface TokenUsageIndicatorProps {
  usage: TokenUsageInfo;
}

// -----------------------------------------------------------------------------
// Conversation Panel
// -----------------------------------------------------------------------------

export interface ConversationPanelProps {
  messages: IdeationMessage[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onButtonClick: (buttonId: string, buttonValue: string) => void;
  onFormSubmit: (formId: string, answers: Record<string, unknown>) => void;
}

export interface MessageListProps {
  messages: IdeationMessage[];
  onButtonClick: (buttonId: string, buttonValue: string) => void;
  onFormSubmit: (formId: string, answers: Record<string, unknown>) => void;
  isLoading: boolean;
}

export interface AgentMessageProps {
  message: IdeationMessage;
  onButtonClick: (buttonId: string, buttonValue: string) => void;
  onFormSubmit: (formId: string, answers: Record<string, unknown>) => void;
  isLatest: boolean;
}

export interface UserMessageProps {
  message: IdeationMessage;
}

export interface MessageTextProps {
  content: string;
  isStreaming?: boolean;
}

export interface TypingIndicatorProps {
  isVisible: boolean;
}

// -----------------------------------------------------------------------------
// Interactive Elements
// -----------------------------------------------------------------------------

export interface ButtonGroupProps {
  buttons: ButtonOption[];
  onSelect: (buttonId: string, buttonValue: string) => void;
  disabled: boolean;
  selectedId?: string;
}

export interface FormRendererProps {
  form: FormDefinition;
  onSubmit: (answers: Record<string, unknown>) => void;
  onCancel: () => void;
  disabled: boolean;
}

export interface FormFieldProps {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
}

export interface FormField {
  name: string;
  type: 'text' | 'radio' | 'checkbox' | 'slider' | 'select';
  label: string;
  options?: string[];
  min?: number;
  max?: number;
  required?: boolean;
}

export interface SourceCitationsProps {
  sources: WebSearchResult[];
}

// -----------------------------------------------------------------------------
// Input Area
// -----------------------------------------------------------------------------

export interface InputAreaProps {
  onSend: (message: string) => void;
  disabled: boolean;
  placeholder?: string;
}

export interface TextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled: boolean;
  placeholder?: string;
}

export interface SendButtonProps {
  onClick: () => void;
  disabled: boolean;
}

// -----------------------------------------------------------------------------
// Idea Candidate Panel
// -----------------------------------------------------------------------------

export interface IdeaCandidatePanelProps {
  candidate: IdeaCandidate | null;
  confidence: number;
  viability: number;
  risks: ViabilityRisk[];
  onCapture: () => void;
  onSave: () => void;
  onDiscard: () => void;
  onContinue: () => void;
  showIntervention: boolean;
}

export interface EmptyStateProps {
  message?: string;
}

export interface FormingStateProps {
  confidence: number;
  threshold: number;
}

export interface ActiveStateProps {
  candidate: IdeaCandidate;
  confidence: number;
  viability: number;
  risks: ViabilityRisk[];
  onCapture: () => void;
  onSave: () => void;
}

export interface WarningStateProps {
  candidate: IdeaCandidate;
  viability: number;
  risks: ViabilityRisk[];
  onAddressRisks: () => void;
  onPivot: () => void;
  onContinueAnyway: () => void;
  onDiscard: () => void;
}

// -----------------------------------------------------------------------------
// Meters
// -----------------------------------------------------------------------------

export interface ConfidenceMeterProps {
  value: number;  // 0-100
  showLabel: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export interface ViabilityMeterProps {
  value: number;  // 0-100
  risks: ViabilityRisk[];
  showWarning: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export interface RisksListProps {
  risks: ViabilityRisk[];
  maxDisplay?: number;
  onViewAll?: () => void;
}

export interface RiskItemProps {
  risk: ViabilityRisk;
}

// -----------------------------------------------------------------------------
// Action Buttons
// -----------------------------------------------------------------------------

export interface CandidateActionButtonsProps {
  onCapture: () => void;
  onSave: () => void;
  captureEnabled: boolean;
  saveEnabled: boolean;
}

export interface InterventionOptionsProps {
  onAddressRisks: () => void;
  onPivot: () => void;
  onContinueAnyway: () => void;
  onDiscard: () => void;
}
```

### 2.2 State Interfaces

```typescript
// =============================================================================
// FILE: frontend/src/types/ideation-state.ts
// =============================================================================

import type {
  IdeationMessage,
  IdeaCandidate,
  ViabilityRisk,
} from './index';
import type { TokenUsageInfo, EntryMode } from './ideation';

// -----------------------------------------------------------------------------
// Session State
// -----------------------------------------------------------------------------

export interface IdeationSessionState {
  sessionId: string | null;
  profileId: string;
  status: 'idle' | 'loading' | 'active' | 'completed' | 'abandoned' | 'error';
  entryMode: EntryMode;
  error: string | null;
}

export interface ConversationState {
  messages: IdeationMessage[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingContent: string;
  error: string | null;
}

export interface CandidateState {
  candidate: IdeaCandidate | null;
  confidence: number;
  viability: number;
  risks: ViabilityRisk[];
  showIntervention: boolean;
  interventionType: 'warning' | 'critical' | null;
}

export interface TokenState {
  usage: TokenUsageInfo;
  handoffPending: boolean;
  handoffCount: number;
}

// -----------------------------------------------------------------------------
// Combined Store State
// -----------------------------------------------------------------------------

export interface IdeationStore {
  session: IdeationSessionState;
  conversation: ConversationState;
  candidate: CandidateState;
  tokens: TokenState;
}

// -----------------------------------------------------------------------------
// Actions
// -----------------------------------------------------------------------------

export type IdeationAction =
  | { type: 'SESSION_START'; payload: { profileId: string; entryMode: EntryMode } }
  | { type: 'SESSION_CREATED'; payload: { sessionId: string; greeting: string } }
  | { type: 'SESSION_ERROR'; payload: { error: string } }
  | { type: 'SESSION_COMPLETE'; payload: { ideaId: string } }
  | { type: 'SESSION_ABANDON' }
  | { type: 'MESSAGE_SEND'; payload: { content: string } }
  | { type: 'MESSAGE_STREAM_START' }
  | { type: 'MESSAGE_STREAM_CHUNK'; payload: { chunk: string } }
  | { type: 'MESSAGE_STREAM_END'; payload: { message: IdeationMessage } }
  | { type: 'MESSAGE_RECEIVED'; payload: { message: IdeationMessage } }
  | { type: 'MESSAGE_ERROR'; payload: { error: string } }
  | { type: 'BUTTON_CLICK'; payload: { buttonId: string; buttonValue: string } }
  | { type: 'FORM_SUBMIT'; payload: { formId: string; answers: Record<string, unknown> } }
  | { type: 'CANDIDATE_UPDATE'; payload: { candidate: IdeaCandidate } }
  | { type: 'CANDIDATE_CLEAR' }
  | { type: 'CONFIDENCE_UPDATE'; payload: { confidence: number } }
  | { type: 'VIABILITY_UPDATE'; payload: { viability: number; risks: ViabilityRisk[] } }
  | { type: 'INTERVENTION_SHOW'; payload: { type: 'warning' | 'critical' } }
  | { type: 'INTERVENTION_DISMISS' }
  | { type: 'TOKEN_UPDATE'; payload: { usage: TokenUsageInfo } }
  | { type: 'HANDOFF_PENDING' }
  | { type: 'HANDOFF_COMPLETE' };
```

---

## 3. Component Implementations

### 3.1 IdeationPage (Entry Point)

```typescript
// =============================================================================
// FILE: frontend/src/pages/IdeationPage.tsx
// =============================================================================

import React, { useState, useCallback } from 'react';
import { IdeationEntryModal } from '../components/ideation/IdeationEntryModal';
import { IdeationSession } from '../components/ideation/IdeationSession';
import type { IdeationPageProps, EntryMode } from '../types/ideation';

export function IdeationPage({ profileId, onComplete, onExit }: IdeationPageProps) {
  const [entryMode, setEntryMode] = useState<EntryMode>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showEntryModal, setShowEntryModal] = useState(true);

  const handleEntrySelect = useCallback((mode: EntryMode) => {
    setEntryMode(mode);
    setShowEntryModal(false);
  }, []);

  const handleSessionStart = useCallback((id: string) => {
    setSessionId(id);
  }, []);

  const handleComplete = useCallback((ideaId: string) => {
    onComplete(ideaId);
  }, [onComplete]);

  const handleExit = useCallback(() => {
    setSessionId(null);
    setEntryMode(null);
    onExit();
  }, [onExit]);

  if (showEntryModal) {
    return (
      <IdeationEntryModal
        isOpen={true}
        onSelect={handleEntrySelect}
        onClose={onExit}
      />
    );
  }

  return (
    <div className="ideation-page">
      <IdeationSession
        sessionId={sessionId || ''}
        profileId={profileId}
        entryMode={entryMode}
        onComplete={handleComplete}
        onExit={handleExit}
      />
    </div>
  );
}
```

### 3.2 IdeationEntryModal

```typescript
// =============================================================================
// FILE: frontend/src/components/ideation/IdeationEntryModal.tsx
// =============================================================================

import React from 'react';
import { Lightbulb, Compass } from 'lucide-react';
import type { IdeationEntryModalProps, EntryMode } from '../../types/ideation';

export function IdeationEntryModal({ isOpen, onSelect, onClose }: IdeationEntryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-lg w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold text-center mb-2">
          Start Your Ideation Journey
        </h2>
        <p className="text-gray-600 text-center mb-8">
          How would you like to begin?
        </p>

        <div className="space-y-4">
          <EntryOption
            icon={<Lightbulb className="w-8 h-8" />}
            title="I have an idea"
            description="Explore and validate an idea you already have in mind"
            mode="have_idea"
            onSelect={onSelect}
          />
          <EntryOption
            icon={<Compass className="w-8 h-8" />}
            title="Help me discover"
            description="Let's explore your interests and find opportunities together"
            mode="discover"
            onSelect={onSelect}
          />
        </div>

        <button
          onClick={onClose}
          className="mt-6 w-full text-gray-500 hover:text-gray-700 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function EntryOption({
  icon,
  title,
  description,
  mode,
  onSelect,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  mode: EntryMode;
  onSelect: (mode: EntryMode) => void;
}) {
  return (
    <button
      onClick={() => onSelect(mode)}
      className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500
                 hover:bg-blue-50 transition-all flex items-start gap-4 text-left"
    >
      <div className="text-blue-600 mt-1">{icon}</div>
      <div>
        <h3 className="font-semibold text-lg">{title}</h3>
        <p className="text-gray-600 text-sm">{description}</p>
      </div>
    </button>
  );
}
```

### 3.3 IdeationSession (Main Container)

```typescript
// =============================================================================
// FILE: frontend/src/components/ideation/IdeationSession.tsx
// =============================================================================

import React, { useEffect, useReducer, useCallback } from 'react';
import { SessionHeader } from './SessionHeader';
import { ConversationPanel } from './ConversationPanel';
import { IdeaCandidatePanel } from './IdeaCandidatePanel';
import { useIdeationAPI } from '../../hooks/useIdeationAPI';
import { useSSEStream } from '../../hooks/useSSEStream';
import { ideationReducer, initialState } from '../../reducers/ideationReducer';
import type { IdeationSessionProps } from '../../types/ideation';

export function IdeationSession({
  sessionId: initialSessionId,
  profileId,
  entryMode,
  onComplete,
  onExit,
}: IdeationSessionProps) {
  const [state, dispatch] = useReducer(ideationReducer, initialState);
  const api = useIdeationAPI();
  const { connect, disconnect } = useSSEStream();

  // Initialize session
  useEffect(() => {
    async function initSession() {
      dispatch({ type: 'SESSION_START', payload: { profileId, entryMode } });

      try {
        const result = await api.startSession(profileId, entryMode);
        dispatch({
          type: 'SESSION_CREATED',
          payload: { sessionId: result.sessionId, greeting: result.greeting },
        });

        // Add greeting message
        dispatch({
          type: 'MESSAGE_RECEIVED',
          payload: {
            message: {
              id: `msg_${Date.now()}`,
              sessionId: result.sessionId,
              role: 'assistant',
              content: result.greeting,
              buttons: result.buttons || null,
              form: null,
              createdAt: new Date().toISOString(),
            },
          },
        });
      } catch (error) {
        dispatch({
          type: 'SESSION_ERROR',
          payload: { error: error instanceof Error ? error.message : 'Failed to start session' },
        });
      }
    }

    if (!initialSessionId) {
      initSession();
    }
  }, [profileId, entryMode, initialSessionId, api]);

  // Handle sending messages
  const handleSendMessage = useCallback(async (content: string) => {
    if (!state.session.sessionId) return;

    dispatch({ type: 'MESSAGE_SEND', payload: { content } });

    // Add user message to conversation
    const userMessage = {
      id: `msg_${Date.now()}`,
      sessionId: state.session.sessionId,
      role: 'user' as const,
      content,
      buttons: null,
      form: null,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'MESSAGE_RECEIVED', payload: { message: userMessage } });

    // Start streaming
    dispatch({ type: 'MESSAGE_STREAM_START' });

    try {
      const response = await api.sendMessage(state.session.sessionId, content);

      // Update with response
      dispatch({
        type: 'MESSAGE_STREAM_END',
        payload: {
          message: {
            id: response.messageId,
            sessionId: state.session.sessionId,
            role: 'assistant',
            content: response.reply,
            buttons: response.buttons || null,
            form: response.form || null,
            createdAt: new Date().toISOString(),
          },
        },
      });

      // Update candidate if present
      if (response.candidateUpdate) {
        dispatch({
          type: 'CANDIDATE_UPDATE',
          payload: { candidate: response.candidateUpdate },
        });
      }

      // Update confidence/viability
      if (response.confidence !== undefined) {
        dispatch({
          type: 'CONFIDENCE_UPDATE',
          payload: { confidence: response.confidence },
        });
      }
      if (response.viability !== undefined) {
        dispatch({
          type: 'VIABILITY_UPDATE',
          payload: {
            viability: response.viability,
            risks: response.risks || [],
          },
        });
      }

      // Check for intervention
      if (response.intervention) {
        dispatch({
          type: 'INTERVENTION_SHOW',
          payload: { type: response.intervention.type },
        });
      }

      // Update token usage
      if (response.tokenUsage) {
        dispatch({
          type: 'TOKEN_UPDATE',
          payload: { usage: response.tokenUsage },
        });
      }
    } catch (error) {
      dispatch({
        type: 'MESSAGE_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Failed to send message' },
      });
    }
  }, [state.session.sessionId, api]);

  // Handle button clicks
  const handleButtonClick = useCallback(async (buttonId: string, buttonValue: string) => {
    if (!state.session.sessionId) return;

    dispatch({ type: 'BUTTON_CLICK', payload: { buttonId, buttonValue } });

    try {
      const response = await api.clickButton(state.session.sessionId, buttonId, buttonValue);

      dispatch({
        type: 'MESSAGE_RECEIVED',
        payload: {
          message: {
            id: response.messageId,
            sessionId: state.session.sessionId,
            role: 'assistant',
            content: response.reply,
            buttons: response.buttons || null,
            form: response.form || null,
            createdAt: new Date().toISOString(),
          },
        },
      });
    } catch (error) {
      dispatch({
        type: 'MESSAGE_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Failed to process button click' },
      });
    }
  }, [state.session.sessionId, api]);

  // Handle form submissions
  const handleFormSubmit = useCallback(async (formId: string, answers: Record<string, unknown>) => {
    if (!state.session.sessionId) return;

    dispatch({ type: 'FORM_SUBMIT', payload: { formId, answers } });

    // Process form as a message with structured data
    const formattedAnswers = Object.entries(answers)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');

    await handleSendMessage(`[Form Response: ${formattedAnswers}]`);
  }, [state.session.sessionId, handleSendMessage]);

  // Handle capture
  const handleCapture = useCallback(async () => {
    if (!state.session.sessionId) return;

    try {
      const result = await api.captureIdea(state.session.sessionId);
      dispatch({ type: 'SESSION_COMPLETE', payload: { ideaId: result.ideaId } });
      onComplete(result.ideaId);
    } catch (error) {
      dispatch({
        type: 'MESSAGE_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Failed to capture idea' },
      });
    }
  }, [state.session.sessionId, api, onComplete]);

  // Handle save for later
  const handleSave = useCallback(async () => {
    if (!state.session.sessionId) return;

    try {
      await api.saveForLater(state.session.sessionId);
      // Continue conversation or show confirmation
    } catch (error) {
      dispatch({
        type: 'MESSAGE_ERROR',
        payload: { error: error instanceof Error ? error.message : 'Failed to save idea' },
      });
    }
  }, [state.session.sessionId, api]);

  // Handle abandon
  const handleAbandon = useCallback(async () => {
    if (!state.session.sessionId) return;

    try {
      await api.abandonSession(state.session.sessionId);
      dispatch({ type: 'SESSION_ABANDON' });
      onExit();
    } catch (error) {
      console.error('Failed to abandon session:', error);
      onExit();
    }
  }, [state.session.sessionId, api, onExit]);

  // Handle discard candidate
  const handleDiscard = useCallback(() => {
    dispatch({ type: 'CANDIDATE_CLEAR' });
    dispatch({ type: 'INTERVENTION_DISMISS' });
  }, []);

  // Handle intervention continue
  const handleContinue = useCallback(() => {
    dispatch({ type: 'INTERVENTION_DISMISS' });
  }, []);

  if (state.session.status === 'error') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-600 mb-4">{state.session.error}</p>
          <button
            onClick={onExit}
            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (state.session.status === 'loading') {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="ideation-session h-full flex flex-col">
      <SessionHeader
        sessionId={state.session.sessionId || ''}
        tokenUsage={state.tokens.usage}
        onAbandon={handleAbandon}
        onMinimize={onExit}
      />

      <div className="flex-1 flex overflow-hidden">
        <ConversationPanel
          messages={state.conversation.messages}
          isLoading={state.conversation.isLoading}
          onSendMessage={handleSendMessage}
          onButtonClick={handleButtonClick}
          onFormSubmit={handleFormSubmit}
        />

        <IdeaCandidatePanel
          candidate={state.candidate.candidate}
          confidence={state.candidate.confidence}
          viability={state.candidate.viability}
          risks={state.candidate.risks}
          onCapture={handleCapture}
          onSave={handleSave}
          onDiscard={handleDiscard}
          onContinue={handleContinue}
          showIntervention={state.candidate.showIntervention}
        />
      </div>
    </div>
  );
}
```

### 3.4 ConversationPanel

```typescript
// =============================================================================
// FILE: frontend/src/components/ideation/ConversationPanel.tsx
// =============================================================================

import React, { useRef, useEffect } from 'react';
import { MessageList } from './MessageList';
import { InputArea } from './InputArea';
import { TypingIndicator } from './TypingIndicator';
import type { ConversationPanelProps } from '../../types/ideation';

export function ConversationPanel({
  messages,
  isLoading,
  onSendMessage,
  onButtonClick,
  onFormSubmit,
}: ConversationPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="conversation-panel flex-1 flex flex-col bg-gray-50 border-r border-gray-200">
      <div className="flex-1 overflow-y-auto p-4">
        <MessageList
          messages={messages}
          onButtonClick={onButtonClick}
          onFormSubmit={onFormSubmit}
          isLoading={isLoading}
        />
        <TypingIndicator isVisible={isLoading} />
        <div ref={messagesEndRef} />
      </div>

      <InputArea
        onSend={onSendMessage}
        disabled={isLoading}
        placeholder="Type your message..."
      />
    </div>
  );
}
```

### 3.5 MessageList and Message Components

```typescript
// =============================================================================
// FILE: frontend/src/components/ideation/MessageList.tsx
// =============================================================================

import React from 'react';
import { AgentMessage } from './AgentMessage';
import { UserMessage } from './UserMessage';
import type { MessageListProps } from '../../types/ideation';

export function MessageList({
  messages,
  onButtonClick,
  onFormSubmit,
  isLoading,
}: MessageListProps) {
  return (
    <div className="message-list space-y-4">
      {messages.map((message, index) => {
        const isLatest = index === messages.length - 1;

        if (message.role === 'assistant') {
          return (
            <AgentMessage
              key={message.id}
              message={message}
              onButtonClick={onButtonClick}
              onFormSubmit={onFormSubmit}
              isLatest={isLatest && !isLoading}
            />
          );
        }

        return <UserMessage key={message.id} message={message} />;
      })}
    </div>
  );
}

// =============================================================================
// FILE: frontend/src/components/ideation/AgentMessage.tsx
// =============================================================================

import React from 'react';
import { Bot } from 'lucide-react';
import { MessageText } from './MessageText';
import { ButtonGroup } from './ButtonGroup';
import { FormRenderer } from './FormRenderer';
import { SourceCitations } from './SourceCitations';
import type { AgentMessageProps } from '../../types/ideation';

export function AgentMessage({
  message,
  onButtonClick,
  onFormSubmit,
  isLatest,
}: AgentMessageProps) {
  return (
    <div className="agent-message flex gap-3">
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
          <Bot className="w-5 h-5 text-blue-600" />
        </div>
      </div>
      <div className="flex-1 space-y-3">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <MessageText content={message.content} />
        </div>

        {message.buttons && isLatest && (
          <ButtonGroup
            buttons={message.buttons}
            onSelect={onButtonClick}
            disabled={false}
            selectedId={message.buttonClicked || undefined}
          />
        )}

        {message.form && isLatest && (
          <FormRenderer
            form={message.form}
            onSubmit={(answers) => onFormSubmit(message.form!.id, answers)}
            onCancel={() => {}}
            disabled={false}
          />
        )}

        {message.webSearchResults && message.webSearchResults.length > 0 && (
          <SourceCitations sources={message.webSearchResults} />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// FILE: frontend/src/components/ideation/UserMessage.tsx
// =============================================================================

import React from 'react';
import { User } from 'lucide-react';
import type { UserMessageProps } from '../../types/ideation';

export function UserMessage({ message }: UserMessageProps) {
  return (
    <div className="user-message flex gap-3 justify-end">
      <div className="flex-1 max-w-[80%]">
        <div className="bg-blue-600 text-white rounded-lg p-4 ml-auto">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
      <div className="flex-shrink-0">
        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
          <User className="w-5 h-5 text-gray-600" />
        </div>
      </div>
    </div>
  );
}
```

### 3.6 ButtonGroup and FormRenderer

```typescript
// =============================================================================
// FILE: frontend/src/components/ideation/ButtonGroup.tsx
// =============================================================================

import React from 'react';
import type { ButtonGroupProps, ButtonOption } from '../../types/ideation';

export function ButtonGroup({
  buttons,
  onSelect,
  disabled,
  selectedId,
}: ButtonGroupProps) {
  return (
    <div className="button-group flex flex-wrap gap-2">
      {buttons.map((button) => (
        <button
          key={button.id}
          onClick={() => onSelect(button.id, button.value)}
          disabled={disabled || selectedId !== undefined}
          className={`
            px-4 py-2 rounded-lg font-medium transition-all
            ${selectedId === button.id
              ? 'bg-blue-600 text-white'
              : selectedId !== undefined
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : button.style === 'primary'
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}

// =============================================================================
// FILE: frontend/src/components/ideation/FormRenderer.tsx
// =============================================================================

import React, { useState } from 'react';
import type { FormRendererProps, FormField } from '../../types/ideation';

export function FormRenderer({
  form,
  onSubmit,
  onCancel,
  disabled,
}: FormRendererProps) {
  const [values, setValues] = useState<Record<string, unknown>>({});

  const handleFieldChange = (fieldName: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [fieldName]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
  };

  return (
    <form onSubmit={handleSubmit} className="form-renderer bg-white rounded-lg p-4 shadow-sm">
      <div className="space-y-4">
        {form.fields.map((field) => (
          <FormFieldComponent
            key={field.name}
            field={field}
            value={values[field.name]}
            onChange={(value) => handleFieldChange(field.name, value)}
            disabled={disabled}
          />
        ))}
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          disabled={disabled}
        >
          Skip
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          disabled={disabled}
        >
          Submit
        </button>
      </div>
    </form>
  );
}

function FormFieldComponent({
  field,
  value,
  onChange,
  disabled,
}: {
  field: FormField;
  value: unknown;
  onChange: (value: unknown) => void;
  disabled: boolean;
}) {
  switch (field.type) {
    case 'radio':
      return (
        <div className="form-field">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {field.label}
          </label>
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name={field.name}
                  value={option}
                  checked={value === option}
                  onChange={() => onChange(option)}
                  disabled={disabled}
                  className="text-blue-600"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>
      );

    case 'checkbox':
      return (
        <div className="form-field">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {field.label}
          </label>
          <div className="space-y-2">
            {field.options?.map((option) => (
              <label key={option} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Array.isArray(value) && value.includes(option)}
                  onChange={(e) => {
                    const current = Array.isArray(value) ? value : [];
                    if (e.target.checked) {
                      onChange([...current, option]);
                    } else {
                      onChange(current.filter((v) => v !== option));
                    }
                  }}
                  disabled={disabled}
                  className="text-blue-600 rounded"
                />
                <span>{option}</span>
              </label>
            ))}
          </div>
        </div>
      );

    case 'slider':
      return (
        <div className="form-field">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {field.label}: {value || field.min || 0}
          </label>
          <input
            type="range"
            min={field.min || 0}
            max={field.max || 100}
            value={(value as number) || field.min || 0}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            disabled={disabled}
            className="w-full"
          />
        </div>
      );

    case 'select':
      return (
        <div className="form-field">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {field.label}
          </label>
          <select
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          >
            <option value="">Select...</option>
            {field.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
      );

    default:
      return (
        <div className="form-field">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {field.label}
          </label>
          <input
            type="text"
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>
      );
  }
}
```

### 3.7 IdeaCandidatePanel

```typescript
// =============================================================================
// FILE: frontend/src/components/ideation/IdeaCandidatePanel.tsx
// =============================================================================

import React from 'react';
import { Sparkles, AlertTriangle } from 'lucide-react';
import { ConfidenceMeter } from './ConfidenceMeter';
import { ViabilityMeter } from './ViabilityMeter';
import { RisksList } from './RisksList';
import type { IdeaCandidatePanelProps } from '../../types/ideation';

const CONFIDENCE_THRESHOLD = 30; // Candidate appears at 30%
const CAPTURE_THRESHOLD = 60;    // Can capture at 60%

export function IdeaCandidatePanel({
  candidate,
  confidence,
  viability,
  risks,
  onCapture,
  onSave,
  onDiscard,
  onContinue,
  showIntervention,
}: IdeaCandidatePanelProps) {
  // Determine which state to show
  const hasCandidate = candidate !== null;
  const isForming = confidence > 0 && confidence < CONFIDENCE_THRESHOLD;
  const isActive = confidence >= CONFIDENCE_THRESHOLD && !showIntervention;
  const isWarning = showIntervention;

  return (
    <div className="idea-candidate-panel w-96 bg-white border-l border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-yellow-500" />
          Idea Candidate
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {!hasCandidate && !isForming && (
          <EmptyState />
        )}

        {isForming && (
          <FormingState confidence={confidence} threshold={CONFIDENCE_THRESHOLD} />
        )}

        {isActive && candidate && (
          <ActiveState
            candidate={candidate}
            confidence={confidence}
            viability={viability}
            risks={risks}
            onCapture={onCapture}
            onSave={onSave}
            captureEnabled={confidence >= CAPTURE_THRESHOLD}
          />
        )}

        {isWarning && candidate && (
          <WarningState
            candidate={candidate}
            viability={viability}
            risks={risks}
            onAddressRisks={() => {}}
            onPivot={() => {}}
            onContinueAnyway={onContinue}
            onDiscard={onDiscard}
          />
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="empty-state text-center py-12">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Sparkles className="w-8 h-8 text-gray-400" />
      </div>
      <h3 className="text-gray-600 font-medium mb-2">No idea yet</h3>
      <p className="text-gray-500 text-sm">
        As you explore, an idea will begin to form here
      </p>
    </div>
  );
}

function FormingState({
  confidence,
  threshold,
}: {
  confidence: number;
  threshold: number;
}) {
  const progress = (confidence / threshold) * 100;

  return (
    <div className="forming-state">
      <div className="bg-blue-50 rounded-lg p-4 mb-4">
        <h3 className="text-blue-800 font-medium mb-2">Idea Forming...</h3>
        <div className="w-full bg-blue-200 rounded-full h-2 mb-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <p className="text-blue-600 text-sm">
          {Math.round(progress)}% to candidate
        </p>
      </div>
      <p className="text-gray-500 text-sm text-center">
        Keep exploring - your idea is taking shape!
      </p>
    </div>
  );
}

function ActiveState({
  candidate,
  confidence,
  viability,
  risks,
  onCapture,
  onSave,
  captureEnabled,
}: {
  candidate: IdeaCandidate;
  confidence: number;
  viability: number;
  risks: ViabilityRisk[];
  onCapture: () => void;
  onSave: () => void;
  captureEnabled: boolean;
}) {
  return (
    <div className="active-state space-y-4">
      <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg p-4">
        <h3 className="font-semibold text-lg mb-2">{candidate.title}</h3>
        <p className="text-gray-600 text-sm">{candidate.summary}</p>
      </div>

      <div className="space-y-3">
        <ConfidenceMeter value={confidence} showLabel={true} />
        <ViabilityMeter
          value={viability}
          risks={risks}
          showWarning={viability < 50}
        />
      </div>

      {risks.length > 0 && (
        <RisksList risks={risks} maxDisplay={3} />
      )}

      <div className="flex gap-2 pt-4">
        <button
          onClick={onCapture}
          disabled={!captureEnabled}
          className={`
            flex-1 py-2 rounded-lg font-medium transition-all
            ${captureEnabled
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-200 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          Capture Idea
        </button>
        <button
          onClick={onSave}
          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Save
        </button>
      </div>

      {!captureEnabled && (
        <p className="text-xs text-gray-500 text-center">
          Continue exploring to capture ({CAPTURE_THRESHOLD}% confidence needed)
        </p>
      )}
    </div>
  );
}

function WarningState({
  candidate,
  viability,
  risks,
  onAddressRisks,
  onPivot,
  onContinueAnyway,
  onDiscard,
}: {
  candidate: IdeaCandidate;
  viability: number;
  risks: ViabilityRisk[];
  onAddressRisks: () => void;
  onPivot: () => void;
  onContinueAnyway: () => void;
  onDiscard: () => void;
}) {
  const isCritical = viability < 25;

  return (
    <div className="warning-state space-y-4">
      <div className={`
        rounded-lg p-4
        ${isCritical ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'}
      `}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={`
            w-5 h-5 mt-0.5
            ${isCritical ? 'text-red-600' : 'text-yellow-600'}
          `} />
          <div>
            <h3 className={`font-semibold ${isCritical ? 'text-red-800' : 'text-yellow-800'}`}>
              {isCritical ? 'Critical Concerns' : 'Viability Warning'}
            </h3>
            <p className={`text-sm mt-1 ${isCritical ? 'text-red-700' : 'text-yellow-700'}`}>
              This idea has significant challenges that should be addressed.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <h4 className="font-medium mb-2">{candidate.title}</h4>
        <ViabilityMeter value={viability} risks={risks} showWarning={true} />
      </div>

      <RisksList risks={risks} />

      <div className="space-y-2 pt-2">
        <button
          onClick={onAddressRisks}
          className="w-full py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Address These Challenges
        </button>
        <button
          onClick={onPivot}
          className="w-full py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Pivot Direction
        </button>
        <button
          onClick={onContinueAnyway}
          className="w-full py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
        >
          Continue Anyway
        </button>
        <button
          onClick={onDiscard}
          className="w-full py-2 text-red-600 hover:bg-red-50 rounded-lg"
        >
          Discard & Start Fresh
        </button>
      </div>
    </div>
  );
}

// Import the types needed
import type { IdeaCandidate, ViabilityRisk } from '../../types';
```

### 3.8 Meters and Indicators

```typescript
// =============================================================================
// FILE: frontend/src/components/ideation/ConfidenceMeter.tsx
// =============================================================================

import React from 'react';
import type { ConfidenceMeterProps } from '../../types/ideation';

export function ConfidenceMeter({ value, showLabel, size = 'md' }: ConfidenceMeterProps) {
  const getColor = () => {
    if (value >= 80) return 'bg-green-500';
    if (value >= 60) return 'bg-blue-500';
    if (value >= 30) return 'bg-yellow-500';
    return 'bg-gray-400';
  };

  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="confidence-meter">
      {showLabel && (
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-600">Confidence</span>
          <span className="font-medium">{value}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-200 rounded-full ${heights[size]}`}>
        <div
          className={`${getColor()} ${heights[size]} rounded-full transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// FILE: frontend/src/components/ideation/ViabilityMeter.tsx
// =============================================================================

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import type { ViabilityMeterProps } from '../../types/ideation';

export function ViabilityMeter({
  value,
  risks,
  showWarning,
  size = 'md',
}: ViabilityMeterProps) {
  const getColor = () => {
    if (value >= 75) return 'bg-green-500';
    if (value >= 50) return 'bg-yellow-500';
    if (value >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getLabel = () => {
    if (value >= 75) return 'Healthy';
    if (value >= 50) return 'Caution';
    if (value >= 25) return 'Warning';
    return 'Critical';
  };

  const heights = {
    sm: 'h-1.5',
    md: 'h-2',
    lg: 'h-3',
  };

  return (
    <div className="viability-meter">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600 flex items-center gap-1">
          Viability
          {showWarning && (
            <AlertTriangle className="w-3 h-3 text-yellow-600" />
          )}
        </span>
        <span className={`font-medium ${value < 50 ? 'text-orange-600' : ''}`}>
          {value}% ({getLabel()})
        </span>
      </div>
      <div className={`w-full bg-gray-200 rounded-full ${heights[size]}`}>
        <div
          className={`${getColor()} ${heights[size]} rounded-full transition-all duration-500`}
          style={{ width: `${value}%` }}
        />
      </div>
      {risks.length > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          {risks.length} risk{risks.length > 1 ? 's' : ''} identified
        </p>
      )}
    </div>
  );
}

// =============================================================================
// FILE: frontend/src/components/ideation/RisksList.tsx
// =============================================================================

import React, { useState } from 'react';
import { AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import type { RisksListProps, ViabilityRisk } from '../../types/ideation';

export function RisksList({ risks, maxDisplay = 5, onViewAll }: RisksListProps) {
  const [expanded, setExpanded] = useState(false);

  const displayedRisks = expanded ? risks : risks.slice(0, maxDisplay);
  const hasMore = risks.length > maxDisplay;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'text-red-600 bg-red-50';
      case 'high':
        return 'text-orange-600 bg-orange-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  if (risks.length === 0) return null;

  return (
    <div className="risks-list">
      <h4 className="text-sm font-medium text-gray-700 mb-2">Identified Risks</h4>
      <div className="space-y-2">
        {displayedRisks.map((risk, index) => (
          <div
            key={index}
            className={`rounded-lg p-3 ${getSeverityColor(risk.severity)}`}
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium capitalize">
                  {risk.riskType.replace(/_/g, ' ')}
                </p>
                <p className="text-xs mt-0.5 opacity-80">
                  {risk.description}
                </p>
                {risk.source && (
                  <a
                    href={risk.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline mt-1 inline-block"
                  >
                    Source
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-2"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              Show {risks.length - maxDisplay} more
            </>
          )}
        </button>
      )}
    </div>
  );
}
```

### 3.9 Input Area

```typescript
// =============================================================================
// FILE: frontend/src/components/ideation/InputArea.tsx
// =============================================================================

import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import type { InputAreaProps } from '../../types/ideation';

export function InputArea({ onSend, disabled, placeholder }: InputAreaProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [value]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setValue('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="input-area border-t border-gray-200 p-4 bg-white">
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none border border-gray-300 rounded-lg px-4 py-2
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:bg-gray-100 disabled:cursor-not-allowed"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !value.trim()}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700
                     disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2">
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}

// =============================================================================
// FILE: frontend/src/components/ideation/TypingIndicator.tsx
// =============================================================================

import React from 'react';
import type { TypingIndicatorProps } from '../../types/ideation';

export function TypingIndicator({ isVisible }: TypingIndicatorProps) {
  if (!isVisible) return null;

  return (
    <div className="typing-indicator flex items-center gap-2 p-4">
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
             style={{ animationDelay: '0ms' }} />
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
             style={{ animationDelay: '150ms' }} />
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
             style={{ animationDelay: '300ms' }} />
      </div>
      <span className="text-sm text-gray-500">Thinking...</span>
    </div>
  );
}
```

---
