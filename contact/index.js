const nodemailer = require('nodemailer');

module.exports = class Mail {
	constructor(config) {
		if(!config.host || !config.port || !config.auth && (!config.login || !config.password))
			throw new Error('Missing parameters for sending emails.');
		
		this.login = config.login;
		this.name = config.name;

		this.transporter = nodemailer.createTransport({
			host: config.host,
			port: config.port,
			secure: config.port == 465,
			auth: config.auth || {
				user: config.login,
				pass: config.password
			},
			dkim: config.dkim,
			pool: config.pool || false,
			maxConnections: config.maxConnections || 5
		});
	}

	sendEmail(subject, text, params = {}) {
		if(typeof subject !== 'object') {
			params.subject = subject;
			params.text = text;
		} else params = subject; // second and third parameters are ignored

		if(!params.text && !params.html)
			throw new Error('Email content (text or html) must be specified.');

		const user = params.auth ? params.auth.user : this.login;

		// recipient(s)
		params.to = !params.to ? user : Array.isArray(params.to) ? params.to.join(',') : params.to;
		if(!params.to)
			throw new Error('Email recipient must be specified.');

		// sender address
		if(!params.from) params.from = user;
		if(!params.from)
			throw new Error('Email sender must be specified');

		// sender name
		const name = params.name || this.name;
		if(name)
			params.from = `${name} <${params.from}>`;

		// subject
		if(!params.subject)
			params.subject = 'No subject';

		// sending
		return this.transporter.sendMail(params);
	}
};
