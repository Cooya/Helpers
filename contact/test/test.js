const Contact = require('../index');

const contact = new Contact(require('./config'));

(async () => {
	await contact.sendEmail('Hey', 'Hey toi');
})();
