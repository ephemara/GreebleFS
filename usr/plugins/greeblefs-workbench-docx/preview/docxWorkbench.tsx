import { definePreviewLane } from 'overlayterm-plugin';
import { DocxWorkbenchPreviewAdapter } from 'greeblefs-workbenches';

export default definePreviewLane({
  component: DocxWorkbenchPreviewAdapter,
});
