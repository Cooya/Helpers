const Counter = require('../src/Counter');

(async () => {
	await Counter.connect('mongodb://localhost/test');

	let counter = Counter.get('hey');
	console.log(counter.id, await counter.val());

	await counter.inc();
	console.log(counter.id, await counter.val());

	counter = Counter.get('hola', {dailyCounter: true});
	console.log(counter.id, await counter.val());

	await counter.inc();
	console.log(counter.id, await counter.val());

	counter = Counter.get('toto.com-requests', {dailyCounter: true})
	console.log(counter.id, await counter.val());

	const counters = await Counter.all();
	counters.map((c) => console.log(c));

	await Counter.disconnect();
})();