import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import * as CUI from "@thatopen/ui-obc";
import * as FRAGS from "@thatopen/fragments";
import { appIcons } from "../../globals";
import { FinderPropertyInput, usePropertyInItemsFinder } from "./items-finder";

export interface ModelItemsPanelState {
  components: OBC.Components;
}

interface ModelProperty extends FinderPropertyInput {}

const attributeValue = (attribute: FRAGS.ItemAttribute | FRAGS.ItemData[] | undefined) => {
  if (!attribute || Array.isArray(attribute) || !("value" in attribute)) return undefined;
  return attribute.value;
};

const displayValue = (value: unknown) => {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  return "";
};

const getValueType = (value: unknown): FinderPropertyInput["valueType"] => {
  if (typeof value === "number") return "number";
  if (typeof value === "boolean") return "boolean";
  return "text";
};

const extractPropertySets = (item: FRAGS.ItemData) => {
  const propertySets: FRAGS.ItemData[] = [];
  const occurrencePropertySets = item.IsDefinedBy;
  if (Array.isArray(occurrencePropertySets)) propertySets.push(...occurrencePropertySets);

  const types = item.IsTypedBy;
  if (Array.isArray(types)) {
    for (const type of types) {
      const typePropertySets = type.HasPropertySets;
      if (Array.isArray(typePropertySets)) propertySets.push(...typePropertySets);
    }
  }

  return propertySets;
};

const extractProperties = (item: FRAGS.ItemData): ModelProperty[] => {
  const properties: ModelProperty[] = [];
  const seen = new Set<string>();

  for (const propertySet of extractPropertySets(item)) {
    const propertySetName = displayValue(attributeValue(propertySet.Name));
    if (!propertySetName) continue;

    const propertyList = Array.isArray(propertySet.HasProperties)
      ? propertySet.HasProperties
      : Array.isArray(propertySet.Quantities)
        ? propertySet.Quantities
        : [];

    for (const property of propertyList) {
      const propertyName = displayValue(attributeValue(property.Name));
      if (!propertyName) continue;

      const valueKey = Object.keys(property).find(
        (key) => /Value|Values/.test(key) && key !== "Name",
      );
      if (!valueKey) continue;

      const rawValue = attributeValue(property[valueKey]);
      const value = displayValue(rawValue);
      if (!value) continue;

      const key = `${propertySetName}\u0000${propertyName}\u0000${value}`;
      if (seen.has(key)) continue;
      seen.add(key);

      properties.push({
        propertySet: propertySetName,
        property: propertyName,
        value,
        valueType: getValueType(rawValue),
      });
    }
  }

  return properties;
};

export const modelItemsPanelTemplate: BUI.StatefullComponent<
  ModelItemsPanelState
> = (state) => {
  const { components } = state;
  const fragments = components.get(OBC.FragmentsManager);
  const highlighter = components.get(OBF.Highlighter);

  const [itemsTree, updateItemsTree] = CUI.tables.spatialTree({
    components,
    models: fragments.list.values(),
    selectHighlighterName: "select",
  });

  itemsTree.style.minHeight = "12rem";
  itemsTree.style.flex = "1";

  let propertiesContainer: HTMLDivElement | undefined;
  let selectionLabel: BUI.Label | undefined;
  let propertySearch = "";
  let selectedProperties: ModelProperty[] = [];

  const renderProperties = () => {
    if (!propertiesContainer) return;
    propertiesContainer.replaceChildren();

    const normalizedSearch = propertySearch.trim().toLowerCase();
    const visibleProperties = selectedProperties.filter((property) => {
      if (!normalizedSearch) return true;
      return `${property.propertySet} ${property.property} ${property.value}`
        .toLowerCase()
        .includes(normalizedSearch);
    });

    if (visibleProperties.length === 0) {
      const empty = document.createElement("p");
      empty.className = "model-properties-empty";
      empty.textContent = selectedProperties.length
        ? "No properties match this filter."
        : "Select an item to inspect its property sets.";
      propertiesContainer.append(empty);
      return;
    }

    for (const property of visibleProperties) {
      const row = document.createElement("div");
      row.className = "model-property-row";

      const details = document.createElement("div");
      details.className = "model-property-details";

      const propertySet = document.createElement("span");
      propertySet.className = "model-property-set";
      propertySet.textContent = property.propertySet;

      const name = document.createElement("strong");
      name.textContent = property.property;

      const value = document.createElement("span");
      value.className = "model-property-value";
      value.textContent = property.value;
      value.title = property.value;

      const useButton = document.createElement("bim-button") as BUI.Button;
      useButton.icon = appIcons.COPY;
      useButton.label = "Use in Finder";
      useButton.onclick = () => {
        usePropertyInItemsFinder(components, property);
        selectionLabel && (selectionLabel.textContent = `${property.property} copied to Items Finder.`);
      };

      details.append(propertySet, name, value);
      row.append(details, useButton);
      propertiesContainer.append(row);
    }
  };

  const inspectSelection = async (selection: OBC.ModelIdMap) => {
    const firstSelection = Object.entries(selection).find(([, localIds]) => localIds.size > 0);
    if (!firstSelection) {
      selectedProperties = [];
      selectionLabel && (selectionLabel.textContent = "Select an item from the list or viewer.");
      renderProperties();
      return;
    }

    const [modelId, localIds] = firstSelection;
    const model = fragments.list.get(modelId);
    const [localId] = localIds;
    if (!model || localId === undefined) return;

    selectionLabel && (selectionLabel.textContent = "Loading selected item properties…");

    try {
      const [item] = await model.getItemsData([localId], {
        attributesDefault: true,
        relationsDefault: { attributes: false, relations: false },
        relations: {
          IsDefinedBy: { attributes: true, relations: true },
          IsTypedBy: { attributes: true, relations: true },
          HasPropertySets: { attributes: true, relations: true },
        },
      });

      selectedProperties = item ? extractProperties(item) : [];
      const itemName = item ? displayValue(attributeValue(item.Name)) : "";
      selectionLabel && (selectionLabel.textContent = `${itemName || `Item ${localId}`} · ${selectedProperties.length} properties`);
      renderProperties();
    } catch (error) {
      console.error("Could not load item properties", error);
      selectedProperties = [];
      selectionLabel && (selectionLabel.textContent = "The selected item's properties could not be loaded.");
      renderProperties();
    }
  };

  highlighter.events.select.onHighlight.add(inspectSelection);
  highlighter.events.select.onClear.add(() => inspectSelection({}));

  const onItemsSearch = ({ target }: { target: BUI.TextInput }) => {
    itemsTree.queryString = target.value;
  };

  const onPropertiesSearch = ({ target }: { target: BUI.TextInput }) => {
    propertySearch = target.value;
    renderProperties();
  };

  const refreshItems = () => updateItemsTree({ models: fragments.list.values() });

  return BUI.html`
    <bim-panel-section fixed label="Model Items" icon=${appIcons.LIST}>
      <div class="model-items-panel">
        <bim-label class="items-finder-help">
          Models appear here automatically. Select an item to inspect and reuse its properties.
        </bim-label>
        <div class="model-items-search">
          <bim-text-input
            placeholder="Search model items…"
            debounce="200"
            @input=${onItemsSearch}
          ></bim-text-input>
          <bim-button
            icon=${appIcons.REFRESH}
            @click=${refreshItems}
          ></bim-button>
        </div>
        ${itemsTree}

        <div class="model-properties-header">
          <bim-label
            ${BUI.ref((element) => (selectionLabel = element as BUI.Label))}
          >Select an item from the list or viewer.</bim-label>
          <bim-text-input
            placeholder="Filter selected item properties…"
            debounce="150"
            @input=${onPropertiesSearch}
          ></bim-text-input>
        </div>
        <div
          class="model-properties-list"
          ${BUI.ref((element) => {
            propertiesContainer = element as HTMLDivElement;
            renderProperties();
          })}
        ></div>
      </div>
    </bim-panel-section>
  `;
};
