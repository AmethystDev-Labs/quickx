import React from "react";
import { Box, Text } from "ink";

import type { StatusInfo } from "../../types.js";
import { statusLines } from "../../lib/tui.js";

export function StatusScreen({ status }: { status: StatusInfo }): React.JSX.Element {
  return (
    <Box borderStyle="round" borderColor="blue" paddingX={1} flexDirection="column">
      {statusLines(status).map((line, index) => (
        <Text key={`status-${index}`}>{line}</Text>
      ))}
    </Box>
  );
}
