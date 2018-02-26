var mongoose = require('mongoose');
var Float = require('mongoose-float').loadType(mongoose);
var Schema = mongoose.Schema;
var Coffe = require('./coffee.js');
var Recharge = require('./recharge.js');

var userSchema = mongoose.Schema({
	telegram_username: {type: String, required: true},
	telegram_chat_id: Number,
	email: {type: String},
	password: String,
	fingerprint_ids: [{type: Number}],
	is_admin: {type: Boolean, default: false},
	name: {type: String, required: true},
	insertion_date:{type: Date, default: Date.now},
	coffee: [{type: Schema.Types.ObjectId, ref:'Coffee'}],
	credit: {type: Number, default: 0},
	recharges: [{type: Schema.Types.ObjectId, ref:'Recharge'}]

});

userSchema.statics.returnUserByFingerprint = async function returnUserByFingerprint(f_id) {
	var user = null;
	try {
		var users = await this.model('User').find({});
		for(var i = 0; i < users.length; i++) {
			if(users[i].fingerprint_ids.indexOf(f_id) > -1) {
				user = users[i];
				break;
			}
		}
		return user;
	} catch(err) {
		console.log(err);
	}
};

userSchema.methods.returnAvailableFingerprint = async function returnAvailableFingerprint() {
	var f_id = 0;
	try {
		var users = await this.model('User').find({});
		for(var i = 0; i < users.length; i++) {
			var tmp_max = Math.max(...users[i].fingerprint_ids);
			if(tmp_max >= f_id) {
				f_id = tmp_max;
				f_id++;
			}
		}
		return f_id;
	} catch(err) {
		console.log(err);
	}
};


// create the model for users and expose it to our app
module.exports = mongoose.model('User', userSchema);
