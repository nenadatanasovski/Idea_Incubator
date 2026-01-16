# Spec 9: Frontend State & Hooks

## Overview

This specification covers state management and hooks for the Ideation Agent frontend:

- **State Management (Reducer)**: Centralized state handling for ideation sessions
- **API Hooks**: Custom hooks for API interactions
- **SSE Streaming Hook**: Real-time streaming for AI responses
- **Test Plan**: Comprehensive testing strategies
- **File Structure**: Recommended file organization
- **Implementation Order**: Phased development approach

## Dependencies

- Spec 1: Database & Data Models (TypeScript types)
- Spec 7: API Endpoints (API client functions)
- Spec 8: Frontend Components (Component implementations)

---

## 4. State Management (Reducer)

```typescript
// =============================================================================
// FILE: frontend/src/reducers/ideationReducer.ts
// =============================================================================

import type {
  IdeationStore,
  IdeationAction,
  TokenUsageInfo,
} from "../types/ideation-state";

const DEFAULT_TOKEN_USAGE: TokenUsageInfo = {
  total: 0,
  limit: 100000,
  percentUsed: 0,
  shouldHandoff: false,
};

export const initialState: IdeationStore = {
  session: {
    sessionId: null,
    profileId: "",
    status: "idle",
    entryMode: null,
    error: null,
  },
  conversation: {
    messages: [],
    isLoading: false,
    isStreaming: false,
    streamingContent: "",
    error: null,
  },
  candidate: {
    candidate: null,
    confidence: 0,
    viability: 100,
    risks: [],
    showIntervention: false,
    interventionType: null,
  },
  tokens: {
    usage: DEFAULT_TOKEN_USAGE,
    handoffPending: false,
    handoffCount: 0,
  },
};

export function ideationReducer(
  state: IdeationStore,
  action: IdeationAction,
): IdeationStore {
  switch (action.type) {
    // =========================================================================
    // Session Actions
    // =========================================================================
    case "SESSION_START":
      return {
        ...state,
        session: {
          ...state.session,
          profileId: action.payload.profileId,
          entryMode: action.payload.entryMode,
          status: "loading",
          error: null,
        },
      };

    case "SESSION_CREATED":
      return {
        ...state,
        session: {
          ...state.session,
          sessionId: action.payload.sessionId,
          status: "active",
        },
      };

    case "SESSION_ERROR":
      return {
        ...state,
        session: {
          ...state.session,
          status: "error",
          error: action.payload.error,
        },
      };

    case "SESSION_COMPLETE":
      return {
        ...state,
        session: {
          ...state.session,
          status: "completed",
        },
      };

    case "SESSION_ABANDON":
      return {
        ...state,
        session: {
          ...state.session,
          status: "abandoned",
        },
      };

    // =========================================================================
    // Message Actions
    // =========================================================================
    case "MESSAGE_SEND":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          isLoading: true,
          error: null,
        },
      };

    case "MESSAGE_STREAM_START":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          isStreaming: true,
          streamingContent: "",
        },
      };

    case "MESSAGE_STREAM_CHUNK":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          streamingContent:
            state.conversation.streamingContent + action.payload.chunk,
        },
      };

    case "MESSAGE_STREAM_END":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          messages: [...state.conversation.messages, action.payload.message],
          isLoading: false,
          isStreaming: false,
          streamingContent: "",
        },
      };

    case "MESSAGE_RECEIVED":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          messages: [...state.conversation.messages, action.payload.message],
          isLoading: false,
        },
      };

    case "MESSAGE_ERROR":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          isLoading: false,
          isStreaming: false,
          error: action.payload.error,
        },
      };

    case "BUTTON_CLICK":
      // Mark the button as clicked in the last message
      const messagesWithClick = [...state.conversation.messages];
      const lastIdx = messagesWithClick.length - 1;
      if (lastIdx >= 0 && messagesWithClick[lastIdx].role === "assistant") {
        messagesWithClick[lastIdx] = {
          ...messagesWithClick[lastIdx],
          buttonClicked: action.payload.buttonId,
        };
      }
      return {
        ...state,
        conversation: {
          ...state.conversation,
          messages: messagesWithClick,
          isLoading: true,
        },
      };

    case "FORM_SUBMIT":
      return {
        ...state,
        conversation: {
          ...state.conversation,
          isLoading: true,
        },
      };

    // =========================================================================
    // Candidate Actions
    // =========================================================================
    case "CANDIDATE_UPDATE":
      return {
        ...state,
        candidate: {
          ...state.candidate,
          candidate: action.payload.candidate,
        },
      };

    case "CANDIDATE_CLEAR":
      return {
        ...state,
        candidate: {
          ...state.candidate,
          candidate: null,
          confidence: 0,
          viability: 100,
          risks: [],
        },
      };

    case "CONFIDENCE_UPDATE":
      return {
        ...state,
        candidate: {
          ...state.candidate,
          confidence: action.payload.confidence,
        },
      };

    case "VIABILITY_UPDATE":
      return {
        ...state,
        candidate: {
          ...state.candidate,
          viability: action.payload.viability,
          risks: action.payload.risks,
        },
      };

    case "INTERVENTION_SHOW":
      return {
        ...state,
        candidate: {
          ...state.candidate,
          showIntervention: true,
          interventionType: action.payload.type,
        },
      };

    case "INTERVENTION_DISMISS":
      return {
        ...state,
        candidate: {
          ...state.candidate,
          showIntervention: false,
          interventionType: null,
        },
      };

    // =========================================================================
    // Token Actions
    // =========================================================================
    case "TOKEN_UPDATE":
      return {
        ...state,
        tokens: {
          ...state.tokens,
          usage: action.payload.usage,
        },
      };

    case "HANDOFF_PENDING":
      return {
        ...state,
        tokens: {
          ...state.tokens,
          handoffPending: true,
        },
      };

    case "HANDOFF_COMPLETE":
      return {
        ...state,
        tokens: {
          ...state.tokens,
          handoffPending: false,
          handoffCount: state.tokens.handoffCount + 1,
        },
      };

    default:
      return state;
  }
}
```

---

## 5. API Hooks

```typescript
// =============================================================================
// FILE: frontend/src/hooks/useIdeationAPI.ts
// =============================================================================

import { useCallback, useMemo } from "react";
import type { EntryMode } from "../types/ideation";

const API_BASE = "/api/ideation";

interface StartSessionResponse {
  sessionId: string;
  greeting: string;
  buttons?: ButtonOption[];
}

interface MessageResponse {
  messageId: string;
  reply: string;
  buttons?: ButtonOption[];
  form?: FormDefinition;
  candidateUpdate?: IdeaCandidate;
  confidence?: number;
  viability?: number;
  risks?: ViabilityRisk[];
  intervention?: { type: "warning" | "critical" };
  tokenUsage?: TokenUsageInfo;
}

interface CaptureResponse {
  ideaId: string;
  ideaSlug: string;
}

export function useIdeationAPI() {
  const startSession = useCallback(
    async (
      profileId: string,
      entryMode: EntryMode,
    ): Promise<StartSessionResponse> => {
      const response = await fetch(`${API_BASE}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profileId, entryMode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to start session");
      }

      return response.json();
    },
    [],
  );

  const sendMessage = useCallback(
    async (sessionId: string, message: string): Promise<MessageResponse> => {
      const response = await fetch(`${API_BASE}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to send message");
      }

      return response.json();
    },
    [],
  );

  const clickButton = useCallback(
    async (
      sessionId: string,
      buttonId: string,
      buttonValue: string,
    ): Promise<MessageResponse> => {
      const response = await fetch(`${API_BASE}/button`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, buttonId, buttonValue }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(
          error.error?.message || "Failed to process button click",
        );
      }

      return response.json();
    },
    [],
  );

  const captureIdea = useCallback(
    async (sessionId: string): Promise<CaptureResponse> => {
      const response = await fetch(`${API_BASE}/capture`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to capture idea");
      }

      return response.json();
    },
    [],
  );

  const saveForLater = useCallback(async (sessionId: string): Promise<void> => {
    const response = await fetch(`${API_BASE}/session/${sessionId}/save`, {
      method: "POST",
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || "Failed to save idea");
    }
  }, []);

  const abandonSession = useCallback(
    async (sessionId: string): Promise<void> => {
      const response = await fetch(`${API_BASE}/session/${sessionId}/abandon`, {
        method: "POST",
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || "Failed to abandon session");
      }
    },
    [],
  );

  return useMemo(
    () => ({
      startSession,
      sendMessage,
      clickButton,
      captureIdea,
      saveForLater,
      abandonSession,
    }),
    [
      startSession,
      sendMessage,
      clickButton,
      captureIdea,
      saveForLater,
      abandonSession,
    ],
  );
}

// Import types
import type {
  ButtonOption,
  FormDefinition,
  IdeaCandidate,
  ViabilityRisk,
} from "../types";
import type { TokenUsageInfo } from "../types/ideation";
```

---

## 6. SSE Streaming Hook (Optional Enhancement)

```typescript
// =============================================================================
// FILE: frontend/src/hooks/useSSEStream.ts
// =============================================================================

import { useCallback, useRef } from "react";

interface SSEStreamOptions {
  onChunk: (chunk: string) => void;
  onComplete: () => void;
  onError: (error: Error) => void;
}

export function useSSEStream() {
  const eventSourceRef = useRef<EventSource | null>(null);

  const connect = useCallback((url: string, options: SSEStreamOptions) => {
    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === "chunk") {
          options.onChunk(data.content);
        } else if (data.type === "complete") {
          options.onComplete();
          eventSource.close();
        }
      } catch (error) {
        options.onError(new Error("Failed to parse SSE data"));
      }
    };

    eventSource.onerror = () => {
      options.onError(new Error("SSE connection failed"));
      eventSource.close();
    };

    return eventSource;
  }, []);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  return { connect, disconnect };
}
```

---

## 6b. SessionHeader Component

Create file: `frontend/src/components/ideation/SessionHeader.tsx`

```typescript
import React from 'react';
import { Box, Flex, Text, IconButton, Badge, Tooltip, Progress } from '@chakra-ui/react';
import { IoClose, IoRefresh, IoSaveOutline, IoTrashOutline } from 'react-icons/io5';

interface SessionHeaderProps {
  sessionId: string;
  candidateTitle?: string;
  tokenUsage: {
    current: number;
    limit: number;
    handoffThreshold: number;
  };
  onSave: () => void;
  onDiscard: () => void;
  onClose: () => void;
  isProcessing?: boolean;
}

export function SessionHeader({
  sessionId,
  candidateTitle,
  tokenUsage,
  onSave,
  onDiscard,
  onClose,
  isProcessing = false,
}: SessionHeaderProps) {
  const usagePercentage = (tokenUsage.current / tokenUsage.limit) * 100;
  const nearHandoff = tokenUsage.current >= tokenUsage.handoffThreshold;

  return (
    <Flex
      as="header"
      px={4}
      py={3}
      bg="white"
      borderBottom="1px solid"
      borderColor="gray.200"
      align="center"
      justify="space-between"
    >
      {/* Left: Session info */}
      <Flex align="center" gap={3}>
        <Box>
          <Text fontSize="sm" fontWeight="medium" color="gray.700">
            {candidateTitle || 'Exploring ideas...'}
          </Text>
          <Text fontSize="xs" color="gray.500">
            Session: {sessionId.slice(0, 8)}...
          </Text>
        </Box>
        {isProcessing && (
          <Badge colorScheme="blue" variant="subtle">
            Thinking...
          </Badge>
        )}
      </Flex>

      {/* Center: Token usage indicator */}
      <TokenUsageIndicator
        current={tokenUsage.current}
        limit={tokenUsage.limit}
        handoffThreshold={tokenUsage.handoffThreshold}
      />

      {/* Right: Actions */}
      <Flex gap={2}>
        <Tooltip label="Save for later">
          <IconButton
            aria-label="Save for later"
            icon={<IoSaveOutline />}
            variant="ghost"
            size="sm"
            onClick={onSave}
            isDisabled={isProcessing}
          />
        </Tooltip>
        <Tooltip label="Discard & start fresh">
          <IconButton
            aria-label="Discard session"
            icon={<IoTrashOutline />}
            variant="ghost"
            size="sm"
            colorScheme="red"
            onClick={onDiscard}
            isDisabled={isProcessing}
          />
        </Tooltip>
        <Tooltip label="Close session">
          <IconButton
            aria-label="Close session"
            icon={<IoClose />}
            variant="ghost"
            size="sm"
            onClick={onClose}
          />
        </Tooltip>
      </Flex>
    </Flex>
  );
}
```

---

## 6c. TokenUsageIndicator Component

Create file: `frontend/src/components/ideation/TokenUsageIndicator.tsx`

```typescript
import React from 'react';
import { Box, Flex, Text, Progress, Tooltip, Badge } from '@chakra-ui/react';
import { IoWarning } from 'react-icons/io5';

interface TokenUsageIndicatorProps {
  current: number;
  limit: number;
  handoffThreshold: number;
  showLabel?: boolean;
}

export function TokenUsageIndicator({
  current,
  limit,
  handoffThreshold,
  showLabel = true,
}: TokenUsageIndicatorProps) {
  const usagePercentage = (current / limit) * 100;
  const handoffPercentage = (handoffThreshold / limit) * 100;
  const nearHandoff = current >= handoffThreshold;
  const overHandoff = current >= handoffThreshold * 1.1; // 10% over threshold

  // Determine color based on usage
  const getColorScheme = () => {
    if (overHandoff) return 'red';
    if (nearHandoff) return 'orange';
    if (usagePercentage > 50) return 'yellow';
    return 'green';
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}k`;
    }
    return tokens.toString();
  };

  return (
    <Tooltip
      label={
        <Box p={2}>
          <Text fontWeight="bold">Context Usage</Text>
          <Text>Current: {formatTokens(current)} tokens</Text>
          <Text>Handoff at: {formatTokens(handoffThreshold)} tokens</Text>
          <Text>Limit: {formatTokens(limit)} tokens</Text>
          {nearHandoff && (
            <Text color="orange.300" mt={2}>
              Approaching handoff threshold. Session state will be preserved.
            </Text>
          )}
        </Box>
      }
      hasArrow
      placement="bottom"
    >
      <Flex align="center" gap={2} minW="150px">
        {showLabel && (
          <Text fontSize="xs" color="gray.500" whiteSpace="nowrap">
            Context
          </Text>
        )}

        <Box flex={1} position="relative">
          <Progress
            value={usagePercentage}
            size="sm"
            colorScheme={getColorScheme()}
            borderRadius="full"
            bg="gray.100"
          />

          {/* Handoff threshold marker */}
          <Box
            position="absolute"
            top={0}
            left={`${handoffPercentage}%`}
            w="2px"
            h="100%"
            bg="orange.400"
            transform="translateX(-50%)"
          />
        </Box>

        {nearHandoff && (
          <Box color="orange.500">
            <IoWarning />
          </Box>
        )}

        <Text fontSize="xs" color="gray.500" minW="35px" textAlign="right">
          {Math.round(usagePercentage)}%
        </Text>
      </Flex>
    </Tooltip>
  );
}

/**
 * Compact version for space-constrained areas.
 */
export function TokenUsageCompact({
  current,
  limit,
  handoffThreshold,
}: Omit<TokenUsageIndicatorProps, 'showLabel'>) {
  const usagePercentage = (current / limit) * 100;
  const nearHandoff = current >= handoffThreshold;

  return (
    <Tooltip label={`${Math.round(usagePercentage)}% context used`}>
      <Badge
        colorScheme={nearHandoff ? 'orange' : usagePercentage > 50 ? 'yellow' : 'green'}
        variant="subtle"
        display="flex"
        alignItems="center"
        gap={1}
      >
        {nearHandoff && <IoWarning />}
        {Math.round(usagePercentage)}%
      </Badge>
    </Tooltip>
  );
}
```

---

## 6d. SourceCitations Component

Create file: `frontend/src/components/ideation/SourceCitations.tsx`

```typescript
import React, { useState } from 'react';
import {
  Box,
  Flex,
  Text,
  Link,
  Badge,
  Collapse,
  IconButton,
  VStack,
  HStack,
  Tooltip,
} from '@chakra-ui/react';
import { IoChevronDown, IoChevronUp, IoOpenOutline, IoGlobeOutline } from 'react-icons/io5';

interface Citation {
  title: string;
  url: string;
  snippet?: string;
  source: string;
  relevance?: 'high' | 'medium' | 'low';
}

interface SourceCitationsProps {
  citations: Citation[];
  title?: string;
  maxVisible?: number;
}

export function SourceCitations({
  citations,
  title = 'Sources',
  maxVisible = 3,
}: SourceCitationsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (citations.length === 0) return null;

  const visibleCitations = isExpanded ? citations : citations.slice(0, maxVisible);
  const hasMore = citations.length > maxVisible;

  return (
    <Box
      bg="gray.50"
      borderRadius="md"
      p={3}
      mt={3}
      border="1px solid"
      borderColor="gray.200"
    >
      <Flex justify="space-between" align="center" mb={2}>
        <HStack>
          <IoGlobeOutline color="gray" />
          <Text fontSize="sm" fontWeight="medium" color="gray.700">
            {title}
          </Text>
          <Badge colorScheme="gray" variant="subtle">
            {citations.length}
          </Badge>
        </HStack>

        {hasMore && (
          <IconButton
            aria-label={isExpanded ? 'Show less' : 'Show more'}
            icon={isExpanded ? <IoChevronUp /> : <IoChevronDown />}
            size="xs"
            variant="ghost"
            onClick={() => setIsExpanded(!isExpanded)}
          />
        )}
      </Flex>

      <VStack align="stretch" spacing={2}>
        {visibleCitations.map((citation, index) => (
          <CitationItem key={`${citation.url}-${index}`} citation={citation} />
        ))}
      </VStack>

      {hasMore && !isExpanded && (
        <Text
          fontSize="xs"
          color="blue.500"
          mt={2}
          cursor="pointer"
          onClick={() => setIsExpanded(true)}
        >
          Show {citations.length - maxVisible} more sources...
        </Text>
      )}
    </Box>
  );
}

interface CitationItemProps {
  citation: Citation;
}

function CitationItem({ citation }: CitationItemProps) {
  const [showSnippet, setShowSnippet] = useState(false);

  const getRelevanceColor = (relevance?: string) => {
    switch (relevance) {
      case 'high':
        return 'green';
      case 'medium':
        return 'yellow';
      case 'low':
        return 'gray';
      default:
        return 'gray';
    }
  };

  return (
    <Box
      p={2}
      bg="white"
      borderRadius="sm"
      border="1px solid"
      borderColor="gray.100"
      _hover={{ borderColor: 'gray.300' }}
    >
      <Flex justify="space-between" align="start">
        <Box flex={1}>
          <HStack spacing={2} mb={1}>
            <Link
              href={citation.url}
              isExternal
              fontSize="sm"
              fontWeight="medium"
              color="blue.600"
              display="flex"
              alignItems="center"
              gap={1}
              noOfLines={1}
            >
              {citation.title}
              <IoOpenOutline size={12} />
            </Link>
          </HStack>

          <Text fontSize="xs" color="gray.500" mb={1}>
            {citation.source}
          </Text>

          {citation.snippet && (
            <Collapse in={showSnippet}>
              <Text fontSize="xs" color="gray.600" mt={1}>
                {citation.snippet}
              </Text>
            </Collapse>
          )}
        </Box>

        <HStack>
          {citation.relevance && (
            <Tooltip label={`${citation.relevance} relevance`}>
              <Badge colorScheme={getRelevanceColor(citation.relevance)} size="sm">
                {citation.relevance}
              </Badge>
            </Tooltip>
          )}

          {citation.snippet && (
            <IconButton
              aria-label={showSnippet ? 'Hide snippet' : 'Show snippet'}
              icon={showSnippet ? <IoChevronUp /> : <IoChevronDown />}
              size="xs"
              variant="ghost"
              onClick={() => setShowSnippet(!showSnippet)}
            />
          )}
        </HStack>
      </Flex>
    </Box>
  );
}

/**
 * Inline citation link for use within message text.
 */
export function InlineCitation({
  citation,
  index,
}: {
  citation: Citation;
  index: number;
}) {
  return (
    <Tooltip
      label={
        <Box>
          <Text fontWeight="bold">{citation.title}</Text>
          <Text fontSize="xs">{citation.source}</Text>
          {citation.snippet && (
            <Text fontSize="xs" mt={1} noOfLines={2}>
              {citation.snippet}
            </Text>
          )}
        </Box>
      }
      hasArrow
    >
      <Link
        href={citation.url}
        isExternal
        color="blue.500"
        fontSize="xs"
        fontWeight="medium"
        px={1}
        py={0.5}
        bg="blue.50"
        borderRadius="sm"
        _hover={{ bg: 'blue.100' }}
      >
        [{index + 1}]
      </Link>
    </Tooltip>
  );
}
```

---

## 6e. StreamingText Component

Create file: `frontend/src/components/ideation/StreamingText.tsx`

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { Text, Box, Flex, keyframes } from '@chakra-ui/react';
import ReactMarkdown from 'react-markdown';

interface StreamingTextProps {
  text: string;
  isStreaming?: boolean;
  typingSpeed?: number; // ms per character
  showCursor?: boolean;
  onComplete?: () => void;
}

// Blinking cursor animation
const blink = keyframes`
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
`;

export function StreamingText({
  text,
  isStreaming = false,
  typingSpeed = 10,
  showCursor = true,
  onComplete,
}: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const indexRef = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isStreaming) {
      // Not streaming, show full text immediately
      setDisplayedText(text);
      setIsComplete(true);
      return;
    }

    // Reset for new streaming
    setDisplayedText('');
    setIsComplete(false);
    indexRef.current = 0;

    // Start typing animation
    intervalRef.current = setInterval(() => {
      if (indexRef.current < text.length) {
        setDisplayedText(text.slice(0, indexRef.current + 1));
        indexRef.current++;
      } else {
        // Typing complete
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
        setIsComplete(true);
        onComplete?.();
      }
    }, typingSpeed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [text, isStreaming, typingSpeed, onComplete]);

  // Update displayed text when source text changes during streaming
  useEffect(() => {
    if (isStreaming && text.length > displayedText.length) {
      // New content arrived, continue from current position
      indexRef.current = displayedText.length;
    }
  }, [text, isStreaming, displayedText.length]);

  return (
    <Box>
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <Text mb={2}>{children}</Text>
          ),
        }}
      >
        {displayedText}
      </ReactMarkdown>

      {showCursor && isStreaming && !isComplete && (
        <Box
          as="span"
          display="inline-block"
          w="2px"
          h="1em"
          bg="blue.500"
          ml={1}
          animation={`${blink} 1s infinite`}
          verticalAlign="text-bottom"
        />
      )}
    </Box>
  );
}

/**
 * Hook for managing streaming text state.
 */
export function useStreamingText() {
  const [text, setText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const startStream = () => {
    setText('');
    setIsStreaming(true);
  };

  const appendChunk = (chunk: string) => {
    setText((prev) => prev + chunk);
  };

  const endStream = () => {
    setIsStreaming(false);
  };

  const reset = () => {
    setText('');
    setIsStreaming(false);
  };

  return {
    text,
    isStreaming,
    startStream,
    appendChunk,
    endStream,
    reset,
  };
}
```

---

## 6f. ExistingIdeaModal Component

Create file: `frontend/src/components/ideation/ExistingIdeaModal.tsx`

```typescript
import React from 'react';
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  VStack,
  Box,
  Text,
  Badge,
  Flex,
  Divider,
} from '@chakra-ui/react';
import { IoArrowForward, IoAdd, IoTime } from 'react-icons/io5';

interface ExistingSession {
  id: string;
  candidateTitle?: string;
  lastMessageAt: string;
  messageCount: number;
  confidence?: number;
  viability?: number;
}

interface ExistingIdeaModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingSession: ExistingSession;
  onContinue: (sessionId: string) => void;
  onStartFresh: () => void;
}

export function ExistingIdeaModal({
  isOpen,
  onClose,
  existingSession,
  onContinue,
  onStartFresh,
}: ExistingIdeaModalProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md" isCentered>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <Text fontSize="lg">You Have an Active Session</Text>
          <Text fontSize="sm" fontWeight="normal" color="gray.500" mt={1}>
            One idea at a time keeps focus sharp
          </Text>
        </ModalHeader>

        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* Existing session card */}
            <Box
              p={4}
              bg="blue.50"
              borderRadius="md"
              border="1px solid"
              borderColor="blue.200"
            >
              <Flex justify="space-between" align="start" mb={2}>
                <Text fontWeight="medium" color="gray.700">
                  {existingSession.candidateTitle || 'Exploring ideas...'}
                </Text>
                <Flex align="center" gap={1} color="gray.500">
                  <IoTime />
                  <Text fontSize="xs">{formatTime(existingSession.lastMessageAt)}</Text>
                </Flex>
              </Flex>

              <Flex gap={3} mb={3}>
                <Badge colorScheme="gray">
                  {existingSession.messageCount} messages
                </Badge>
                {existingSession.confidence !== undefined && (
                  <Badge colorScheme="blue">
                    {existingSession.confidence}% confident
                  </Badge>
                )}
                {existingSession.viability !== undefined && (
                  <Badge colorScheme="green">
                    {existingSession.viability}% viable
                  </Badge>
                )}
              </Flex>

              <Button
                colorScheme="blue"
                size="sm"
                width="full"
                rightIcon={<IoArrowForward />}
                onClick={() => onContinue(existingSession.id)}
              >
                Continue This Session
              </Button>
            </Box>

            <Divider />

            <Text fontSize="sm" color="gray.600" textAlign="center">
              Or if you want to explore something completely different:
            </Text>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button
            colorScheme="gray"
            variant="outline"
            leftIcon={<IoAdd />}
            onClick={onStartFresh}
          >
            Start Fresh (discard current)
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

/**
 * Hook to check for existing sessions.
 */
export function useExistingSessionCheck(profileId: string) {
  const [existingSession, setExistingSession] = useState<ExistingSession | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    async function checkForExisting() {
      try {
        const response = await fetch(
          `/api/ideation/sessions?profileId=${profileId}&status=active`
        );
        const data = await response.json();

        if (data.sessions && data.sessions.length > 0) {
          setExistingSession(data.sessions[0]);
        }
      } catch (error) {
        console.error('Failed to check for existing sessions:', error);
      } finally {
        setIsChecking(false);
      }
    }

    checkForExisting();
  }, [profileId]);

  return { existingSession, isChecking };
}
```

---

## 7. Test Plan

### 7.1 Component Unit Tests

```typescript
// =============================================================================
// FILE: frontend/src/__tests__/ideation/IdeationEntryModal.test.tsx
// =============================================================================

import { render, screen, fireEvent } from '@testing-library/react';
import { IdeationEntryModal } from '../../components/ideation/IdeationEntryModal';

describe('IdeationEntryModal', () => {
  const mockOnSelect = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // RENDERING TESTS
  // ===========================================================================

  test('PASS: Renders modal when isOpen is true', () => {
    render(
      <IdeationEntryModal
        isOpen={true}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Start Your Ideation Journey')).toBeInTheDocument();
  });

  test('PASS: Does not render when isOpen is false', () => {
    render(
      <IdeationEntryModal
        isOpen={false}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText('Start Your Ideation Journey')).not.toBeInTheDocument();
  });

  test('PASS: Shows both entry options', () => {
    render(
      <IdeationEntryModal
        isOpen={true}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('I have an idea')).toBeInTheDocument();
    expect(screen.getByText('Help me discover')).toBeInTheDocument();
  });

  // ===========================================================================
  // INTERACTION TESTS
  // ===========================================================================

  test('PASS: Clicking "I have an idea" calls onSelect with "have_idea"', () => {
    render(
      <IdeationEntryModal
        isOpen={true}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText('I have an idea'));
    expect(mockOnSelect).toHaveBeenCalledWith('have_idea');
  });

  test('PASS: Clicking "Help me discover" calls onSelect with "discover"', () => {
    render(
      <IdeationEntryModal
        isOpen={true}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText('Help me discover'));
    expect(mockOnSelect).toHaveBeenCalledWith('discover');
  });

  test('PASS: Clicking cancel calls onClose', () => {
    render(
      <IdeationEntryModal
        isOpen={true}
        onSelect={mockOnSelect}
        onClose={mockOnClose}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });
});

// =============================================================================
// FILE: frontend/src/__tests__/ideation/ButtonGroup.test.tsx
// =============================================================================

import { render, screen, fireEvent } from '@testing-library/react';
import { ButtonGroup } from '../../components/ideation/ButtonGroup';

describe('ButtonGroup', () => {
  const mockButtons = [
    { id: 'btn_1', label: 'Option A', value: 'a', style: 'primary' as const },
    { id: 'btn_2', label: 'Option B', value: 'b', style: 'secondary' as const },
    { id: 'btn_3', label: 'Option C', value: 'c', style: 'secondary' as const },
  ];
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // RENDERING TESTS
  // ===========================================================================

  test('PASS: Renders all buttons', () => {
    render(
      <ButtonGroup
        buttons={mockButtons}
        onSelect={mockOnSelect}
        disabled={false}
      />
    );

    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
    expect(screen.getByText('Option C')).toBeInTheDocument();
  });

  test('PASS: Primary button has distinct styling', () => {
    render(
      <ButtonGroup
        buttons={mockButtons}
        onSelect={mockOnSelect}
        disabled={false}
      />
    );

    const primaryBtn = screen.getByText('Option A');
    expect(primaryBtn).toHaveClass('bg-blue-100');
  });

  // ===========================================================================
  // INTERACTION TESTS
  // ===========================================================================

  test('PASS: Clicking button calls onSelect with id and value', () => {
    render(
      <ButtonGroup
        buttons={mockButtons}
        onSelect={mockOnSelect}
        disabled={false}
      />
    );

    fireEvent.click(screen.getByText('Option A'));
    expect(mockOnSelect).toHaveBeenCalledWith('btn_1', 'a');
  });

  test('PASS: Buttons are disabled when disabled prop is true', () => {
    render(
      <ButtonGroup
        buttons={mockButtons}
        onSelect={mockOnSelect}
        disabled={true}
      />
    );

    const button = screen.getByText('Option A');
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(mockOnSelect).not.toHaveBeenCalled();
  });

  test('PASS: After selection, other buttons are disabled', () => {
    render(
      <ButtonGroup
        buttons={mockButtons}
        onSelect={mockOnSelect}
        disabled={false}
        selectedId="btn_1"
      />
    );

    const optionB = screen.getByText('Option B');
    expect(optionB).toBeDisabled();
  });

  test('PASS: Selected button has highlight styling', () => {
    render(
      <ButtonGroup
        buttons={mockButtons}
        onSelect={mockOnSelect}
        disabled={false}
        selectedId="btn_1"
      />
    );

    const selectedBtn = screen.getByText('Option A');
    expect(selectedBtn).toHaveClass('bg-blue-600', 'text-white');
  });
});

// =============================================================================
// FILE: frontend/src/__tests__/ideation/ConfidenceMeter.test.tsx
// =============================================================================

import { render, screen } from '@testing-library/react';
import { ConfidenceMeter } from '../../components/ideation/ConfidenceMeter';

describe('ConfidenceMeter', () => {
  // ===========================================================================
  // RENDERING TESTS
  // ===========================================================================

  test('PASS: Renders with value 0', () => {
    render(<ConfidenceMeter value={0} showLabel={true} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  test('PASS: Renders with value 100', () => {
    render(<ConfidenceMeter value={100} showLabel={true} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  test('PASS: Shows label when showLabel is true', () => {
    render(<ConfidenceMeter value={50} showLabel={true} />);
    expect(screen.getByText('Confidence')).toBeInTheDocument();
  });

  test('PASS: Hides label when showLabel is false', () => {
    render(<ConfidenceMeter value={50} showLabel={false} />);
    expect(screen.queryByText('Confidence')).not.toBeInTheDocument();
  });

  // ===========================================================================
  // COLOR TESTS
  // ===========================================================================

  test('PASS: Green color for high confidence (80+)', () => {
    const { container } = render(<ConfidenceMeter value={85} showLabel={false} />);
    const progressBar = container.querySelector('.bg-green-500');
    expect(progressBar).toBeInTheDocument();
  });

  test('PASS: Blue color for good confidence (60-79)', () => {
    const { container } = render(<ConfidenceMeter value={65} showLabel={false} />);
    const progressBar = container.querySelector('.bg-blue-500');
    expect(progressBar).toBeInTheDocument();
  });

  test('PASS: Yellow color for moderate confidence (30-59)', () => {
    const { container } = render(<ConfidenceMeter value={45} showLabel={false} />);
    const progressBar = container.querySelector('.bg-yellow-500');
    expect(progressBar).toBeInTheDocument();
  });

  test('PASS: Gray color for low confidence (<30)', () => {
    const { container } = render(<ConfidenceMeter value={15} showLabel={false} />);
    const progressBar = container.querySelector('.bg-gray-400');
    expect(progressBar).toBeInTheDocument();
  });

  // ===========================================================================
  // SIZE TESTS
  // ===========================================================================

  test('PASS: Small size applies correct height', () => {
    const { container } = render(<ConfidenceMeter value={50} showLabel={false} size="sm" />);
    expect(container.querySelector('.h-1\\.5')).toBeInTheDocument();
  });

  test('PASS: Medium size applies correct height', () => {
    const { container } = render(<ConfidenceMeter value={50} showLabel={false} size="md" />);
    expect(container.querySelector('.h-2')).toBeInTheDocument();
  });

  test('PASS: Large size applies correct height', () => {
    const { container } = render(<ConfidenceMeter value={50} showLabel={false} size="lg" />);
    expect(container.querySelector('.h-3')).toBeInTheDocument();
  });
});

// =============================================================================
// FILE: frontend/src/__tests__/ideation/ViabilityMeter.test.tsx
// =============================================================================

import { render, screen } from '@testing-library/react';
import { ViabilityMeter } from '../../components/ideation/ViabilityMeter';

describe('ViabilityMeter', () => {
  const mockRisks = [
    { riskType: 'saturated_market', severity: 'high', description: 'Many competitors', source: 'url' },
    { riskType: 'unrealistic', severity: 'medium', description: 'Limited resources', source: null },
  ];

  // ===========================================================================
  // RENDERING TESTS
  // ===========================================================================

  test('PASS: Shows "Healthy" label for 75+ viability', () => {
    render(<ViabilityMeter value={80} risks={[]} showWarning={false} />);
    expect(screen.getByText(/Healthy/)).toBeInTheDocument();
  });

  test('PASS: Shows "Caution" label for 50-74 viability', () => {
    render(<ViabilityMeter value={60} risks={[]} showWarning={false} />);
    expect(screen.getByText(/Caution/)).toBeInTheDocument();
  });

  test('PASS: Shows "Warning" label for 25-49 viability', () => {
    render(<ViabilityMeter value={35} risks={[]} showWarning={true} />);
    expect(screen.getByText(/Warning/)).toBeInTheDocument();
  });

  test('PASS: Shows "Critical" label for <25 viability', () => {
    render(<ViabilityMeter value={15} risks={[]} showWarning={true} />);
    expect(screen.getByText(/Critical/)).toBeInTheDocument();
  });

  // ===========================================================================
  // WARNING INDICATOR TESTS
  // ===========================================================================

  test('PASS: Shows warning icon when showWarning is true', () => {
    const { container } = render(
      <ViabilityMeter value={40} risks={mockRisks} showWarning={true} />
    );
    // AlertTriangle icon should be present
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  test('PASS: Hides warning icon when showWarning is false', () => {
    render(<ViabilityMeter value={80} risks={[]} showWarning={false} />);
    // No warning indicator in healthy state
    expect(screen.queryByText('AlertTriangle')).not.toBeInTheDocument();
  });

  // ===========================================================================
  // RISKS COUNT TESTS
  // ===========================================================================

  test('PASS: Shows risk count when risks present', () => {
    render(<ViabilityMeter value={40} risks={mockRisks} showWarning={true} />);
    expect(screen.getByText('2 risks identified')).toBeInTheDocument();
  });

  test('PASS: Shows singular "risk" for single risk', () => {
    render(<ViabilityMeter value={40} risks={[mockRisks[0]]} showWarning={true} />);
    expect(screen.getByText('1 risk identified')).toBeInTheDocument();
  });

  test('PASS: Hides risk count when no risks', () => {
    render(<ViabilityMeter value={80} risks={[]} showWarning={false} />);
    expect(screen.queryByText(/risks? identified/)).not.toBeInTheDocument();
  });
});

// =============================================================================
// FILE: frontend/src/__tests__/ideation/InputArea.test.tsx
// =============================================================================

import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InputArea } from '../../components/ideation/InputArea';

describe('InputArea', () => {
  const mockOnSend = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // RENDERING TESTS
  // ===========================================================================

  test('PASS: Renders textarea and send button', () => {
    render(<InputArea onSend={mockOnSend} disabled={false} />);

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  test('PASS: Shows placeholder text', () => {
    render(
      <InputArea
        onSend={mockOnSend}
        disabled={false}
        placeholder="Type here..."
      />
    );

    expect(screen.getByPlaceholderText('Type here...')).toBeInTheDocument();
  });

  // ===========================================================================
  // INTERACTION TESTS
  // ===========================================================================

  test('PASS: Typing updates input value', async () => {
    render(<InputArea onSend={mockOnSend} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'Hello');

    expect(textarea).toHaveValue('Hello');
  });

  test('PASS: Clicking send button calls onSend with message', async () => {
    render(<InputArea onSend={mockOnSend} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'Test message');

    fireEvent.click(screen.getByRole('button'));

    expect(mockOnSend).toHaveBeenCalledWith('Test message');
  });

  test('PASS: Enter key sends message', async () => {
    render(<InputArea onSend={mockOnSend} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'Test message{enter}');

    expect(mockOnSend).toHaveBeenCalledWith('Test message');
  });

  test('PASS: Shift+Enter does not send, adds newline', async () => {
    render(<InputArea onSend={mockOnSend} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'Line 1{shift>}{enter}{/shift}Line 2');

    expect(mockOnSend).not.toHaveBeenCalled();
    expect(textarea.value).toContain('Line 1');
  });

  test('PASS: Input clears after sending', async () => {
    render(<InputArea onSend={mockOnSend} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, 'Test{enter}');

    expect(textarea).toHaveValue('');
  });

  // ===========================================================================
  // DISABLED STATE TESTS
  // ===========================================================================

  test('PASS: Input is disabled when disabled prop is true', () => {
    render(<InputArea onSend={mockOnSend} disabled={true} />);

    expect(screen.getByRole('textbox')).toBeDisabled();
    expect(screen.getByRole('button')).toBeDisabled();
  });

  test('PASS: Send button disabled when input is empty', () => {
    render(<InputArea onSend={mockOnSend} disabled={false} />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  test('PASS: Whitespace-only input does not enable send', async () => {
    render(<InputArea onSend={mockOnSend} disabled={false} />);

    const textarea = screen.getByRole('textbox');
    await userEvent.type(textarea, '   ');

    expect(screen.getByRole('button')).toBeDisabled();
  });
});

// =============================================================================
// FILE: frontend/src/__tests__/ideation/RisksList.test.tsx
// =============================================================================

import { render, screen, fireEvent } from '@testing-library/react';
import { RisksList } from '../../components/ideation/RisksList';

describe('RisksList', () => {
  const mockRisks = [
    { riskType: 'saturated_market', severity: 'critical', description: 'Too many competitors', source: 'http://example.com' },
    { riskType: 'unrealistic', severity: 'high', description: 'Beyond capacity', source: null },
    { riskType: 'wrong_timing', severity: 'medium', description: 'Market not ready', source: 'http://example2.com' },
    { riskType: 'too_complex', severity: 'low', description: 'Multiple challenges', source: null },
  ];

  // ===========================================================================
  // RENDERING TESTS
  // ===========================================================================

  test('PASS: Renders nothing when risks array is empty', () => {
    const { container } = render(<RisksList risks={[]} />);
    expect(container.firstChild).toBeNull();
  });

  test('PASS: Renders all risks when under maxDisplay', () => {
    render(<RisksList risks={mockRisks.slice(0, 2)} maxDisplay={5} />);

    expect(screen.getByText('saturated market')).toBeInTheDocument();
    expect(screen.getByText('unrealistic')).toBeInTheDocument();
  });

  test('PASS: Truncates at maxDisplay', () => {
    render(<RisksList risks={mockRisks} maxDisplay={2} />);

    expect(screen.getByText('saturated market')).toBeInTheDocument();
    expect(screen.getByText('unrealistic')).toBeInTheDocument();
    expect(screen.queryByText('wrong timing')).not.toBeInTheDocument();
  });

  // ===========================================================================
  // SEVERITY STYLING TESTS
  // ===========================================================================

  test('PASS: Critical severity has red styling', () => {
    render(<RisksList risks={[mockRisks[0]]} />);
    const riskItem = screen.getByText('Too many competitors').closest('div');
    expect(riskItem?.parentElement).toHaveClass('text-red-600');
  });

  test('PASS: High severity has orange styling', () => {
    render(<RisksList risks={[mockRisks[1]]} />);
    const riskItem = screen.getByText('Beyond capacity').closest('div');
    expect(riskItem?.parentElement).toHaveClass('text-orange-600');
  });

  // ===========================================================================
  // EXPAND/COLLAPSE TESTS
  // ===========================================================================

  test('PASS: Shows "Show more" when truncated', () => {
    render(<RisksList risks={mockRisks} maxDisplay={2} />);
    expect(screen.getByText('Show 2 more')).toBeInTheDocument();
  });

  test('PASS: Clicking "Show more" reveals all risks', () => {
    render(<RisksList risks={mockRisks} maxDisplay={2} />);

    fireEvent.click(screen.getByText('Show 2 more'));

    expect(screen.getByText('wrong timing')).toBeInTheDocument();
    expect(screen.getByText('too complex')).toBeInTheDocument();
  });

  test('PASS: Shows "Show less" after expanding', () => {
    render(<RisksList risks={mockRisks} maxDisplay={2} />);

    fireEvent.click(screen.getByText('Show 2 more'));

    expect(screen.getByText('Show less')).toBeInTheDocument();
  });

  // ===========================================================================
  // SOURCE LINK TESTS
  // ===========================================================================

  test('PASS: Shows source link when source is provided', () => {
    render(<RisksList risks={[mockRisks[0]]} />);
    expect(screen.getByText('Source')).toBeInTheDocument();
  });

  test('PASS: No source link when source is null', () => {
    render(<RisksList risks={[mockRisks[1]]} />);
    expect(screen.queryByText('Source')).not.toBeInTheDocument();
  });
});
```

### 7.2 Reducer Tests

```typescript
// =============================================================================
// FILE: frontend/src/__tests__/ideation/ideationReducer.test.ts
// =============================================================================

import { ideationReducer, initialState } from "../../reducers/ideationReducer";

describe("ideationReducer", () => {
  // ===========================================================================
  // SESSION ACTIONS
  // ===========================================================================

  describe("SESSION_START", () => {
    test("PASS: Sets status to loading and stores profile", () => {
      const action = {
        type: "SESSION_START" as const,
        payload: { profileId: "profile_123", entryMode: "discover" as const },
      };

      const result = ideationReducer(initialState, action);

      expect(result.session.status).toBe("loading");
      expect(result.session.profileId).toBe("profile_123");
      expect(result.session.entryMode).toBe("discover");
    });
  });

  describe("SESSION_CREATED", () => {
    test("PASS: Sets sessionId and status to active", () => {
      const startState = {
        ...initialState,
        session: { ...initialState.session, status: "loading" as const },
      };

      const action = {
        type: "SESSION_CREATED" as const,
        payload: { sessionId: "session_abc", greeting: "Hello!" },
      };

      const result = ideationReducer(startState, action);

      expect(result.session.sessionId).toBe("session_abc");
      expect(result.session.status).toBe("active");
    });
  });

  describe("SESSION_ERROR", () => {
    test("PASS: Sets status to error and stores message", () => {
      const action = {
        type: "SESSION_ERROR" as const,
        payload: { error: "Connection failed" },
      };

      const result = ideationReducer(initialState, action);

      expect(result.session.status).toBe("error");
      expect(result.session.error).toBe("Connection failed");
    });
  });

  // ===========================================================================
  // MESSAGE ACTIONS
  // ===========================================================================

  describe("MESSAGE_SEND", () => {
    test("PASS: Sets isLoading to true", () => {
      const action = {
        type: "MESSAGE_SEND" as const,
        payload: { content: "Hello" },
      };

      const result = ideationReducer(initialState, action);

      expect(result.conversation.isLoading).toBe(true);
      expect(result.conversation.error).toBeNull();
    });
  });

  describe("MESSAGE_RECEIVED", () => {
    test("PASS: Adds message to messages array", () => {
      const message = {
        id: "msg_1",
        sessionId: "session_1",
        role: "assistant" as const,
        content: "Hi there",
        buttons: null,
        form: null,
        createdAt: "2025-01-01T00:00:00Z",
      };

      const action = {
        type: "MESSAGE_RECEIVED" as const,
        payload: { message },
      };

      const result = ideationReducer(initialState, action);

      expect(result.conversation.messages).toHaveLength(1);
      expect(result.conversation.messages[0]).toEqual(message);
      expect(result.conversation.isLoading).toBe(false);
    });
  });

  describe("BUTTON_CLICK", () => {
    test("PASS: Marks button as clicked on last message", () => {
      const stateWithMessage = {
        ...initialState,
        conversation: {
          ...initialState.conversation,
          messages: [
            {
              id: "msg_1",
              sessionId: "session_1",
              role: "assistant" as const,
              content: "Choose one",
              buttons: [
                {
                  id: "btn_1",
                  label: "A",
                  value: "a",
                  style: "primary" as const,
                },
              ],
              form: null,
              createdAt: "2025-01-01T00:00:00Z",
            },
          ],
        },
      };

      const action = {
        type: "BUTTON_CLICK" as const,
        payload: { buttonId: "btn_1", buttonValue: "a" },
      };

      const result = ideationReducer(stateWithMessage, action);

      expect(result.conversation.messages[0].buttonClicked).toBe("btn_1");
      expect(result.conversation.isLoading).toBe(true);
    });
  });

  // ===========================================================================
  // CANDIDATE ACTIONS
  // ===========================================================================

  describe("CANDIDATE_UPDATE", () => {
    test("PASS: Updates candidate in state", () => {
      const candidate = {
        id: "cand_1",
        sessionId: "session_1",
        title: "New Idea",
        summary: "Summary",
        status: "active" as const,
        confidence: 50,
        viability: 70,
        userSuggested: false,
        version: 1,
        createdAt: "2025-01-01T00:00:00Z",
        updatedAt: "2025-01-01T00:00:00Z",
      };

      const action = {
        type: "CANDIDATE_UPDATE" as const,
        payload: { candidate },
      };

      const result = ideationReducer(initialState, action);

      expect(result.candidate.candidate).toEqual(candidate);
    });
  });

  describe("CANDIDATE_CLEAR", () => {
    test("PASS: Resets candidate state", () => {
      const stateWithCandidate = {
        ...initialState,
        candidate: {
          ...initialState.candidate,
          candidate: { id: "cand_1" } as any,
          confidence: 60,
          viability: 40,
          risks: [
            {
              riskType: "test",
              severity: "high",
              description: "desc",
              source: null,
            },
          ],
        },
      };

      const action = { type: "CANDIDATE_CLEAR" as const };

      const result = ideationReducer(stateWithCandidate, action);

      expect(result.candidate.candidate).toBeNull();
      expect(result.candidate.confidence).toBe(0);
      expect(result.candidate.viability).toBe(100);
      expect(result.candidate.risks).toHaveLength(0);
    });
  });

  describe("CONFIDENCE_UPDATE", () => {
    test("PASS: Updates confidence value", () => {
      const action = {
        type: "CONFIDENCE_UPDATE" as const,
        payload: { confidence: 45 },
      };

      const result = ideationReducer(initialState, action);

      expect(result.candidate.confidence).toBe(45);
    });
  });

  describe("VIABILITY_UPDATE", () => {
    test("PASS: Updates viability and risks", () => {
      const risks = [
        {
          riskType: "saturated_market",
          severity: "high" as const,
          description: "Many competitors",
          source: null,
        },
      ];

      const action = {
        type: "VIABILITY_UPDATE" as const,
        payload: { viability: 35, risks },
      };

      const result = ideationReducer(initialState, action);

      expect(result.candidate.viability).toBe(35);
      expect(result.candidate.risks).toEqual(risks);
    });
  });

  // ===========================================================================
  // INTERVENTION ACTIONS
  // ===========================================================================

  describe("INTERVENTION_SHOW", () => {
    test("PASS: Shows intervention with type", () => {
      const action = {
        type: "INTERVENTION_SHOW" as const,
        payload: { type: "warning" as const },
      };

      const result = ideationReducer(initialState, action);

      expect(result.candidate.showIntervention).toBe(true);
      expect(result.candidate.interventionType).toBe("warning");
    });
  });

  describe("INTERVENTION_DISMISS", () => {
    test("PASS: Hides intervention", () => {
      const stateWithIntervention = {
        ...initialState,
        candidate: {
          ...initialState.candidate,
          showIntervention: true,
          interventionType: "critical" as const,
        },
      };

      const action = { type: "INTERVENTION_DISMISS" as const };

      const result = ideationReducer(stateWithIntervention, action);

      expect(result.candidate.showIntervention).toBe(false);
      expect(result.candidate.interventionType).toBeNull();
    });
  });

  // ===========================================================================
  // TOKEN ACTIONS
  // ===========================================================================

  describe("TOKEN_UPDATE", () => {
    test("PASS: Updates token usage", () => {
      const usage = {
        total: 50000,
        limit: 100000,
        percentUsed: 50,
        shouldHandoff: false,
      };

      const action = {
        type: "TOKEN_UPDATE" as const,
        payload: { usage },
      };

      const result = ideationReducer(initialState, action);

      expect(result.tokens.usage).toEqual(usage);
    });
  });

  describe("HANDOFF_COMPLETE", () => {
    test("PASS: Increments handoff count and clears pending", () => {
      const stateWithPendingHandoff = {
        ...initialState,
        tokens: {
          ...initialState.tokens,
          handoffPending: true,
          handoffCount: 1,
        },
      };

      const action = { type: "HANDOFF_COMPLETE" as const };

      const result = ideationReducer(stateWithPendingHandoff, action);

      expect(result.tokens.handoffPending).toBe(false);
      expect(result.tokens.handoffCount).toBe(2);
    });
  });
});
```

### 7.3 Integration Tests

```typescript
// =============================================================================
// FILE: frontend/src/__tests__/ideation/IdeationSession.integration.test.tsx
// =============================================================================

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdeationSession } from '../../components/ideation/IdeationSession';

// Mock the API hook
jest.mock('../../hooks/useIdeationAPI', () => ({
  useIdeationAPI: () => ({
    startSession: jest.fn().mockResolvedValue({
      sessionId: 'test_session',
      greeting: 'Welcome! What interests you?',
      buttons: [
        { id: 'btn_tech', label: 'Technology', value: 'tech', style: 'primary' },
        { id: 'btn_health', label: 'Healthcare', value: 'health', style: 'secondary' },
      ],
    }),
    sendMessage: jest.fn().mockResolvedValue({
      messageId: 'msg_response',
      reply: 'Interesting! Tell me more.',
      confidence: 25,
      viability: 80,
    }),
    clickButton: jest.fn().mockResolvedValue({
      messageId: 'msg_button_response',
      reply: 'Great choice! What problem do you want to solve?',
    }),
    captureIdea: jest.fn().mockResolvedValue({
      ideaId: 'idea_123',
      ideaSlug: 'test-idea',
    }),
    abandonSession: jest.fn().mockResolvedValue(undefined),
  }),
}));

describe('IdeationSession Integration', () => {
  const mockOnComplete = jest.fn();
  const mockOnExit = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ===========================================================================
  // SESSION INITIALIZATION
  // ===========================================================================

  test('PASS: Initializes session and shows greeting', async () => {
    render(
      <IdeationSession
        sessionId=""
        profileId="profile_123"
        entryMode="discover"
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Welcome! What interests you?')).toBeInTheDocument();
    });
  });

  test('PASS: Shows entry buttons from greeting', async () => {
    render(
      <IdeationSession
        sessionId=""
        profileId="profile_123"
        entryMode="discover"
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Technology')).toBeInTheDocument();
      expect(screen.getByText('Healthcare')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // MESSAGE FLOW
  // ===========================================================================

  test('PASS: User can send a message and receive response', async () => {
    render(
      <IdeationSession
        sessionId=""
        profileId="profile_123"
        entryMode="discover"
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    // Wait for initial greeting
    await waitFor(() => {
      expect(screen.getByText('Welcome! What interests you?')).toBeInTheDocument();
    });

    // Type and send message
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'I want to build something for developers');
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    // Verify user message appears
    await waitFor(() => {
      expect(screen.getByText('I want to build something for developers')).toBeInTheDocument();
    });

    // Verify response appears
    await waitFor(() => {
      expect(screen.getByText('Interesting! Tell me more.')).toBeInTheDocument();
    });
  });

  test('PASS: Button click triggers response', async () => {
    render(
      <IdeationSession
        sessionId=""
        profileId="profile_123"
        entryMode="discover"
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Technology')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Technology'));

    await waitFor(() => {
      expect(screen.getByText('Great choice! What problem do you want to solve?')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // CANDIDATE PANEL
  // ===========================================================================

  test('PASS: Candidate panel shows empty state initially', async () => {
    render(
      <IdeationSession
        sessionId=""
        profileId="profile_123"
        entryMode="discover"
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('No idea yet')).toBeInTheDocument();
    });
  });

  test('PASS: Candidate panel updates as confidence increases', async () => {
    render(
      <IdeationSession
        sessionId=""
        profileId="profile_123"
        entryMode="discover"
        onComplete={mockOnComplete}
        onExit={mockOnExit}
      />
    );

    // Send message to increase confidence
    await waitFor(() => {
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'Developer tools for testing');
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    // With 25% confidence from mock, should show forming state
    await waitFor(() => {
      expect(screen.getByText(/Idea Forming/)).toBeInTheDocument();
    });
  });
});
```

### 7.4 Test Summary

| Category            | Test Count | Expected Pass | Expected Fail |
| ------------------- | ---------- | ------------- | ------------- |
| IdeationEntryModal  | 6          | 6             | 0             |
| ButtonGroup         | 6          | 6             | 0             |
| ConfidenceMeter     | 8          | 8             | 0             |
| ViabilityMeter      | 8          | 8             | 0             |
| InputArea           | 9          | 9             | 0             |
| RisksList           | 8          | 8             | 0             |
| SessionHeader       | 6          | 6             | 0             |
| TokenUsageIndicator | 6          | 6             | 0             |
| SourceCitations     | 8          | 8             | 0             |
| StreamingText       | 6          | 6             | 0             |
| ExistingIdeaModal   | 5          | 5             | 0             |
| ideationReducer     | 14         | 14            | 0             |
| Integration         | 5          | 5             | 0             |
| **TOTAL**           | **95**     | **95**        | **0**         |

---

## 8. File Structure

```
frontend/src/
├── components/
│   └── ideation/
│       ├── IdeationEntryModal.tsx
│       ├── IdeationSession.tsx
│       ├── SessionHeader.tsx
│       ├── ConversationPanel.tsx
│       ├── MessageList.tsx
│       ├── AgentMessage.tsx
│       ├── UserMessage.tsx
│       ├── MessageText.tsx
│       ├── ButtonGroup.tsx
│       ├── FormRenderer.tsx
│       ├── SourceCitations.tsx
│       ├── InputArea.tsx
│       ├── TypingIndicator.tsx
│       ├── IdeaCandidatePanel.tsx
│       ├── ConfidenceMeter.tsx
│       ├── ViabilityMeter.tsx
│       └── RisksList.tsx
├── hooks/
│   ├── useIdeationAPI.ts
│   └── useSSEStream.ts
├── pages/
│   └── IdeationPage.tsx
├── reducers/
│   └── ideationReducer.ts
├── types/
│   ├── ideation.ts
│   └── ideation-state.ts
└── __tests__/
    └── ideation/
        ├── IdeationEntryModal.test.tsx
        ├── ButtonGroup.test.tsx
        ├── ConfidenceMeter.test.tsx
        ├── ViabilityMeter.test.tsx
        ├── InputArea.test.tsx
        ├── RisksList.test.tsx
        ├── ideationReducer.test.ts
        └── IdeationSession.integration.test.tsx
```

---

## 9. Implementation Order

1. **Types first** - Create `ideation.ts` and `ideation-state.ts`
2. **Reducer** - Implement `ideationReducer.ts` with tests
3. **API hook** - Create `useIdeationAPI.ts`
4. **Simple components** - ConfidenceMeter, ViabilityMeter, TypingIndicator
5. **Interactive components** - ButtonGroup, FormRenderer, InputArea
6. **Message components** - MessageText, UserMessage, AgentMessage, MessageList
7. **Panel components** - ConversationPanel, IdeaCandidatePanel
8. **Container components** - IdeationSession, IdeationEntryModal
9. **Page component** - IdeationPage
10. **Integration tests** - Full flow testing

---

_Document Version: 1.0_
_Spec: 09 of 09_
_Dependencies: Spec 1, Spec 7, Spec 8_
_Status: Implementation Ready_
