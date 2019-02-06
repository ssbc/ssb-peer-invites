var crypto = require('crypto')

module.exports = function() {
    return {
        sign: crypto.randomBytes(32),
        peerInvite: crypto.randomBytes(32),
        shs: crypto.randomBytes(32),
    }
}