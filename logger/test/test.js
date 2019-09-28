const logger = require('../index');

(async () => {
	const fileLogger = logger({file: 'test.log'});
	fileLogger.info('test');
	fileLogger.error('coucou');
	fileLogger.warn('hey');

	const consoleLogger = logger();
	consoleLogger.info('seulement');
	consoleLogger.error('dans la console');
	consoleLogger.warning('pas de fichier');
	consoleLogger.debug('marre des bugs');

	const fileAndConsoleLogger = logger({file: 'test2.log', console: true});
	fileAndConsoleLogger.info('salut');
	fileAndConsoleLogger.error('bien');
	fileAndConsoleLogger.warn('fais gaffe');
})();
