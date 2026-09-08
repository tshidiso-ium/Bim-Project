import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import * as OBF from "@thatopen/components-front";
import { appColorPalette, appIcons } from "../../globals";
import * as THREE from "three"
import * as FRAGS from "@thatopen/fragments"

const originalMaterialsData = new Map<
  FRAGS.BIMMaterial,
  { color: number; transparent: boolean; opacity: number; lodOpacity?: number }
>();

export interface ViewerToolbarState {
  components: OBC.Components;
  world: OBC.World
}

export const viewerToolbarTemplate: BUI.StatefullComponent<
  ViewerToolbarState
> = (state) => {
  const { components, world } = state;

  const getButton = (event: Event) => event.currentTarget as HTMLButtonElement;

  const setButtonLoading = (button: HTMLButtonElement, loading: boolean) => {
    button.disabled = loading;
    button.classList.toggle("is-loading", loading);
  };

  const openContextMenu = (event: Event) => {
    const button = getButton(event);
    const menu = button.parentElement?.querySelector<BUI.ContextMenu>(
      ":scope > bim-context-menu",
    );
    if (menu) menu.visible = true;
  };

  const onApplyColor = async (event: Event) => {
    const button = getButton(event);
    const colorInput = button
      .closest("bim-context-menu")
      ?.querySelector<BUI.ColorInput>("bim-color-input");
    if (!colorInput) return;
    const { color } = colorInput;
    const highlighter = components.get(OBF.Highlighter)
    const selection = highlighter.selection.select; // this is a ModelIdMap, the engine data type to represent item selections
    if (OBC.ModelIdMapUtils.isEmpty(selection)) return;
    setButtonLoading(button, true)
    if (!highlighter.styles.has(color)) {
      highlighter.styles.set(color, {
        color: new THREE.Color(color),
        renderedFaces: 1,
        opacity: 1,
        transparent: false,
      });
    }

    await Promise.all([highlighter.highlightByID(
      color,
      selection,
      false, // indicates that previous items colorized with the same style will keep the color
      false // indicates the camera to not zoom on the colorized items
    ),
      highlighter.clear("select")])
    
    setButtonLoading(button, false)
    BUI.ContextMenu.removeMenus()
  };

  const setActiveSelectionSwatch = (color: string) => {
    const swatches = document.querySelectorAll<HTMLButtonElement>(
      ".selection-color-swatch",
    );
    for (const swatch of swatches) {
      swatch.toggleAttribute(
        "data-selected",
        swatch.dataset.color?.toLowerCase() === color.toLowerCase(),
      );
    }
  };

  const onSelectionColorChange = async (name: string, color: string) => {
    const highlighter = components.get(OBF.Highlighter);
    const material: Omit<FRAGS.MaterialDefinition, "customId"> = {
      color: new THREE.Color(color),
      renderedFaces: FRAGS.RenderedFaces.ONE,
      opacity: 1,
      transparent: false,
    };

    highlighter.config.selectMaterialDefinition = material;
    highlighter.styles.set(highlighter.config.selectName, material);
    await highlighter.updateColors();

    setActiveSelectionSwatch(color);
    const labels = document.querySelectorAll<BUI.Label>(
      ".selection-color-label",
    );
    for (const label of labels) {
      label.textContent = `${name} · ${color}`;
    }
  };

  const onReset = async (event: Event) => {
    const target = getButton(event);
    setButtonLoading(target, true);
    const highlighter = components.get(OBF.Highlighter)
    await highlighter.clear()
    BUI.ContextMenu.removeMenus()
    setButtonLoading(target, false);
  };
  
  const onHide = async (event: Event) => {
    const target = getButton(event);
    const highlighter = components.get(OBF.Highlighter);
    const selection = highlighter.selection.select;
    if (OBC.ModelIdMapUtils.isEmpty(selection)) return;
    setButtonLoading(target, true);
    const hider = components.get(OBC.Hider);
    const promises = [hider.set(false, selection), highlighter.clear("select")];
    await Promise.all(promises);
    setButtonLoading(target, false);
  }

  const onIsolate = async (event: Event) => {
    const target = getButton(event);
    const highlighter = components.get(OBF.Highlighter);
    const selection = highlighter.selection.select;
    if (OBC.ModelIdMapUtils.isEmpty(selection)) return;
    setButtonLoading(target, true);
    const hider = components.get(OBC.Hider);
    await hider.isolate(selection);
    setButtonLoading(target, false);
  };

  const onShowAll = async (event: Event) => {
    const target = getButton(event);
    setButtonLoading(target, true);
    const hider = components.get(OBC.Hider);
    await hider.set(true);
    setButtonLoading(target, false);
  };

  const setModelTransparency = (opacity: number) => {
    const fragments = components.get(OBC.FragmentsManager);
    const materials = [...fragments.core.models.materials.list.values()];

    for (const material of materials) {
      if (material.userData.customId) continue;
      let color: number | undefined;
      let lodOpacity: number | undefined
      if ("color" in material) {
        color = material.color.getHex();
      } else {
        color = material.lodColor.getHex();
        lodOpacity = material.uniforms.lodOpacity.value
      }

      originalMaterialsData.set(material, {
        color,
        transparent: material.transparent,
        opacity: material.opacity,
        lodOpacity
      });

      material.transparent = true;
      if ("color" in material) {
        material.opacity = opacity;
        material.color.setColorName("white");
      } else {
        material.uniforms.lodColor.value.setColorName("white")
        material.uniforms.lodOpacity.value = opacity
      }
      material.needsUpdate = true;
    }
  }

  const restoreTransparency = () => {
    for (const [material, data] of originalMaterialsData) {
      const { color, transparent, opacity, lodOpacity } = data;

      material.transparent = transparent;
      if ("color" in material) {
        material.opacity = opacity;
        material.color.setHex(color);
      } else {
        material.uniforms.lodColor.value.setHex(color)
        material.uniforms.lodOpacity.value = lodOpacity
      }
      material.needsUpdate = true;
    }

    originalMaterialsData.clear();
  }

  const onToggleGhost = () => {
    if (originalMaterialsData.size > 0) {
      restoreTransparency();
    }  else {
      setModelTransparency(0.05);
    }
  }

  const onFocus = async (event: Event) => {
    const target = getButton(event);
    if (!(world.camera instanceof OBC.SimpleCamera)) return;
    const highlighter = components.get(OBF.Highlighter)
    const selection = highlighter.selection.select;
    setButtonLoading(target, true);
    await world.camera.fitToItems(
      OBC.ModelIdMapUtils.isEmpty(selection) ? undefined : selection,
    );
    setButtonLoading(target, false);
  };

  type ToolbarIconName =
    | "show"
    | "ghost"
    | "focus"
    | "hide"
    | "isolate"
    | "palette"
    | "colorize";

  const toolbarIcons: Record<ToolbarIconName, string> = {
    show: appIcons.SHOW,
    ghost: appIcons.TRANSPARENT,
    focus: appIcons.FOCUS,
    hide: appIcons.HIDE,
    isolate: appIcons.ISOLATE,
    palette: appIcons.PALETTE,
    colorize: appIcons.COLORIZE,
  };

  const toolbarIconTemplate = (name: ToolbarIconName) => {
    return BUI.html`
      <bim-icon
        class="viewer-toolbar-icon"
        icon=${toolbarIcons[name]}
        aria-hidden="true"
      ></bim-icon>
    `;
  };

  const selectionColorMenuTemplate = () => BUI.html`
    <bim-context-menu>
      <div class="selection-palette-menu">
        <bim-label>Select a highlight color</bim-label>
        <div class="selection-color-palette">
          ${appColorPalette.map(({ name, value }) => BUI.html`
            <button
              type="button"
              class="selection-color-swatch"
              style=${`--selection-swatch: ${value}`}
              data-color=${value}
              ?data-selected=${value === appColorPalette[0].value}
              title=${name}
              aria-label=${`Use ${name} as the selection color`}
              @click=${() => onSelectionColorChange(name, value)}
            ></button>
          `)}
        </div>
        <bim-label class="selection-color-label">Lime · #BCF124</bim-label>
      </div>
    </bim-context-menu>
  `;

  const colorizeMenuTemplate = () => BUI.html`
    <bim-context-menu>
      <div class="viewer-colorize-menu">
        <bim-color-input></bim-color-input>
        <div class="viewer-context-actions">
          <button type="button" class="viewer-context-action" @click=${onApplyColor}>
            Apply
          </button>
          <button type="button" class="viewer-context-action" @click=${onReset}>
            Reset
          </button>
        </div>
      </div>
    </bim-context-menu>
  `;

  const menuChevronTemplate = () => BUI.html`
    <svg
      class="viewer-toolbar-menu-chevron"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      aria-hidden="true"
    >
      <path d="m4 6 4 4 4-4"></path>
    </svg>
  `;

  const toolbarActionTemplate = (
    compact: boolean,
    icon: ToolbarIconName,
    label: string,
    onClick: (event: Event) => void | Promise<void>,
    menu?: BUI.TemplateResult,
  ) => BUI.html`
    <div class="viewer-toolbar-action-shell">
      <button
        type="button"
        class=${`viewer-toolbar-action${compact ? " viewer-toolbar-action--compact" : ""}`}
        title=${label}
        aria-label=${label}
        aria-haspopup=${menu ? "menu" : "false"}
        @click=${menu ? openContextMenu : onClick}
      >
        ${toolbarIconTemplate(icon)}
        ${compact
          ? null
          : BUI.html`<span class="viewer-toolbar-action-label">${label}</span>`}
        ${menu && !compact ? menuChevronTemplate() : null}
      </button>
      ${menu ?? null}
    </div>
  `;

  const visibilityToolsTemplate = (compact: boolean) => BUI.html`
    ${toolbarActionTemplate(compact, "show", "Show All", onShowAll)}
    ${toolbarActionTemplate(compact, "ghost", "Toggle Ghost", onToggleGhost)}
  `;

  const selectionToolsTemplate = (compact: boolean) => BUI.html`
    ${toolbarActionTemplate(compact, "focus", "Focus", onFocus)}
    ${toolbarActionTemplate(compact, "hide", "Hide", onHide)}
    ${toolbarActionTemplate(compact, "isolate", "Isolate", onIsolate)}
    ${toolbarActionTemplate(
      compact,
      "palette",
      "Selection Color",
      openContextMenu,
      selectionColorMenuTemplate(),
    )}
    ${toolbarActionTemplate(
      compact,
      "colorize",
      "Colorize",
      openContextMenu,
      colorizeMenuTemplate(),
    )}
  `;

  return BUI.html`
    <div class="viewer-toolbar-switcher">
      <div class="viewer-toolbar-expanded" role="toolbar" aria-label="Viewer tools">
        <div class="viewer-toolbar-expanded-section" role="group" aria-label="Visibility tools">
          <div class="viewer-toolbar-expanded-actions">
            ${visibilityToolsTemplate(false)}
          </div>
          <div class="viewer-toolbar-section-label" aria-hidden="true">
            ${toolbarIconTemplate("show")}
            <span>Visibility</span>
          </div>
        </div>
        <div class="viewer-toolbar-expanded-divider" aria-hidden="true"></div>
        <div class="viewer-toolbar-expanded-section" role="group" aria-label="Selection tools">
          <div class="viewer-toolbar-expanded-actions">
            ${selectionToolsTemplate(false)}
          </div>
          <div class="viewer-toolbar-section-label" aria-hidden="true">
            ${toolbarIconTemplate("focus")}
            <span>Selection</span>
          </div>
        </div>
      </div>

      <div class="viewer-toolbar-compact" role="toolbar" aria-label="Viewer tools">
        <div class="viewer-toolbar-group" role="group" aria-label="Visibility tools">
          ${visibilityToolsTemplate(true)}
        </div>
        <div class="viewer-toolbar-divider" aria-hidden="true"></div>
        <div class="viewer-toolbar-group" role="group" aria-label="Selection tools">
          ${selectionToolsTemplate(true)}
        </div>
      </div>
    </div>
  `;
};
