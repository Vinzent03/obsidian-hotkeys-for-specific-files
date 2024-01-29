import {
    App,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    TFile,
    moment,
} from "obsidian";
import { FileSuggest } from "./file-suggest";

interface FileObject {
    useMoment: boolean;
    file: string;
}

interface SpecificFilesSettings {
    files: FileObject[];
    useExistingPane: boolean;
    useHoverEditor: boolean;
}

const DEFAULT_SETTINGS: SpecificFilesSettings = {
    files: [],
    useExistingPane: true,
    useHoverEditor: false,
};

function getMomentFromFile(file: string): string {
    if (file.split(".").length > 1) {
        return (
            moment().format(file.substring(0, file.lastIndexOf("."))) +
            file.substring(file.lastIndexOf("."))
        );
    } else {
        return "";
    }
}
export default class SpecificFilesPlugin extends Plugin {
    settings: SpecificFilesSettings;
    async onload() {
        await this.loadSettings();
        console.log("loading " + this.manifest.name);
        this.addSettingTab(new SettingsTab(this.app, this));
        this.setCommands(this);
        this.app.vault.on("rename", (file, oldPath) => {
            const oldItemIndex = this.settings.files.findIndex(
                (item) => item.file === oldPath,
            );
            if (oldItemIndex >= 0) {
                this.settings.files[oldItemIndex].file = file.path;
                this.saveSettings();
                const id = this.manifest.id + ":" + oldPath;
                (this.app as any).commands.removeCommand(id);
                const hotkeys = (this.app as any).hotkeyManager.getHotkeys(id);
                this.setCommands(this);
                if (hotkeys) {
                    (this.app as any).hotkeyManager.setHotkeys(
                        this.manifest.id + ":" + file.path,
                        hotkeys,
                    );
                }
            }
        });
        this.app.vault.on("delete", (file) => {
            const oldItemIndex = this.settings.files.findIndex(
                (item) => item.file === file.path,
            );
            if (oldItemIndex >= 0) {
                this.settings.files.splice(oldItemIndex, 1);
                this.saveSettings();
                const id = this.manifest.id + ":" + file.path;
                (this.app as any).commands.removeCommand(id);
            }
        });
    }
    onunload() {
        console.log("unloading " + this.manifest.name);
    }

    async loadSettings() {
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData(),
        );
        let changed = false;
        for (var i = 0; i < this.settings.files.length; i++) {
            if (typeof this.settings.files[i] == "string") {
                changed = true;
                this.settings.files[i] = {
                    useMoment: false,
                    file: this.settings.files[i] as unknown as string,
                };
            }
        }
        if (changed) {
            this.saveSettings();
        }
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    setCommands(plugin: SpecificFilesPlugin) {
        for (const fileObject of this.settings.files) {
            if (!fileObject || !fileObject.file) continue;

            const fileName: string = fileObject.file;
            const getParsedName = () => {
                if (fileObject.useMoment) {
                    return getMomentFromFile(fileName);
                } else {
                    return fileName;
                }
            };
            plugin.addCommand({
                id: fileName,
                name: `Open ${fileName.substring(
                    0,
                    fileName.lastIndexOf("."),
                )}`,
                callback: () => {
                    if (this.settings.useExistingPane) {
                        let found = false;

                        this.app.workspace.iterateAllLeaves((leaf) => {
                            const file: TFile = (leaf.view as any).file;
                            if (!found && file?.path === getParsedName()) {
                                this.app.workspace.setActiveLeaf(leaf, {
                                    focus: true,
                                });
                                found = true;
                            }
                        });
                        if (!found) {
                            plugin.app.workspace.openLinkText(
                                getParsedName(),
                                "",
                            );
                        }
                    } else {
                        plugin.app.workspace.openLinkText(getParsedName(), "");
                    }
                },
            });
            plugin.addCommand({
                id: `${fileName}-new-tab`,
                name: `Open ${fileName.substring(
                    0,
                    fileName.lastIndexOf("."),
                )} in new tab`,
                callback: () => {
                    plugin.app.workspace.openLinkText(
                        getParsedName(),
                        "",
                        "tab",
                    );
                },
            });

            if (this.settings.useHoverEditor) {
                plugin.addCommand({
                    id: `${fileName}-hover-editor`,
                    name: `Open ${fileName.substring(
                        0,
                        fileName.lastIndexOf("."),
                    )} in Hover Editor`,
                    callback: () => {
                        const hoverEditor = (this.app as any).plugins.plugins[
                            "obsidian-hover-editor"
                        ];
                        if (!hoverEditor) {
                            new Notice(
                                "Cannot find Hover Editor plugin. Please file an issue.",
                            );
                            return;
                        }

                        const leaf = hoverEditor.spawnPopover(undefined, () => {
                            this.app.workspace.setActiveLeaf(leaf, {
                                focus: true,
                            });
                        });
                        const tfile =
                            this.app.vault.getAbstractFileByPath(
                                getParsedName(),
                            );
                        leaf.openFile(tfile);
                    },
                });
            }
        }
    }
}

class SettingsTab extends PluginSettingTab {
    plugin: SpecificFilesPlugin;
    constructor(app: App, plugin: SpecificFilesPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        // remove empty entries
        this.plugin.settings.files = this.plugin.settings.files.filter(
            (file) => file != null && file.file != "",
        );
        this.plugin.saveSettings();

        let { containerEl } = this;
        containerEl.empty();
        containerEl.createEl("h2", { text: this.plugin.manifest.name });
        let index = 0;
        new Setting(containerEl)
            .setName("Prefer existing panes")
            .setDesc(
                "Turn on to prefer existing panes and only open it in the current pane if the files isn't opened already.",
            )
            .addToggle((cb) => {
                cb.onChange((b) => {
                    this.plugin.settings.useExistingPane = b;
                    this.plugin.saveSettings();
                });
                cb.setValue(this.plugin.settings.useExistingPane);
            });
        new Setting(containerEl)
            .setName("Add command to open file in Hover Editor")
            .setDesc(
                "Needs the Hover Editor plugin to be installed and enabled.",
            )
            .addToggle((cb) => {
                cb.onChange((b) => {
                    this.plugin.settings.useHoverEditor = b;
                    this.plugin.saveSettings();
                });
                cb.setValue(this.plugin.settings.useHoverEditor);
            });
        new Setting(containerEl)
            .setName("Add new commands (required after changes)")
            .setDesc(
                "To remove already added commands, you have to reload Obsidian (or disable and enable this plugin) ",
            )
            .addButton((cb) =>
                cb
                    .setButtonText("Add")
                    .onClick(() => {
                        this.plugin.setCommands(this.plugin);
                    })
                    .setClass("mod-cta"),
            );
        new Setting(containerEl)
            .setName("Create new text field")
            .addButton((cb) =>
                cb
                    .setButtonText("Create")
                    .onClick(() => {
                        this.addTextField(index);
                        index++;
                    })
                    .setClass("mod-cta"),
            );
        new Setting(containerEl)
            .setName("Create new text field with moment format")
            .addButton((cb) =>
                cb
                    .setButtonText("Create")
                    .onClick(() => {
                        this.addTextField(index, { useMoment: true, file: "" });
                        index++;
                    })
                    .setClass("mod-cta"),
            );
        for (let i = 0; i <= this.plugin.settings.files.length; i++) {
            this.addTextField(index, this.plugin.settings.files[index]);
            index++;
        }
    }
    addTextField(
        index: number,
        fileObjet: FileObject = { useMoment: false, file: "" },
    ) {
        const setting = new Setting(this.containerEl);
        if (fileObjet.useMoment) {
            setting.setDesc(
                "Include file extension(e.g. .md)! Is excluded from moment format.",
            );
            setting.setName("File to open with command (with moment format)");
            setting.addMomentFormat((cb) => {
                let sampleElement: HTMLElement;
                cb.setDefaultFormat("YY-MM-DD.md");
                setting.descEl.appendChild(
                    createFragment((frag) => {
                        frag.createEl("br");
                        frag.appendText("For syntax, refer to" + " ");
                        frag.createEl(
                            "a",
                            {
                                text: "format reference",
                                href: "https://momentjs.com/docs/#/displaying/format/",
                            },
                            (a) => {
                                a.setAttr("target", "_blank");
                            },
                        );
                        frag.createEl("br");
                        frag.appendText(
                            "Your current syntax looks like this" + ": ",
                        );
                        sampleElement = frag.createEl("b", {
                            cls: "u-pop",
                            text: getMomentFromFile(fileObjet.file),
                        });
                        frag.createEl("br");
                    }),
                );
                cb.setValue(fileObjet.file);
                cb.onChange((value) => {
                    sampleElement.setText(getMomentFromFile(value));
                    this.plugin.settings.files[index] = {
                        useMoment: true,
                        file: value,
                    };
                    this.plugin.saveSettings();
                });
            });
        } else {
            setting.setDesc("Include file extension(e.g. .md)!");
            setting.setName("File to open with command");
            setting.addText((cb) => {
                new FileSuggest(this.app, cb.inputEl);
                cb.setPlaceholder("Directory/file.md")
                    .setValue(fileObjet.file)
                    .onChange((value) => {
                        this.plugin.settings.files[index] = {
                            useMoment: false,
                            file: value,
                        };
                        this.plugin.saveSettings();
                    });
            });
        }
    }
}
