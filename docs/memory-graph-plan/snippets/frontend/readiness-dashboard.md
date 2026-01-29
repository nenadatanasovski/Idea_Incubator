# Readiness Dashboard

Create `frontend/src/components/ideation/ReadinessDashboard.tsx`:

```typescript
/**
 * ReadinessDashboard
 *
 * Shows readiness status for spec, build, and launch phases.
 */

import React, { useEffect, useState } from "react";
import { Card, Progress, Stack, Text, Badge, List, ThemeIcon, Group, Loader } from "@mantine/core";
import { IconCheck, IconX, IconAlertTriangle } from "@tabler/icons-react";

interface ReadinessResult {
  ready: boolean;
  score: number;
  missing: Array<{
    item: string;
    description: string;
    importance: "critical" | "important" | "nice_to_have";
  }>;
  recommendations: string[];
}

interface ReadinessDashboardProps {
  ideaId: string;
}

export function ReadinessDashboard({ ideaId }: ReadinessDashboardProps) {
  const [specReadiness, setSpecReadiness] = useState<ReadinessResult | null>(null);
  const [buildReadiness, setBuildReadiness] = useState<ReadinessResult | null>(null);
  const [launchReadiness, setLaunchReadiness] = useState<ReadinessResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReadiness() {
      setLoading(true);
      try {
        const [spec, build, launch] = await Promise.all([
          fetch(`/api/ideation/idea/${ideaId}/graph/readiness/spec`).then(r => r.json()),
          fetch(`/api/ideation/idea/${ideaId}/graph/readiness/build`).then(r => r.json()),
          fetch(`/api/ideation/idea/${ideaId}/graph/readiness/launch`).then(r => r.json()),
        ]);
        setSpecReadiness(spec);
        setBuildReadiness(build);
        setLaunchReadiness(launch);
      } catch (error) {
        console.error("Failed to fetch readiness:", error);
      }
      setLoading(false);
    }
    fetchReadiness();
  }, [ideaId]);

  if (loading) {
    return <Loader />;
  }

  return (
    <Stack gap="md">
      <Text size="lg" fw={600}>Phase Readiness</Text>

      <ReadinessCard
        title="Specification"
        description="Ready to generate detailed spec?"
        result={specReadiness}
        color="blue"
      />

      <ReadinessCard
        title="Build"
        description="Ready to start development?"
        result={buildReadiness}
        color="green"
      />

      <ReadinessCard
        title="Launch"
        description="Ready for marketing & launch?"
        result={launchReadiness}
        color="violet"
      />
    </Stack>
  );
}

function ReadinessCard({
  title,
  description,
  result,
  color,
}: {
  title: string;
  description: string;
  result: ReadinessResult | null;
  color: string;
}) {
  if (!result) return null;

  const importanceColor = {
    critical: "red",
    important: "yellow",
    nice_to_have: "gray",
  };

  const importanceIcon = {
    critical: <IconX size={14} />,
    important: <IconAlertTriangle size={14} />,
    nice_to_have: <IconCheck size={14} />,
  };

  return (
    <Card shadow="sm" padding="lg" radius="md" withBorder>
      <Group justify="space-between" mb="xs">
        <Text fw={500}>{title}</Text>
        <Badge color={result.ready ? "green" : "red"}>
          {result.ready ? "Ready" : "Not Ready"}
        </Badge>
      </Group>

      <Text size="sm" c="dimmed" mb="md">{description}</Text>

      <Progress
        value={result.score}
        color={result.score >= 80 ? "green" : result.score >= 50 ? "yellow" : "red"}
        size="lg"
        radius="xl"
        mb="md"
      />

      {result.missing.length > 0 && (
        <>
          <Text size="sm" fw={500} mb="xs">Missing:</Text>
          <List spacing="xs" size="sm" mb="md">
            {result.missing.map((item, i) => (
              <List.Item
                key={i}
                icon={
                  <ThemeIcon color={importanceColor[item.importance]} size={20} radius="xl">
                    {importanceIcon[item.importance]}
                  </ThemeIcon>
                }
              >
                <Text span fw={500}>{item.item}:</Text> {item.description}
              </List.Item>
            ))}
          </List>
        </>
      )}

      {result.recommendations.length > 0 && (
        <>
          <Text size="sm" fw={500} mb="xs">Recommendations:</Text>
          <List spacing="xs" size="sm">
            {result.recommendations.map((rec, i) => (
              <List.Item key={i}>{rec}</List.Item>
            ))}
          </List>
        </>
      )}
    </Card>
  );
}
```
