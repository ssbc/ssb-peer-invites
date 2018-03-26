var chloride = require('chloride')

function box (data, key) {
  if(!data) return
  var b = new Buffer(JSON.stringify(data))
  return chloride.crypto_secretbox_easy(b, key.slice(0, 24), key).toString('base64')
}

function unbox (ctxt, key) {
  var b = new Buffer(ctxt, 'base64')
  var ptxt = chloride.crypto_secretbox_open_easy(b, key.slice(0, 24), key)
  if(!ptxt) return
  try {
    return JSON.parse(ptxt)
  } catch(err) {
    console.error(err)
  }
}


function hash(s) {
  return chloride.crypto_hash_sha256(
    'string' == typeof s ? new Buffer(s, 'utf8') : s
  )
}

exports.hash = hash
exports.box = box
exports.unbox = unbox
