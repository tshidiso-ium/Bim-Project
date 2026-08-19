import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { DataSourcesListState } from "./types";
import { DataEnhancer } from "../../../../bim-components";

export const setDefaults = (
  state: DataSourcesListState,
  table: BUI.Table,
) => {
  const { components } = state

  table.noIndentation = true
  table.addEventListener("rowcreated", (e: CustomEvent<BUI.RowCreatedEventDetail>) => {
    const { row } = e.detail
    row.style.cursor = "pointer"
    row.title = "Select every model item sharing this source information"
    row.addEventListener("click", async () => {
      const source = table.dataset.source
      if (!source || row.isHeader) return

      const enhancer = components.get(DataEnhancer)
      const highlighter = components.get(OBF.Highlighter)
      row.style.pointerEvents = "none"
      row.style.opacity = "0.6"

      try {
        const items = await enhancer.getItemsBySourceData(source, row.data)
        if (OBC.ModelIdMapUtils.isEmpty(items)) {
          await highlighter.clear("select")
          return
        }
        await highlighter.highlightByID("select", items)
      } catch (error) {
        console.error(`Could not find items for the ${source} source data`, error)
      } finally {
        row.style.removeProperty("pointer-events")
        row.style.removeProperty("opacity")
      }
    })
  })
}
