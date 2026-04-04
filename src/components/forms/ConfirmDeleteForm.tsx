import React from "react";
import { Box, Text } from "ink";

export function ConfirmDeleteForm({ name }: { name: string }): React.JSX.Element {
  return (
    <Box borderStyle="round" borderColor="red" paddingX={1} flexDirection="column">
      <Text bold color="redBright">
        Confirm Delete
      </Text>
      <Text>{`Delete profile "${name}"?`}</Text>
      <Text color="gray">Press D to confirm, Esc to cancel</Text>
    </Box>
  );
}
