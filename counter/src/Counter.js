const dateFormat = require('dateformat');
const MongoClient = require('mongodb').MongoClient;

let mongoConnection;
let counters;
let cache = {};

module.exports = class {
	// private constructor
	constructor(id) {
		this.id = id;
	}

	inc() {
		return counters.updateOne({ id: this.id }, { $inc: { value: 1 } }, { upsert: true });
	}

	async val() {
		const counter = await counters.findOne({ id: this.id });
		return counter ? counter.value : 0;
	}

	clear() {
		return counters.deleteOne({ id: this.id });
	}

	static async connect(dbUrl) {
		if (mongoConnection) return;
		mongoConnection = await MongoClient.connect(dbUrl, { useNewUrlParser: true });
		counters = mongoConnection.db().collection('counters');
		await counters.createIndex({ id: 1 }, { name: 'id_index', unique: true });
	}

	static async disconnect() {
		await mongoConnection.close();
		mongoConnection = null;
		counters = null;
	}

	static get(id, options = {}) {
		if (options.dailyCounter || options.daily) id = id + '-' + dateFormat(new Date(), 'dd-mm-yyyy');
		else if (options.global) id = id + '-global';

		if (!cache[id]) cache[id] = new this(id);
		return cache[id];
	}

	static inc(id, options = {}) {
		return this.get(id, options).inc();
	}

	static val(id, options = {}) {
		return this.get(id, options).val();
	}

	static all() {
		return counters.find().toArray();
	}

	static clear(id, options = {}) {
		if (options.dailyCounter || options.daily) id = id + '-' + dateFormat(new Date(), 'dd-mm-yyyy');
		else if (options.global) id = id + '-global';

		return counters.deleteOne({ id });
	}

	static clearAll() {
		return mongoConnection.db().collection('counters').drop();
	}
};
