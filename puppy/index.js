const fs = require('fs');
const puppeteer = require('puppeteer');
const sleep = require('sleep');
const util = require('util');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

let logger = console;
let screenshotsFolder = '';
let proxy = null;
let displayConsole = false;

const browserOptions = {
	args: [
		'--no-sandbox',
		'--disable-setuid-sandbox',
		'--disable-notifications',
		'--disable-dev-shm-usage',
		'--window-size=1600,900',
		'--lang=en_US'
	],
	headless: true
};

module.exports = {
	runBrowser,
	createPage,
	goTo,
	scrollPage,
	infiniteScroll,
	click,
	reloadPage,
	loadCookies,
	saveCookies,
	deleteCookiesFile,
	value,
	attribute,
	screenshot
};

async function runBrowser(options = {}) {
	if(options.logger) logger = options.logger;
	if(options.screenshotsFolder) screenshotsFolder = options.screenshotsFolder;
	if(options.proxy) {
		proxy = options.proxy;
		browserOptions.args.push('--proxy-server=' + proxy.url);
	}
	if(options.displayConsole) displayConsole = true;
	return await puppeteer.launch(Object.assign(browserOptions, options));
}

async function createPage(browser, cookiesFile) {
	logger.debug('Creating page...');
	const page = await browser.newPage();
	await page.setUserAgent('Mozilla/5.0 (Windows NT 6.1; Win64; x64; rv:57.0) Gecko/20100101 Firefox/57.0');
	await page.setViewport({width: 1600, height: 900});
	await page.setExtraHTTPHeaders({'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8'});
	if (cookiesFile) await loadCookies(page, cookiesFile);
	if (proxy && proxy.username && proxy.password) await page.authenticate(proxy);
	process.on('unhandledRejection', (error) => {
		logger.error(error);
		screenshot(page).catch(logger.error.bind(logger));
	});
	if(displayConsole)
		page.on('console', (msg) => {
			for (let i = 0; i < msg.args().length; ++i) logger.info(`${i}: ${msg.args()[i]}`);
		});
	logger.debug('Page created.');
	return page;
}

async function goTo(page, url, options = {}) {
	logger.info('Going to %s...', url);

	options.waitUntil = options.waitUntil || 'networkidle2';
	options.ignoreDestination = options.ignoreDestination !== undefined || false;
	options.timeout = options.timeout !== undefined || 60000;

	while (true) {
		try {
			await page.goto(url, options);
			break;
		} catch (e) {
			if (e.message.indexOf('Navigation Timeout Exceeded') != -1) logger.info('goTo() timeout !');
			else throw e;
		}
	}

	const currentUrl = page.url();
	if (!options.ignoreDestination && currentUrl != url)
		throw Error('The current page is not the destination page, "' + currentUrl + '" != "' + url + '".');
}

async function scrollPage(page, selector, xPosition = 1) {
	logger.info('Scrolling the page...');
	while (true) {
		await page.evaluate('window.scrollTo(0, document.body.scrollHeight * ' + xPosition + ')');
		try {
			await page.waitForSelector(selector, {timeout: 1000});
			return;
		} catch (e) {
			xPosition = xPosition >= 1 ? 0 : xPosition + 0.1;
			logger.info('Scrolling again to ' + xPosition + '...');
		}
	}
}

async function infiniteScroll(page, action) {
	let oldScrollPos = 0;
	let newScrollPos = 0;
	let result = await action();
	while (!result) {
		logger.debug('Scrolling the page...');
		newScrollPos = await page.evaluate(() => {
			window.scrollBy(0, document.body.scrollHeight);
			return document.body.scrollHeight;
		});
		await sleep.sleep(1);
		if (oldScrollPos == newScrollPos) break;
		oldScrollPos = newScrollPos;
		result = await action();
	}
	return result;
}

async function click(page, element, timeout = 30) {
	logger.info('Clicking on element...');

	while (true) {
		try {
			await page.evaluate((el) => {
				el.click();
			}, element);
			await page.waitForNavigation({timeout: timeout});
			break;
		} catch (e) {
			if (e.message.indexOf('Navigation Timeout Exceeded') != -1) {
				logger.error('click() timeout !');
				await reloadPage(page);
			} else throw e;
		}
	}
}

async function reloadPage(page, timeout = 30, attempts = 5) {
	logger.info('Reloading page...');

	for (let i = 0; i < attempts; ++i) {
		try {
			await page.reload({timeout: timeout});

			// old version
			//await page.evaluate('location.reload()');
			//await page.waitForNavigation({timeout: timeout});

			return;
		} catch (e) {
			if (e.message.indexOf('Navigation Timeout Exceeded') != -1) logger.error('Page reloading timeout !');
			else throw e;
		}
	}

	throw Error('The internet connection seems lost because the page cannot be reloaded.');
}

async function loadCookies(page, cookiesFile) {
	logger.info('Loading cookies...');
	let cookies;
	try {
		cookies = JSON.parse(await readFile(cookiesFile, 'utf-8'));
	} catch (e) {
		await writeFile(cookiesFile, '[]');
		logger.info('Empty cookies file created.');
		return;
	}
	await page.setCookie(...cookies);
	logger.info('Cookies loaded.');
}

async function saveCookies(page, cookiesFile) {
	logger.info('Saving cookies...');
	const cookies = JSON.stringify(await page.cookies());
	await writeFile(cookiesFile, cookies);
	logger.info('Cookies saved.');
}

async function deleteCookiesFile(cookiesFile) {
	const fileExists = await fs.exists(cookiesFile);
	if (!fileExists) return logger.info('Cookies file does not exist.');
	await fs.unlink(cookiesFile);
	logger.info('Cookies file deleted.');
}

function value(page, selector, value) {
	return page.evaluate(
		(selector, value) => {
			var elt = document.querySelector(selector);
			if (value !== undefined) elt.value = value;
			return elt.value;
		},
		selector,
		value
	);
}

async function attribute(page, selector, attribute, value) {
	return await page.evaluate(
		(selector, attribute, value) => {
			var elt = document.querySelector(selector);
			if (value !== undefined) elt[attribute] = value;
			return elt[attribute];
		},
		selector,
		attribute,
		value
	);
}

async function screenshot(page, folder = '') {
	folder = folder || screenshotsFolder;
	logger.debug('Taking screenshot...');
	await page.screenshot({path: folder + new Date().toISOString() + '.png', fullPage: true});
}
