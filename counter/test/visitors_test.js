const assert = require('assert');
const express = require('express');
const expressSession = require('express-session');
const request = require('supertest');

const Counter = require('../src/Counter');
const countVisitors = require('../src/visitors_counter');

function createAgent(secret) {
	const app = express();
	app.use(expressSession({secret: 'secret', resave: false, saveUninitialized: true}));
	app.use(countVisitors);
	app.get('/', (req, res, next) => res.end());
	return request.agent(app);
}

function sendRequest(agent) {
	return new Promise((resolve) => {
		agent.get('/').end(resolve);
	});
}

(async () => {
	// connection to database
	await Counter.connect('mongodb://localhost/test');
	const counter = await Counter.get('127.0.0.1-visitors', {dailyCounter: true});
	await counter.clear();
	assert.equal(await counter.val(), 0);

	// define the server and the agent
	let agent = createAgent();

	// first wave of requests
	await Promise.all([
		sendRequest(agent),
		sendRequest(agent),
		sendRequest(agent)
	]);
	assert.equal(await counter.val(), 0);

	// second wave of requests
	await Promise.all([
		sendRequest(agent),
		sendRequest(agent),
		sendRequest(agent)
	]);
	assert.equal(await counter.val(), 1);

	// third wave of requests
	await Promise.all([
		sendRequest(agent),
		sendRequest(agent),
		sendRequest(agent)
	]);
	assert.equal(await counter.val(), 1);

	// new agent
	agent = createAgent();
	await sendRequest(agent); // init the session
	await sendRequest(agent); // increment the counter
	assert.equal(await counter.val(), 2);

	await Counter.disconnect();
})();
