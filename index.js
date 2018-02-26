var mongoose = require('mongoose');
var TeleBot = require('telebot');
var bot = new TeleBot({
	token: 'YOUR_TELEGRAM_TOKEN',
	polling: {
		retryTimeout: 5000, // Optional. Reconnecting timeout (in ms).
		        interval: 1000, // Optional. How often check updates (in ms).
		        timeout: 0 // Optional. Update polling timeout (0 - short polling).
	}
});
var User = require('./models/user.js');
var Coffee = require('./models/coffee.js');
var messages = require('./strings.js');
var Recharge = require('./models/recharge.js');

var SerialPort = require('serialport');
var input_serial_port = process.argv[2] || '/dev/ttyUSB0';

var serial_port = new SerialPort(input_serial_port, {
	baudRate: 9600
});

var step_per_users = {};
var tmp_msg_per_users = {};
var lock_user = null;
var Readline = SerialPort.parsers.Readline;
var parser = serial_port.pipe(new Readline({ delimiter: '\r\n' }));
var chat_ids = {};
//parser.on('data', console.log);

var mongo_options = {
	useMongoClient: true,
	keepAlive: 300000,
	connectTimeoutMS : 30000
};

var configDB = {
	secret: 'YOUR_SECRET',
	url : 'YOUR_DB_URL'
};
mongoose.connect(configDB.url, mongo_options); // connect to our database
mongoose.Promise = Promise;


function
set_user_step(who, step) {
	step_per_users[who] = step;
}

function
lock(username) {
	lock_user = username; //take m.e.
}

function
unlock() {
	lock_user = null;
}

async function
user_exists(username) {
	var user = User.findOne({telegram_username: username});
	return user;
}

async function
create_user(username) {
	var id = -1;
	var tmp_obj = null;
	if(username) {
		tmp_obj = {};
		tmp_obj.username = username;
	}
	var users = await User.find({});
	var user = new User();
	user.telegram_username = username;
	user.name = tmp_msg_per_users[username].name;
	user.credit = tmp_msg_per_users[username].credit;
	user.telegram_chat_id = tmp_msg_per_users[username].telegram_chat_id;
	user.fingerprint_ids = [];
	await user.save();
	return user;
}


async function
add_user_fingerprint(username, save) {
	var user = await User.findOne({telegram_username: username});
	var f_id =  await user.returnAvailableFingerprint();
	if(save === true) {
		user.fingerprint_ids.push(f_id);
		await user.save();
	}
	return f_id;
}

async function
coffee_summary(user) {
	var coffee_cost = 0.25;
	var n_coffee = user.coffee.length;
	var msg = '';
	if(user.credit > 0) {
		msg = "DAEMON_HAPPY";
		messages["DAEMON_HAPPY"] = messages["DAEMON_HAPPY"].replace(/<b>(.*)<\/b>/, '<b>'+user.credit+'</b>');
	} else if(user.credit < 0) {
		msg = "DAEMON_SAD";
		messages["DAEMON_SAD"] = messages["DAEMON_SAD"].replace(/<b>(.*)<\/b>/, '<b>'+(user.credit*-1)+'</b>');
	} else {
		msg = "DAEMON_NEUTRAL";
	}
	send_bot_message(msg, user.telegram_username);
	return;

}

async function
drink_coffee(f_id) {
	var user = await User.returnUserByFingerprint(f_id);
	if(!user) {
		console.log("No user found with this fingerprint");
		return;
	}
	var coffee = new Coffee();
	coffee.user = user._id;
	coffee.insertion_date = new Date();
	user.coffee.push(coffee);
	user.credit = user.credit - 1;
	await coffee.save();
	await user.save();
	var msg = "COFFEE_PAID";
	send_bot_message(msg, user.telegram_username);
	await coffee_summary(user);

	return;

}

async function
recharge_account(username, value) {
	var user = await User.findOne({telegram_username: username});
	var recharge = new Recharge();
	recharge.value = value;
	recharge.user = user._id;
	user.recharges.push(recharge);
	user.credit = user.credit + parseInt(value);
	await recharge.save();
	await user.save();
	await notify_admin(username, recharge);
	await coffee_summary(user);
	return;

}

async function
notify_admin(username, recharge) {
	var admins = await User.find({is_admin: true});

	messages["ADMIN_NOTIFY_RECHARGE"] = messages["ADMIN_NOTIFY_RECHARGE"].replace(/<b class='name'>(.*?)<\/b>/, "<b class='name'>"+username+"</b>");
	messages["ADMIN_NOTIFY_RECHARGE"] = messages["ADMIN_NOTIFY_RECHARGE"].replace(/<b class='n_coffee'>(.*?)<\/b>/, "<b class='n_coffee'>"+recharge.value+"</b>");
	for(var i = 0; i < admins.length; i++) {
		var admin = admins[i];
		if(admin.telegram_username !== username) {
			send_bot_message("ADMIN_NOTIFY_RECHARGE", admin.telegram_username);
		}
	}
	return;

}

async function
send_bot_message(msg, username) {
	var string = msg;
	if(msg in messages) {
		string = messages[msg];
	}
	try {
		who = lock_user;
		if(username) {
			who = username;
		}
		var user = await User.findOne({telegram_username: who});
		if(!user) { //try to find in chat_ids
			user = {};
			user.telegram_chat_id = chat_ids[who];
		}
		return bot.sendMessage(user.telegram_chat_id, string, {parseMode:'HTML'});
	} catch(err) {
		console.log(err);
	}
}

async function
handle_answer(msg) {
	var username = msg.from.username;
	var payload = msg.text;
	var chat_id = msg.chat.id;
	var user_status = step_per_users[username];
	var res = true;
	switch(user_status) {
		case "WAIT_FOR_NAME":
			tmp_msg_per_users[username]  = {};
			tmp_msg_per_users[username].name = payload;
			tmp_msg_per_users[username].telegram_chat_id = chat_id;
			set_user_step(username, 'WAIT_FOR_INITIAL_CREDIT');
			res = "INSERT_CREDIT";
			break;
		case "WAIT_FOR_INITIAL_CREDIT":
			if(!parseInt(payload) && parseInt(payload) !== 0) {
				res = "VALID_NUMBER_REQUESTED";
				break;
			}
			tmp_msg_per_users[username].credit = payload;
			var user = await create_user(username);
			set_user_step(username, 'ENROLL_FINGERPRINT');
			res = "READY_TO_ENROLL_FINGERPRINT";
			break;
		case "ENROLL_FINGERPRINT":
			if(payload !== "ok" && payload !== "cancel") {
				res = "ENROLL_FINGERPRINT";
				break;
			}
			if(payload.toUpperCase() === "ok".toUpperCase()) {
				lock(username);
				var f_id = await add_user_fingerprint(username, false);
				write_serial_msg('ENROLL_MODE', f_id);
				res = true;

			} else if(payload.toUpperCase() === "cancel".toUpperCase()) {
				set_user_step(username, 'NULL');
				unlock();
				res = "OPERATION_CANCELED";
			} else {
				set_user_step(username, 'NULL');
				res = "READY_TO_ENROLL_FINGERPRINT";
			}
			break;
		case "RECHARGE_CREDIT":
			if(!parseInt(payload)) {
				res = "VALID_NUMBER_REQUESTED";
				break;
			}
			//tmp_msg_per_users[username].recharge_value = payload;
			await recharge_account(username, payload);
			set_user_step(username, 'NULL');
			res = "CREDIT_UPDATED";
			break;

		default:
			break;
	}
	return res;
}


function
write_serial_msg(what, payload) {
	var msg = '';
	if(!payload) {
		payload = '0';
	}
	switch(what) {
		case "SCAN_MODE":
			what = '0';
			break;
		case "ENROLL_MODE":
			what = '1';
			payload = payload+'';
			break;
		default:
			break;
	}
	msg = what+','+payload;
	serial_port.write(msg, function(err) {
		if (err) {
			return console.log('error on write: ', err.message);
		}
		console.log('message written');
	});
}

async function
read_serial_msg(payload) {
	var msg = '';
	var state = null;
	if(lock_user) {
		state = step_per_users[lock_user]; //user state
	} else {
		state = "READ_FINGERPRINT";
	}
	switch(state) {
		case "ENROLL_FINGERPRINT":
			if(payload === "ok") {
				msg = "SCANNER_READY";
				await send_bot_message(msg);

			} else if(payload === "done") {

				await add_user_fingerprint(lock_user, true); //save the fingerprint id
				msg = "FINGERPRINT_STORED";
				await send_bot_message(msg);
				set_user_step(lock_user, 'NULL');
				unlock();
			} else {
				msg = "ARDUINO_ERROR";
				await send_bot_message(msg);
				set_user_step(lock_user, 'NULL');
				unlock();
				return;
			}
			break;
		case "READ_FINGERPRINT":
			var string = payload.split(',');
			if(string[0] !== "2") { //see utils.h of arduino sketch
				break;
			}
			var f_id = parseInt(string[1]); //payload
			if(!f_id && f_id !== 0) {
				break;
			}
			await drink_coffee(f_id);
			break;
		default:
			break;
	}
}


// Switches the port into "flowing mode"
serial_port.on('data', function (data) {
	var string = data.toString();
	console.log('Data:', data.toString());
	//console.log('Data:', data);
	string = string.replace("\n", "");
	if(string.charAt(0) === "\\") {
		string = string.replace("\\", "");
		bot.sendMessage(lock_user, string);
	} else { //it could be an answer message from arduino
		read_serial_msg(string);
	}
});

// Read data that is available but keep the stream from entering "flowing mode"
serial_port.on('readable', function () {
	var buff = new Buffer();
	//console.log('Data:', serial_port.read());
});

// Open errors will be emitted as an error event
serial_port.on('error', function(err) {
	console.log('Error: ', err.message);
});

bot.on('/add_user', async (msg) => {
	var username = msg.from.username;
	if(lock_user && lock_user !== username) {
		send_bot_message("LOCK_OPERATION", username);
		return;
	}
	var user = await User.findOne({telegram_username: username});
	if(user) {
		send_bot_message("ACCOUNT_ALREADY_EXISTING", username);
		return;
	}
	chat_ids[username] = msg.chat.id; //first time
	set_user_step(username, 'WAIT_FOR_NAME');
	send_bot_message("WRITE_NAME", username);
	return;
});

bot.on('/recharge', async (msg) => {
	var username = msg.from.username;

	if(!await user_exists(username)) {
		chat_ids[username] = msg.chat.id;
		send_bot_message("ACCOUNT_NOT_FOUND", username);
		return;
	}

	set_user_step(username, 'RECHARGE_CREDIT');
	var string = 'INSERT_RECHARGE_VALUE';
	send_bot_message(string, username);
	return;
});

bot.on(['/start', '/back'], msg => {

	var username = msg.from.username;
	set_user_step(username, 'NULL');
	let replyMarkup = bot.keyboard([
		['/add_user', '/recharge', '/new_fingerprint', '/my_credit']
	], {resize: true});

	return bot.sendMessage(msg.from.id, messages["WELCOME"], {parseMode:'HTML', replyMarkup});

});

bot.on(['/cancel'], msg => {
	var username = msg.from.username;
	var user_status = step_per_users[username];
	if(user_status === "ENROLL_FINGERPRINT") {
		write_serial_msg(-1, 0); //random message just to stop arduino
		unlock();

	}
	set_user_step(msg.from.username, 'NULL');
	send_bot_message("OPERATION_CANCELED", username);
	return;

});

bot.on(['/new_fingerprint'], async msg => {
	var username = msg.from.username;
	var string = '';
	if(!await user_exists(username)) {
		chat_ids[username] = msg.chat.id;
		send_bot_message("ACCOUNT_NOT_FOUND", username);
		return;
	}
	set_user_step(username, "ENROLL_FINGERPRINT");
	send_bot_message("ENROLL_FINGERPRINT", username);
	return;

});

bot.on(['/my_credit'], async msg => {
	var username = msg.from.username;
	var string = '';
	if(!await user_exists(username)) {
		chat_ids[username] = msg.chat.id;
		send_bot_message("ACCOUNT_NOT_FOUND", username);
		return;
	}
	var user = await User.findOne({telegram_username: username});
	coffee_summary(user);
	return;
});



bot.on('text', async msg => {

	if(msg.text.charAt(0) === "/") {
		return;
	}
	var username = msg.from.username;
	var res = true;
	if(step_per_users[username] && step_per_users[username] != 'NULL') {
		res = await handle_answer(msg);
		if(res !== true) {
			send_bot_message(res, username);
		}
	} else if(!step_per_users[username]) {
		set_user_step(username, 'NULL');
		let replyMarkup = bot.keyboard([
			['/add_user', '/recharge', '/new_fingerprint', '/my_credit']
		], {resize: true});

		return bot.sendMessage(msg.from.id, messages["WELCOME"], {parseMode:'HTML', replyMarkup});
	} else {
		return;
	}

});


process.on('unhandledRejection', error => {
	// Will print "unhandledRejection err is not defined"
	console.log('unhandledRejection', error);
});

bot.start();
