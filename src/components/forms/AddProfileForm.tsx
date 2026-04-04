import React from "react";
import { Box, Text } from "ink";

import type { AddDraft } from "../../types.js";
import { addFieldDefs } from "../../lib/tui.js";
import { maskKey } from "../../lib/utils.js";

interface AddProfileFormProps {
  draft: AddDraft;
  fieldIndex: number;
}

export function AddProfileForm({ draft, fieldIndex }: AddProfileFormProps): React.JSX.Element {
  return (
    <Box borderStyle="round" borderColor="green" paddingX={1} flexDirection="column">
      <Text bold>Add Profile</Text>
      {addFieldDefs.map((field, index) => {
        const focused = index === fieldIndex;
        const rawValue = draft[field.key];
        const shown = field.secret ? maskKey(rawValue) : rawValue;
        const displayValue = shown || field.placeholder;

        return (
          <Text key={`add-${field.key}`} color={focused ? "greenBright" : undefined}>
            {`${focused ? ">" : " "} ${field.label.padEnd(12, " ")} : ${displayValue}`}
          </Text>
        );
      })}
    </Box>
  );
}
