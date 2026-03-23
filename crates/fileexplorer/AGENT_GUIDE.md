# Agent Guide

## Purpose

This repository is intended to be worked on by multiple future AI coding agents. The job of each agent is not only to implement features, but to preserve the intended product shape.

Read this document before making architectural decisions.

## Product Summary

We are building a desktop workspace around a Yazi-backed engine with a premium custom shell.

The design reference comes from the `overlayterm` prototype:

- panel-based desktop shell
- file workspace as a hero surface
- strong visual identity
- runtime themes, animations, shaders, and layouts

Do not reduce this project to “a file manager with a nicer frontend.”

## Primary Mandate

Optimize for long-term product integrity.

That means:

- preserve engine / UI separation
- preserve typed contracts
- preserve full themeability
- preserve layout transformability
- avoid hardcoding the app around one temporary visual direction

## What To Protect

### 1. Shell-First Architecture

Do not let the explorer or any other panel become the entire app architecture.

### 2. Typed Bridge Discipline

Do not introduce raw string command names or ad hoc event names in random components if a contract layer exists or is being introduced.

### 3. Theme System Depth

Do not reduce theming to:

- just colors
- just wallpaper
- just CSS variables

Themes are expected to influence fonts, iconography, motion defaults, shell atmosphere, and layout-compatible presentation.

### 4. Yazi As Engine, Not As Visual Constraint

Use Yazi for performance, async behavior, and domain capabilities. Do not let Yazi’s current terminal UI define the product’s presentation boundaries.

### 5. Vertical Slice Delivery

Prefer complete slices over partial abstractions. A good slice includes:

- contract
- engine behavior
- frontend service
- UI integration
- verification

## Things Agents Must Not Do

- Do not port OverlayTerm blindly.
- Do not move domain behavior into frontend components.
- Do not hardcode theme-specific styling into general components.
- Do not add filesystem logic directly to views when it belongs in the backend.
- Do not create a one-off visual hack that cannot survive theme or layout changes.
- Do not build a giant custom UI library before the app’s primitives are proven.
- Do not assume the initial visual style is canonical.

## Preferred System Boundaries

### Backend

Owns:

- filesystem truth
- search truth
- watcher truth
- jobs and task state
- preview metadata
- package discovery metadata

### Frontend Services

Own:

- subscriptions
- local interaction state
- shell orchestration
- panel activation
- invoking typed backend clients

### Components

Own:

- rendering
- composition
- local display state
- input events routed into services

## Theme And Layout Rules

Any new system should ask:

1. Can this be themed?
2. Can this survive multiple layout profiles?
3. Is this behavior tied to one visual style by accident?
4. Does this belong in tokens, recipes, layout profiles, or component logic?

If a change only works for one shell identity, it is probably being implemented at the wrong layer.

## Aesthetic Intent

This product should support wildly different identities while staying coherent. Examples include:

- premium content browser
- XMB-like shell
- retro desktop shell
- playful handheld-inspired layout
- glassy cinematic shell
- tile- and board-oriented shell

Agents should preserve this breadth instead of flattening the system into generic enterprise UI.

## Recommended Work Order

When uncertain, prioritize work in this order:

1. clarify docs and contracts
2. improve engine boundaries
3. improve typed bridge quality
4. improve shell and panel systems
5. improve theme and layout systems
6. implement a vertical feature slice
7. polish visuals

## Deliverable Style

Good deliverables:

- explicit contracts
- strong file boundaries
- isolated heavy surfaces
- schema-driven packages
- reusable shell primitives
- testable behavior

Bad deliverables:

- giant monolithic components
- view-owned domain state
- raw invoke usage scattered everywhere
- hardcoded one-theme assumptions
- UI abstractions without a proven need

## If You Need A Mental Model

Think of the product like this:

- Yazi is the engine room
- Tauri is the native host
- the contract layer is the language between worlds
- the shell is the operating environment
- the content browser is the flagship workspace
- themes and layouts are transformation systems, not afterthoughts

Protect that model in every change.
