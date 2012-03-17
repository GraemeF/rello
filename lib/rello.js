var config = require('./config');
var Step = require('step');
var Redminer = require('redminer');
var Trello = require("trello");
require('sugar');

var trello = new Trello(config.trello.key, config.trello.token);
var redminer = new Redminer(config.redmine.uri, config.redmine.apiKey);

function ensureListExists(boardId, requiredName, lists, callback) {
    if (lists.some(function (x) {
        return x.name === requiredName;
    })) {
        console.log("List already exists:", requiredName);
        callback(null, null);
    }
    else {
        console.log("Adding list:", requiredName);
        trello.addListToBoard(boardId, requiredName, callback);
    }
}

var ensureListsExist = function (boardId, requiredNames, lists, callback) {
    console.log('Checking lists exist:', requiredNames);
    Step(function () {
            var group = this.group();

            requiredNames.each(function (listName) {
                ensureListExists(boardId, listName, lists, group());
            });
        },
        callback);
}

Step(function () {
        redminer.getIssues(this.parallel());
        trello.getListsOnBoard(config.trello.boardId, this.parallel());
    },
    function (error, issues, lists) {
        if (error)
            throw error;

        ensureListsExist(config.trello.boardId, issues.map(
            function (x) {
                return x.status.name;
            }).unique(), lists, this);
    }
);