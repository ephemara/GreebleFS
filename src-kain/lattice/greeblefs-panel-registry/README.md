# GreebleFS Panel Registry

This Lattice package is the first real conversion of shell panel metadata out of JSX ownership.

The current migration boundary is deliberate:

- `src/config/panelLatticeRegistry.ts` is the live descriptor registry consumed by React.
- `src/panels/panelRegistry.tsx` remains the trusted renderer host for actual panel components.
- this package mirrors the authored Lattice shape so Kain, Settings, and future tooling can see the panel system as package data.

Next migrations should move panel render contracts, panel permissions, interaction policy, and native-window activation rules behind the same descriptor layer before attempting full panel renderer generation.
