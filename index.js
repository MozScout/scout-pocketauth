/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const express = require('express')
const bodyParser = require('body-parser').json();
const rp = require('request-promise');
const nconf = require('nconf');
const validator = require('validator');

var logOpts = {
  logDirectory: __dirname + '/logs',
  fileNamePattern: 'shim-<date>.log',
  dateFormat:'YYYY.MM.DD-HHa'
};
console.log('log directory: ' + logOpts.logDirectory);

var logger = require('simple-node-logger').createRollingFileLogger(logOpts);
logger.setLevel('debug');

var consumer_key, user_key, access_token, userid;

const oathRequestOptions = {
  uri: 'https://getpocket.com/v3/oauth/request',
  method: 'POST',
  body: '',
  headers: {'Content-Type': 'application/json; charset=UTF-8',
            'X-Accept': 'application/json'}
};

const finalAuthorizeOptions = {
  uri: 'https://getpocket.com/v3/oauth/authorize',
  method: 'POST',
  body: '',
  headers: {'Content-Type': 'application/json; charset=UTF-8',
            'X-Accept': 'application/json'}
};

const addOptions = {
  uri: 'https://getpocket.com/v3/add',
  method: 'POST',
  body: '',
  headers: {'Content-Type': 'application/json; charset=UTF-8',
            'X-Accept': 'application/json'}
};

const clientOptions = {
  uri: 'http://localhost:3001/listen',
  method: 'POST',
  body: '',
  headers: {'Content-Type': 'application/json'}
};


// Read the configuration file for pocket info.
nconf.file({ file: './config/config.json' });
nconf.load();
consumer_key = nconf.get('pocketconsumerkey');  // identity of foxy ext
access_token = nconf.get('access_token');       // user's oauth token
userid = nconf.get('userid');                   // userid

const app = express();
app.get('/', function (req, res) {
  res.send('Hello World!')
})


//
// Pocket Auth Flows
//
app.get('/pocket', function(req, res) {
  var oauthBody = {'consumer_key':consumer_key,
     'redirect_uri': 'http://127.0.0.1:3000/redirecturi'
   };
  oathRequestOptions.body = JSON.stringify(oauthBody);
  rp(oathRequestOptions)
    .then(function(body) {
      let jsonBody = JSON.parse(body);
      logger.debug('Code is:' + jsonBody.code);
      user_key = jsonBody.code;

      var redir = 'https://getpocket.com/auth/authorize?request_token=' +
      user_key + '&redirect_uri=http://127.0.0.1:3000/redirecturi';

      return res.redirect(redir);
    });
});

app.get('/redirecturi', function(req, res) {
  logger.debug('calling redirect');

  var authBody = {
    'consumer_key':consumer_key,
    'code':user_key
  };
  finalAuthorizeOptions.body = JSON.stringify(authBody);
  logger.debug('calling redirect');

  rp(finalAuthorizeOptions)
    .then(function(body) {
      let jsonBody = JSON.parse(body);
      access_token = jsonBody.access_token;
      userid = jsonBody.username;
      // Save to the config so they don't need to redo this.
      nconf.set('access_token', access_token);
      nconf.set('userid', userid);
      nconf.save();
    })
    .catch(function(err) {
      logger.debug('Call failed' + err);
    });
    res.status(200).send('OK');
});

var server = app.listen(3000, function () {
  logger.debug('initializing startup shim');
});
module.exports = server

// this function is called when you want the server to die gracefully
// i.e. wait for existing connections
var gracefulShutdown = function() {
  console.log('Received kill signal, shutting down gracefully.');
  server.close(function() {
    console.log('Closed out remaining connections.');
    process.exit()
  });

   // if after ten seconds, it's not closing, shut down.
   setTimeout(function() {
       console.error('Could not close connections in time, shutting down');
       process.exit()
  }, 10*1000);
}
