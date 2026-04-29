import { definePreviewLane } from 'overlayterm-plugin';
import { PdfWorkbenchPreviewAdapter } from 'greeblefs-workbenches';

export default definePreviewLane({
  component: PdfWorkbenchPreviewAdapter,
});
