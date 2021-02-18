import { App, Plugin, PluginSettingTab, Setting } from 'obsidian';
interface MyPluginSettings {
	files: string[];
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	files: []
};
export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	async onload() {
		await this.loadSettings();
		console.log('loading ' + this.manifest.name);
		this.addSettingTab(new SettingsTab(this.app, this));
		this.setCommands(this);

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
	setCommands(app: MyPlugin) {
		for (const fileName of this.settings.files) {
			app.addCommand({
				id: fileName,
				name: `Open ${fileName.substring(0, fileName.lastIndexOf("."))}`,
				callback: () => app.app.workspace.openLinkText(fileName, "")
			});
		}
	}
}

class SettingsTab extends PluginSettingTab {
	plugin: MyPlugin;
	constructor(app: App, plugin: MyPlugin) {
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
			.addText(cb => cb
				.setPlaceholder("Directory/file.md")
				.setValue(this.plugin.settings.files[index])
				.setValue(text)
				.onChange((value) => {
					this.plugin.settings.files[index] = value;
					this.plugin.saveSettings();
				}));
	}
}