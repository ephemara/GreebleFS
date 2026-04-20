import { useRef } from 'react';
import { useZenControlBindings } from '../../../core/zen';

export const useKSculptKeybinds = (
    activeTool: string,
    setBrushRadius: (cb: (prev: number) => number) => void,
    setActiveTool: (tool: string) => void,
    undo: () => void,
    setWireframe: (cb: (prev: boolean) => boolean) => void,
    onFrame: () => void,
    onCycleLayer: (direction: number) => void,
    toggleBrushMenu: () => void,
    toggleAlphaMenu: () => void,
    toggleSymmetry: () => void,
    toggleQuickMenu: () => void
) => {
    const restoreToolRef = useRef<string | null>(null);

    useZenControlBindings('sculpt', ({ actionId, phase, sourceModuleId, keyboardEvent }) => {
        if (sourceModuleId !== 'sculpt') {
            return false;
        }

        if (actionId === 'sculpt.mask.hold') {
            if (phase === 'down') {
                if (activeTool !== 'MASK' && !restoreToolRef.current) {
                    restoreToolRef.current = activeTool;
                    setActiveTool('MASK');
                }
            } else if (restoreToolRef.current) {
                setActiveTool(restoreToolRef.current);
                restoreToolRef.current = null;
            }
            return true;
        }

        if (phase !== 'down') {
            return false;
        }

        switch (actionId) {
            case 'history.undo':
                undo();
                return true;
            case 'camera.focus':
                onFrame();
                return true;
            case 'layer.prev':
                onCycleLayer(-1);
                return true;
            case 'layer.next':
                onCycleLayer(1);
                return true;
            case 'menu.quick.toggle':
                toggleQuickMenu();
                return true;
            case 'menu.brush.toggle':
                toggleBrushMenu();
                return true;
            case 'menu.alpha.toggle':
                if (!keyboardEvent.ctrlKey && !keyboardEvent.metaKey) {
                    toggleAlphaMenu();
                    return true;
                }
                return false;
            case 'sculpt.radius.decrease':
                setBrushRadius((radius) => Math.max(0.05, radius - 0.05));
                return true;
            case 'sculpt.radius.increase':
                setBrushRadius((radius) => Math.min(2.0, radius + 0.05));
                return true;
            case 'sculpt.symmetry.toggle':
                toggleSymmetry();
                return true;
            case 'tool.slot.1':
                setActiveTool('CLAY');
                return true;
            case 'tool.slot.2':
                setActiveTool('MOVE');
                return true;
            case 'tool.slot.3':
                setActiveTool('SMOOTH');
                return true;
            case 'tool.slot.4':
                setActiveTool('FLATTEN');
                return true;
            case 'tool.slot.5':
                setActiveTool('INFLATE');
                return true;
            case 'tool.slot.6':
                setActiveTool('PINCH');
                return true;
            case 'tool.slot.7':
                setActiveTool('CREASE');
                return true;
            case 'tool.slot.8':
                setActiveTool('SCRAPE');
                return true;
            case 'tool.slot.9':
                setActiveTool('FILL');
                return true;
            case 'tool.slot.0':
                setActiveTool('PAINT');
                return true;
            default:
                return false;
        }
    });
};
