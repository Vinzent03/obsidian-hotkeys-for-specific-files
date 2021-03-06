import { App, MarkdownView, Plugin, PluginSettingTab, Setting, TFile } from 'obsidian';
import { FileSuggest } from './file-suggest';
interface SpecificFilesSettings {
	files: string[];
}

const DEFAULT_SETTINGS: SpecificFilesSettings = {
	files: []
};
export default class SpecificFilesPlugin extends Plugin {
	settings: SpecificFilesSettings;
	async onload() {
		await this.loadSettings();
		console.log('loading ' + this.manifest.name);
		this.addSettingTab(new SettingsTab(this.app, this));
		this.setCommands(this);
		this.app.vault.on("rename", (file, oldPath) => {
			const oldItemIndex = this.settings.files.findIndex(item => item === oldPath);
			if (oldItemIndex >= 0) {
				this.settings.files.splice(oldItemIndex, 1, file.path);
				this.saveSettings();
				const id = this.manifest.id + ":" + oldPath;
				(this.app as any).commands.removeCommand(id);
				const hotkeys = (this.app as any).hotkeyManager.getHotkeys(id);
				this.setCommands(this);
				if (hotkeys) {
					(this.app as any).hotkeyManager.setHotkeys(this.manifest.id + ":" + file.path, hotkeys);
				}
			};
		});
		this.app.vault.on("delete", file => {
			const oldItemIndex = this.settings.files.findIndex(item => item === file.path);
			if (oldItemIndex >= 0) {
				this.settings.files.splice(oldItemIndex, 1,);
				this.saveSettings();
				const id = this.manifest.id + ":" + file.path;
				(this.app as any).commands.removeCommand(id);
			};
		});

	}
	onunload() {
		console.log('unloading ' + this.manifest.name);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
	setCommands(plugin: SpecificFilesPlugin) {
		for (const fileName of this.settings.files) {
			plugin.addCommand({
				id: fileName,
				name: `Open ${fileName.substring(0, fileName.lastIndexOf("."))}`,
				callback: () => {
					let found = false;
					this.app.workspace.iterateAllLeaves(leaf => {
						const file: TFile = (leaf.view as any).file;
						if (file?.path === fileName) {
							this.app.workspace.revealLeaf(leaf);
							if (leaf.view instanceof MarkdownView) {
								leaf.view.editor.focus();
							}
							found = true;
						}
					});
					if (!found) {
						plugin.app.workspace.openLinkText(fileName, "");
					}
				}
			});
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
		this.plugin.settings.files = this.plugin.settings.files.filter(file => file != null && file != "");
		this.plugin.saveSettings();

		let { containerEl } = this;
		containerEl.empty();
		containerEl.createEl("h2", { text: this.plugin.manifest.name });
		let index = 0;
		new Setting(containerEl)
			.setName("Add new commands (required after changes)")
			.setDesc("To remove already added commands, you have to reload Obsidian (or disable and enable this plugin) ")
			.addButton(cb => cb.setButtonText("Add").onClick(() => {
				this.plugin.setCommands(this.plugin);
			}).setClass("mod-cta"));
		new Setting(containerEl)
			.setName("Create new text field")
			.addButton(cb => cb.setButtonText("Create").onClick(() => {
				this.addTextField(index);
				index++;
			}).setClass("mod-cta"));
		for (let i = 0; i <= this.plugin.settings.files.length; i++) {
			this.addTextField(index, this.plugin.settings.files[index]);
			index++;
		}

	}
	addTextField(index: number, text: string = "") {
		new Setting(this.containerEl)
			.setName("File to open with command")
			.setDesc("With file extension!")
			.addText(cb => {
				new FileSuggest(this.app, cb.inputEl);
				cb
					.setPlaceholder("Directory/file.md")
					.setValue(this.plugin.settings.files[index])
					.setValue(text)
					.onChange((value) => {
						this.plugin.settings.files[index] = value;
						this.plugin.saveSettings();
					});
			});

	}
}