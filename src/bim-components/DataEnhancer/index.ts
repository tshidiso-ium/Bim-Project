import * as OBC from "@thatopen/components"
import * as FRAGS from "@thatopen/fragments"
import { DataEnhancerSource } from "./src";

export class DataEnhancer extends OBC.Component {
  static uuid = "d9d41a68-2606-4c61-9e86-af6b675758ef" as const
  enabled = true;

  private _sourcesDataCache: Record<string, any[]> = {}

  readonly sources = new FRAGS.DataMap<string, DataEnhancerSource>()

  async getSourceData(source: string) {
    const sourceConfig = this.sources.get(source)
    if (!sourceConfig) {
      throw new Error(`DataEnhancer: Source "${source}" not found`)
    }

    let data = this._sourcesDataCache[source]
    if (!data) {
      data = await sourceConfig.data()
      this._sourcesDataCache[source] = data
    }

    return data
  }

  async getData(items: OBC.ModelIdMap) {
    const fragments = this.components.get(OBC.FragmentsManager)
    const result: OBC.ModelIdDataMap<Record<string, any[]>> = new FRAGS.DataMap()
    for (const [modelId, _localIds] of Object.entries(items)) {
      const model = fragments.list.get(modelId)
      if (!model) continue
      const localIds = [..._localIds]
      const itemsData = await model.getItemsData(localIds)
      for (const [source, config] of this.sources.entries()) {
        const sourceData = await this.getSourceData(source)
        for (const [index, attributes] of itemsData.entries()) {
          const itemExternalData = config.matcher(attributes, sourceData)
          if (!itemExternalData) continue

          let modelResult = result.get(modelId)
          if (!modelResult) {
            modelResult = new FRAGS.DataMap()
            result.set(modelId, modelResult)
          }

          const localId = localIds[index]
          let itemSources = modelResult.get(localId)
          if (!itemSources) {
            itemSources = {}
            modelResult.set(localId, itemSources)
          }

          itemSources[source] = itemExternalData
        }
      }
    }

    return result
  }

  /**
   * Finds every loaded model item that matches one or more records from a
   * configured external data source.
   *
   * The source matcher is reused in reverse: instead of matching one item
   * against the complete source, each model item is matched only against the
   * supplied source records. This keeps the matching rules in one place and
   * works with any DataEnhancer source.
   */
  async getItemsBySourceData(
    source: string,
    sourceData: any | any[],
    config?: {
      modelIds?: RegExp[];
      batchSize?: number;
    },
  ): Promise<OBC.ModelIdMap> {
    const sourceConfig = this.sources.get(source)
    if (!sourceConfig) {
      throw new Error(`DataEnhancer: Source "${source}" not found`)
    }

    const records = Array.isArray(sourceData) ? sourceData : [sourceData]
    if (records.length === 0) return {}

    const batchSize = config?.batchSize ?? 1000
    if (!Number.isInteger(batchSize) || batchSize < 1) {
      throw new Error("DataEnhancer: batchSize must be a positive integer")
    }

    const fragments = this.components.get(OBC.FragmentsManager)
    const result: OBC.ModelIdMap = {}

    for (const [modelId, model] of fragments.list) {
      if (config?.modelIds && !config.modelIds.some(pattern => pattern.test(modelId))) {
        continue
      }

      const localIds = await model.getLocalIds()
      for (let start = 0; start < localIds.length; start += batchSize) {
        const batchIds = localIds.slice(start, start + batchSize)
        const batchData = await model.getItemsData(batchIds)

        for (const [index, attributes] of batchData.entries()) {
          const matches = sourceConfig.matcher(attributes, records)
          if (!matches || matches.length === 0) continue

          let modelResult = result[modelId]
          if (!modelResult) {
            modelResult = new Set<number>()
            result[modelId] = modelResult
          }
          modelResult.add(batchIds[index])
        }
      }
    }

    return result
  }
}
