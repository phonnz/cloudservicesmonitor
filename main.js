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
app.use(session({
	secret: 'keyboard cat',
	/*store: new MongoStore(),*/
    /*store: new MongoStore({
        server: process.env.MONGOLAB_URI    
    }),*/
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


app.use(function(req, res, next){
	Service.find({}, function(err, docs){
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
	var notifications = []

	Service.findOne({_id: req.params.id}, function(err, serv){
		
		/*console.log(serv)*/
		
		var results = []
		var pingSession = ping.createSession ()
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
		

			res.render('index', { notifications:notifications, service: serv, results:results})
		})
		
		
	})

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