const Counter = require('./Counter');

const ips = {};
const sessions = {}; // it allows to handle multiple requests at the same time

module.exports = (req, res, next) => {
	Counter.inc(req.hostname + '-requests', {dailyCounter: true});

	// check if express-session middleware is enabled
	if(req.session === undefined)
		return next();

	// if this session is already in memory, we retrieve it to get the last updates
	if(sessions[req.session.id]) req.session = sessions[req.session.id];

	// determine the today date
	const date = new Date(), todayDate = date.getDate() + '/' + date.getMonth() + '/' + date.getFullYear();

	// first, set the last visit time and then, at the second request, set the last visit date
	if(req.session.lastVisitTime && req.session.lastVisitDate !== todayDate) {
		req.session.lastVisitDate = todayDate;
		Counter.inc(req.hostname + '-visitors', {dailyCounter: true});
	}
	req.session.lastVisitTime = date.getTime();

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
