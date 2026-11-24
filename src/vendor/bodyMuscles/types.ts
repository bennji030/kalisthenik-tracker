/*
 * Copyright 2024 Ivan Vulović
 * Licensed under the Apache License, Version 2.0 (see LICENSE in this folder).
 * Source: https://github.com/vulovix/body-muscles, commit 15c8085ee97cb94c51f92c75224416b15f955b5c
 * Modified: rewritten as a local replacement for the upstream types (no MuscleId, ViewSide as const object)
 */

export const ViewSide = { FRONT: 'front', BACK: 'back' } as const;
export type ViewSide = (typeof ViewSide)[keyof typeof ViewSide];

/** SVG path definition for a muscle region. */
export interface MuscleDef {
  id: string;
  name: string;
  path: string;
  view: ViewSide;
}
