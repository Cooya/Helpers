const nodemailer = require('nodemailer');

module.exports = class Mail {
	constructor(config) {
		if(!config.host || !config.port || !config.login || !config.password)
			throw new Error('Missing parameters for sending emails.');
		
		this.host = config.host;
		this.port = config.port;
		this.login = config.login;
		this.password = config.password;
		this.myself = config.myself || config.login;
	}

	sendEmail(subject, text, params = {}) {
		const transporter = nodemailer.createTransport({
			host: this.host,
			port: this.port,
			secure: this.port == 465,
			auth: {
				user: this.login,
			  	pass: this.password
			}
		});

		if(typeof subject !== 'object') {
			params.subject = subject;
			params.text = text;
		} else params = subject; // second and third parameters are ignored

		if(!params.to) params.to = this.myself;
		else params.to = Array.isArray(params.to) ? params.to.join(',') : params.to;
		if(!params.from) params.from = this.myself;
		if(!params.subject) params.subject = 'No subject';
		if(!params.text && !params.html) throw new Error('Email content (text or html) must be specified.');
		return transporter.sendMail(params);
	}
};