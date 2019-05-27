const Counter = require('./Counter');

const sessions = {};

module.exports = (req, res, next) => {
	Counter.inc(req.hostname + '-requests', {dailyCounter: true});

	if(req.session === undefined) // express-session middleware not enabled
		return next();

	// if this session is already in memory, we retrieve it to get the last updates
	if(sessions[req.session.id]) req.session = sessions[req.session.id];

	const date = new Date();
	if(req.session.lastVisit) { // if this is not the first request ever for this session
		const currentDay = date.getDate();
		if(!req.session.lastVisitDay) {
			req.session.lastVisitDay = currentDay;
			Counter.inc(req.hostname + '-visitors', {dailyCounter: true});
		}
		else {
			if(req.session.lastVisitDay !== currentDay) {
				req.session.lastVisitDay = currentDay;
				Counter.inc(req.hostname + '-visitors', {dailyCounter: true});
			}
		}
	}
	req.session.lastVisit = date.getTime();
	sessions[req.session.id] = req.session;
	next();
};