const crypto = require('crypto');
const mongo = require('mongodb').MongoClient;
const ObjectId = require('mongodb').ObjectId;

const Logs = require('@coya/logs');

// private variables
let collections = {};
let db = null;
let logs = null;

module.exports = class Database {
	static connect(config) {
		if(db) // already connected to the database
			return Promise.resolve();

		const database = config.dbName || config.database || config.db || config.databaseName;
		const login = config.dbLogin || config.login;
		const password = config.dbPassword || config.password || config.pw;

		if(!database)
			return Promise.reject(new Error('Invalid database configuration object.'));
		if(!login && password)
            return Promise.reject(new Error('Invalid database configuration object.'));

		let dbUrl;
		if(!password) {
			if(!login)
				dbUrl = 'mongodb://localhost:27017/' + database;
			else
            	dbUrl = 'mongodb://' + login + '@localhost:27017/' + database;
        }
        else
            dbUrl = 'mongodb://' + login + ':' + password + '@localhost:27017/' + database;

		logs = new Logs('database', config);
		return mongo.connect(dbUrl)
		.then(function(database) {
			logs.info('Connected and authenticated to database.');
			db = database;
		});
	}

	static createCollection(collectionName) {
		logs.info('Creating collection "' + collectionName + '"...');
		return db.createCollection(collectionName)
		.then(Database.selectCollection.bind(null, collectionName));
	}

	static createCappedCollection(collectionName, size, max) {
		return Database.collectionExists(collectionName)
		.then(function(exists) {
			if(!exists) {
				logs.info('Creating capped collection "' + collectionName + '" of size = ' + size + ' and max = ' + max + '...');
				return db.createCollection(collectionName, {capped: true, size: size, max: max})
				.then(Database.selectCollection.bind(null, collectionName));
			}
			return Database.selectCollection(collectionName);
		});
	}

	static createIndex(collectionName, index) {
		collections[collectionName].indexExists(index)
		.then(function(exists) {
			if(!exists) {
				logs.info('Collection "' + collectionName + '" : creating index...');
				return collections[collectionName].createIndex(index);
			}
			return Promise.resolve();
		});
	}

	static collectionExists(collectionName) {
		return db.listCollections().toArray()
		.then(function(collections) {
			for(let collection of collections)
				if(collection.name === collectionName)
					return Promise.resolve(true);
			return Promise.resolve(false);
		});
	}

	static getCollection(collectionName) {
		return collections[collectionName];
	}

	static selectCollection(collectionName) {
		return new Promise(function(resolve, reject) {
			if(!db)
				reject('Not connected to database.');
			else {
				if(collections[collectionName]) // collection already selected
					resolve();
				else
					db.collection(collectionName, function(err, collection) {
						if(err) {
							logs.error('Collection "' + collectionName + '" does not exist.');
							reject(err);
						}
						else {
							collections[collectionName] = collection;
							logs.info('Collection "' + collectionName + '" selected.');
							resolve();
						}
					});
			}
		});
	}

	static selectCollections(collectionNames) { // the promise usage is required
		const promises = [];
		for(let collectionName of collectionNames)
			promises.push(Database.selectCollection(collectionName));
		return Promise.all(promises)
		.then(function() { // allows to not return an array any[] in the function then()
			return null;
		});
	}

	static addDocs(collectionName, docs, callback = null) {
		if(!Array.isArray(docs))
			docs = [docs];
		return collections[collectionName].insertMany(docs)
		.then(function(result) {
			if(result.insertedCount !== docs.length) {
				const err = 'One or several document(s) could not be added.';
				logs.error(err);
				if(callback) callback(err, result.ops);
				return Promise.reject(err);
			}
			else {
				logs.debug('Adding documents succeeded.');
				if(callback) callback(null, result.ops);
				return result.ops;
			}
		})
		.catch(function(err) {
			logs.error(err);
			if(callback) callback(err);
			return err;
		});
	}

	static addOrUpdateOneDoc(collectionName, pattern, doc, callback = null) {
		return collections[collectionName].findOneAndUpdate(pattern, doc, {upsert: true})
		.then(function(result) {
			logs.debug('Adding or updating document succeeded.');
			if(callback) callback(null, result);
			return result;
		})
		.catch(function(err) {
			logs.error(err);
			if(callback) callback(err);
			return err;
		});
	}

	static updateOneDoc(collectionName, doc, filter = null, options = null, callback = null) {
		if(typeof filter === 'function') {
			callback = filter;
			filter = null;
			options = null;
		}
		else if(typeof options === 'function') {
			callback = options;
			options = null;
		}

		if(!filter) {
			if(doc._id) { // identification by a MongoDB id
				filter = {_id: ObjectId(doc._id)};
				delete doc._id; // otherwise MongoDB forbids the change
			}
			else if(doc.id) // identification by a custom id
				filter = {id: doc.id};
			else {
				logs.error('Impossible to get the unique id.');
				if(callback) callback(true);
				return Promise.reject('Impossible to get the unique id.');
			}
		}

		return collections[collectionName].updateOne(filter, doc, options)
		.then(function() {
			logs.debug('Updating document succeeded.');
			if(callback) callback(false);
			return null; // return a new promise
		})
		.catch(function(err) {
			logs.error(err);
			if(callback) callback(true);
			return err;
		});
	}

	static deleteOneDoc(collectionName, docId, callback = null) {
		return new Promise(function(resolve, reject) {
			collections[collectionName].deleteOne({_id: ObjectId(docId)}, function(err, result) {
				if(err)
					logs.error(err);
				else
					logs.debug('Deletion document succeeded.');
				if(callback) callback(err, result);
				if(err) reject(err);
				else resolve(result);
			});
		});
	}

	static deleteDocsByPattern(collectionName, pattern, callback = null) {
		return new Promise(function(resolve, reject) {
			collections[collectionName].deleteMany(pattern, function(err, result) {
				if(err)
					logs.error(err);
				else
					logs.debug('Deletion document succeeded.');
				if(callback) callback(err, result);
				if(err) reject(err);
				else resolve(result);
			});
		});
	}

	static getOneDoc(collectionName, query, callback = null) {
		return new Promise(function(resolve, reject) {
			logs.debug('Searching document with query = ' + JSON.stringify(query) + '.');
			if(query._id)
				query._id = ObjectId(query._id);

			collections[collectionName].findOne(query)
			.then(function(result) {
				if(!result)
					logs.debug('Document not found.');
				else
					logs.debug('Document found.');
				if(callback) callback(null, result);
				resolve(result);
			})
			.catch(function(err) {
				logs.error(err);
				if(callback) callback(err);
				reject(err);
			});
		});
	}

	static getDocs(collectionName, query, projection, sort, callback = null) {
		return new Promise(function(resolve, reject) {
			if(typeof query === 'function') {
				callback = query;
				query = null;
				projection = null;
				sort = null;
			}
			else if(typeof projection === 'function') {
				callback = projection;
				projection = null;
				sort = null;
			}
			else if(typeof sort === 'function') {
				callback = sort;
				sort = null;
			}

			let cursor;
			if(query) {
				logs.debug('Collection "' + collectionName + '" : searching documents with query = "' + JSON.stringify(query) + '".');
				if(projection)
					cursor = collections[collectionName].find(query).project(projection);
				else
					cursor = collections[collectionName].find(query);
			}
			else {
				logs.debug('Collection "' + collectionName + '" : searching all documents.');
				cursor = collections[collectionName].find();
			}

			if(sort)
				cursor = cursor.sort(sort);

			cursor.toArray()
			.then(function(result) {
				if(!result || result.length === 0) {
					if(query)
						logs.warning('Collection "' + collectionName + '" : query result is empty.');
					else
						logs.warning('Collection "' + collectionName + '" : collection is empty.');
					result = [];
				}
				else {
					if(query)
						logs.debug('Collection "' + collectionName + '" : query succeeded.');
					else
						logs.debug('Collection "' + collectionName + '" : getting all the collection succeeded.');
				}
				if(callback) callback(null, result);
				resolve(result);
			})
			.catch(function(err) {
				logs.error(err);
				if(callback) callback(err);
				reject(err);
			});
		});
	}

	static getCursor(collectionName, query = {}) {
		logs.debug('Getting cursor from collection "' + collectionName + '".');
		return collections[collectionName].find(query);
	}

	static logIn(collectionName, login, password, callback = null) {
		return collections[collectionName].findOne({login: login})
		.then(function(result) {
			if(!result) {
				logs.warning('Log in query received with invalid login.');
				if(callback) callback(null, {invalid: 'login'});
				return Promise.resolve({invalid: 'login'});
			}
			else {
				if(crypto.createHash('md5').update(password).digest('hex') !== result.password) {
					logs.warning('Log in query received with invalid password.');
					if(callback) callback(null, {invalid: 'password'});
					return Promise.resolve({invalid: 'password'});
				}
				else {
					logs.debug('Succeeded log in query received.');
					if(callback) callback(null, null);
					return Promise.resolve(null);
				}
			}
		})
		.catch(function(err) {
			logs.error(err);
			if(callback) callback(err);
			return Promise.reject(err);
		});
	}

	static registration(collectionName, fields, uniqueFields, callback = null) {
		logs.debug('Registration query received.');

		const query = [];
		for(let uniqueField of uniqueFields)
			query.push({[uniqueField]: fields[uniqueField]});

		return collections[collectionName].findOne({$or: query})
		.then(function(result) {
			if(result) {
				for(let key of Object.keys(result))
					if(result[key] === fields[key]) {
						logs.warning('Field "' + key + '" with value = "' + result[key] + '" exists already into the collection "' + collectionName + '".');
						if(callback) callback(null, key);
						return Promise.resolve(key);
					}
			}
			else {
				if(fields.password)
					fields.password = crypto.createHash('md5').update(fields.password).digest('hex');
				return Database.addDocs(collectionName, fields)
				.then(function() {
					logs.debug('New account created.');
					if(callback) callback();
					return Promise.resolve();
				})
				.catch(function(err) {
					logs.error(err);
					if(callback) callback(err);
					return Promise.reject(err);
				});
			}
		})
		.catch(function(err) {
			logs.error(err);
			if(callback) callback(err);
			return Promise.reject(err);
		});
	}
};