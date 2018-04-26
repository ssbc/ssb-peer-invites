var chloride = require('chloride')

function hash(s) {
  return chloride.crypto_hash_sha256(
    'string' == typeof s ? new Buffer(s, 'utf8') : s
  )
}

module.exports =  hash("user-invites:DEVELOPMENT")

