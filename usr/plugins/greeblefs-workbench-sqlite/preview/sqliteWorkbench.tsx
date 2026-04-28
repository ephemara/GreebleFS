import { definePreviewLane } from 'overlayterm-plugin';
import { SqliteWorkbenchPreviewAdapter } from 'greeblefs-workbenches';

export default definePreviewLane({
  component: SqliteWorkbenchPreviewAdapter,
});
