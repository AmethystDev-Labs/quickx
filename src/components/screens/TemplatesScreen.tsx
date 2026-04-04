import React from "react";
import { Box, Text } from "ink";

import type { Template } from "../../types.js";
import { truncate, pickWindow } from "../../lib/utils.js";

interface TemplatesScreenProps {
  templates: Template[];
  selectedIndex: number;
  previewCache: Record<string, Template>;
}

export function TemplatesScreen({
  templates,
  selectedIndex,
  previewCache,
}: TemplatesScreenProps): React.JSX.Element {
  const selectedRow = templates[selectedIndex] ?? null;
  const window = pickWindow(templates, selectedIndex, 14);
  const currentPreview = selectedRow ? (previewCache[selectedRow.id] ?? null) : null;

  const detailLines = currentPreview
    ? [
        `ID: ${currentPreview.id || "-"}`,
        `Name: ${currentPreview.displayName || "-"}`,
        `Scope: ${currentPreview.scope.join(", ") || "-"}`,
        `Base URL: ${currentPreview.baseUrl || "-"}`,
        `Model: ${currentPreview.model || "-"}`,
        `Wire API: ${currentPreview.wireApi || "-"}`,
        `Auth Method: ${currentPreview.authMethod || "-"}`,
        `Docs: ${currentPreview.docsUrl || "-"}`,
      ]
    : ["Select a template to preview details."];

  return (
    <Box gap={1}>
      <Box
        borderStyle="round"
        borderColor="magenta"
        paddingX={1}
        flexDirection="column"
        width={72}
      >
        <Text bold>Templates</Text>
        {templates.length === 0 ? (
          <Text color="gray">No templates available.</Text>
        ) : (
          window.rows.map((template, index) => {
            const absolute = window.start + index;
            const marker = absolute === selectedIndex ? ">" : " ";
            const id = truncate(template.id || "-", 22).padEnd(22, " ");
            const display = truncate(template.displayName || "-", 34).padEnd(34, " ");
            const scope = truncate(template.scope.join(","), 12);

            return (
              <Text
                key={`template-${template.id}-${absolute}`}
                color={absolute === selectedIndex ? "magentaBright" : undefined}
              >
                {`${marker} ${id} ${display} ${scope}`}
              </Text>
            );
          })
        )}
      </Box>

      <Box
        borderStyle="round"
        borderColor="yellow"
        paddingX={1}
        flexDirection="column"
        width={45}
      >
        <Text bold>Preview</Text>
        {detailLines.map((line, index) => (
          <Text key={`preview-${index}`}>{line}</Text>
        ))}
      </Box>
    </Box>
  );
}
