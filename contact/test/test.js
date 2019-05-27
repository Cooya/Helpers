const config = require('./config');
const Contact = require('./index');

const contact = new Contact(config);

(async () => {
	//await contact.sendEmail({to: [config.myself], subject: 'Hey', text: 'Hey toi'});
	await contact.sendEmail('Hey', 'Hey toi');
})();