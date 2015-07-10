const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const ModalDialog = imports.ui.modalDialog;
const Pango = imports.gi.Pango;
const St = imports.gi.St;

const _DIALOG_ICON_SIZE = 32;

function _setLabelText(label, text) {
	if (text) {
		label.set_text(text);
		label.show();
	} else {
		label.set_text('');
		label.hide();
	}
}

const ConfirmDialog = new Lang.Class({
	Name: 'OzShellDialog',
	Extends: ModalDialog.ModalDialog,
	
	_init: function(dialog, dynsubject, dyndesc) {
		this.parent({
			styleClass: 'end-session-dialog',
			destroyOnClose: true
		});
		
		let mainContentLayout = new St.BoxLayout({ vertical: false });
		this.contentLayout.add(mainContentLayout, {
			x_fill: true,
			y_fill: false
		});
		
		this._iconBin = new St.Bin();
		mainContentLayout.add(this._iconBin, {
			x_fill:  true,
			y_fill:  false,
			x_align: St.Align.MIDDLE,
			y_align: St.Align.MIDDLE
		});
		
		let messageLayout = new St.BoxLayout({ vertical: true });
		mainContentLayout.add(messageLayout, { y_align: St.Align.START });
		
		this._subjectLabel = new St.Label({ style_class: 'end-session-dialog-subject' });
		
		messageLayout.add(this._subjectLabel, {
			y_fill:  false,
			y_align: St.Align.START
		});
		
		this._descriptionLabel = new St.Label({ style_class: 'end-session-dialog-description' });
		this._descriptionLabel.clutter_text.ellipsize = Pango.EllipsizeMode.NONE;
		this._descriptionLabel.clutter_text.line_wrap = true;
		messageLayout.add(this._descriptionLabel, {
			x_fill: true,
			x_align: St.Align.START,
			y_fill:  true,
			y_align: St.Align.START
		});
		
		let displaysubject = dialog.subject;
		if (dynsubject) {
			displaysubject = displaysubject.format(dynsubject);
		}
		let displaydesc = dialog.description;
		if (dyndesc) {
			displaydesc = displaydesc.format(dyndesc);
		}
		
		_setLabelText(this._descriptionLabel, displaydesc);
		_setLabelText(this._subjectLabel, displaysubject);
		
		if (dialog.iconName) {
			this._iconBin.child = new St.Icon({
				icon_name: dialog.iconName,
				icon_size: _DIALOG_ICON_SIZE,
				style_class: dialog.iconStyleClass
			});
		}
		
		let buttons = [];
		for (let i = 0; i < dialog.confirmButtons.length; i++) {
			let signal = dialog.confirmButtons[i].signal;
			let label = dialog.confirmButtons[i].label;
			let keys = dialog.confirmButtons[i].key;
			buttons.push({ action: Lang.bind(this, 
				function() {
					this.close();
					let signalId = this.connect('closed',
						Lang.bind(this, function() {
							this.disconnect(signalId);
							this._confirm(signal);
						}));
				}),
				label: label,
				key: keys
			});
		};
		
		this.setButtons(buttons);
	},

	_confirm: function(signal) {
		this.emit(signal);
	},

	cancel: function() {
		this.close();
	},

	Close: function(parameters, invocation) {
		this.close();
	}
});
