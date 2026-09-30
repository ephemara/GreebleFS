/**
 * greebleLegacyShim — legacy theme-renderer TSX surfaced through the API.
 *
 * Packs like `toon-studio-shell` / `custom-shell` predate the harness: they
 * export `defineThemeRenderer({...})` via `overlayterm-theme-renderer` and
 * render through App's `ThemeRendererBoundary` path. This shim registers
 * every successfully loaded legacy renderer as a `shell` contribution in
 * the shared harness book, so the API world sees, owns, and can dispose
 * them — with an adapter component that renders the legacy component
 * against a live host.
 *
 * The live host comes from App (which already builds the full
 * `OverlayThemeRendererHost` for the boundary path) via
 * `setLegacyShellHostProvider`. Without a provider the adapter degrades to
 * the API shell's own default surface instead of crashing.
 */

import React from 'react';
import type {
  GreebleRenderProps,
  GreebleShellContribution,
  GreebleShellData,
} from '../api/greeble';
import type {
  LoadedOverlayThemeRenderer,
  OverlayThemeRendererHost,
} from '../components/themeRendererRuntime';
import { getGreebleDomainBook } from './greebleHost';

let liveHostProvider: (() => OverlayThemeRendererHost) | null = null;

/** App sets this once from its existing themeRendererHost memo. */
export function setLegacyShellHostProvider(
  provider: (() => OverlayThemeRendererHost) | null,
): void {
  liveHostProvider = provider;
}

function renderLegacyShellAdapter(
  renderer: LoadedOverlayThemeRenderer,
  props: GreebleRenderProps<GreebleShellData>,
): React.ReactNode {
  const Component = renderer.component;
  if (!Component) return props.data.host.renderDefaultShell();
  const provider = liveHostProvider;
  if (!provider) return props.data.host.renderDefaultShell();
  let host: OverlayThemeRendererHost;
  try {
    host = provider();
  } catch {
    return props.data.host.renderDefaultShell();
  }
  return React.createElement(Component, {
    renderer: {
      id: renderer.id,
      name: renderer.name,
      filePath: renderer.filePath,
      rendererRoot: renderer.rendererRoot,
      entryModule: renderer.entryModule,
    },
    host,
  } as never);
}

export interface AdoptLegacyThemeRendererOptions {
  /** Owning pack id — doubles as the dispose scope. */
  packId: string;
  renderer: LoadedOverlayThemeRenderer;
  title?: string;
  description?: string;
}

/**
 * Register one loaded legacy renderer as an API `shell`. Idempotent
 * (registry replaces on duplicate id). Returns the contribution id, or null
 * when the renderer failed to load / has no component.
 */
export function adoptLegacyThemeRenderer(
  options: AdoptLegacyThemeRendererOptions,
): string | null {
  const { packId, renderer } = options;
  if (!packId || !renderer || renderer.error || !renderer.component) {
    return null;
  }
  const contributionId = renderer.id?.trim() ? renderer.id : packId;
  const snapshot = renderer;
  const entry: GreebleShellContribution = {
    id: contributionId,
    title: options.title ?? renderer.name ?? contributionId,
    description:
      options.description ?? renderer.description ?? `Legacy shell renderer "${contributionId}".`,
    component: (props: GreebleRenderProps<GreebleShellData>) =>
      renderLegacyShellAdapter(snapshot, props),
  };
  getGreebleDomainBook().define('shell').register(entry, packId);
  return contributionId;
}

/** Withdraw every shell owned by a pack (hot-reload / unload path). */
export function withdrawLegacyThemeRenderer(packId: string): number {
  if (!packId) return 0;
  return getGreebleDomainBook().unregisterOwner(packId);
}

export interface AdoptableShellRendererPack {
  id?: string;
  name?: string;
  description?: string;
  renderer?: LoadedOverlayThemeRenderer;
}

/** Batch helper for App: adopt all successfully loaded shell packs. */
export function adoptLoadedShellRendererPacks(
  packs: readonly AdoptableShellRendererPack[] | null | undefined,
): string[] {
  if (!packs) return [];
  const adopted: string[] = [];
  for (const pack of packs) {
    if (!pack?.renderer || !pack.id) continue;
    const id = adoptLegacyThemeRenderer({
      packId: pack.id,
      renderer: pack.renderer,
      title: pack.name,
      description: pack.description,
    });
    if (id) adopted.push(id);
  }
  return adopted;
}
