const assert = require('assert');
const Time = require('../index');

assert.equal(Time.convertTimeToReadable(Date.now()), 'a few seconds ago');
assert.equal(Time.convertTimeToReadable(Date.now() - Time.oneDay), '24 hours ago');
assert.equal(Time.convertTimeToReadable(Date.now() - Time.oneDay * 10), '10 days ago');

assert.equal(Time.convertReadableToMilliseconds('10 s ago'), Date.now() - Time.oneSecond * 10); 
assert.equal(Time.convertReadableToMilliseconds('5 mon ago'), Date.now() - Time.oneMonth * 5);
assert.equal(Time.convertReadableToMilliseconds('3 tata ago'), null);
assert.equal(Time.convertReadableToMilliseconds('14:32'), 14 * Time.oneHour + 32 * Time.oneMinute);

assert.equal(Time.roundDateToDay(), new Date(new Date().toISOString().split('T')[0]).getTime());
assert.equal(Time.roundDateToDay(new Date('1995-12-17T03:24:00')), new Date('1995-12-17').getTime());
assert.equal(Time.roundDateToDay(new Date('1987-06-30T17:28:34').getTime()), new Date('1987-06-30').getTime());
assert.throws(() => {
	assert.equal(Time.roundDateToDay(new Date('invalid date')), null);
}, Error);

assert.ok(Time.getMillisecondsFromMidnight() > 0);
assert.ok(Time.getMillisecondsFromMidnight() < Time.oneDay);
const midnight = new Date();
midnight.setUTCHours(0, 0, 0, 0);
assert.ok((Time.getMillisecondsFromMidnight() - midnight.getTime() - new Date().getTime()) < 100);

assert.equal(Time.millisecondsToTime(Time.convertReadableToMilliseconds('14:32')), '14:32');
assert.equal(Time.millisecondsToTime(Time.convertReadableToMilliseconds('05:00')), '05:00');

assert.equal(Time.millisecondsToDate(new Date('2015-08-12').getTime()), '12/08/2015');
assert.equal(Time.millisecondsToDate(new Date('2024-02-29').getTime()), '29/02/2024');
assert.equal(Time.millisecondsToDate(new Date('2024-02-29').getTime(), 'ymd', '-'), '2024-02-29');
assert.equal(Time.millisecondsToDate(new Date('2024-02-29').getTime(), 'mdy', '~'), '02~29~2024');
assert.equal(Time.millisecondsToDate(0), '01/01/1970');
