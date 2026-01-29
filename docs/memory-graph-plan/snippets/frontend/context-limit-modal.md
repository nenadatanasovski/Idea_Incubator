# Context Limit Modal

Create `frontend/src/components/ideation/ContextLimitModal.tsx`:

```typescript
/**
 * ContextLimitModal
 *
 * Shown when conversation context is approaching limit.
 * Prompts user to save insights to memory graph.
 */

import React from "react";
import { Modal, Button, Progress, Text, Stack, Group, Alert } from "@mantine/core";
import { IconBrain, IconRefresh, IconAlertTriangle } from "@tabler/icons-react";

interface ContextLimitModalProps {
  isOpen: boolean;
  onClose: () => void;
  percentUsed: number;
  onSaveAndContinue: () => Promise<void>;
  onContinueWithoutSaving: () => void;
  isSaving: boolean;
  saveResult?: {
    success: boolean;
    blocksCreated?: number;
    linksCreated?: number;
    error?: string;
  };
}

export function ContextLimitModal({
  isOpen,
  onClose,
  percentUsed,
  onSaveAndContinue,
  onContinueWithoutSaving,
  isSaving,
  saveResult,
}: ContextLimitModalProps) {
  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      title="Context Limit Approaching"
      size="md"
      centered
    >
      <Stack gap="md">
        <Alert
          icon={<IconAlertTriangle size={16} />}
          color="yellow"
          title="Running Low on Context"
        >
          Your conversation has used {Math.round(percentUsed * 100)}% of available context.
          To continue effectively, save your insights to the memory graph.
        </Alert>

        <Progress
          value={percentUsed * 100}
          color={percentUsed > 0.95 ? "red" : percentUsed > 0.9 ? "yellow" : "blue"}
          size="lg"
          radius="xl"
        />

        {saveResult?.success && (
          <Alert color="green" title="Saved Successfully!">
            Created {saveResult.blocksCreated} blocks and {saveResult.linksCreated} links.
            You can now start a fresh session with full context from the graph.
          </Alert>
        )}

        {saveResult?.error && (
          <Alert color="red" title="Save Failed">
            {saveResult.error}
          </Alert>
        )}

        <Text size="sm" c="dimmed">
          <strong>Save & Continue</strong> extracts insights from this conversation
          into your memory graph. You'll start a fresh session, but all knowledge
          is preserved and accessible.
        </Text>

        <Text size="sm" c="dimmed">
          <strong>Continue Without Saving</strong> starts a fresh session without
          extracting insights. You can return to this session later.
        </Text>

        <Group justify="flex-end" mt="md">
          <Button
            variant="outline"
            onClick={onContinueWithoutSaving}
            disabled={isSaving}
          >
            <IconRefresh size={16} style={{ marginRight: 8 }} />
            Continue Without Saving
          </Button>
          <Button
            onClick={onSaveAndContinue}
            loading={isSaving}
            leftSection={<IconBrain size={16} />}
          >
            Save & Continue
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
```

## Integration with Session Component

```typescript
// In the main ideation session component:

const [showContextModal, setShowContextModal] = useState(false);

// Check context on token update
useEffect(() => {
  if (contextStatus?.shouldPromptSave && !showContextModal) {
    setShowContextModal(true);
  }
}, [contextStatus]);

// In render:
<ContextLimitModal
  isOpen={showContextModal}
  onClose={() => setShowContextModal(false)}
  percentUsed={contextStatus?.percentUsed || 0}
  onSaveAndContinue={async () => {
    await saveConversationToGraph(sessionId, ideaId);
    // Optionally start new session
  }}
  onContinueWithoutSaving={() => {
    setShowContextModal(false);
    // Start new session without saving
  }}
  isSaving={isSavingContext}
  saveResult={contextSaveResult}
/>
```
