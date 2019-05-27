Object.defineProperties(String.prototype, {
	'countChar': {
		value: function(char) {
			let nb = 0;
			for(let i = 0; i < this.length; ++i)
				if(this[i] === char)
					nb++;
			return nb;
		},
		enumerable: false
	},
    'countLines': {
		value: function() {
            return this.split(/\r\n|\r|\n/).length;
        },
		enumerable: false
	},
	'extractUntil': {
		value: function(char) {
			return this.substr(0, this.indexOf(char) - 1);
		},
		enumerable: false
	},
	'removeSubdomain': {
		value: function() {
			if(this.countChar('.') === 2)
				return this.substr(this.indexOf('.') + 1);
			return this;
		},
		enumerable: false
	},
	'priceToNumber': {
		value: function() {
			return Number(this.replace('€', '').replace(',', '.').trim());
		},
		enumerable: false
	}
});

Object.defineProperties(Array.prototype, {
	'inArray': {
		value: function(value) {
			for(let i = 0; i < this.length; i++)
				if(this[i] === value) return true;
					return false;
		},
		enumerable: false
	},
	'inObjList': {
		value: function(property, value) {
			for(let field in this)
				if(this.hasOwnProperty(field) && this[field][property] === value)
					return true;
			return false;
		},
		enumerable: false
	},
	'remove': {
		value: function(value) {
			let index = this.indexOf(value);
			if(index === -1)
				return false;
			this.splice(index, 1);
			return true;
		},
		enumerable: false
	}
});

Object.defineProperties(Object.prototype, {
	'sizeof': {
		value: function() {
			let counter = 0;
			for(let field in this)
				if(this.hasOwnProperty(field))
					counter++;
			return counter;
		},
		enumerable: false
	},
	'clone': {  // version simple
		value: function() {
			const clone = {};
			for(let attr in this)
				if(this.hasOwnProperty(attr))
					clone[attr] = this[attr];
			return clone;
		},
		enumerable: false
	}
});

function sleep(s) {
	const e = new Date().getTime() + (s * 1000);
	while(new Date().getTime() <= e) {}
}

function usleep(s) {
	const e = new Date().getTime() + (s / 1000);
	while(new Date().getTime() <= e) {}
}