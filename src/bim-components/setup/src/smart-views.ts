import * as OBC from "@thatopen/components"
import { SerializedSmartView, SmartViews } from "../../SmartViews"
import { getDocument, updateDocument } from "../../../firebase"

interface FirebaseProjectSmartViews {
  smartViews?: OBC.SerializationResult<SerializedSmartView>
}

const addDefaultView = (smartViews: SmartViews) => {
  smartViews.list.set(OBC.UUID.create(), {
    name: "My Custom View",
    defaultVisibility: true,
    visibilityExceptions: {
      queries: new Set(["External Walls"])
    },
    colors: {
      queries: {
        "#ef9a9a": new Set(["Walls"]),
        "#a5d6a7": new Set(["Doors & Windows"]),
      }
    }
  })
}

export const setupSmartViews = async (
  components: OBC.Components,
  projectId?: string,
) => {
  const smartViews = components.get(SmartViews)

  let projectExists = false
  let hasStoredViews = false

  if (projectId) {
    try {
      const project = await getDocument<FirebaseProjectSmartViews>(
        "projects",
        projectId,
      )
      projectExists = Boolean(project)
      if (project?.smartViews) {
        smartViews.import(project.smartViews)
        hasStoredViews = true
      }
    } catch (error) {
      console.error("Could not load the project's Smart Views", error)
    }
  }

  if (!hasStoredViews) addDefaultView(smartViews)

  if (!projectId || !projectExists) return smartViews

  let saveTimer: ReturnType<typeof setTimeout> | undefined
  let saveQueue = Promise.resolve()
  const saveToFirebase = () => {
    const serialization = smartViews.export()
    saveQueue = saveQueue.then(async () => {
      try {
        await updateDocument("projects", projectId, {
          smartViews: serialization,
        })
      } catch (error) {
        console.error("Could not save the project's Smart Views", error)
      }
    })
    return saveQueue
  }

  const scheduleSave = () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveTimer = undefined
      void saveToFirebase()
    }, 150)
  }

  smartViews.list.onItemSet.add(scheduleSave)
  smartViews.list.onItemUpdated.add(scheduleSave)
  smartViews.list.onItemDeleted.add(scheduleSave)
  smartViews.list.onCleared.add(scheduleSave)

  // Migrate projects created before Smart Views persistence was introduced.
  if (!hasStoredViews) await saveToFirebase()

  return smartViews
}
