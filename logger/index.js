const path = require('path');
const util = require('util');
const { createLogger, config, format, transports } = require('winston');

module.exports = ({dbUrl, collection = 'log', enabled} = {}) => {
	const moduleName = process.mainModule ? path.basename(process.mainModule.filename) : 'unknown';

	let transport;
	let exitOnError;
	const formats = [
		format.timestamp({ format: 'DD/MM HH:mm:ss' }),
		format.label({ label: moduleName }),
		format.errors({ stack: true }),
		format.splat(),
		format.printf(info => {
			info.message = typeof info.message === 'object' ? util.inspect(info.message) : info.message;
			return `${info.timestamp} ${info.level} [${info.label}] ${info.message} ${info.stack || ''}`;
		})
	];

	if (dbUrl && enabled) { // logging into database
		require('winston-mongodb');
		transport = new transports.MongoDB({
			level: 'debug',
			db: dbUrl,
			collection,
			label: moduleName,
			handleExceptions: true,
			format: format.metadata({ fillWith: ['stack'] })
		});
		exitOnError = false;
	} else { // logging into console
		formats.unshift(format.colorize());
		transport = new transports.Console({
			level: process.env.NODE_ENV == 'debug' ? 'debug' : 'info',
			handleExceptions: true
		});
		exitOnError = true;
	}

	return createLogger({
		levels: config.syslog.levels,
		level: 'debug',
		exitOnError,
		transports: [transport],
		format: format.combine(...formats)
	});
}
