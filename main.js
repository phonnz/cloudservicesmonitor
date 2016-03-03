var express = require('express')
var swig = require('swig')
var mongoose = require('mongoose')
var bodyParser = require('body-parser')
var uuid = require('uuid')
var bcrypt = require('bcrypt-nodejs')

var session = require('express-session')
var RedisStore = require('connect-redis')(session)
var MongoStore = require('express-session-mongo')
var flash = require('flash')

var request = require('request')
var ping = require('net-ping')
var dns = require('dns')

var Schema = mongoose.Schema

if (process.env.NODE_ENV === 'production') {
	mongoose.connect('mongodb://heroku_g2p8n3d9:h46lh0j1p48g1d2gak7hcumugg@ds019078.mlab.com:19078/heroku_g2p8n3d9')
}else{
	mongoose.connect('mongodb://localhost/csm')
}

// Declara tus modelos en este espacio

var UserSchema = Schema({
	email: String,
	password: String,
	uuid : {type: String, default: uuid.v4}
})

var User = mongoose.model('User', UserSchema)


var ServiceSchema = new Schema({
	name: String,
	host: {url: String, ip: String},
	port: {type:Number, default: 80},
	responsePattern: String,
	created: { type: Date, default: Date.now },
	user: { type: Schema.Types.ObjectId, ref: 'User' },
})

var Service = mongoose.model('Service', ServiceSchema)



ServiceSchema.pre('save', function (next) {
	var isDomain = false
	this.host.url = this.host.url.replace('http://','')

	for(i = 0; i < this.host.url.length; i++){
		if(this.host.url.charAt(i) > '9'){
			console.log('Have chars')
			isDomain = true
			next()
		}
		if(!isDomain) {
			this.host.ip = this.host.url
			this.host.url = ''
		}
	}
	
  next();
});

// Termina la declaracion de modelos



var app = express()

// Add sessions and flash
var sessionConfig = {
	saveUninitialized: true,
	resave: true
}

// Configuramos el store y secreto dependiendo si es heroku o local
if (process.env.NODE_ENV === 'production') {
	sessionConfig.secret = '0b4925ed09ab47f25976904a6f96d36d'
	sessionConfig.store = new RedisStore({url: process.env.REDISTOGO_URL})
}else{
	sessionConfig.secret = 'keyboard cat'
	sessionConfig.store = new MongoStore()

}
app.use(session(sessionConfig))
// Correr en MongoDB:
// use express-sessions
// db.sessions.ensureIndex( { "lastAccess": 1 }, { expireAfterSeconds: 3600 } )
app.use( flash() )

// Configurar de swig!
app.engine('html', swig.renderFile)
app.set('view engine', 'html')
app.set('views', __dirname + '/templates')

// Configurar cache
app.set('view cache', false)
swig.setDefaults({cache:false})// <-- Cambiar a true en produccion

// Agregamos body parser a express
app.use( bodyParser.urlencoded({ extended:false }) )

// Adds static assets
app.use('/assets', express.static('public'));

// Declara tus url handlers en este espacio
app.use(function (req, res, next) {
	if(!req.session.userId){
		return next()
	}

	User.findOne({uuid: req.session.userId}, function(err, user){
		if(err){
			return res.send(500, 'Internal Server Error')
		}

		res.locals.user = user
		next()
	})
})

// TODO Integrate filtered services by user to locals
app.use(function(req, res, next){
	if(!req.session.userId){
		return next()
	}
	Service.find({user:res.locals.user}, function(err, docs){
		if(err){
			res.send(500, 'Internal server error')
		}

		res.locals.services = docs
		next()
	})
})

app.use(function(req, res, next){
	var notifications = []

	while(res.locals.flash.length > 0){
		notifications.push(res.locals.flash.pop())
	}

	res.locals.notifications = notifications

	next()
})



app.get('/', function (req, res) {
	

	res.render('index', { })
})

app.get('/create-service', function (req, res){
	var error = res.locals.flash.pop()

	res.render('create-service',{
		error: error
	})
	
})

app.post('/create-service', function(req, res){

		Service.create({

			name: req.body.name,
			host : {url :req.body.host,},
			port: req.body.port,
			responsePattern: req.body.responsePattern,
			user: res.locals.user,
		},
		function(err, serv){
			if(err){
				req.flash('warning', 'No se logró crear el servicio')
				req.flash('danger', '500 - Internal server error')
				/*res.render(500, 'Internal server Error')*/
				res.redirect('/')
			}
			req.flash('success', 'Se agregó ' + req.body.name + ' como servicio.')
			/*req.flash('danger', 'No has iniciado sesión, los posts no tendrán tu nombre')*/
			res.redirect('/')
			
		})
	
})


app.get('/service/:id', function (req, res) {
	
	Service.findOne({_id: req.params.id})
		.populate('user')
		.exec(function(err, serv){
		
		if(err){
			return res.send(500, 'Internal Server Error')
		}
		
		var results = []
		var pingSession = ping.createSession ({packetSize: 64})
		/*var domain = "telegana.tv"*/
		var domain = serv.host.url.split('/')[0]
		console.log(domain)
		/*var ip = '127.0.0.1'*/
		var ip = serv.ip
		/*var path = '/api/channel'*/
		var path = serv.host.url.replace(domain, '')
		var url = 'http://' + domain + path

		var options = { url : url, 
						time : true,
		}

 
		dns.resolve4(domain, function (err, addresses) {
		  if (err) throw err;
		 
		  console.log('addresses for ' + domain + ': ' + JSON.stringify(addresses));
			ip  = addresses[0]
		  /*addresses.forEach(function (a) {
		    dns.reverse(a, function (err, domains) {
		      if (err) {
		        console.log('reverse for ' + a + ' failed: ' +
		          err.message);
		      } else {
		        console.log('reverse for ' + a + ': ' +
		          JSON.stringify(domains));
		      }
		    });
		  });*/

			pingSession.pingHost(ip, function (error, ip, sent, rcvd) {
				var ms = rcvd - sent
				if (error)
					console.log (domain + ' ' + ip + ": " + error.toString ())
				else
					console.log (domain + ' ' + ip + ": Alive (ms=" + ms + ")")
					serv.ping = ms + ' ms'
			})

		})
	
	

	/* Using request for make a rhttprequest */
	request(options, function(error, response, body) {
		/*console.log(response['headers'])*/
		/*console.log('************************<')
		Object.keys(response['socket']).forEach(function(par){
			console.log(par)
		})
		*/
			/*results.push({name : 'defaultEncoding', value: response['_readableState']['defaultEncoding']})*/
			results.push({name : 'webserver', value: (response['headers']['server']).split(' ')[0]})
			results.push({name : 'server', value: (response['headers']['server']).split(' ')[1]})
			results.push({name : 'serverDate', value:response['headers']['date'] })
			results.push({name : 'statusCode', value: response['statusCode']})
			results.push({name : 'statusMessage', value: response['statusMessage']})
			results.push({name : 'contentType', value: response.headers['content-type'] })
			results.push({name : 'elapsedTime', value: response['elapsedTime']})


			res.render('index', { service: serv, results:results})
		})
		
		
	})

})

app.get('/delete-service/:id', function(req, res){
	
	Service.findOne({_id: req.params.id}).remove( function(err, serv){
		if(err){
			return res.send(500, 'Internal Server Error')
		}

		req.flash('success', 'Se borró correctamente el servicio.')
		return res.redirect('/')

	})
})


app.get('/sign-up', function (req, res){
	/*var error = res.locals.flash.pop()*/

	res.render('sign-up', {
		/*error: error*/
	})
})

app.post('/sign-up', function (req, res){
	if(!req.body.email || !req.body.password){
		req.flash('danger', 'To sign up you need a email and a password')
		return res.redirect('/sign-up')		
	}

	User.findOne({email: req.body.email}, function(err, user){
		if(err){
			return res.send(500, 'Internal Server Error')
		}

		if(user){
			req.flash('danger', 'El correo ya está registrado')
			return res.redirect('/sign-up')
		}

		bcrypt.hash(req.body.password, null/* Salt */, null, function(err, hashedPassword) {
			if(err){
				return res.send(500, 'Internal Server Error')
			}

			User.create({
				email: req.body.email,
				password: hashedPassword
			}, function(err, doc){
				if(err){
					return res.send(500, 'Internal Server Error')
				}

				req.session.userId = doc.uuid
				res.redirect('/')
			})
		});
	})
})


app.get('/sign-in', function (req, res){
	/*var error = res.locals.flash.pop()*/

	res.render('log-in',{
		/*error: error*/
	})
})

app.post('/sign-in', function (req, res){
	if(!req.body.email || !req.body.password){
		req.flash('danger', 'Para iniciar sesión es necesario escribir email y password')
		return res.redirect('/sign-in')
	}

	User.findOne({email: req.body.email}, function(err, user){
		if(err){
			return res.send(500, 'Internal Server Error')
		}

		if(!user){
			console.log('No user')
			req.flash('danger', 'El usuario no existe')
			return res.redirect('/sign-in')
		}

		bcrypt.compare(req.body.password, user.password, function(err, result){
			if(err){
				return res.send(500, 'Internal Server Error')
			}
			req.session.userId = user.uuid
			res.redirect('/')
		})
	})
})

app.get('/sign-out', function (req, res){
	req.session.destroy()
	res.redirect('/')
})



// Termina la declaracion de url handlers

app.set('port', (process.env.PORT || 8000))
app.listen(app.get('port'), function() {
  console.log('Node app is running on port', app.get('port'));
})
/*app.listen(3000, function () {
	console.log('Example app listening on port 8000!')
})*/