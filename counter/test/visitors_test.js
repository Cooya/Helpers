const assert = require('assert');
const express = require('express');
const expressSession = require('express-session');
const request = require('supertest');

const Counter = require('../src/Counter');
const countVisitors = require('../src/visitors_counter');

function createAgent(secret = 'secret') {
	const app = express();
	app.enable('trust proxy');
	app.use(expressSession({secret, resave: false, saveUninitialized: true}));
	app.use(countVisitors);
	app.get('/', (req, res, next) => res.end());
	return request.agent(app);
}

function sendRequest(agent, ip = '50.50.50.0') {
	return new Promise((resolve) => {
		agent.get('/').set('X-Forwarded-For', ip).end(resolve);
	});
}

(async () => {
	// connection to database
	await Counter.connect('mongodb://localhost/test');

	// daily requests counter
	const requestsCounter = await Counter.get('127.0.0.1-requests', {dailyCounter: true});
	await requestsCounter.clear();
	assert.equal(await requestsCounter.val(), 0);

	// daily visitors counter
	const visitorsCounter = await Counter.get('127.0.0.1-visitors', {dailyCounter: true});
	await visitorsCounter.clear();
	assert.equal(await visitorsCounter.val(), 0);

	// daily ip addresses counter
	const ipAddressesCounter = await Counter.get('127.0.0.1-ip-adresses', {dailyCounter: true});
	await ipAddressesCounter.clear();
	assert.equal(await ipAddressesCounter.val(), 0);

	// define the server and the agent
	let agent = createAgent();

	// first wave of requests
	await Promise.all([
		sendRequest(agent),
		sendRequest(agent, '50.50.50.1'),
		sendRequest(agent, '50.50.50.2')
	]);
	assert.equal(await visitorsCounter.val(), 0);

	// second wave of requests
	await Promise.all([
		sendRequest(agent),
		sendRequest(agent),
		sendRequest(agent)
	]);
	assert.equal(await visitorsCounter.val(), 1);

	// third wave of requests
	await Promise.all([
		sendRequest(agent),
		sendRequest(agent),
		sendRequest(agent)
	]);
	assert.equal(await visitorsCounter.val(), 1);

	// new agent
	agent = createAgent();
	await sendRequest(agent); // init the session
	await sendRequest(agent); // increment the counter
	assert.equal(await visitorsCounter.val(), 2);

	assert.equal(await ipAddressesCounter.val(), 3);
	assert.equal(await requestsCounter.val(), 11);

	await Counter.disconnect();
	console.log('Visitors test ok.');
})();
