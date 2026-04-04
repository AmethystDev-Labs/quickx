import React from "react";
import { Box, Text } from "ink";

import type { EditDraft } from "../../types.js";
import { editFieldDefs } from "../../lib/tui.js";
import { maskKey } from "../../lib/utils.js";

interface EditProfileFormProps {
  profileName: string;
  draft: EditDraft;
  fieldIndex: number;
}

export function EditProfileForm({
  profileName,
  draft,
  fieldIndex,
}: EditProfileFormProps): React.JSX.Element {
  return (
    <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
      <Text bold>{`Edit Profile: ${profileName || "-"}`}</Text>
      {editFieldDefs.map((field, index) => {
        const focused = index === fieldIndex;
        const rawValue = draft[field.key];
        const shown = field.secret ? maskKey(rawValue) : rawValue;
        const displayValue = shown || field.placeholder;

        return (
          <Text key={`edit-${field.key}`} color={focused ? "greenBright" : undefined}>
            {`${focused ? ">" : " "} ${field.label.padEnd(12, " ")} : ${displayValue}`}
          </Text>
        );
      })}
    </Box>
  );
}
