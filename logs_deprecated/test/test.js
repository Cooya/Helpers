const config = require('./config');
const Logs = require('../index');

const config1 = {
	dbName: config.dbName,
	dbLogin: config.dbLogin,
	dbPassword: config.dbPassword,
	executionMode: 'prod',
	outputFile: 'test.html',
	outputCollection: null
};

const config2 = {
	dbName: config.dbName,
	dbLogin: config.dbLogin,
	dbPassword: config.dbPassword,
	executionMode: 'prod',
	outputFile: null,
	outputCollection: 'logs.test'
};

console.log('writing into console');
let logs = new Logs('test_1');
logs.info('test');
logs.error('test');
logs.notice('test');
logs.warning('test');
logs.debug('test');

console.log('writing into file');
logs = new Logs('test_2', config1);
logs.clear();
logs.info('test');
logs.error('test');
logs.notice('test');
logs.warning('test');
logs.debug('test');

console.log('writing into database');
logs = new Logs('test_3', config2);
logs.info('test');
logs.error('test');
logs.notice('test');
logs.warning('test');
logs.debug('test');

console.log('waiting...');

setTimeout(() => {
	logs.getLogs()
	.then((entries) => {
		console.log(entries);
		logs.clear().then(logs.disconnect.bind(logs));
	})
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
}, 1000);