# ADR 0046: Privacy is chosen by data category

Status: accepted product direction; implementation pending. Partially supersedes
ADR 0011's public-only Library restriction. ADR 0045 remains the implemented
experimental trial, not the completed privacy feature.

Users choose Public or Private for Watches, Library and Notes by category. Lists
have a default visibility and an individual visibility choice per List. This
balances simple controls with the common need for both public and private Lists;
individual Watch, Library Item and Note overrides are deferred. Settings remain
private regardless of whether their optional PDS sync is enabled. New Users start
Public for Watches, Library and Notes, with Public as the Lists default. Existing
Users retain their current visibility until they explicitly change it.

Spaces allow owner-only portable records, removing the technical reason for
requiring a public Library in ADR 0011. Its distinction between ownership and
curation remains unchanged. Users can change visibility in either direction,
with explicit publication consent, recoverable migration and honest warnings that
previously public copies cannot be recalled from other systems. Privacy covers
public derived data and caches as well as the underlying records.

This does not change ADR 0010's Circle boundary or introduce sharing with selected
people. The [product brief](../prd/data-privacy.md) records the agreed controls,
implementation stages and decisions that still need resolution.

Implementation starts with Watches. The [migration design](../prd/watch-privacy-implementation.md)
uses verified full-record copies and a durable temporary journal before source
deletion. Private → Public must wait for conditional private-record deletion at
the PDS; on 2026-10-07 the operator explicitly rejected retaining a permanent
private recovery copy as a substitute. Controls remain unavailable until public
readers, writers and background synchronization enforce the category boundary.

Private means access by the owner and apps the owner explicitly authorizes.
Spaces access control is not end-to-end encryption: the hosting PDS can access
the records, and the owner can grant another app access outside Opnshelf.
