const Clutter = imports.gi.Clutter;
const ExtensionUtils = imports.misc.extensionUtils;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Main = imports.ui.main;
const Pango = imports.gi.Pango;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const StatusSystem = imports.ui.status.system;
const Util = imports.misc.util;

const Gettext = imports.gettext.domain('gnome-shell-extension-ozshell');
const _ = Gettext.gettext;

const Me = ExtensionUtils.getCurrentExtension();
const Spawn = Me.imports.spawn;
const ozClient = Me.imports.ozClient;
const ozDialog = Me.imports.modalDialog;

const _defaultApplicationIconPath = Me.path + '/icons/unknown-application-icon.svg';

let _iconSuffix = '-symbolic';
if (Main.sessionMode._modeStack.indexOf('classic') == 0) {
	_iconSuffix = '';
}

const ConfirmShutdownDialog = {
	subject: _("Shutdown %s sandbox."),
	description: _("Are you certain you want to shutdown this sandbox? Doing so will destroy any unsaved work."),
	confirmButtons: [{ signal: 'CancelShutdownSandbox',
						label: _("Cancel"),
						 key: Clutter.Escape },
					{ signal: 'ShutdownSandbox',
						label: _("Shutdown"),
						default: true }],
	iconName: 'system-shutdown-symbolic',//'dialog-warning-symbolic',
	iconStyleClass: 'end-session-dialog-shutdown-icon',
};

const ErrorFileMountDialog = {
	subject: "%s",
	description: "%s.",
	confirmButtons: [{ signal: 'DismissErrorFileMount',
						label: _("Ok"),
						key: Clutter.Escape }],
	iconName: 'dialog-error-symbolic',//'edit-delete-symbolic',
	iconStyleClass: 'end-session-dialog-shutdown-icon',
};

const ConfirmFileDeletationDialog = {
	subject: _("Remove files from sandbox."),
	description: _("Removing files from a sandbox may result in data loss if the files are still open. Are you certain you want to remove:\n%s"),
	confirmButtons: [{ signal: 'CancelRemoveFile',
						label: _("Cancel"),
						key: Clutter.Escape },
					{ signal: 'RemoveFile',
						label: _("Remove"),
						default: true }],
	iconName: 'dialog-warning-symbolic',//'edit-delete-symbolic',
	iconStyleClass: 'end-session-dialog-shutdown-icon',
};

function buildEmptyMenuItem(title) {
	return new PopupMenu.PopupMenuItem(title, {
		can_focus: false,
		reactive: false,
		activate: false,
		hover: false,
	});
}
const DEFAULT_TERMINAL_SCHEMA = 'org.gnome.desktop.default-applications.terminal';
const DEFAULT_TERMINAL_KEY = 'exec';
const DEFAULT_TERMINAL_ARGS_KEY = 'exec-arg';
const DEFAULT_TERMINAL_APP = 'gnome-terminal';

// try to find the default terminal app. fallback is gnome-terminal
// Borrowed from https://github.com/brot/gnome-shell-extension-sshsearch/
function getDefaultTerminal() {
	try {
		if (Gio.Settings.list_schemas().indexOf(DEFAULT_TERMINAL_SCHEMA) == -1) {
			return {'exec': SSHSEARCH_TERMINAL_APP,
					'args': ''
				};
		}
		
		let terminal_setting = new Gio.Settings({ schema: DEFAULT_TERMINAL_SCHEMA });
		return {'exec': terminal_setting.get_string(DEFAULT_TERMINAL_KEY),
				'args': terminal_setting.get_string(DEFAULT_TERMINAL_ARGS_KEY)
			};
	} catch (err) {
		return {'exec': DEFAULT_TERMINAL_APP,
				'args': ''
			};
	}
}

//let defaultTerm = getDefaultTerminal();

function OzMenuItem()
{
	return this._init.apply(this, arguments);
}

OzMenuItem.prototype =
{
	__proto__: PopupMenu.PopupSubMenuMenuItem.prototype,
	
	_init: function(sandbox, OzConfig, terminalMode, fnToggleParentDisabled, parent)
	{
		let displayName = sandbox.Profile;
		displayName = displayName.replace(/[-_]+/g, ' ');
		displayName = displayName.replace(/\w\S*/g, function(txt) {
			return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
		});
		
		PopupMenu.PopupSubMenuMenuItem.prototype._init.call(this, displayName, true);
		
		this._ozConfig = OzConfig;
		this._terminalMode = terminalMode;
		this._sandbox = sandbox;
		this._fnToggleParentDisabled = fnToggleParentDisabled;
		
		this.icon.style_class = 'sandbox-item-icon';
		this.icon.icon_size = 24;
		if (Gtk.IconTheme.get_default().has_icon(sandbox.Profile)) {
			this.icon.icon_name = sandbox.Profile;
		} else {
			this.icon.icon_name = 'package-x-generic';
			//this.icon.gicon = Gio.icon_new_for_string(_defaultApplicationIconPath);
		}
		
		this._initSubmenuActions();
		this._initSubmenuMounts();
		
		return this;
	},
	
	addMountItem: function(mount) {
		let mountItem = new OzMenuMountItem(mount, Lang.bind(this, this._clickRemoveFile));
		this.menu.addMenuItem(mountItem);
	},
	
	removeMountItem: function(mount) {
		this.menu._getMenuItems().forEach(Lang.bind(this, function(child) {
			if (!child.get_mount_name) {
				return
			}
			if (child.get_mount_name() != mount) {
				return;
			}
			child.destroy();
		}));
	},
	
	_initSubmenuActions: function() {
		let shutdownIcon = 'system-shutdown-symbolic';
		if (_iconSuffix == '') {
			shutdownIcon = 'gnome-shutdown';
		}
		let actionItems = [
			//system-file-manager, system-file-manager-symbolic, 
			{label: _("Add file..."), icon_name: 'system-file-manager'+_iconSuffix, fnEvent: this._clickedAddFile}
			//gksu-root-terminal, utilities-terminal, utilities-terminal-symbolic
			, {label: _("Open terminal in sandbox"), icon_name: 'utilities-terminal'+_iconSuffix, fnEvent: this._clickOpenTerminal}
			//system-shutdown-symbolic, gnome-shutdown
			, {label: _("Shutdown sandbox..."), icon_name: shutdownIcon, fnEvent: this._clickShutdownSandbox}
		];
		
		let fnAddActionItem = function (actionItem) {
			let submenuItem = new PopupMenu.PopupBaseMenuItem();
			submenuItem.actor.add(new St.Icon({ style_class: 'popup-menu-icon', icon_name: actionItem.icon_name}));
			submenuItem.actor.add(new St.Label({text: actionItem.label}));
			//submenuItem.actor.connect('button-press-event', Lang.bind(this, actionItem.fnEvent));
			submenuItem.connect('activate', Lang.bind(this, actionItem.fnEvent));
			this.menu.addMenuItem(submenuItem);
		};
		actionItems.forEach(Lang.bind(this, fnAddActionItem));
		
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
	},
	
	_initSubmenuMounts: function() {
		if (!this._sandbox.Mounts) {
			return
		}
		for (let i = 0; i < this._sandbox.Mounts.length; i++) {
			this.addMountItem(this._sandbox.Mounts[i]);
		}
	},

	_clickedAddFile: function() {
		//print("CLICKED ADD FILE: " + this._sandbox.Profile);
		this._fnToggleParentDisabled();
		let buff = '';
		let reader = new Spawn.SpawnReader();
		let pathOpenFile = GLib.build_pathv('/', [Me.path, 'openFile.js']);
		let handleResponse = Lang.bind(this, function(rsp) {
			let jsonret;
			try {
				jsonret = JSON.parse(rsp);
			} catch (err) {
				jsronret = {error: err.toString()};
			}
			let errSubject = _("Error adding files to sandbox!");
			if (jsonret.error) {
				this._dialog = new ozDialog.ConfirmDialog(ErrorFileMountDialog, errSubject, jsonret.error);
				this._dialog.open();
			} else if (jsonret.files.length > 0) {
				try {
					let jret = ozClient.MountFiles(this._sandbox.Id, jsonret.files, jsonret.readonly);
					if (jret.error) {
						if (jret.error) {
							this._dialog = new ozDialog.ConfirmDialog(ErrorFileMountDialog, errSubject, jret.error);
							this._dialog.open();
						}
					}
				} catch (err) {
					this._dialog = new ozDialog.ConfirmDialog(ErrorFileMountDialog, errSubject, err.toString());
					this._dialog.open();
				}
			}
		});
		reader.spawn(GLib.get_home_dir(), ['/usr/bin/gjs', pathOpenFile, this._sandbox.Profile], Lang.bind (this, function (line) {
			if (line != null) {
				buff += String(line) + '\n';
			} else {
				if (buff.length > 0) {
					handleResponse(buff);
				}
				this._fnToggleParentDisabled();
			}
		}));
	},
	
	_clickRemoveFile: function(file, dispname) {
		//print("CLICKED REMOVE FILE: " + this._sandbox.Profile + " > " + file);
		this._fnToggleParentDisabled();
		this._dialog = new ozDialog.ConfirmDialog(ConfirmFileDeletationDialog, null, dispname);
		this._dialog.connect('RemoveFile', Lang.bind(this, function() {
			try {
				let jret = ozClient.UnmountFile(this._sandbox.Id, file);
				if (jret.error) {
					if (jret.Msg) {
						this._dialog = new ozDialog.ConfirmDialog(ErrorFileMountDialog, _("Error removing files"), jret.error);
						this._dialog.open();
					}
				}
				this.removeMountItem(file);
			} catch (err) {
				log("OzShell Extension error: " + err.toString());
			}
			this._fnToggleParentDisabled();
		}));
		this._dialog.connect('CancelRemoveFile', Lang.bind(this, function() {
			this._fnToggleParentDisabled();
		}));
		this._dialog.open();
	},
	
	_clickOpenTerminal: function() {
		//print("CLICKED OPEN TERMINAL: " + this._sandbox.Profile);
		//pkexec
		let pathOzClient = GLib.build_filenamev([this._ozConfig.prefix_path, "bin", "oz"]);
		let cmdArray = ['/usr/bin/gnome-terminal'
			, '--hide-menubar'
		];
		
		switch(this._terminalMode) {
			case 'maximized':
				cmdArray.push('--maximize');
				break;
			case 'fullscreen':
				cmdArray.push('--full-screen');
				break;
		}
		
		cmdArray.push(
			  /*'--title="Terminal inside '+ this._sandbox.Profile +' sandbox"'
			, */'--execute'
			, pathOzClient
			, 'shell'
			, this._sandbox.Id.toString()
		);
		
		Util.spawn(cmdArray);
	},
	
	_clickShutdownSandbox: function() {
		//print("CLICKED SHUTDOWN: " + this._sandbox.Profile);
		this._fnToggleParentDisabled();
		this._dialog = new ozDialog.ConfirmDialog(ConfirmShutdownDialog, this._sandbox.Profile);
		this._dialog.connect('ShutdownSandbox', Lang.bind(this, function() {
			try {
				ozClient.HaltSandbox(this._sandbox.Id);
				this._fnToggleParentDisabled();
				this.destroy();//setSensitive
				return;
			} catch (err) {
				log("OzShell Extension error: " + err.toString());
			}
			this._fnToggleParentDisabled();
		}));
		this._dialog.connect('CancelShutdownSandbox', Lang.bind(this, function() {
			this._fnToggleParentDisabled();
		}));
		this._dialog.open();
	},
	
	_onDestroy: function() {
		if (this._dialog) {
			this._dialog.Close();
		}
	}
};

function OzMenuMountItem()
{
	return this._init.apply(this, arguments);
}

OzMenuMountItem.prototype =
{
	__proto__: PopupMenu.PopupBaseMenuItem.prototype,
	
	_init: function(mount, fnAction)
	{
		PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
		
		let uhome = GLib.get_home_dir();
		let dispmount = mount;
		if (mount.indexOf(uhome) == 0) {
			dispmount = mount.replace(uhome, '~');
		}
		
		this.item_name = dispmount;
		this._labelIcon = new St.Icon({
			style_class: 'popup-menu-icon'
			//list-remove, list-remove-symbolic
			, icon_name: 'list-remove'+_iconSuffix
		});
		this._labelActor = new St.Label({
			text: this.item_name
		});
		this._labelActor.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
		this._labelActor.clutter_text.line_wrap = true;
		
		this.actor.add(this._labelIcon);
		this.actor.add(this._labelActor);
		
		this.actor.connect('button-press-event', Lang.bind(this, function() {
			fnAction(mount, dispmount);
		}));
	},
	
	get_mount_name: function() {
		return this.item_name;
	},
};
