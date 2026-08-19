import * as OBC from "@thatopen/components";
import * as BUI from "@thatopen/ui";
import { SmartViewsListState, SmartViewsListTableData } from "./types";
import { appIcons } from "../../../../globals";
import { SmartViews } from "../../../../bim-components";

export const setDefaults = (
  state: SmartViewsListState,
  table: BUI.Table<SmartViewsListTableData>,
) => {
  const { components } = state

  table.noIndentation = true
  table.headersHidden = true
  table.columns = ["Name", { name: "Actions", width: "auto" }]
  table.hiddenColumns = ["guid"]
  table.dataTransform = {
    Actions: (cellValue, rowData) => {
      const { guid } = rowData
      if (!guid) return cellValue

      const smartViews = components.get(SmartViews)
      const view = smartViews.list.get(guid)
      if (!view) return cellValue

      const onApply = async ({target: button}: {target: BUI.Button}) => {
        button.loading = true
        try {
          await smartViews.apply(view)
        } finally {
          button.loading = false
        }
      }

      const onUpdate = () => {
        smartViews.updateFromCurrentState(guid)
      }

      return BUI.html`
        <bim-button
          @click=${onApply}
          style="flex: 0;"
          icon=${appIcons.APPLY}
          title="Apply Smart View"
        ></bim-button>
        <bim-button
          @click=${onUpdate}
          style="flex: 0;"
          icon=${appIcons.REFRESH}
          title="Update Smart View from current state"
        ></bim-button>
      `
    }
  }
}
