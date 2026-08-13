import * as OBC from "@thatopen/components";
import { createWorld, setupDataEnhancer, setupFragmentsManager, setupHighlighter, setupIfcLoader, setupItemsFinder, setupSmartViews } from "./src";

export const setupComponents = async () => {
  const components = new OBC.Components();
  const { world, viewport } = createWorld(components)

  setupIfcLoader(components)
  setupFragmentsManager(components, world)
  setupHighlighter(components, world)
  setupItemsFinder(components)
  setupDataEnhancer(components)
  setupSmartViews(components)

  components.init()

  return { components, viewport }
}