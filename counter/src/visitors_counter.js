const Counter = require('./Counter');

const ips = {};
const sessions = {}; // it is just to handle multiple requests at the same time

module.exports = (req, res, next) => {
	Counter.inc(req.hostname + '-requests', {dailyCounter: true});

	// check if express-session middleware is enabled
	if(req.session === undefined)
		return next();

	// if this session is already in memory, we retrieve it to get the last updates
	if(sessions[req.session.id]) req.session = sessions[req.session.id];

	// determine the today date
	const date = new Date(), todayDate = date.getDate() + '/' + (date.getMonth() + 1) + '/' + date.getFullYear();

	// "notFirstVisit" is used because when several requests come at the same time from the same web client, they are not identified with the same session id yet
	// the last visit date is set only after the second wave of requests when the cookie has been initialized client-side
	if(req.session.notFirstVisit && req.session.lastVisitDate !== todayDate) {
		req.session.lastVisitDate = todayDate;
		Counter.inc(req.hostname + '-visitors', {dailyCounter: true});
	}
	req.session.notFirstVisit = true;

	// save into memory
	sessions[req.session.id] = req.session;

	// create an array for the current day to store ip addresses
	if(!ips[todayDate]) ips[todayDate] = [];

	// check if this ip address is new today
	if(!ips[todayDate].includes(req.ip)) {
		ips[todayDate].push(req.ip);
		Counter.inc(req.hostname + '-ip-adresses', {dailyCounter: true});
	}
	
	next();
};
