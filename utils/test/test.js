const utils = require('../index');

(async () => {
	const res = await utils.request('get', 'http://google.fr');
	console.log(res);
})();