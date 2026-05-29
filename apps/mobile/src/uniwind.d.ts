/// <reference types="uniwind/types" />

// Augments React Native component props with Uniwind's `className` (and
// related className props). Metro additionally generates `uniwind-env.d.ts`
// at bundle time with the project-specific class typings; that file is git
// ignored. This reference is the stable, committed piece so `tsc` knows about
// `className` without needing Metro to have run first.
