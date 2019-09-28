const path = require('path');
const util = require('util');
const { createLogger, config, format, transports } = require('winston');

const colors = {
	error: 'red',
	warning: 'yellow',
	info: 'green',
	debug: 'white'
};

module.exports = ({db = null, file = null, console = false} = {}) => {
	const moduleName = process.mainModule ? path.basename(process.mainModule.filename) : 'unknown';
	const transportsList = [];
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

	if (db) { // logging into database
		require('winston-mongodb');
		transportsList.push(new transports.MongoDB({
			level: 'debug',
			db,
			collection: db.split('/').pop(),
			label: moduleName,
			handleExceptions: true,
			format: format.metadata({ fillWith: ['stack'] })
		}));
	}

	if (file) { // logging into file
		formats.unshift(format.colorize());
		transportsList.push(new transports.File({
			level: process.env.DEBUG ? 'debug' : 'info',
			filename: file,
			options: {flags: 'w'}
		}));
	}

	if (console || !transportsList.length) { // logging into console
		formats.unshift(format.colorize({ colors } ));
		transportsList.push(new transports.Console({
			level: process.env.DEBUG ? 'debug' : 'info',
			handleExceptions: true
		}));
	}

	const logger = createLogger({
		levels: config.syslog.levels,
		level: process.env.DEBUG ? 'debug' : 'info',
		exitOnError: false,
		transports: transportsList,
		format: format.combine(...formats)
	});
	logger.warn = logger.warning; // alias
	return logger;
}
