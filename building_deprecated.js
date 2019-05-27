const fs = require('fs');
const path = require('path');

const browserify = require('browserify');
const jsx = require('node-jsx').install();
const minify = require('html-minifier').minify; // heavy import
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const converter = new (require('showdown')).Converter();
const sass = require('node-sass');
const slash = require('slash');
const uglifycss = require('uglifycss');

const Database = require('@coya/database');
const File = require('./file');
const Logs = require('@coya/logs');

const PROD_MODE = 0;
const DEV_MODE = 1;
const DEBUG_MODE = 2;

let logs;
let executionMode;
const GENERATED_FILES = {};
const TIMESTAMPS = {};
const TIMESTAMPS_COLLECTION_NAME = 'building.timestamps';

module.exports = class Building {
	static init(config) {
		logs = new Logs('building', config);
		executionMode = config.executionMode;
		if(executionMode != PROD_MODE)
			return Database.selectCollection(TIMESTAMPS_COLLECTION_NAME)
			.then(Database.getDocs.bind(null, TIMESTAMPS_COLLECTION_NAME))
			.then(function(docs) {
				for(let doc of docs)
					GENERATED_FILES[doc['generatedFilePath']] = doc;
				return Promise.resolve();
			});
		else
			return Promise.resolve();
	}

	static buildCSSBundle(bundlePath, cssFilePaths) {
		let generatedFilePaths;

		const compileSCSS = function() {
			generatedFilePaths = []; // we reset the generated file array each time we run the SCSS compilation

			const promises = [];
			for(let cssFilePath of cssFilePaths) {
				if(File.getFileExtension(cssFilePath) === '.scss')
					promises.push(new Promise(function(resolve, reject) {
						logs.info('Compiling SCSS file "' + cssFilePath + '"...');
						sass.render({
							file: cssFilePath
						}, function(err, result) {
							if(err) reject(err);
							else {
								let generatedFilePath = path.join(path.dirname(bundlePath), path.basename(cssFilePath) + '.css');
								File.writeFile(generatedFilePath, result.css, function(err) {
									if(err) reject(err);
									else {
										generatedFilePaths.push(generatedFilePath);
										resolve();
									}
								});
							}
						});
					}));
				else
					generatedFilePaths.push(cssFilePath);
			}
			return Promise.all(promises);
		};

		const building = function() {
			return new Promise(function(resolve, reject) {
				logs.info('Building CSS bundle "' + bundlePath + '"...');
				for(let cssFilePath of cssFilePaths)
					logs.debug('Dependency : ' + cssFilePath);

				compileSCSS().then(function() {
					fs.writeFile(bundlePath, uglifycss.processFiles(generatedFilePaths), (err) => {
						if(err) {
							logs.error('An error has occurred while building the CSS bundle : ' + err);
							reject(err);
						}
						else
							resolve();
					});
				}, reject);
			});
		};

		return executionMode != PROD_MODE ? registerGeneratedFile(bundlePath, cssFilePaths, building) : building();
	}

	static buildReactApp(destPath, templateFilePath, jsxFilePath) {
		const building = function() {
			return new Promise(function(resolve, reject) {
				buildReactBundle(jsxFilePath)
				.then(function(bundleContent) {
					logs.info('Building React app file "' + destPath + '"...');
					fs.readFile(templateFilePath, 'utf8', (err, templateContent) => {
						if(err) {
							logs.error('An error has occurred while building the React application : ' + err);
							reject();
						}
						else {
							const appContent = ReactDOMServer.renderToStaticMarkup(React.createElement(require(jsxFilePath))) + 
							'<script>' + bundleContent + '</script>';
							const templatesParts = templateContent.split('~X~');
							let output = templatesParts[0] + appContent + templatesParts[1];

							if(executionMode == PROD_MODE)
								output = minify(output, {
									removeAttributeQuotes: true,
									collapseWhitespace: true,
									removeComments: true
								});

							fs.writeFile(destPath, output, (err) => {
								if(err) {
									logs.error('An error has occurred while building the React application : ' + err);
									reject();
								}
								else
									resolve();
							});
						}
					});
				})
				.catch(reject);
			});
		};

		return executionMode != PROD_MODE ? registerGeneratedFile(destPath, [templateFilePath, jsxFilePath], building) : building();
	}

	static convertMarkdownToHTML(markdownFilePath, htmlFilePath) {
		if(!htmlFilePath)
			htmlFilePath = File.replaceFileExtension(markdownFilePath, 'html');

		const building = function() {
			return new Promise(function(resolve, reject) {
				logs.info('Building static HTML file from Markdown "' + htmlFilePath + '"...');
				fs.readFile(markdownFilePath, 'utf8', function(err, data) {
					if(err) {
						logs.error(err);
						reject(err);
					}
					else {
						fs.writeFile(htmlFilePath, '<link rel="stylesheet" href="retro.css">' + converter.makeHtml(data), function(err) {
							if(err) {
								logs.error(err);
								reject();
							}
							else
								resolve();
						});
					}
				});
			});
		};

		return executionMode != PROD_MODE ? registerGeneratedFile(htmlFilePath, markdownFilePath, building) : building();
	}

	static buildIfNecessary(generatedFilePath) {
		generatedFilePath = slash(generatedFilePath);
		logs.debug('Checking if need to rebuild : ' + generatedFilePath);

		// return if file is not registered generated file
		if(!GENERATED_FILES[generatedFilePath])
			return Promise.resolve();

		// check and update dependency timestamps in memory
		const promises = [];
		let timestampsChanged = false;
		logs.debug('Checking dependency timestamps...');
		for(let dependency of GENERATED_FILES[generatedFilePath].dependencies)
			promises.push(File.getFileTimestamp(dependency.filePath).then(function(timestamp) {
				if(dependency.timestamp.getTime() !== timestamp.getTime()) {
					dependency.timestamp = timestamp;
					timestampsChanged = true;
				}
			}));
		return Promise.all(promises)

		// run the building process if necessary
		.then(function() {
			if(timestampsChanged) {
				// update the entry in database 
				return Database.addOrUpdateOneDoc(TIMESTAMPS_COLLECTION_NAME, {generatedFilePath: generatedFilePath}, GENERATED_FILES[generatedFilePath])
				.then(GENERATED_FILES[generatedFilePath].process);
			}
			else
				return File.checkFileExistsPromise(generatedFilePath).then(function(exists) {
					return exists ? Promise.resolve() : GENERATED_FILES[generatedFilePath].process();
				});
		});
	}

	static saveFileTimestamp(filePath) {
		filePath = slash(filePath);
		logs.debug('Saving file timestamp : ' + filePath);
		return File.getFileTimestamp(filePath).then(function(timestamp) {
			TIMESTAMPS[filePath] = timestamp;
		});
	}

	static checkFileTimestamp(filePath) {
		filePath = slash(filePath);
		logs.debug('Checking file timestamp : ' + filePath);
		return File.getFileTimestamp(filePath)
		.then(function(timestamp) {
			logs.debug(timestamp + ' ' + TIMESTAMPS[filePath]);
			return Promise.resolve(timestamp.getTime() === TIMESTAMPS[filePath].getTime());
		});
	}
};

function buildReactBundle(jsxFilePath) {
	return new Promise(function(resolve, reject) {
		logs.info('Building React bundle for jsx file "' + jsxFilePath + '"...');
		const tmpBundle = jsxFilePath + '.bundle';
		fs.writeFileSync(tmpBundle, "require('react-dom').render(require('react').createElement(require('" + slash(jsxFilePath) + "')), document.getElementById('app'));");

		const stream = browserify(tmpBundle).transform('reactify'); // transpile jsx to js
		if(executionMode === PROD_MODE)
			stream.transform({global: true}, 'uglifyify');

		stream.bundle(function(error, buffer) {
			File.checkFileExists(tmpBundle, (exists) => {
                if(exists) fs.unlinkSync(tmpBundle);
            });

			if(error) reject(error);
			else resolve(buffer.toString());
		});
	});
}

function registerGeneratedFile(generatedFilePath, dependencyFilePaths, process) {
	if(!Array.isArray(dependencyFilePaths))
		dependencyFilePaths = [dependencyFilePaths];
	generatedFilePath = slash(generatedFilePath);
	for(let i in dependencyFilePaths)
		if(dependencyFilePaths.hasOwnProperty(i))
			dependencyFilePaths[i] = slash(dependencyFilePaths[i]);

		logs.debug('Registering generated file : ' + generatedFilePath);
		for(let dependencyFilePath of dependencyFilePaths)
			logs.debug('Dependency file : ' + dependencyFilePath);

	// create the new instance in memory if not exists
	if(!GENERATED_FILES[generatedFilePath])
		GENERATED_FILES[generatedFilePath] = {generatedFilePath: generatedFilePath, process: process, dependencies: []};
	else
		GENERATED_FILES[generatedFilePath].process = process;

	// drop old dependencies in memory but keep a reference for file timestamps checking
	const oldDependencies = GENERATED_FILES[generatedFilePath].dependencies;
	GENERATED_FILES[generatedFilePath].dependencies = [];

	// check file timestamps and update dependencies in memory
	const promises = [];
	let timestampsChanged = false;
	let depIndex;
	logs.debug('Checking dependency timestamps...');
	for(let dependencyFilePath of dependencyFilePaths)
		promises.push(File.getFileTimestamp(dependencyFilePath).then(function(timestamp) {
			depIndex = oldDependencies.getObjIndexInArray('filePath', dependencyFilePath);
			if(depIndex === -1 || oldDependencies[depIndex].timestamp.getTime() !== timestamp.getTime())
				timestampsChanged = true;
			GENERATED_FILES[generatedFilePath].dependencies.push({filePath: dependencyFilePath, timestamp: timestamp});
		}));
	return Promise.all(promises)

	// run the building process if necessary
	.then(function() {
		if(timestampsChanged) {
			// update the entry in database 
			return Database.addOrUpdateOneDoc(TIMESTAMPS_COLLECTION_NAME, {generatedFilePath: generatedFilePath}, GENERATED_FILES[generatedFilePath])
			.then(process);
		}
		else
			return File.checkFileExistsPromise(generatedFilePath).then(function(exists) {
				return exists ? Promise.resolve() : process();
			});
	});
}

Object.defineProperties(Array.prototype, {
	'inObjArray': {
		value: function(property, value) {
			for(let obj of this)
				if(obj[property] === value)
					return true;
				return false;
			},
		enumerable: false
	},
});

Object.defineProperties(Array.prototype, {
	'getObjIndexInArray': {
		value: function(property, value) {
			for(let i in this)
				if(this.hasOwnProperty(i) && this[i][property] === value)
					return i;
				return -1;
			},
		enumerable: false
	},
});