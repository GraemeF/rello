var config = require('./config');
var Step = require('step');
var Redminer = require('redminer');
var Trello = require("trello");
require('sugar');

var trello = new Trello(config.trello.key, config.trello.token);
var redminer = new Redminer(config.redmine.uri, config.redmine.apiKey);

var escape = function (text) {
    return text.replace('#', '\\#');
};

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

var convertJournalToComment = function (journal) {
    if (!journal.notes)
        return null;

    return '[' + journal.user.name + ' - ' + journal.created_on + ']\n\n' + journal.notes;
};

var getDescription = function (issue) {

    return '[Redmine \\#' + issue.id + '](' + redminer.getIssueUri(issue.id) + ' "See this issue on Redmine")'
        + ' - '
        + issue.author.name
        + ' - '
        + issue.created_on
        + '\n\n' + escape(issue.description);
};

var convertIssueToCard = function (issue, listsByStatus, callback) {
    console.log("Getting issue detail:", issue.subject);
    redminer.getIssue(issue.id, function (error, detail) {
        callback(null, {
            name: issue.subject,
            desc: getDescription(issue),
            idList: listsByStatus.find(
                function (list) {
                    return list.name == issue.status.name;
                }).id,
            comments: detail.journals.map(convertJournalToComment).filter(function (x) {
                return x !== null;
            })
        });
    });
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

var addCardForIssue = function (issue, lists, members, callback) {
    Step(function () {
            convertIssueToCard(issue, lists, this);
        },
        function (error, card) {
            if (error) {
                console.log("Could not convert issue to card:", error);
                throw error;
            }
            var self = this;
            trello.addCard(card.name, card.desc, card.idList, function (error, trelloCard) {
                if (error) {
                    console.log('Could not add card:', error);
                    throw error;
                }
                self(null, {card: card, cardId: trelloCard.id});
            });
        },
        function (error, stuff) {
            if (error) {
                console.log('Could not create stuff after adding card:', error);
                throw error;
            }
            var callback = this;
            var involvedMembers = members.filter(function (x) {

                return (issue.assigned_to && x.fullName == issue.assigned_to.name )
                    || (issue.author && x.fullName == issue.author.name);
            });

            Step(function () {
                    var group = this.group();
                    involvedMembers.each(function (member) {
                        console.log("Adding member to card:", member.fullName);
                        trello.addMemberToCard(stuff.cardId, member.id, function (error) {
                            if (error) {
                                console.log('Could not add member to card:', error);
                                group(error);
                            }
                            group(null, stuff);
                        });
                    });
                },
                function (error) {
                    callback(error, stuff);
                });
        },
        function (error, stuff) {
            if (error) {
                console.log('Something went wrong when assigning members:', error);
                throw error;
            }
            var group = this.group();

            var commentCount = stuff.card.comments.length;
            if (commentCount > 0)
                console.log("Adding " + commentCount + ' comments.');

            stuff.card.comments.each(function (comment) {
                trello.addCommentToCard(stuff.cardId, comment, group());
            });
        },
        callback);
};

Step(function () {
        console.log("Getting issues.");
        redminer.getAllIssues(43, this.parallel());
        console.log("Getting board members.");
        trello.getBoardMembers(config.trello.boardId, this.parallel());
        deleteAllCardsOnBoard(config.trello.boardId, this.parallel());
    },
    function (error, issues, members) {
        var uniqueIssues = issues.unique('id');

        if (error) {
            console.log('Something went wrong during startup:', error);
            throw error;
        }
        var statuses = uniqueIssues.map(
            function (x) {
                return x.status;
            }).unique();
        var self = this;
        getListsByStatus(config.trello.boardId, statuses, function (error, lists) {
            self(error, {lists: lists, issues: uniqueIssues, members: members});
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
            addCardForIssue(issue, stuff.lists, stuff.members, group());
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