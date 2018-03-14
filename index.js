var ssbKeys = require('ssb-keys')

var chloride = require('chloride')

function box (data, key) {
  var b = new Buffer(JSON.stringify(data))
  return chloride.crypto_secretbox_easy(b, key.slice(0, 24), key).toString('base64')
}

function unbox (ctxt, key) {
  //var b = new Buffer(JSON.stringify(data))
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
  return chloride.crypto_hash_sha256(new Buffer(s, 'utf8'))
}

exports.createInvite = function (seed, id, reveal, private) {
  var keys = ssbKeys.generate(null, seed) //K
  return ssbKeys.signObj(keys, null, {
    type: 'invite',
    invite: keys.id,
    host: id, //sign our own key, to prove we created K
    reveal: box(reveal, hash(hash(seed))),
    private: box(private, hash(seed))
  })
}

exports.verifyInvitePublic = function (msg) {
  if(!ssbKeys.verifyObj(msg.content.invite, msg.content)) throw new Error('invalid guest signature')
  if(!ssbKeys.verifyObj(msg.author, msg)) throw new Error('invalid host signature')
  return true
}

exports.verifyInvitePrivate = function (msg, seed) {
  exports.verifyInvitePublic(msg)
  if(msg.content.reveal) {
    var reveal = unbox(msg.content.reveal, hash(hash(seed)))
    if(!reveal) throw new Error('could not decrypt message to be revealed')
  }
  if(msg.content.private) {
    var private = unbox(msg.content.private, hash(seed))
    if(!reveal) throw new Error('could not decrypt private message')
  }
  return {reveal: reveal, private: private}
}

exports.createAccept = function (msg, seed, id) {
  var keys = ssbKeys.generate(null, seed) //K
  if(keys.id != msg.content.invite) throw new Error('seed does not match invite')
  
  var inviteId = ssbKeys.hash(JSON.stringify(msg, null, 2))
  return ssbKeys.signObj(keys, null, {
    reciept: inviteId,
    id: id,
    key: msg.content.reveal ? hash(hash(seed)).toString('base64') : undefined
  })
}

exports.verifyAccept = function (accept, invite) {
  console.log(accept, invite)
  var reveal
  if(ssbKeys.hash(JSON.stringify(invite, null, 2)) !== accept.content.reciept)
    throw new Error('acceptance not matched to given invite')
  if(invite.content.reveal) {
    reveal = unbox(invite.content.reveal, new Buffer(accept.content.key, 'base64'))
    if(!reveal) throw new Error('accept did not correctly reveal invite')
  }

  if(!ssbKeys.verifyObj(invite.content.invite, accept.content))
    throw new Error('did not verify invite-acceptance contents')
  if(!ssbKeys.verifyObj(accept.content.id, accept))
    throw new Error('acceptance must be signed by claimed key')
  return reveal || true
}




