var ssbKeys = require('ssb-keys')

var u = require('./util')

var invite_key = require('./cap')

exports.createInvite = function (seed, host, reveal, private) {
  var keys = ssbKeys.generate(null, seed) //K
  if(keys.id === host)
    throw new Error('do not create invite with own public key')
  return ssbKeys.signObj(keys, invite_key, {
    type: 'invite',
    invite: keys.id,
    host: host, //sign our own key, to prove we created K
    reveal: u.box(reveal, u.hash(u.hash(seed))),
    private: u.box(private, u.hash(seed))
  })
}

exports.verifyInvitePublic = function (msg) {
  if(!ssbKeys.verifyObj(msg.content.invite, invite_key, msg.content))
    throw new Error('invalid guest signature')
  if(msg.content.host != msg.author)
    throw new Error('host did not match author')

  //an ordinary message so doesn't use special hmac_key
  if(!ssbKeys.verifyObj(msg.author, msg))
    throw new Error('invalid host signature')
  return true
}

exports.verifyInvitePrivate = function (msg, seed) {
  exports.verifyInvitePublic(msg)
  if(msg.content.reveal) {
    var reveal = u.unbox(msg.content.reveal, u.hash(u.hash(seed)))
    if(!reveal) throw new Error('could not decrypt message to be revealed')
  }
  if(msg.content.private) {
    var private = u.unbox(msg.content.private, u.hash(seed))
    if(!reveal) throw new Error('could not decrypt private message')
  }

  return {reveal: reveal, private: private}
}

exports.createAccept = function (msg, seed, id) {
  var keys = ssbKeys.generate(null, seed) //K
  if(keys.id != msg.content.invite) throw new Error('seed does not match invite')
  var inviteId = '%'+ssbKeys.hash(JSON.stringify(msg, null, 2))
  return ssbKeys.signObj(keys, invite_key, {
    type: 'invite/accept',
    reciept: inviteId,
    id: id,
    key: msg.content.reveal ? u.hash(u.hash(seed)).toString('base64') : undefined
  })
}

exports.verifyAccept = function (accept, invite) {
  var reveal
  if('%'+ssbKeys.hash(JSON.stringify(invite, null, 2)) !== accept.content.reciept)
    throw new Error('acceptance not matched to given invite')
  if(accept.author === invite.content.id)
    throw new Error('invitee must use a new key, not the same seed')
  if(invite.content.reveal) {
    reveal = u.unbox(invite.content.reveal, new Buffer(accept.content.key, 'base64'))
    if(!reveal) throw new Error('accept did not correctly reveal invite')
  }

  if(!ssbKeys.verifyObj(invite.content.invite, invite_key, accept.content))
    throw new Error('did not verify invite-acceptance contents')
  //an ordinary message, so does not use hmac_key
  if(!ssbKeys.verifyObj(accept.content.id, accept))
    throw new Error('acceptance must be signed by claimed key')
  return reveal || true
}


