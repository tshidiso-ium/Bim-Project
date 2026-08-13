import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as FRAGS from "@thatopen/fragments";
import { appIcons } from "../../globals";

export interface ItemsFinderPanelState {
  components: OBC.Components;
}

type PropertyValue = RegExp | number | boolean;

const exactText = (value: string) => {
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}$`, "i");
};

const getResultCount = (items: OBC.ModelIdMap) => {
  let total = 0;
  for (const localIds of Object.values(items)) total += localIds.size;
  return total;
};

export const itemsFinderPanelTemplate: BUI.StatefullComponent<
  ItemsFinderPanelState
> = (state) => {
  const { components } = state;

  let propertySetInput: BUI.TextInput | undefined;
  let propertyInput: BUI.TextInput | undefined;
  let valueInput: BUI.TextInput | undefined;
  let valueTypeInput: BUI.Dropdown | undefined;
  let statusLabel: BUI.Label | undefined;
  let resultsContainer: HTMLDivElement | undefined;

  const setStatus = (message: string, tone: "default" | "success" | "error" = "default") => {
    if (!statusLabel) return;
    statusLabel.textContent = message;
    statusLabel.dataset.tone = tone;
  };

  const showResults = (items: OBC.ModelIdMap) => {
    if (!resultsContainer) return;
    resultsContainer.replaceChildren();

    const entries = Object.entries(items).filter(([, localIds]) => localIds.size > 0);
    for (const [modelId, localIds] of entries) {
      const row = document.createElement("div");
      row.className = "items-finder-result";

      const modelName = document.createElement("span");
      modelName.textContent = modelId;
      modelName.title = modelId;

      const count = document.createElement("strong");
      count.textContent = `${localIds.size}`;

      row.append(modelName, count);
      resultsContainer.append(row);
    }
  };

  const readPropertyValue = (): PropertyValue => {
    const rawValue = valueInput?.value.trim() ?? "";
    const [valueType = "text"] = valueTypeInput?.value ?? [];

    if (valueType === "number") {
      const numericValue = Number(rawValue);
      if (rawValue === "" || !Number.isFinite(numericValue)) {
        throw new Error("Enter a valid number for the property value.");
      }
      return numericValue;
    }

    if (valueType === "boolean") {
      const normalizedValue = rawValue.toLowerCase();
      if (normalizedValue !== "true" && normalizedValue !== "false") {
        throw new Error('Enter either "true" or "false" for a boolean value.');
      }
      return normalizedValue === "true";
    }

    if (!rawValue) throw new Error("Enter the property value to find.");
    return exactText(rawValue);
  };

  const onFind = async ({ target: button }: { target: BUI.Button }) => {
    const propertySet = propertySetInput?.value.trim() ?? "";
    const property = propertyInput?.value.trim() ?? "";

    if (!propertySet || !property) {
      setStatus("Property set and property name are required.", "error");
      return;
    }

    const fragments = components.get(OBC.FragmentsManager);
    if (fragments.list.size === 0) {
      setStatus("Load an IFC model before running a search.", "error");
      return;
    }

    button.loading = true;
    setStatus("Searching all loaded models…");

    try {
      const propertyValue = readPropertyValue();
      const queries: FRAGS.ItemsQueryParams[] = [
        {
          relation: {
            name: "IsDefinedBy",
            query: {
              attributes: {
                queries: [{ name: exactText("Name"), value: exactText(propertySet) }],
              },
              relation: {
                name: "HasProperties",
                query: {
                  attributes: {
                    aggregation: "exclusive",
                    queries: [
                      { name: exactText("Name"), value: exactText(property) },
                      { name: exactText("NominalValue"), value: propertyValue },
                    ],
                  },
                },
              },
            },
          },
        },
      ];

      const finder = components.get(OBC.ItemsFinder);
      const items = await finder.getItems(queries);
      const total = getResultCount(items);
      const highlighter = components.get(OBF.Highlighter);

      await highlighter.clear("select");
      showResults(items);

      if (total === 0) {
        setStatus("No matching items found.");
        return;
      }

      await highlighter.highlightByID("select", items);
      const modelCount = Object.values(items).filter((localIds) => localIds.size > 0).length;
      setStatus(
        `${total} ${total === 1 ? "item" : "items"} found in ${modelCount} ${modelCount === 1 ? "model" : "models"}.`,
        "success",
      );
    } catch (error) {
      console.error("Items Finder search failed", error);
      const message = error instanceof Error ? error.message : "The search could not be completed.";
      setStatus(message, "error");
    } finally {
      button.loading = false;
    }
  };

  const onClear = async () => {
    propertySetInput && (propertySetInput.value = "");
    propertyInput && (propertyInput.value = "");
    valueInput && (valueInput.value = "");
    resultsContainer?.replaceChildren();
    setStatus("Enter a property set, property, and value to begin.");
    await components.get(OBF.Highlighter).clear("select");
  };

  return BUI.html`
    <bim-panel-section fixed label="Items Finder" icon=${appIcons.SEARCH}>
      <div class="items-finder-form">
        <bim-label class="items-finder-help">
          Find every item whose property has an exact value in a specific property set.
        </bim-label>

        <bim-text-input
          ${BUI.ref((element) => (propertySetInput = element as BUI.TextInput))}
          label="Property set"
          placeholder="e.g. Pset_WallCommon"
          vertical
        ></bim-text-input>

        <bim-text-input
          ${BUI.ref((element) => (propertyInput = element as BUI.TextInput))}
          label="Property"
          placeholder="e.g. IsExternal"
          vertical
        ></bim-text-input>

        <bim-dropdown
          ${BUI.ref((element) => (valueTypeInput = element as BUI.Dropdown))}
          label="Value type"
          vertical
        >
          <bim-option label="Text" value="text" checked></bim-option>
          <bim-option label="Number" value="number"></bim-option>
          <bim-option label="Boolean" value="boolean"></bim-option>
        </bim-dropdown>

        <bim-text-input
          ${BUI.ref((element) => (valueInput = element as BUI.TextInput))}
          label="Property value"
          placeholder="e.g. true"
          vertical
        ></bim-text-input>

        <div class="items-finder-actions">
          <bim-button
            icon=${appIcons.SEARCH}
            label="Find items"
            @click=${onFind}
          ></bim-button>
          <bim-button
            icon=${appIcons.CLEAR}
            label="Clear"
            @click=${onClear}
          ></bim-button>
        </div>

        <div class="items-finder-summary" aria-live="polite">
          <bim-label
            ${BUI.ref((element) => (statusLabel = element as BUI.Label))}
          >Enter a property set, property, and value to begin.</bim-label>
          <div
            class="items-finder-results"
            ${BUI.ref((element) => (resultsContainer = element as HTMLDivElement))}
          ></div>
        </div>
      </div>
    </bim-panel-section>
  `;
};
