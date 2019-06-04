const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const util = require('util');

const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const mkdirp = require('mkdirp');
const sleep = require('sleep');
const xml2js = require('xml2js');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const fileStat = util.promisify(fs.stat);
const parseXML = util.promisify(xml2js.parseString);
const mkdir = util.promisify(mkdirp);
const builder = new xml2js.Builder({ rootName: 'xml' });

let logger = null;
function setLogger(_logger) {
	logger = _logger;
}

async function readXMLFile(filePath) {
	const xml = await readFile(filePath);
	return parseXML(xml);
}

async function writeXMLFile(filePath, content) {
	const xml = builder.buildObject(content);
	await writeFile(filePath, xml);
}

async function downloadFile(url, destFolder, fileName = null, forceDownload = false) {
	await mkdir(destFolder);

	if (!fileName) fileName = path.basename(url);

	const filePath = path.join(destFolder, fileName);
	if (!forceDownload && (await fileExists(filePath)))
		// do not download if the file already exists
		return Promise.resolve(filePath);

	const file = fs.createWriteStream(filePath);

	const request = require('request');
	return new Promise((resolve, reject) => {
		request.get(url).pipe(file);

		file.on('error', reject);
		file.on('finish', resolve.bind(null, filePath));
	});
}

async function fileExists(filePath) {
	try {
		await util.promisify(fs.access)(filePath);
		return true;
	} catch (e) {
		return false;
	}
}

async function fileSize(filePath) {
	return (await fileStat(filePath)).size;
}

function getRandomNumber(min, max) {
	return Number.parseInt(Math.random() * (max - min) + min);
}

async function randomSleep(min, max) {
	let ms = max ? getRandomNumber(min * 1000, max * 1000) : min * 1000;
	if(logger) logger.info('Sleeping for %s milliseconds...', ms);
	await sleep.msleep(ms);
}

function resolveUrl(base, url) {
	if (url.startsWith('http')) return url;
	return base + url;
}

function getLinks($, selector) {
	const links = $(selector);
	if (!links) throw new Error('No link found on the page.');

	const array = [];
	links.map((i, link) => {
		// cheerio map() does not return a new array
		const href = $(link).attr('href');
		if (!href) throw new Error('Href attribute missing.');
		array.push(href);
	});

	return array;
}

async function waitForValue(variable, expectedValue, delay = 500, iterations = 10) {
	for (let i = 0; i < iterations; ++i) {
		if (variable == expectedValue) return true;
		await sleep.msleep(delay);
	}
	return false;
}

async function attempt(action, attemptsNumber = 3) {
	let err;
	for (let i = 0; i < attemptsNumber; ++i) {
		try {
			return await action();
		} catch (e) {
			if(logger) logger.error(e);
			err = e;
		}
		if(logger) logger.info('Trying again in 5 seconds...');
		await sleep.sleep(5);
		resolveUrl;
	}
	throw err;
}

async function asyncForEach(array, callback, maxSimultaneous = 0) {
	if (maxSimultaneous == 0) {
		const arr = [];
		for (let i = 0; i < array.length; i++) arr.push(callback(array[i], i, array));
		return Promise.all(arr);
	} else {
		let i = 0;
		let arr;
		while (i < array.length) {
			arr = [];
			for (let j = 0; j < maxSimultaneous && i < array.length; ++j, ++i)
				arr.push(callback(array[i], i, array));
			await Promise.all(arr);
		}
	}
}

async function asyncThreads(array, callback, threadsNumber = 10) {
	let arrIndex = 0;
	const fct = async () => {
		while (arrIndex < array.length) await callback(array[arrIndex], arrIndex++, array);
	};

	let arr = [];
	for (let i = 0; i < threadsNumber; ++i) arr.push(fct());
	await Promise.all(arr);
}

async function request(method, url, options = {}) {
	let data = null, headers = {};
	if(options.body) {
		data = querystring.stringify(options.body);
		headers = Object.assign({'Content-Type': 'application/x-www-form-urlencoded'}, options.headers);
	}
	else if(options.json) {
		data = JSON.stringify(options.json);
		headers = Object.assign({'Content-Type': 'application/json'}, options.headers);
	}

	let i = 0;
	let res;
	while (++i) {
		try {
			res = await axios({
				method,
				url,
				params: options.params,
				data,
				responseType: options.encoding ? 'arraybuffer' : 'text',
				headers
			});
			break;
		} catch (e) {
			if (e.code == 'ENOTFOUND' && i < 5) {
				if(logger) logger.warn('Server unreachable, trying again in 5 seconds...');
				sleep.msleep(5000);
			} else if (e.message == 'socket hang up') {
				if(logger) logger.warn('The socket has hanged up, trying again in 5 seconds...');
				sleep.msleep(5000);
			} else if (e.message == 'Request failed with status code 404') {
				if(logger) logger.error('The server has returned 404 for url "%s".', url);
				return 404;
			} else throw e;
		}
	}

	if (res.status != 200) throw new Error('Bad response, status code = ' + res.status);

	return options.encoding ? iconv.decode(res.data, options.encoding) : res.data;
}

async function requestPage(method, url, options = {}) {
	const data = await request(method, url, options);
	if (data == 404) return null;
	if (data.length == 0) {
		if(logger) logger.error('The server has returned an empty body for url "%s".', url);
		return null;
	}
	return cheerio.load(data);
}

Array.prototype.equalsTo = function(arr) {
	if (this === arr) return true;
	if (this == null || arr == null) return false;
	if (this.length != arr.length) return false;

	for (var i = 0; i < this.length; ++i) {
		if (this[i] !== arr[i]) return false;
	}
	return true;
};

Array.prototype.getItemWithKey = function(key, value) {
	for (let item of this) {
		if (item[key] == value) return item;
	}
	return null;
};

Array.prototype.removeItem = function(value) {
	for (let i = 0; i < this.length; ++i) {
		if (this[i] == value) {
			this.splice(i, 1);
			break;
		}
	}
	return this;
};

Date.prototype.addDays = function(days) {
	const date = new Date(this.valueOf());
	date.setDate(date.getDate() + days);
	return date;
};

Date.prototype.addSeconds = function(seconds) {
	const date = new Date(this.valueOf());
	date.setSeconds(date.getSeconds() + seconds);
	return date;
};

Date.prototype.isNHoursOld = function(n) {
	const nHours = 1000 * 3600 * n; // in milliseconds
	return new Date().getTime() - this.getTime() < nHours;
};

Date.fromSeconds = (s) => new Date(1970, 0, 1, 0, 0, s);

String.prototype.capitalizeFirstLetter = function() {return this.charAt(0).toUpperCase() + this.slice(1).toLowerCase();};
String.prototype.simplify = function() {return this.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');};

module.exports = {
	setLogger,
	readXMLFile,
	writeXMLFile,
	downloadFile,
	fileExists,
	fileSize,
	deleteFile: util.promisify(fs.unlink),
	getRandomNumber,
	randomSleep,
	resolveUrl,
	getLinks,
	waitForValue,
	attempt,
	asyncForEach,
	asyncThreads,
	request,
	get: requestPage.bind(null, 'get'),
	post: requestPage.bind(null, 'post')
};
