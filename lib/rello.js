var rest = require('restler');
var config = require('./config');
var util = require('util');
var sugar = require('sugar');

rest.get(config.redmine.uri + '/issues.json', {headers: {'X-Redmine-API-Key': config.redmine.apiKey}})
    .on('complete', function (result) {
        if (result instanceof Error) {
            console.log('Error: ' + result.message);
        } else {
            var issue = result.issues[0];
            console.log(util.inspect(issue));
        }
    });