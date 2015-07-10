const St = imports.gi.St;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;

const Gettext = imports.gettext.domain('ozshell');
const _ = Gettext.gettext;

//let msg = '{"Type":"Ping","MsgID":1,"IsResponse":false,"Body":{}}';
//let msg = '{"Type":"ListSandboxes","MsgID":1,"IsResponse":false,"Body":{}}';
//let msg = '{"Type":"ListProfiles","MsgID":1,"IsResponse":false,"Body":{}}';
//let msg = '{"Type":"KillSandbox","MsgID":1,"IsResponse":false,"Body":{"Id":1}}';
//let msg = '{"Type":"OpenTerminal","MsgID":1,"IsResponse":false,"Body":{"Id":1}}';
//let msg = '{"Type":"MountFiles","MsgID":1,"IsResponse":false,"Body":{"Id":1","files":["/home/user/derp", "/home/user/Documents/derp.pdf"]}}';
//let msg = '{"Type":"UnmountFile","MsgID":1,"IsResponse":false,"Body":{"Id":1","file":"/home/user/derp"}}';

function _buildOzRequest(type, body) {
	if (!body) {
		body = {}
	}
	return JSON.stringify({
		  'Type': type
		, 'MsgID': 1
		, 'IsResponse': false
		, 'Body': body
	});
}

function Ping() {
	return _commandSync(this._buildOzRequest('Ping', {}));
}

function GetConfig() {
	let jconfig = _commandSync(this._buildOzRequest('GetConfig', {}));
	if (jconfig.Data) {
		try {
			return JSON.parse(jconfig.Data);
		} catch (err) {
			return {error: err};
		}
	}
	return jconfig;
}

function ListRunning() {
	return _commandSync(this._buildOzRequest('ListSandboxes', {}));
}

function MountFiles(sandboxId, files, readonly) {
	let data = {
		Files: files,
		Id: sandboxId,
		ReadOnly: readonly,
	};
	return _commandSync(this._buildOzRequest('MountFiles', data));
}

function UnmountFile(sandboxId, file) {
	let data = {
		File: file,
		Id: sandboxId,
	};
	return _commandSync(this._buildOzRequest('UnmountFile', data));
}

function HaltSandbox(sandboxId) {
	let data = {
		'Id': sandboxId
	};
	return _commandSync(this._buildOzRequest('KillSandbox', data));
}

function _commandSync(commandMsg) {
	let sockClient, sockConnection, output_reader, output_writer;
	
	let addr = new Gio.UnixSocketAddress({address_type: Gio.UnixSocketAddressType.ABSTRACT, path: 'oz-control'});
	sockClient = new Gio.SocketClient({family: Gio.SocketFamily.UNIX});
	
	let sockConnection = sockClient.connect(addr, null);
	
	//let inStr = new Gio.DataInputStream({ base_stream: sockConnection.get_input_stream() });
	//output_reader = new Gio.DataInputStream({ base_stream: inStr });
	let output_reader = new Gio.DataInputStream({ base_stream: sockConnection.get_input_stream() });
	output_reader.set_byte_order(Gio.DataStreamByteOrder.BIG_ENDIAN);
	
	let output_writer = new Gio.DataOutputStream({ base_stream: sockConnection.get_output_stream() });
	output_writer.set_byte_order(Gio.DataStreamByteOrder.BIG_ENDIAN);
	output_writer.put_uint32(commandMsg.length, null);
	output_writer.write(commandMsg, null);
	output_writer.close(null);
	
	output_reader.fill(4, null);
	let blen = output_reader.read_uint32(null);
	
	if (blen == NaN) {
		throw(_("Unable to get message length!"));
	}
	
	output_reader.fill(blen, null);
	
	let buff = output_reader.read_bytes(blen, null).get_data();
	
	output_reader.close(null);
	sockConnection.close(null);
	
	try {
		let jbuff = JSON.parse(buff);
		if (jbuff.Type == "Error") {
			return {'error': jbuff.Body.Msg};
		}
		return jbuff.Body;
	} catch (err) {
		return {'error': err.toString};
	}
}






































/*
OzClient.prototype.Status = function(cbFunc) {
	this._commandAsync(this._buildOzRequest("PushEvents", {}), cbFunc);
}

OzClient.prototype._commandAsync = function (commandMsg, cbFunc) {
	
}

OzClient.prototype.connect = function(gobject, async_res, user_data) {
	if (cancel_connect.is_cancelled()) {
		return;
	}
	
	// cancel any connection calls that may still be running
	cancel_connect.cancel();
	cancel_connect.reset();
	
	if (!gobject) {
		let addr = sockClient.unix_socket_address_new_abstract("oz-daemon", Gio.G_UNIX_SOCKET_ADDRESS_ABSTRACT);
		
		sockClient.connect_to_host_async(addr, null, cancel_connect, this.connect, null);
	} else {
		try {
			sockConnection = gobject.connect_to_host_finish(async_res, null);
			// create new input stream from sockConnection
			this.inStr = new Gio.DataInputStream({ base_stream: sockConnection.get_input_stream() });
			// create new consistent stream for output_reader from inStr (otherwise Shell crashes on read_line_async
			// when the inputstream gets closed by the server)
			output_reader = new Gio.DataInputStream({ base_stream: this.inStr });
		} catch (err) {
			print(err.toString())
		}
	}
};

OzClient.prototype.send = function(data) {
	let outStr = sockConnection.get_output_stream();
	outStr.write(String(data) + '\n', null);
};

OzClient.prototype.read = function() {
	if (cancel_read.is_cancelled()) {
		return;
	}
	// cancel any read calls that may still be running
	cancel_read.cancel();
	cancel_read.reset();
	
	let line = "";
	do {
		line = output_reader.read_line(cancel_read);
	} while (line != "" || line == null)
};

OzClient.prototype.close = function() {
	sockConnection.close(null);
};
*/
