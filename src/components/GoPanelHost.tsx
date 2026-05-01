import {
  forwardRef,
} from 'react';

import {
  WasmPanelHost,
  type WasmPanelBuildMode,
  type WasmPanelHostContext,
  type WasmPanelHostEvent,
  type WasmPanelHostHandle,
  type WasmPanelHostProps,
} from './WasmPanelHost';

export interface GoPanelHostContext extends WasmPanelHostContext {}

export interface GoPanelHostHandle extends WasmPanelHostHandle {}

export type GoPanelHostEvent = WasmPanelHostEvent;
export type GoRuntimeMode = WasmPanelBuildMode;
export type GoRuntimeTarget = Extract<
  WasmPanelHostProps['buildTarget'],
  'js-wasm' | 'tinygo-wasm'
>;

export interface GoPanelHostProps
  extends Omit<WasmPanelHostProps, 'buildTarget'> {
  buildTarget?: GoRuntimeTarget;
}

export const GoPanelHost = forwardRef<GoPanelHostHandle, GoPanelHostProps>(
  function GoPanelHost(props, ref) {
    return (
      <WasmPanelHost
        {...props}
        ref={ref}
        buildTarget={props.buildTarget ?? 'js-wasm'}
      />
    );
  },
);

export default GoPanelHost;
