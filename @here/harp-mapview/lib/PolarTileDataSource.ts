/*
 * Copyright (C) 2017-2019 HERE Europe B.V.
 * Licensed under Apache 2.0, see full license in LICENSE
 * SPDX-License-Identifier: Apache-2.0
 */

import * as THREE from "three";

import { StyleSet } from "@here/harp-datasource-protocol";
import { MapEnv, StyleSetEvaluator } from "@here/harp-datasource-protocol/index-decoder";
import {
    GeoCoordinates,
    MathUtils,
    MercatorProjection,
    polarTilingScheme,
    TileKey,
    TilingScheme
} from "@here/harp-geoutils";

import { DataSource } from "./DataSource";
import { createMaterial } from "./DecodedTileHelpers";
import { Tile } from "./Tile";

/**
 * [[DataSource]] providing geometry for poles
 */
export class PolarTileDataSource extends DataSource {
    private m_tilingScheme: TilingScheme = polarTilingScheme;
    private m_maxLatitude = MathUtils.radToDeg(MercatorProjection.MAXIMUM_LATITUDE);

    private m_styleSetEvaluator?: StyleSetEvaluator;
    private m_northPoleMaterial?: THREE.Material;
    private m_southPoleMaterial?: THREE.Material;

    constructor({
        styleSetName,
        minZoomLevel,
        maxZoomLevel,
        storageLevelOffset = -1
    }: {
        styleSetName?: string;
        minZoomLevel?: number;
        maxZoomLevel?: number;
        storageLevelOffset?: number;
    }) {
        super("polar", styleSetName, minZoomLevel, maxZoomLevel, storageLevelOffset);

        this.cacheable = false;
    }

    dispose() {
        if (this.m_northPoleMaterial) {
            this.m_northPoleMaterial.dispose();
            delete this.m_northPoleMaterial;
        }
        if (this.m_southPoleMaterial) {
            this.m_southPoleMaterial.dispose();
            delete this.m_southPoleMaterial;
        }
        if (this.m_styleSetEvaluator) {
            delete this.m_styleSetEvaluator;
        }
    }

    setStyleSet(styleSet?: StyleSet, languages?: string[]): void {
        this.dispose();

        if (styleSet !== undefined) {
            this.m_styleSetEvaluator = new StyleSetEvaluator(styleSet);

            const northEnv = new MapEnv({
                $geometryType: "polygon",
                $layer: "earth",
                kind: "north_pole"
            });

            const northTechnique = this.m_styleSetEvaluator.getMatchingTechniques(northEnv);
            if (northTechnique.length !== 0) {
                this.m_northPoleMaterial = createMaterial({
                    technique: northTechnique[0],
                    level: 1
                });
            }

            const southEnv = new MapEnv({
                $geometryType: "polygon",
                $layer: "earth",
                kind: "south_pole"
            });

            const southTechnique = this.m_styleSetEvaluator.getMatchingTechniques(southEnv);
            if (southTechnique.length !== 0) {
                this.m_southPoleMaterial = createMaterial({
                    technique: southTechnique[0],
                    level: 1
                });
            }
        }

        this.mapView.markTilesDirty(this);
    }

    shouldRender(zoomLevel: number, tileKey: TileKey): boolean {
        if (zoomLevel !== tileKey.level || tileKey.level < 2) {
            return false;
        }

        const { north, south } = this.m_tilingScheme.getGeoBox(tileKey);

        const shouldRender = north > this.m_maxLatitude || south < -this.m_maxLatitude;

        return shouldRender;
    }

    getTilingScheme(): TilingScheme {
        return this.m_tilingScheme;
    }

    getTile(tileKey: TileKey): Tile {
        const tile = new Tile(this, tileKey);

        this.createTileGeometry(tile);

        return tile;
    }

    createTileGeometry(tile: Tile): void {
        const { east, west, north, south } = tile.geoBox;

        const isNorthPole = north > 0 && south >= 0;
        const material = isNorthPole ? this.m_northPoleMaterial : this.m_southPoleMaterial;
        if (material === undefined) {
            return;
        }

        const maxLat = this.m_maxLatitude;
        const limitedNorth = isNorthPole ? Math.max(north, maxLat) : Math.min(north, -maxLat);
        const limitedSouth = isNorthPole ? Math.max(south, maxLat) : Math.min(south, -maxLat);

        if (limitedSouth >= limitedNorth) {
            return;
        }

        const g = new THREE.Geometry();

        const points = [
            new GeoCoordinates(limitedSouth, west),
            new GeoCoordinates(limitedSouth, east),
            new GeoCoordinates(limitedNorth, west),
            new GeoCoordinates(limitedNorth, east)
        ];

        const projection = this.projection;
        points.forEach(point => {
            g.vertices.push(projection.projectPoint(point, new THREE.Vector3()).sub(tile.center));
        });

        g.faces.push(new THREE.Face3(0, 1, 2), new THREE.Face3(2, 1, 3));

        const geometry = new THREE.BufferGeometry();
        geometry.fromGeometry(g);
        g.dispose();

        const mesh = new THREE.Mesh(geometry, material);
        tile.objects.push(mesh);
    }
}
