import * as OBC from "@thatopen/components";

export interface ViewColors {
  queries?: Record<string, Set<string>>;
  items?: Record<string, OBC.ModelIdMap>;
}

export interface ViewExceptions {
  queries?: Set<string>;
  items?: OBC.ModelIdMap;
}

export interface SmartView {
  name: string;
  colors: ViewColors;
  // Default item visibility behavior
  // If not set, everything will be visibile (see exceptions)
  defaultVisibility: boolean;
  // Items except from the visibility rule
  // If visibility is false, all items will be hidden unless those in exceptions
  // If visibility is true, all items will be visible unless those in exceptions
  visibilityExceptions: ViewExceptions;
}

export type SerializedModelIdMap = Record<string, number[]>;

export interface SerializedViewColors {
  queries?: Record<string, string[]>;
  items?: Record<string, SerializedModelIdMap>;
}

export interface SerializedViewExceptions {
  queries?: string[];
  items?: SerializedModelIdMap;
}

/** JSON-safe definition used to recreate a SmartView. */
export interface SerializedSmartView extends Record<string, unknown> {
  id: string;
  name: string;
  colors: SerializedViewColors;
  defaultVisibility: boolean;
  visibilityExceptions: SerializedViewExceptions;
}
