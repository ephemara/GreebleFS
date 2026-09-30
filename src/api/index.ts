/**
 * GreebleFS Extension API — public barrel.
 *
 * Extension authors import from `'greeblefs'` (the virtual module). Internally,
 * host code imports from this barrel. Everything augmentable lives in
 * `./greeble`, so `declare module 'greeblefs'` widens the whole surface.
 */

export * from './greeble';
export {
  GreebleRegistryImpl,
  GreebleDomainBookImpl,
  normalizeDomain,
  normalizeContributionId,
  isGreebleDomain,
} from './registry';
export {
  GreebleEventSpineImpl,
  GreebleExtensionBusImpl,
  normalizeChannel,
  isNamespacedChannel,
} from './events';
export {
  createGreebleHarness,
  runGreebleExtension,
  createGreebleDomainBook,
  type GreebleEntryStore,
  type GreebleHostBindings,
} from './host';
