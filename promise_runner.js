const request = require('request');

module.exports = class PromiseRunner {
	static forEach(action, array, i = 0) {
		return action(array[i]).then(function() {
			if(++i < array.length)
				return this.forEach(action, array, i);
		}.bind(this));
	}

	static waterfall(array) {
		let fct = function() {
			return array.shift()().then(function() {
				if(!!array.length)
					return fct();
			});
		};
		return fct();
	}

	static loop(action, array, i = 0) {
		return action(array[i]).then(function() {
			if(++i < array.length)
				return this.loop(action, array, i);
		});
	}

	static scheduler(action, nbThreads, index) {
		let error = false;

		let loop = function() {
			return action(index++)
			.then(function(isEnd) {
				if(!error && !isEnd) return loop();
			})
			.catch(function(err) {
				error = true; // stop the other loops
				return err; // allows to return a rejected promise
			});
		};

		let promises = [];
		for(let i = 0; i < nbThreads; ++i)
			promises.push(loop());

		return Promise.all(promises);
	}

	static sendRequest(url) {
		return new Promise(function(resolve, reject) {
			let loop = function(nbRequests) {
				request({url: url, timeout: 10000}, function(err, res, body) {
					if(err) {
						if(err.code === 'ESOCKETTIMEDOUT' || err.code === 'ETIMEDOUT') {
							if(nbRequests >= 5)
								reject(err);
							else
								loop(nbRequests + 1);
						}
						else
							reject(err);
					}
					else if(res.statusCode === 404)
						resolve(null);
					else
						resolve(body);
				});
			};
			loop(0);
		});
	}

	static runThreads(promise, index, result = []) {
		let promises = [];

		for(let step = index + 10; index < step; ++index)
			promises.push(promise(index));

		return Promise.all(promises).then(function(res) {
			deepConcat(result, res);
			return this.runThreads(promise, index, result);
		}.bind(this));
	}

	static sleep(action, timeout) {
		return new Promise(function(resolve, reject) {
			setTimeout(function() {
				action()
				.then(resolve)
				.catch(reject);
			}, timeout);
		});
	}
};

function deepConcat(array1, array2) {
	if(Array.isArray(array2[0]))
		array2.forEach(function(element) {
			this.deepConcat(array1, element);
		}.bind(this));
	else
		array2.forEach(function(element) {
			array1.push(element);
		});
}