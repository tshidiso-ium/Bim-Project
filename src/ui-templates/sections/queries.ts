import * as BUI from "@thatopen/ui";
import * as OBC from "@thatopen/components";
import { queriesList } from "../tables/queries";
import { appIcons } from "../../globals";

export interface QueriesPanelState {
  components: OBC.Components;
}

export const queriesPanelTemplate: BUI.StatefullComponent<
  QueriesPanelState
> = (state) => {
  const { components } = state;

  const [modelsList] = queriesList({
    components,
  });

  const finder = components.get(OBC.ItemsFinder);
  let transferStatus: BUI.Label | undefined;

  const setTransferStatus = (
    message: string,
    tone: "default" | "success" | "error" = "default",
  ) => {
    if (!transferStatus) return;
    transferStatus.textContent = message;
    transferStatus.dataset.tone = tone;
  };

  const onSearch = (e: Event) => {
    const input = e.target as BUI.TextInput;
    modelsList.queryString = input.value;
  };

  const onDownloadQueries = ({ target: button }: { target: BUI.Button }) => {
    button.loading = true;

    try {
      // ItemsFinder.export() produces the SerializationResult expected by import().
      const serialization = finder.export();
      const json = JSON.stringify(serialization, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const download = document.createElement("a");

      download.href = url;
      download.download = "items-finder-queries.json";
      document.body.append(download);
      download.click();
      download.remove();
      URL.revokeObjectURL(url);

      const count = serialization.data.length;
      setTransferStatus(
        `${count} ${count === 1 ? "query" : "queries"} downloaded.`,
        "success",
      );
    } catch (error) {
      console.error("Could not export Items Finder queries", error);
      setTransferStatus("The queries could not be downloaded.", "error");
    } finally {
      button.loading = false;
    }
  };

  const onUploadQueries = ({ target: button }: { target: BUI.Button }) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = false;
    input.accept = "application/json,.json";

    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;

      button.loading = true;
      setTransferStatus(`Importing ${file.name}…`);

      try {
        const parsed: unknown = JSON.parse(await file.text());
        if (
          !parsed ||
          typeof parsed !== "object" ||
          !("data" in parsed) ||
          !Array.isArray(parsed.data)
        ) {
          throw new Error("The file is not an ItemsFinder serialization result.");
        }

        // Do not manually deserialize regex values: ItemsFinder.import() handles them.
        const imported = finder.import(
          parsed as OBC.SerializationResult<OBC.SerializedFinderQuery>,
        );
        const count = imported.length;
        setTransferStatus(
          `${count} ${count === 1 ? "query" : "queries"} imported. Existing names were replaced.`,
          "success",
        );
      } catch (error) {
        console.error("Could not import Items Finder queries", error);
        const message = error instanceof Error
          ? error.message
          : "The selected query file could not be imported.";
        setTransferStatus(message, "error");
      } finally {
        button.loading = false;
      }
    });

    input.click();
  };

  return BUI.html`
  <bim-panel-section fixed label="Queries List">
    <div class="queries-toolbar">
      <bim-text-input @input=${onSearch} placeholder="Search..." debounce="200"></bim-text-input>
      <bim-button
        icon=${appIcons.DOWNLOAD}
        label="Download"
        @click=${onDownloadQueries}
      ></bim-button>
      <bim-button
        icon=${appIcons.UPLOAD}
        label="Upload"
        @click=${onUploadQueries}
      ></bim-button>
    </div>
    <bim-label
      class="queries-transfer-status"
      ${BUI.ref((element) => (transferStatus = element as BUI.Label))}
      aria-live="polite"
    ></bim-label>
    ${modelsList}
  </bim-panel-section>`;
};
