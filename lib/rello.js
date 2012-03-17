var config = require('./config');
var util = require('util');
var Redminer = require('redminer');

var redminer = new Redminer(config.redmine.uri, config.redmine.apiKey);

redminer.getIssues(function (error, issues) {
    if (error !== null) {
        console.log('Error: ' + error.message);
    } else {
        var issue = issues[0];
        console.log(util.inspect(issue));
    }
});
