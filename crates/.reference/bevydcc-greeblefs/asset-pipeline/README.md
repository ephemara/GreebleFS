# Asset Pipeline Bundle

This crate stages the bevydcc source most relevant to GreebleFS metadata, indexing, caching, and preview job orchestration.

Primary value:

- metadata-first processing before heavy preview generation
- content-hash cache keys for durable thumbnail and artifact reuse
- data-driven format routing and import policy
- prebuilt workspace and API registry patterns instead of repeated runtime crawling

Use this lane when lifting:

- explorer thumbnail job orchestration
- cache key and invalidation strategy
- large-content indexing or registry generation
- plugin or file-type policy routing

The copied upstream files live under `upstream/` with original relative paths preserved.
