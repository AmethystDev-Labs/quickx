import React from "react";
import { Box, Text } from "ink";

import type { TemplatePlaceholder } from "../../types.js";
import { maskKey } from "../../lib/utils.js";

interface TemplateAddFormProps {
  templateId: string;
  profileName: string;
  placeholders: TemplatePlaceholder[];
  answers: Record<string, string>;
  fieldIndex: number;
}

export function TemplateAddForm({
  templateId,
  profileName,
  placeholders,
  answers,
  fieldIndex,
}: TemplateAddFormProps): React.JSX.Element {
  return (
    <Box borderStyle="round" borderColor="magenta" paddingX={1} flexDirection="column">
      <Text bold>{`Create Profile from Template: ${templateId}`}</Text>
      <Text color={fieldIndex === 0 ? "greenBright" : undefined}>
        {`${fieldIndex === 0 ? ">" : " "} ${"Profile Name".padEnd(24)} : ${profileName || "(defaults to template id)"}`}
      </Text>
      {placeholders.map((ph, index) => {
        const fi = index + 1;
        const focused = fi === fieldIndex;
        const rawValue = answers[ph.question] ?? "";
        const shown = ph.secret ? maskKey(rawValue) : rawValue;
        const displayValue = shown || ph.defaultValue || "(required)";

        return (
          <Text key={`tpl-${ph.question}`} color={focused ? "greenBright" : undefined}>
            {`${focused ? ">" : " "} ${ph.question.slice(0, 24).padEnd(24)} : ${displayValue}`}
          </Text>
        );
      })}
    </Box>
  );
}
