class Time {
	static convertTimeToReadable(datetime) { // milliseconds expected
		const date = new Date(datetime);
		const diff = Date.now() - date.getTime();
		if(diff < Time.oneSecond * 10) // 10 seconds
			return 'a few seconds ago';
		if(diff < Time.oneSecond * 120) // 120 seconds
			return parseInt(diff / Time.oneSecond) + ' seconds ago';
		if(diff < Time.oneMinute * 120) // 120 minutes
			return parseInt(diff / Time.oneMinute) + ' minutes ago';
		if(diff < Time.oneHour * 48) // 48 hours
			return parseInt(diff / Time.oneHour) + ' hours ago';
		if(diff < Time.oneDay * 30) // 30 days
			return parseInt(diff / Time.oneDay) + ' days ago';

		const day = date.getDate();
		const month = date.getMonth() + 1;
		const year = date.getFullYear();
		return (day < 10 ? '0' : '') + day + '/' + (month < 10 ? '0' : '') + month + '/' + year;
	}

	static convertReadableToMilliseconds(readable) {
		if(Number.isInteger(readable)) // already milliseconds
			return readable;

		let matchResult = readable.match(/([0-9]{1,2}) (s|sec|secs|second|seconds) ago/);
		if(matchResult)
			return Date.now() - Time.oneSecond * parseInt(matchResult[1]);

		matchResult = readable.match(/([0-9]{1,2}) (m|min|mins|minute|minutes) ago/);
		if(matchResult)
			return Date.now() - Time.oneMinute * parseInt(matchResult[1]);

		matchResult = readable.match(/([0-9]{1,2}) (h|hr|hrs|hour|hours) ago/);
		if(matchResult)
			return Date.now() - Time.oneHour * parseInt(matchResult[1]);

		matchResult = readable.match(/([0-9]{1,2}) (d|day|days) ago/);
		if(matchResult)
			return Date.now() - Time.oneDay * parseInt(matchResult[1]);

		matchResult = readable.match(/([0-9]{1,2}) (w|wk|week|weeks) ago/);
		if(matchResult)
			return Date.now() - Time.oneWeek * parseInt(matchResult[1]);

		matchResult = readable.match(/([0-9]{1,2}) (mon|month|months) ago/);
		if(matchResult)
			return Date.now() - Time.oneMonth * parseInt(matchResult[1]);

		matchResult = readable.match(/([0-9]{1,2}):([0-9]{1,2})/);
		if(matchResult)
			return matchResult[1] * Time.oneHour + matchResult[2] * Time.oneMinute;

		const date = new Date(readable);
		return date != 'Invalid Date' ? date.getTime() : null;
	}

	static roundDateToDay(date) {
		if(!date)
			date = new Date();
		else if(!Number.isInteger(date)) { // not milliseconds
			date = new Date(date).getTime();
			if(!date)
				throw new Error('Invalid provided date.');
		}
		return date - (date % Time.oneDay);
	}

	static getMidnight() { // return UTC milliseconds
		const midnight = new Date();
		midnight.setUTCHours(0, 0, 0, 0);
		return midnight.getTime();
	}

	static getMillisecondsFromMidnight() {
		return Date.now() % Time.oneDay;
	}

	static millisecondsToTime(ms) {
		const date = new Date(ms);
		const hours = date.getUTCHours();
		const minutes = date.getUTCMinutes();
		return (hours < 10 ? '0' : '') + hours + ':' + (minutes < 10 ? '0' : '') + minutes;
	}

	static millisecondsToDate(ms, format = 'dmy', separator = '/') {
		const date = new Date(ms);
		const day = date.getDate();
		const month = date.getMonth() + 1;
		const year = date.getFullYear();

		if(format == 'dmy')
			return (day < 10 ? '0' : '') + day + separator + (month < 10 ? '0' : '') + month + separator + year;
		else if(format == 'mdy')
			return (month < 10 ? '0' : '') + month + separator + (day < 10 ? '0' : '') + day + separator + year;
		else if(format == 'ymd')
			return year + separator + (month < 10 ? '0' : '') + month + separator + (day < 10 ? '0' : '') + day;
		else
			throw new Error('Invalid provided date format.');
	}

	static dateToMilliseconds(date, format = 'dmy', separator = '/') {
		const split = date.split(separator);
		date = new Date();
		if(format == 'dmy')
			date.setUTCFullYear(split[2], split[1] - 1, split[0]);
		else if(format == 'mdy')
			date.setUTCFullYear(split[2], split[0] - 1, split[1]);
		else if(format == 'ymd')
			date.setUTCFullYear(split[0], split[1] - 1, split[2]);
		else
			throw new Error('Invalid provided date.');
		date.setUTCHours(0, 0, 0, 0);
		return date.getTime();
	}

	static timeToMilliseconds(time) {
		if(time.indexOf(':') == -1)
			throw new Error('Invalid provided time.');

		const split = time.split(':');
		return split[0] * Time.oneHour + split[1] * Time.oneMinute;
	}
};

Time.oneSecond = 1000;
Time.oneMinute = Time.oneSecond * 60;
Time.oneHour = Time.oneMinute * 60;
Time.oneDay = Time.oneHour * 24;
Time.oneWeek = Time.oneDay * 7;
Time.oneMonth = Time.oneDay * 30;
Time.oneYear = Time.oneMonth * 12;

module.exports = Time;