const config = require('./config');
const pup = require('../index');

(async () => {
	const browser = await pup.runBrowser({
		proxy: config.proxy
	});
	try {
		const page = await pup.createPage(browser);
		await pup.goTo(page, 'https://www.google.com/');
	} catch(e) {
		console.error(e);
	}
	await browser.close();
})();