const fs = require('fs');
const path = require('path');
const querystring = require('querystring');
const util = require('util');

const axios = require('axios');
const cheerio = require('cheerio');
const iconv = require('iconv-lite');
const mkdirp = require('mkdirp');
const xml2js = require('xml2js');

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const fileStat = util.promisify(fs.stat);
const parseXML = util.promisify(xml2js.parseString);
const mkdir = util.promisify(mkdirp);

const ParisGMT = new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris', timeZoneName: 'short' }).match(/((GMT|UTC)\+[0-9]+)$/)[1];

let logger = null;
function setLogger(_logger) {
	logger = _logger;
}

async function readXMLFile(filePath) {
	const xml = await readFile(filePath);
	return parseXML(xml);
}

async function writeXMLFile(filePath, content) {
	const builder = new xml2js.Builder({ rootName: 'xml' });
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
	await sleep(ms * 1000);
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

function sleep(seconds) {
	return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

async function waitForValue(variable, expectedValue, delay = 0.5, iterations = 10) {
	for (let i = 0; i < iterations; ++i) {
		if (variable == expectedValue) return true;
		await sleep(delay);
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
		await sleep(5);
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
	else
		headers = options.headers;

	let i = 0;
	let res;
	while (++i) {
		try {
			res = await axios({
				method,
				url,
				timeout: options.timeout || 5000,
				params: options.params,
				data,
				responseType: options.encoding ? 'arraybuffer' : 'text',
				headers
			});
			break;
		} catch (e) {
			if (e.code == 'ENOTFOUND' && i < 5) {
				if(logger) logger.warn('Server unreachable, trying again in 5 seconds...');
				await sleep(5);
			} else if (e.message == 'socket hang up') {
				if(logger) logger.warn('The socket has hanged up, trying again in 5 seconds...');
				await sleep(5);
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

function areEqualArrays(arr1, arr2) {
	if (arr1 === arr2) return true;
	if (arr1 == null || arr2 == null) return false;
	if (arr1.length != arr2.length) return false;

	for (var i = 0; i < arr1.length; ++i)
		if (arr1[i] !== arr2[i])
			return false;

	return true;
}

function simplifyString(str) {
	return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

module.exports = {
	ParisGMT,
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
	sleep,
	waitForValue,
	attempt,
	asyncForEach,
	asyncThreads,
	request,
	get: requestPage.bind(null, 'get'),
	post: requestPage.bind(null, 'post'),
	areEqualArrays,
	simplifyString
};
