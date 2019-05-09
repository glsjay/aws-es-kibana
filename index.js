#!/usr/bin/env node

var AWS = require('aws-sdk');
var http = require('http');
var httpProxy = require('http-proxy');
var express = require('express');
var bodyParser = require('body-parser');
var stream = require('stream');
var figlet = require('figlet');
var basicAuth = require('express-basic-auth');
var compress = require('compression');
const fs = require('fs');
const homedir = require('os').homedir();

// node ./index endpoint -f saml -p 9201
var yargs = require('yargs')
    .usage('usage: $0 [options] <aws-es-cluster-endpoint>')
    .option('e', {
        alias: 'endpoint',
        default: undefined,
        demand: false,
        describe: 'the es address(es) to bind',
        type: 'string'
    })
    .option('b', {
        alias: 'bind-address',
        default: process.env.BIND_ADDRESS || '127.0.0.1',
        demand: false,
        describe: 'the ip address to bind to',
        type: 'string'
    })
    .option('p', {
        alias: 'port',
        default: process.env.PORT || 9200,
        demand: false,
        describe: 'the port to bind to',
        type: 'number'
    })
    .option('r', {
        alias: 'region',
        default: process.env.REGION,
        demand: false,
        describe: 'the region of the Elasticsearch cluster',
        type: 'string'
    })
    .option('u', {
      alias: 'user',
      default: process.env.AUTH_USER ||process.env.USER,
      demand: false,
      describe: 'the username to access the proxy'
    })
    .option('a', {
      alias: 'password',
      default: process.env.AUTH_PASSWORD || process.env.PASSWORD,
      demand: false,
      describe: 'the password to access the proxy'
    })
    .option('s', {
      alias: 'silent',
      default: false,
      demand: false,
      describe: 'remove figlet banner'
    })
    .option('H', {
        alias: 'health-path',
        default: process.env.HEALTH_PATH,
        demand: false,
        describe: 'URI path for health check',
        type: 'string'
    })
    .option('l', {
      alias: 'limit',
      default: process.env.LIMIT || '10000kb',
      demand: false,
      describe: 'request limit'
    })
    .option('f', {
      alias: 'aws-profile',
      default: process.env.PROFILE || 'saml',
      demand: false,
      describe: 'request aws profile'
    })
    .help()
    .version()
    .strict();

var argv = yargs.argv;

var CREDENTIAL;

var ENDPOINT = process.env.ENDPOINT || argv.e || argv._[0];
if (!ENDPOINT) {
    yargs.showHelp();
    process.exit(1);
}

var BIND_ADDRESS = argv.b;
var PORT = argv.p;
var REQ_LIMIT = argv.l;

var PROFILE = argv.f;
if (!PROFILE) {
  var chain = new AWS.CredentialProviderChain();
  chain.resolve(function (err, resolved) {
      if (err) throw err;
      else CREDENTIAL = resolved;
  });
} else {
  CREDENTIAL = new AWS.SharedIniFileCredentials({profile: PROFILE});
  AWS.config.credentials = CREDENTIAL;
}

// print banner and global info
if(!argv.s) {
  console.log(figlet.textSync('AWS ES Proxy!', {
      font: 'Speed',
      horizontalLayout: 'default',
      verticalLayout: 'default'
  }));
}
console.log('Request limit   : ' + REQ_LIMIT);
console.log('AWS Profile     : ' + PROFILE);


// build proxy for all endpoints
if(Array.isArray(ENDPOINT)){
  var port_count = 0;
  ENDPOINT.forEach(function(endpoint){
    buildProxy(endpoint, BIND_ADDRESS, PORT + port_count, PROFILE);
    port_count += 1;
  });
}else{
  buildProxy(ENDPOINT, BIND_ADDRESS, PORT, PROFILE);
}

function getCredentials(req, res, next) {
  return CREDENTIAL.get(function (err) {
      if (err) return next(err);
      else return next();
  });
}

// Try to infer the region if it is not provided as an argument.
function getRegion(region, endpoint){
  if (region) {
    return region;
  }else{
    var m = endpoint.match(/\.([^.]+)\.es\.amazonaws\.com\.?(?=.*$)/);
    if (m) {
        return m[1];
    } else {
        console.error('region cannot be parsed from endpoint address, either the endpoint must end ' +
                      'in .<region>.es.amazonaws.com or --region should be provided as an argument');
        yargs.showHelp();
        process.exit(1);
    }
  }
}

function getTargetUrl(endpoint){
  var targetUrl = process.env.ENDPOINT || endpoint;
  if (!targetUrl.match(/^https?:\/\//)) {
      targetUrl = 'https://' + targetUrl;
  }
  return targetUrl;
}

function buildProxy(endpoint, bindAddress, port, profile){

  var region = getRegion(argv.r, endpoint);

  var options = {
    target: getTargetUrl(endpoint),
    changeOrigin: true,
    secure: true
  };

  var proxy = httpProxy.createProxyServer(options);

  var app = express();
  app.use(compress());
  app.use(bodyParser.raw({limit: REQ_LIMIT, type: function() { return true; }}));
  app.use(getCredentials);

  if (argv.H) {
    app.get(argv.H, function (req, res) {
        res.setHeader('Content-Type', 'text/plain');
        res.send('ok');
    });
  }

  // use basic auth if username and passord provided
  if (argv.u && argv.a) {

    var users = {};
    var user = process.env.USER || process.env.AUTH_USER;
    var pass = process.env.PASSWORD || process.env.AUTH_PASSWORD;

    users[user] = pass;

    app.use(basicAuth({
      users: users,
      challenge: true
    }));
  }

  app.use(async function (req, res) {
    var bufferStream;
    if (Buffer.isBuffer(req.body)) {
        var bufferStream = new stream.PassThrough();
        await bufferStream.end(req.body);
    }
    proxy.web(req, res, {buffer: bufferStream});
  });

  proxy.on('proxyReq', function (proxyReq, req) {
    var awsEndpoint = new AWS.Endpoint(endpoint);
    var request = new AWS.HttpRequest(awsEndpoint);
    request.method = proxyReq.method;
    request.path = proxyReq.path;
    request.region = region;
    if (Buffer.isBuffer(req.body)) request.body = req.body;
    if (!request.headers) request.headers = {};
    request.headers['presigned-expires'] = false;
    request.headers['Host'] = awsEndpoint.hostname;

    var signer = new AWS.Signers.V4(request, 'es');
    signer.addAuthorization(CREDENTIAL, new Date());
    //console.log(request);

    proxyReq.setHeader('Host', request.headers['Host']);
    proxyReq.setHeader('X-Amz-Date', request.headers['X-Amz-Date']);
    proxyReq.setHeader('Authorization', request.headers['Authorization']);
    if (request.headers['x-amz-security-token']){
      proxyReq.setHeader('x-amz-security-token', request.headers['x-amz-security-token']);
    }
  });

  proxy.on('proxyRes', function (proxyReq, req, res) {
    if (req.url.match(/\.(css|js|img|font)/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  });

  http.createServer(app).listen(port, bindAddress);

  console.log('*********************************************************');
  console.log('AWS ES cluster   at: ' + endpoint);
  console.log('Proxy available  at: http://' + bindAddress + ':' + port);
  console.log('Kibana available at: http://' + bindAddress + ':' + port + '/_plugin/kibana/');
  if (argv.H) {
    console.log('Health endpoint  at: http://' + bindAddress + ':' + port + argv.H);
  }
  //console.log(CREDENTIAL);
}
