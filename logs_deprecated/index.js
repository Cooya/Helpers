/* config {
	executionMode: number or string,
	outputCollection: string, // if prod mode, it will write logs into this collection
	outputFile: string // if prod mode, it will write logs into this file
} */

const colors = require('colors');
const fs = require('fs');
const mongo = require('mongodb').MongoClient;

/* Log levels (syslog) */
const EMERGENCY = 0; // system is unusable
const ALERT = 1; // action must be taken immediately
const CRITICAL = 2; // the system is in critical condition
const ERROR = 3; // error condition
const WARNING = 4; // warning condition
const NOTICE = 5; // a normal but significant condition
const INFO = 6; // a purely informational message
const DEBUG = 7; // messages to debug an application

const PROD_MODE = 0;
const DEV_MODE = 1;
const DEBUG_MODE = 2;

module.exports = class Logs {
	constructor(name, config = {}) {
		this.name = name;
		this.config = config;

		if(config.executionMode == PROD_MODE || config.executionMode == 'prod')
			config.executionMode = PROD_MODE;
		else if(config.executionMode == DEV_MODE || config.executionMode == 'dev')
			config.executionMode = DEV_MODE;
		else if(config.executionMode == DEBUG_MODE || config.executionMode == 'debug')
			config.executionMode = DEBUG_MODE;
		else
			config.executionMode = DEV_MODE;

		if(config.executionMode == PROD_MODE) {
			if(config.outputCollection) {
				this.error = writeIntoDabase.bind(this, 'error');
				this.warning = writeIntoDabase.bind(this, 'warning');
				this.notice = (msg) => { log.call(this, 'blue', msg); writeIntoDabase.call(this, 'notice', msg); }; // write into logs and database
				this.info = writeIntoDabase.bind(this, 'info');
				this.debug = writeIntoDabase.bind(this, 'debug');

				this.actionsQueue = [];
				selectCollection.call(this)
				.then(() => {
					this.actionsQueue.forEach((promise) => promise());
					this.actionsQueue = null; // not used anymore
				})
				.catch((err) => {
					throw err;
				});
			}
			else if(config.outputFile) {
				this.logsFile = fs.openSync(config.outputFile, 'a');
				this.error = writeIntoFile.bind(this, 'red');
				this.warning = writeIntoFile.bind(this, 'yellow');
				this.notice = (msg) => { log.call(this, 'blue', msg); writeIntoFile.call(this, 'blue', msg); }; // write into logs and file
				this.info = writeIntoFile.bind(this, 'green');
				this.debug = nothing;
			}
			else {
				this.error = nothing;
				this.warning = nothing;
				this.notice = log.bind(this, 'blue');
				this.info = nothing;
				this.debug = nothing;
			}
		}
		else {
			this.error = error.bind(this, 'red');
			this.warning = log.bind(this, 'yellow');
			this.notice = log.bind(this, 'blue');
			this.info = log.bind(this, 'green');
			this.debug = config.executionMode == DEBUG_MODE ? log.bind(this, 'white') : nothing;
		}

		this.info('Logs handler instantiated.');
	}

	getLogs(limit = 0) {
		return new Promise((resolve, reject) => {
			if(this.config.executionMode != PROD_MODE)
				return reject('No logs');

			if(this.config.outputCollection) {
				if(this.collection)
					this.collection.find().sort({date: -1}).limit(limit).toArray()
					.then(resolve)
					.catch(reject);
				else
					reject('Collection not selected.');
			}
			else if(this.logsFile) {
				fs.readFile(this.config.outputFile, (err, data) => {
					if(err)
						reject(err);
					else
						resolve('<html><body style=\'display: flex; flex-direction: column-reverse;\'>' + data + '</body></html>');
				});
			}
			else
				reject('No logs.');
		});
	}

	clear() {
		if(this.config.executionMode != PROD_MODE)
			return;

		if(this.config.outputCollection) {
			if(this.collection)
				return this.collection.drop();
			else {
				const fct = () => { this.collection.drop(); };
				this.actionsQueue.push(fct.bind(this));
				return Promise.resolve();
			}
		}
		else if(this.logsFile) {
			fs.closeSync(this.logsFile);
			this.logsFile = fs.openSync(this.config.outputFile, 'w');
		}
	}

	disconnect() {
		if(this.config.outputCollection) {
			if(this.collection)
				this.db.close();
			else {
				const fct = () => { this.db.close(); };
				this.actionsQueue.push(fct.bind(this));
			}
		}
	}
};

function nothing() {}

function log(color, msg) {
	console.log(formatMessage(msg, this.name)[color]);
}

function error(color, msg) {
	console.error(formatMessage(msg, this.name)[color]);
}

function writeIntoFile(color, msg) {
	fs.writeSync(this.logsFile, '<div style="color: ' + color + '">' + formatMessage(msg, this.name) + '</div>');
}

function writeIntoDabase(level, msg) {
	const doc = {date: Date.now(), level: level, module: this.name, content: msg};
	if(this.collection)
		this.collection.insertOne(doc);
	else {
		const fct = () => { this.collection.insertOne(doc) };
		this.actionsQueue.push(fct.bind(this));
	}
}

function formatMessage(msg, name) {
	if(msg instanceof Error)
		msg = msg.stack;
	else if(typeof msg !== 'string')
		msg = JSON.stringify(msg);
	return  '[' + new Date().toLocaleString() + '] [' + name + '] ' + msg;
}

function selectCollection() {
	const database = this.config.dbName || this.config.database || this.config.db || this.config.databaseName;
	const login = this.config.dbLogin || this.config.login;
	const password = this.config.dbPassword || this.config.password || this.config.pw;

	if(!database || !login || !password)
		return Promise.reject(new Error('Invalid database configuration object.'));

	return mongo.connect('mongodb://' + login + ':' + password + '@127.0.0.1:27017/' + database)
	.then((db) => {
		this.db = db;
		return db.createCollection(this.config.outputCollection) // not created if already exists
	})
	.then((collection) => {
		this.collection = collection;
		return this.collection.indexExists({date: -1})
		.catch(this.collection.createIndex.bind(this.collection, {date: -1}))
	});
}