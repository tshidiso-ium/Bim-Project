import * as THREE from "three";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { DataMap } from "@thatopen/fragments";
import {
  SerializedModelIdMap,
  SerializedSmartView,
  SmartView,
} from "./src";

export class SmartViews extends OBC.Component implements OBC.Serializable<SerializedSmartView> {
  static uuid = "0d8413c5-7563-4de5-a213-5ac949eacbb1" as const;
  readonly list = new DataMap<string, SmartView>();
  enabled = true;

  currentState: SmartView = {
    name: "SmartView",
    defaultVisibility: true,
    visibilityExceptions: {},
    colors: {},
  };

  addQueryColor(color: string, query: string) {
    let queriesColors = this.currentState.colors.queries;
    if (!queriesColors) {
      queriesColors = {};
      this.currentState.colors.queries = queriesColors;
    }

    let queriesList = queriesColors[color];
    if (!queriesList) {
      queriesList = new Set();
      queriesColors[color] = queriesList;
    }

    queriesList.add(query);
  }

  clone(view = this.currentState) {
    const clone: SmartView = {
      name: view.name,
      defaultVisibility: view.defaultVisibility,
      visibilityExceptions: {},
      colors: {},
    };

    if (view.colors.items) {
      clone.colors.items = {}
      for (const [style, map] of Object.entries(view.colors.items)) {
        clone.colors.items[style] = OBC.ModelIdMapUtils.clone(map);
      }
    }

    if (view.colors.queries) {
      clone.colors.queries = {};
      for (const [style, names] of Object.entries(view.colors.queries)) {
        const set = new Set<string>();
        for (const name of names) {
          set.add(name)
        };
        clone.colors.queries[style] = set;
      }
    }

    if (view.visibilityExceptions.queries) {
      const queries = new Set<string>();
      for (const name of view.visibilityExceptions.queries) {
        queries.add(name);
      }
      clone.visibilityExceptions.queries = queries;
    }

    if (view.visibilityExceptions.items) {
      clone.visibilityExceptions.items = OBC.ModelIdMapUtils.clone(
        view.visibilityExceptions.items,
      );
    }

    return clone;
  }

  saveCurrentState(name: string) {
    const smartView = this.clone();
    smartView.name = name
    const id = OBC.UUID.create()
    this.list.set(id, smartView)
    return { id, smartView }
  }

  updateFromCurrentState(id: string) {
    const savedView = this.list.get(id)
    if (!savedView) return

    const updatedView = this.clone()
    updatedView.name = savedView.name
    this.list.set(id, updatedView)
    return updatedView
  }

  private serializeModelIdMap(map: OBC.ModelIdMap): SerializedModelIdMap {
    const serialized: SerializedModelIdMap = {};
    for (const [modelId, localIds] of Object.entries(map)) {
      serialized[modelId] = [...localIds].sort((a, b) => a - b);
    }
    return serialized;
  }

  private deserializeModelIdMap(
    value: unknown,
    path: string,
  ): OBC.ModelIdMap {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`SmartViews: ${path} must be an object`);
    }

    const map: OBC.ModelIdMap = {};
    for (const [modelId, localIds] of Object.entries(value)) {
      if (
        !Array.isArray(localIds) ||
        localIds.some(localId => !Number.isInteger(localId) || localId < 0)
      ) {
        throw new Error(`SmartViews: ${path}.${modelId} must be an array of item IDs`);
      }
      map[modelId] = new Set(localIds as number[]);
    }
    return map;
  }

  private serializeView(id: string, view: SmartView): SerializedSmartView {
    const serialized: SerializedSmartView = {
      id,
      name: view.name,
      defaultVisibility: view.defaultVisibility,
      visibilityExceptions: {},
      colors: {},
    };

    if (view.visibilityExceptions.queries) {
      serialized.visibilityExceptions.queries = [
        ...view.visibilityExceptions.queries,
      ];
    }
    if (view.visibilityExceptions.items) {
      serialized.visibilityExceptions.items = this.serializeModelIdMap(
        view.visibilityExceptions.items,
      );
    }

    if (view.colors.queries) {
      serialized.colors.queries = {};
      for (const [color, queryNames] of Object.entries(view.colors.queries)) {
        serialized.colors.queries[color] = [...queryNames];
      }
    }
    if (view.colors.items) {
      serialized.colors.items = {};
      for (const [color, map] of Object.entries(view.colors.items)) {
        serialized.colors.items[color] = this.serializeModelIdMap(map);
      }
    }

    return serialized;
  }

  private deserializeStringArray(value: unknown, path: string) {
    if (!Array.isArray(value) || value.some(item => typeof item !== "string")) {
      throw new Error(`SmartViews: ${path} must be an array of strings`);
    }
    return new Set(value as string[]);
  }

  private deserializeView(value: unknown, index: number) {
    const path = `data[${index}]`;
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error(`SmartViews: ${path} must be an object`);
    }

    const serialized = value as Partial<SerializedSmartView>;
    if (!serialized.id || typeof serialized.id !== "string") {
      throw new Error(`SmartViews: ${path}.id must be a non-empty string`);
    }
    if (!serialized.name || typeof serialized.name !== "string") {
      throw new Error(`SmartViews: ${path}.name must be a non-empty string`);
    }
    if (typeof serialized.defaultVisibility !== "boolean") {
      throw new Error(`SmartViews: ${path}.defaultVisibility must be a boolean`);
    }

    const exceptions = serialized.visibilityExceptions;
    if (!exceptions || typeof exceptions !== "object" || Array.isArray(exceptions)) {
      throw new Error(`SmartViews: ${path}.visibilityExceptions must be an object`);
    }
    const colors = serialized.colors;
    if (!colors || typeof colors !== "object" || Array.isArray(colors)) {
      throw new Error(`SmartViews: ${path}.colors must be an object`);
    }

    const view: SmartView = {
      name: serialized.name,
      defaultVisibility: serialized.defaultVisibility,
      visibilityExceptions: {},
      colors: {},
    };

    if (exceptions.queries !== undefined) {
      view.visibilityExceptions.queries = this.deserializeStringArray(
        exceptions.queries,
        `${path}.visibilityExceptions.queries`,
      );
    }
    if (exceptions.items !== undefined) {
      view.visibilityExceptions.items = this.deserializeModelIdMap(
        exceptions.items,
        `${path}.visibilityExceptions.items`,
      );
    }

    if (colors.queries !== undefined) {
      if (!colors.queries || typeof colors.queries !== "object" || Array.isArray(colors.queries)) {
        throw new Error(`SmartViews: ${path}.colors.queries must be an object`);
      }
      view.colors.queries = {};
      for (const [color, queryNames] of Object.entries(colors.queries)) {
        view.colors.queries[color] = this.deserializeStringArray(
          queryNames,
          `${path}.colors.queries.${color}`,
        );
      }
    }

    if (colors.items !== undefined) {
      if (!colors.items || typeof colors.items !== "object" || Array.isArray(colors.items)) {
        throw new Error(`SmartViews: ${path}.colors.items must be an object`);
      }
      view.colors.items = {};
      for (const [color, map] of Object.entries(colors.items)) {
        view.colors.items[color] = this.deserializeModelIdMap(
          map,
          `${path}.colors.items.${color}`,
        );
      }
    }

    return { id: serialized.id, view };
  }

  /** Converts every saved SmartView definition into JSON-safe data. */
  export(): OBC.SerializationResult<SerializedSmartView> {
    const data: SerializedSmartView[] = [];
    for (const [id, view] of this.list) {
      data.push(this.serializeView(id, view));
    }
    return { data };
  }

  /** Recreates saved SmartViews from a previous export. */
  import(result: OBC.SerializationResult<SerializedSmartView>): SmartView[] {
    if (!result?.data) return [];

    // Deserialize everything first so a malformed file cannot be half imported.
    const deserialized = result.data.map((value, index) =>
      this.deserializeView(value, index),
    );

    const imported: SmartView[] = [];
    for (const { id, view } of deserialized) {
      this.list.set(id, view);
      imported.push(view);
    }
    return imported;
  }

  async reset() {
    const highlighter = this.components.get(OBF.Highlighter);
    const hider = this.components.get(OBC.Hider);
    const promises = [highlighter.clear(), hider.set(true)];
    await Promise.all(promises);

    this.currentState = {
      name: "SmartView",
      defaultVisibility: true,
      visibilityExceptions: {},
      colors: {},
    };
  }

  async apply(view: SmartView) {
    if (!this.enabled) return;
    const { defaultVisibility, visibilityExceptions, colors } = view;

    const highlighter = this.components.get(OBF.Highlighter);
    const hider = this.components.get(OBC.Hider);
    const finder = this.components.get(OBC.ItemsFinder);

    const promises = [this.reset(), hider.set(defaultVisibility)];

    if (visibilityExceptions.items) {
      promises.push(hider.set(!defaultVisibility, visibilityExceptions.items));
    }

    if (visibilityExceptions.queries) {
      const queryPromises = [];
      for (const name of visibilityExceptions.queries) {
        const finderQuery = finder.list.get(name);
        if (!finderQuery) continue;
        queryPromises.push(finderQuery.test());
      }
      const maps = await Promise.all(queryPromises);
      const map = OBC.ModelIdMapUtils.join(maps);
      promises.push(hider.set(!defaultVisibility, map));
    }

    const colorsMap = new Map<string, OBC.ModelIdMap>();
    const addStyleMap = (color: string, map: OBC.ModelIdMap) => {
      let colorMap = colorsMap.get(color);
      if (!colorMap) {
        colorMap = {};
        colorsMap.set(color, colorMap);
      }
      OBC.ModelIdMapUtils.add(colorMap, map);
    };

    if (colors.queries) {
      for (const [color, queryNames] of Object.entries(colors.queries)) {
        const queryPromises = []
        for (const name of queryNames) {
          const finderQuery = finder.list.get(name);
          if (!finderQuery) continue;
          queryPromises.push(finderQuery.test())
        }
        const maps = await Promise.all(queryPromises);
        const map = OBC.ModelIdMapUtils.join(maps);
        addStyleMap(color, map);
      }
    }

    if (colors.items) {
      for (const [style, map] of Object.entries(colors.items)) {
        addStyleMap(style, map);
      }
    }

    for (const [color, map] of colorsMap.entries()) {
      if (!highlighter.styles.has(color)) {
        highlighter.styles.set(color, {
          color: new THREE.Color(color),
          renderedFaces: 1,
          opacity: 1,
          transparent: false,
        });
      }
      promises.push(highlighter.highlightByID(color, map));
    }

    await Promise.all(promises);

    this.currentState = this.clone(view);
  }
}

export * from "./src";
