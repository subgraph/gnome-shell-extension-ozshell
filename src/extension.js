const Atk = imports.gi.Atk;
const Clutter = imports.gi.Clutter;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const Main = imports.ui.main;
const Mainloop = imports.mainloop;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Util = imports.misc.util;

const Gettext = imports.gettext.domain('ozshell');
const _ = Gettext.gettext;
const appSys = Shell.AppSystem.get_default();

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;
const ozClient = Me.imports.ozClient;
const ozMenuItem = Me.imports.ozMenuItem;

const IndicatorName ='OzMenu';
const DisabledIcon = 'ozmenu-off-symbolic';
const EnabledIcon = 'ozmenu-on-symbolic';

const OZSHELL_SETTINGS_SCHEMA = 'org.gnome.shell.extensions.ozshell';
const OZSHELL_KEY_CLIENTPATH = 'path-oz-client-executable';
const OZSHELL_KEY_REFRESHTIME = 'refresh-interval';
const OZSHELL_KEY_TERMINALMODE = 'terminal-mode';
const OZSHELL_KEY_PANELPOSITION = 'position-in-panel'

let OzMenu;
let Schema;
let IconSize;

const OzMenuPopup = new Lang.Class({
	Name: IndicatorName+'Popup',
	Extends: PopupMenu.PopupMenu,

	_init: function(sourceActor, arrowAlignment, arrowSide, button) {
		this.parent(sourceActor, arrowAlignment, arrowSide);
		this._button = button;
	},

	isEmpty: function() {
		return false;
	},
});

const OzMenuButton = new Lang.Class({
	Name: IndicatorName+'Button',
	Extends: PanelMenu.Button,
	
	_init: function() {
		this.parent(1.0, null, false);
		
	// Configs
		this._settings = Convenience.getSettings(OZSHELL_SETTINGS_SCHEMA);
		this._refreshTime = this._settings.get_int(OZSHELL_KEY_REFRESHTIME);
		this._termMode = this._settings.get_string(OZSHELL_KEY_TERMINALMODE);
		this._panelPosition = this._settings.get_string(OZSHELL_KEY_PANELPOSITION);
		this._ozConfig = null;
		
	// UI
		this.setMenu(new OzMenuPopup(this.actor, 1.0, St.Side.TOP, this));
		Main.panel.menuManager.addMenu(this.menu);
		this.actor.accessible_role = Atk.Role.LABEL;
		
		this._menuLayout = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
		
		this._button = new St.Bin({ style_class: 'panel-button',
						  reactive: true,
						  can_focus: true,
						  x_fill: true,
						  y_fill: true,
						  track_hover: true });
		this._setButtonIcon(false);
		this._menuLayout.add_child(this._button)
		this._menuLayout.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
		
		this.actor.add_actor(this._menuLayout);
		this.actor.name = 'panelOzSandboxes';
		this.actor.label_actor = this._icon;
		
	// Init
		this.connect('destroy', Lang.bind(this, this._onDestroy));
		this._showingId = Main.overview.connect('showing', Lang.bind(this, function() {
			this.actor.add_accessible_state(Atk.StateType.CHECKED);
		}));
		this._hidingId = Main.overview.connect('hiding', Lang.bind(this, function() {
			this.actor.remove_accessible_state(Atk.StateType.CHECKED);
		}));
		
		this._disable(false);
		this._setButtonIcon(true);
		this._daemonState = false;
		
		this.reloadFlag = false;
		
		this._addTimer();
	},
	
	_loadData: function() {
		let changed = false;
		let Sandboxes, oldSandboxes;
		try {
			Sandboxes = ozClient.ListRunning().Sandboxes;
		} catch(err) {
			this._Sandboxes = null;
			this._daemonState = false;
			this._disable(true);
			return true;
		}
		
		try {
			changed = (JSON.stringify(Sandboxes) != JSON.stringify(this._Sandboxes));
		} catch(err) {
			changed = true;
		}
		
		this._Sandboxes = Sandboxes;
		
		return changed; 
	},
	
	_display: function() {
		if (this._Sandboxes != null) {
			for (let i = 0; i < this._Sandboxes.length; i++) {
				let fnToggle = function() {
					if (this._enabled) {
						this._disable();
					} else {
						this._enable();
					}
				};
				let omi = new ozMenuItem.OzMenuItem(this._Sandboxes[i], 
							this._ozConfig, this._termMode, Lang.bind(this, fnToggle)
						);
				this.menu.addMenuItem(omi);
			}
		} else {
			let itemTitle = _("No running sandboxes");
			this.menu.addMenuItem(ozMenuItem.buildEmptyMenuItem(itemTitle));
		}
	},
	
	_redisplay: function() {
		this.menu.removeAll();
		
		this._display();
	},
	
	_enable: function(seticon) {
		if (seticon == true) {
			this._setButtonIcon(true);
		}
		return (this._enabled = true);
	},
	
	_disable: function(seticon) {
		if (this.menu.isOpen) {
			this.menu.toggle();
		}
		if (seticon == true) {
			this._setButtonIcon(false);
		}
		return (this._enabled = false);
	},
	
	_setButtonIcon: function(enabled) {
		/*
		let iconThemeChangedId = textureCache.connect('icon-theme-changed',
			Lang.bind(this, this._updateIcon));
		*/
		let iconName = (enabled ? EnabledIcon : DisabledIcon);
		let pathIconFile = Me.path + '/icons/' + iconName + '.png';
		let gicon = Gio.icon_new_for_string(pathIconFile);
		this._icon = new St.Icon({ gicon: gicon, icon_size: IconSize, style_class: 'system-status-icon' });
		this._button.set_child(this._icon);
	},
	
	_onEvent: function(actor, event) {
		if (event) {
			if (event.type() == Clutter.EventType.TOUCH_BEGIN ||
					event.type() == Clutter.EventType.BUTTON_PRESS) {
				if (this._enabled == false) {
					return true;
				}
				if (this.menu._getMenuItems().length == 0) {
					return true;
				}
			}
		}
		
		return PanelMenu.Button.prototype._onEvent.apply(this, arguments);
	},
	
	_addTimer: function() {
		let timeoutInterval = this._refreshTime;
		if (timeoutInterval == null || timeoutInterval < 1) {
			timeoutInterval = 1;
		}
		this._timeoutId = Mainloop.timeout_add_seconds(timeoutInterval, Lang.bind(this, function() {
			if (this._daemonState == false) {
				try {
					ozClient.Ping();
					this._daemonState = true;
					this._enable(true);
				} catch (err) {
					this._ozConfig = null;
					this._daemonState = false;
					this._disable(true);
					return true;
				}
			}
			if (this._ozConfig == null) {
				try {
					this._ozConfig = ozClient.GetConfig();
				} catch (err) {
					this._daemonState = false;
					this._disable(true);
					return true;
				}
			}
			if (/*!this.menu.isOpen && */this._enabled) {
				if (this._loadData()) {
					this._redisplay();
				}
			}
			return true;
		}));
	},
	
	_onDestroy: function() {
		if (this._timeoutId) {
			Mainloop.source_remove(this._timeoutId);
			this._timeoutId = 0;
		}
		if (this._settings) {
			this._settings.run_dispose();
		}
	},

	getPanelPosition: function() {
		log("OZ Shell Panel Position: " + this._panelPosition)
		return this._panelPosition;
	},
});

function init(extensionMeta) {
	log("OZ Shell extension initialization from: " + extensionMeta.path);
	let theme = imports.gi.Gtk.IconTheme.get_default();
	theme.append_search_path(extensionMeta.path + '/icons');
	IconSize = (Panel.PANEL_ICON_SIZE - 4);//Math.round(Panel.PANEL_ICON_SIZE * 4 / 5);
	Convenience.initTranslations('ozshell');
}

function enable() {
	OzMenu = new OzMenuButton();
	switch (OzMenu.getPanelPosition()) {
		case 'center':
		case 'right':
			Main.panel.addToStatusArea('OzMenu', OzMenu, -1, OzMenu.getPanelPosition());
		break;
		case 'left':
			let panelIndex = 1;

			if (Main.sessionMode._modeStack.indexOf('classic') == 0) {
				panelIndex = 3;
			}
			Main.panel.addToStatusArea('OzMenu', OzMenu, panelIndex, 'left');
		break;
		default:
			Main.panel.addToStatusArea('OzMenu', OzMenu)
		break;
	}
	log("OZ Shell extension enabled!");
}

function disable() {
	Main.panel.menuManager.removeMenu(OzMenu.menu);
	Main.overview.disconnect(OzMenu._hidingId);
	Main.overview.disconnect(OzMenu._showingId);
	
	OzMenu.destroy();
	OzMenu = null;
	log("OZ Shell extension disabled!");
}
