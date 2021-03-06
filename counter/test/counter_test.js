const assert = require('assert');
const dateFormat = require('dateformat');

const Counter = require('../src/Counter');

(async () => {
	await Counter.connect('mongodb://localhost/test');
	await Counter.clearAll();
	assert.equal((await Counter.all()).length, 0);

	let counter = Counter.get('hey');
	let value = await counter.val();
	await counter.inc();
	assert.equal(counter.id, 'hey');
	assert.equal(await counter.val(), value + 1);

	counter = Counter.get('toto.com-requests', { daily: true });
	value = await counter.val();
	await counter.inc();
	assert.equal(counter.id, 'toto.com-requests-' + dateFormat(new Date(), 'dd-mm-yyyy'));
	assert.equal(await counter.val(), value + 1);

	counter = Counter.get('toto.com-requests', { global: true });
	value = await counter.val();
	await counter.inc();
	assert.equal(counter.id, 'toto.com-requests-global');
	assert.equal(await counter.val(), value + 1);

	// update the same counters in parallel
	counter = Counter.get('test-parallel');
	await Promise.all([
		counter.inc(),
		counter.inc(),
		counter.inc(),
		counter.inc(),
		counter.inc()
	]);
	await Promise.all([
		Counter.inc('test-parallel2'),
		Counter.inc('test-parallel2'),
		Counter.inc('test-parallel2'),
		Counter.inc('test-parallel2'),
		Counter.inc('test-parallel2')
	]);

	assert.equal((await Counter.all()).length, 5);
	await Counter.disconnect();
	console.log('Counters test ok.');
})();
