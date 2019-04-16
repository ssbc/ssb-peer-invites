var chloride = require('chloride')

function hash(s) {
  return chloride.crypto_hash_sha256(
    'string' == typeof s ? Buffer.from(s, 'utf8') : s
  )
}

module.exports =  hash("peer-invites:DEVELOPMENT") //XXX DON'T publish without fixing this!

// TODO
