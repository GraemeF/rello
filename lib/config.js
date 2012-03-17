module.exports = {
    "redmine": {
        "uri": process.env.npm_package_config_redmineUri,
        "apiKey": process.env.npm_package_config_redmineApiKey
    },
    "trello": {
        "boardId": process.env.npm_package_config_trelloBoardId,
        "key": process.env.npm_package_config_trelloKey,
        "secret": process.env.npm_package_config_trelloSecret,
        "token": process.env.npm_package_config_trelloToken
    }
};