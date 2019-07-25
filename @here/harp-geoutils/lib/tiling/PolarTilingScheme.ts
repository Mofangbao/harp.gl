/*
 * Copyright (C) 2017-2019 HERE Europe B.V.
 * Licensed under Apache 2.0, see full license in LICENSE
 * SPDX-License-Identifier: Apache-2.0
 */

import { equirectangularProjection } from "../projection/EquirectangularProjection";
import { quadTreeSubdivisionScheme } from "./QuadTreeSubdivisionScheme";
import { TilingScheme } from "./TilingScheme";

/**
 * A [[TilingScheme]] featuring quadtree subdivision scheme and equirectangular projection.
 */
export const polarTilingScheme = new TilingScheme(
    quadTreeSubdivisionScheme,
    equirectangularProjection
);
