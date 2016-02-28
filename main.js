var express = require('express')
var swig = require('swig')
var mongoose = require('mongoose')
var bodyParser = require('body-parser')
var uuid = require('uuid')
var bcrypt = require('bcrypt-nodejs')

var session = require('express-session')
var MongoStore = require('express-session-mongo')
var flash = require('flash')

var request = require('request')
var ping = require('net-ping')
var dns = require('dns')
/*var fs = require("fs")*/

var Schema = mongoose.Schema

mongoose.connect('mongodb://localhost/csm')
/*mongoose.connect('mongodb://brvo:BRV0@ds061375.mongolab.com:61375/heroku_7qhftjcs')*/

// Declara tus modelos en este espacio

var ServiceSchema = new Schema({
	name: String,
	host: {url: String, ip: String},
	port: {type:Number, default: 80},
	responsePattern: String,
	created: { type: Date, default: Date.now },
})



var Service = mongoose.model('Service', ServiceSchema)



ServiceSchema.pre('save', function (next) {
	
  next();
});



// Termina la declaracion de modelos



var app = express()

// Add sessions and flash
app.use(session({
	secret: 'keyboard cat',
	store: new MongoStore(),
	saveUninitialized: true,
	resave: true
}))
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
app.get('/', function (req, res) {
	
	var notifications = []
	var services

	Service.find({}).sort({name: 1 }).exec(function(servicesList){
		services = List
	})

	var results = []
	var pingSession = ping.createSession ()
	var domain = "telegana.tv"
	var ip = '127.0.0.1'
	var path = '/api/channel'
	var url = 'http://' + domain + path

	var options = { url : url, 
					time : true,
	}

 
	dns.resolve4(domain, function (err, addresses) {
		console.log('dns')
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
		})



	});
	
	

	/* Using request for make a rhttprequest */
	request(options, function(error, response, body) {
		/*console.log(response['headers'])*/
		/*console.log('************************<')
		Object.keys(response['socket']).forEach(function(par){
			console.log(par)
		})
		*/
		results.push({name : 'defaultEncoding', value: response['_readableState']['defaultEncoding']})
		results.push({name : 'webserver', value: (response['headers']['server']).split(' ')[0]})
		results.push({name : 'server', value: (response['headers']['server']).split(' ')[1]})
		results.push({name : 'serverDate', value:response['headers']['date'] })
		results.push({name : 'statusCode', value: response['statusCode']})
		results.push({name : 'statusMessage', value: response['statusMessage']})
		results.push({name : 'contentType', value: response.headers['content-type'] })
		results.push({name : 'elapsedTime', value: response['elapsedTime']})
	
		console.log('===================')
		/*Object.keys(results).forEach(function(key){
			console.log(key + ':' + results[key])
			
		})*/
		results.forEach(function(result){
			console.log(result.name, result.value)
		})

		res.render('index', { results:results, notifications:notifications, services:services})
		
	});

	console.log(results)
	while(res.locals.flash.length > 0){
		notifications.push(res.locals.flash.pop())
	}
	console.log(typeof notifications)
	console.log(notifications)

})

	


app.get('/sign-up', function (req, res){
	var error = res.locals.flash.pop()

	res.render('sign-up', {
		error: error
	})
})

app.get('/sign-in', function (req, res){
	var error = res.locals.flash.pop()

	res.render('log-in',{
		error: error
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