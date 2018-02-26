var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var User = require('./user.js');
var Float = require('mongoose-float').loadType(mongoose);

var bookingSchema = mongoose.Schema({
	insertion_date:  {type: Date, default: Date.now()}, //date of insertion
	user: {type: Schema.Types.ObjectId, ref:'User'},
	cost: {type: Float, default: 0.25}
});
module.exports = mongoose.model('Coffee', bookingSchema);
