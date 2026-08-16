import * as BUI from "@thatopen/ui";
import { DataSourcesPanelState, ItemsDataPanelState, ItemsFinderPanelState, ModelItemsPanelState, ModelsPanelState, QueriesPanelState, SmartViewsPanelState } from "../../../sections";

type Viewport = {
  name: "viewport";
  state: {};
}

export type ItemsData = {
  name: "itemsData";
  state: ItemsDataPanelState
}

export type Queries = {
  name: "queries";
  state: QueriesPanelState
}

export type DataSources = {
  name: "datasources";
  state: DataSourcesPanelState
}

export type Models = {
  name: "models";
  state: ModelsPanelState
}

export type SmartViews = {
  name: "smartViews";
  state: SmartViewsPanelState
}

export type ItemsFinder = {
  name: "itemsFinder";
  state: ItemsFinderPanelState
}

export type ModelItems = {
  name: "modelItems";
  state: ModelItemsPanelState
}

type ComponentsGridElements = [Viewport, ItemsData, Models, Queries, DataSources, SmartViews, ItemsFinder, ModelItems];

type ComponentsGridLayouts = ["Models", "Items Finder", "SmartViews", "Viewer"];

export type ComponentsGrid = BUI.Grid<ComponentsGridLayouts, ComponentsGridElements>
