var mongoose = require('mongoose');
var Float = require('mongoose-float').loadType(mongoose);
var Schema = mongoose.Schema;
var User = require('./user.js');


var creditRechargeSchema = new Schema({
	value : Number,
	user: {type: Schema.Types.ObjectId, ref:'User'},
	insertion_date:  {type: Date, default: Date.now()} //date of insertion

});

module.exports = mongoose.model('Recharge', creditRechargeSchema);

