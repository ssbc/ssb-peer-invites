var chloride = require('chloride')

exports.box = function box (data, key) {
  if(!data) return
  var b = Buffer.from(JSON.stringify(data))
  return chloride.crypto_secretbox_easy(b, key.slice(0, 24), key).toString('base64')
}

exports.unbox = function unbox (ctxt, key) {
  var b = Buffer.from(ctxt, 'base64')
  var ptxt = chloride.crypto_secretbox_open_easy(b, key.slice(0, 24), key)
  if(!ptxt) return
  try {
    return JSON.parse(ptxt)
  } catch(err) {
    console.error(err)
  }
}

exports.hash = function hash (s) {
  return chloride.crypto_hash_sha256(
    'string' === typeof s ? Buffer.from(s, 'utf8') : s
  )
}

exports.parse = function parse (str) {
  if(!/^inv\:/.test(str)) throw new Error('invites must start with "inv:", got '+JSON.stringify(str))
  var ary = str.substring(4).split(',')
  return {
    seed: ary[0],
    invite: ary[1],
    cap: ary[2],
    pubs: ary.slice(3)
  }
}
exports.stringify = function stringify (invite) {
  return 'inv:'+[
      invite.seed,
      invite.invite,
      invite.cap || ''
    ]
    .concat(invite.pubs)
    .join(',')
}

exports.sort = function sort (found) {
  return found.sort(function (a, b) {
    return (!!b.willReplicate) - (!!a.willReplicate) || (b.availability - a.availability)
  })
}
