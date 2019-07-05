var u = require('./util.js')

//todo: get this from ssb-caps@1.1 instead
module.exports = u.hash('peer-invites').toString('base64')
