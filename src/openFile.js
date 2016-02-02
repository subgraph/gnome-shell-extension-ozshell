const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const GLib = imports.gi.GLib;

const Gettext = imports.gettext.domain('ozshell');
const _ = Gettext.gettext;

const OzShellOpenFileApp = new Lang.Class({
	//A Class requires an explicit Name parameter. This is the Class Name.
	Name: 'OzShellOpenFileApp',

	_init: function() {
		this.application = new Gtk.Application({
			application_id: 'com.subgraph.ozshell-openfile',
			flags: Gio.ApplicationFlags.FLAGS_NONE,
		});
		this.application.title = 'Oz Add File';
		GLib.set_prgname(this.application.title);
		GLib.set_application_name(this.application.title);
		
		this.application.connect('activate', Lang.bind(this, this._onActivate));
		this.application.connect('startup', Lang.bind(this, this._onStartup));
	},

	_buildUI: function() {
		let cTitle = _("Select files or directories to add to %s sandbox");
		cTitle = cTitle.replace("%s", ARGV[0]);
		
		this._chooser = new Gtk.FileChooserDialog({title: cTitle,
				action: Gtk.FileChooserAction.OPEN,
				modal: true,
				//transient_for: this.get_toplevel(),
				use_header_bar: false,
		});
		
		this._chooser.set_current_folder(GLib.get_home_dir());
		this._chooser.set_select_multiple(true);
		this._chooser.set_local_only(true);
		
		this._chooser.add_button (Gtk.STOCK_CANCEL, 0);
		this._chooser.add_button (Gtk.STOCK_OPEN, 1);
		this._chooser.set_default_response(1);
		
		this._readonly = new Gtk.CheckButton({label: _("Open file(s) as read-only")});
		this._chooser.set_extra_widget(this._readonly);
	},

	_onActivate: function() {
		if (this._chooser.run () == 1) {
			let files = [];
			let uhome = GLib.get_home_dir();
			let uname = GLib.get_user_name();
			let mpath = GLib.build_pathv('/', ['/media', uname]);
			let found_invalid = false
			for (let i in this._chooser.get_filenames()) {
				let file = this._chooser.get_filenames()[i];
				if (GLib.path_is_absolute(file) == false) {
					file = GLib.build_pathv('/', [uhome, file]);
				}
				
				if ((file.indexOf(uhome) == 0) || (file.indexOf(mpath) == 0)) {
					files.push(file);
				} else {
					found_invalid = true;
				}
			}
			if (files.length > 0) {
				print(JSON.stringify({
					'files': files
					, 'readonly': this._readonly.get_active()
				}));
			} else if (found_invalid) {
				print(JSON.stringify({
					'error': _("Only files mounted in your home or removeable medias are allowed")
				}));
			}
		}
		
		this._chooser.destroy();
	},

	_onStartup: function() {
		this._buildUI();
	}
});

let app = new OzShellOpenFileApp();
app.application.run(ARGV);
