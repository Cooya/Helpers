const nodemailer = require('nodemailer');

module.exports = class Mail {
	constructor(config) {
		if(!config.host || !config.port || !config.login || !config.password)
			throw new Error('Missing parameters for sending emails.');
		
		this.login = config.login;
		this.name = config.name;

		this.transporter = nodemailer.createTransport({
			host: config.host,
			port: config.port,
			secure: config.port == 465,
			auth: {
				user: config.login,
				pass: config.password
			},
			dkim: config.dkim
		});
	}

	sendEmail(subject, text, params = {}) {
		if(typeof subject !== 'object') {
			params.subject = subject;
			params.text = text;
		} else params = subject; // second and third parameters are ignored

		if(!params.text && !params.html)
			throw new Error('Email content (text or html) must be specified.');

		// recipient(s)
		if(!params.to)
			params.to = this.login;
		else
			params.to = Array.isArray(params.to) ? params.to.join(',') : params.to;

		// sender
		if(!params.from)
			params.from = this.login;
		const name = params.name || this.name;
		if(name)
			params.from = `${name} <${params.from}>`;

		// email content
		if(!params.subject)
			params.subject = 'No subject';

		// sending
		return this.transporter.sendMail(params);
	}
};
