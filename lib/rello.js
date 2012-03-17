var config = require('./config');
var Step = require('step');
var Redminer = require('redminer');
var Trello = require("trello");
require('sugar');

var trello = new Trello(config.trello.key, config.trello.token);
var redminer = new Redminer(config.redmine.uri, config.redmine.apiKey);

var ensureListExists = function (boardId, status, lists, callback) {
    var list = lists.find(function (x) {
        return x.name === status.name;
    });

    if (list) {
        console.log("List already exists:", list.name);
        callback(null, list);
    }
    else {
        console.log("Adding list:", status.name);
        trello.addListToBoard(boardId, status.name, callback);
    }
};
var convertIssueToCard = function (issue, listsByStatus) {
    return {
        name: issue.subject,
        desc: issue.description,
        idList: listsByStatus.find(
            function (list) {
                return list.name == issue.status.name;
            }).id
    };
};

var getListsByStatus = function (boardId, statuses, callback) {
    Step(function () {
            trello.getListsOnBoard(boardId, this);
        },
        function (error, lists) {
            var group = this.group();

            statuses.each(function (status) {
                ensureListExists(boardId, status, lists, group());
            });
        },
        callback);
};

var deleteAllCardsOnBoard = function (boardId, callback) {
    Step(function () {
            console.log('Getting existing cards.');
            trello.getCardsOnBoard(boardId, this)
        },
        function (error, cards) {
            if (error) {
                console.log(error);
                throw error;
            }
            var group = this.group();

            cards.each(function (card) {
                console.log("Deleting:", card.name);
                trello.deleteCard(card.id, group());
            });
        },
        callback);
};

Step(function () {
        console.log("Getting issues.");
        redminer.getIssues(this.parallel());
        deleteAllCardsOnBoard(config.trello.boardId, this.parallel());
    },
    function (error, issues) {
        if (error) {
            console.log(error);
            throw error;
        }
        var statuses = issues.map(
            function (x) {
                return x.status;
            }).unique();
        var self = this;
        getListsByStatus(config.trello.boardId, statuses, function (error, lists) {
            self(error, {lists: lists, issues: issues});
        });
    },
    function (error, stuff) {
        if (error) {
            console.log(error);
            throw error;
        }
        var group = this.group();

        stuff.issues.each(function (issue) {
            console.log("Adding card:", issue.subject);
            var card = convertIssueToCard(issue, stuff.lists);
            trello.addCard(card.name, card.desc, card.idList, group());
        });
    },
    function (error, createdCards) {
        if (error) {
            console.log(error);
            throw error;
        }
        console.log('Added ' + createdCards.length + ' cards.');
    }
);