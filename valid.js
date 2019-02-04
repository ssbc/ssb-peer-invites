var ssbKeys = require('ssb-keys')
var isMsg = require('ssb-ref').isMsg
var u = require('./util')

var invite_key = require('./cap')

function code(err, c) {
  err.code = 'peer-invites:'+c
  return err
}

function isObject (o) {
  return o && 'object' === typeof o
}

function toBuffer(str) {
  return Buffer.isBuffer(str) ? str : Buffer.from(str, 'base64')
}

//this should really be refactored out somewhere.
function toMsgId(msg) {
  return '%'+ssbKeys.hash(JSON.stringify(msg, null, 2))
}

//derive key for private field
function hash (seed) {
  if(!Buffer.isBuffer(seed)) throw new Error('expected seed as buffer')
  return u.hash(seed)
}

//derive key for reveal field
function hash2 (seed) {
  if(!Buffer.isBuffer(seed)) throw new Error('expected seed as buffer')
  return u.hash(u.hash(seed))
}


exports.createInvite = function (seed, host, reveal, private, caps) {
  if(!isObject(caps)) throw new Error('caps *must* be provided')

  seed = toBuffer(seed)
  var keys = ssbKeys.generate(null, seed) //K
  if(keys.id === host)
    throw code(new Error('do not create invite with own public key'), 'peer-invites:no-own-goal')
  return ssbKeys.signObj(keys, caps.peerInvite, {
    type: 'peer-invite',
    invite: keys.id,
    host: host, //sign our own key, to prove we created K
    reveal: reveal ? u.box(reveal, hash2(seed)) : undefined,
    private: private ? u.box(private, hash(seed)) : undefined
  })
}

exports.verifyInvitePublic = function (msg, caps) {
  if(!isObject(caps)) throw new Error('caps *must* be provided')

  if(msg.content.host != msg.author)
    throw code(new Error('host did not match author'), 'host-must-match-author')

  if(!ssbKeys.verifyObj(msg.content.invite, caps.peerInvite, msg.content))
    throw code(new Error('invalid invite signature'), 'invite-signature-failed')

  //an ordinary message so doesn't use special hmac_key, unless configed to.
  if(!ssbKeys.verifyObj(msg.author, caps.sign, msg))
    throw code(new Error('invalid host signature'), 'host-signature-failed')
  return true
}

exports.verifyInvitePrivate = function (msg, seed, caps) {
  if(!isObject(caps)) throw new Error('caps *must* be provided')

  seed = toBuffer(seed)
  exports.verifyInvitePublic(msg, caps)
  if(msg.content.reveal) {
    var reveal = u.unbox(msg.content.reveal, hash2(seed))
    if(!reveal) throw code(new Error('could not decrypt reveal field'), 'decrypt-reveal-failed')
  }
  if(msg.content.private) {
    var private = u.unbox(msg.content.private, hash(seed))
    if(!private) throw code(new Error('could not decrypt private field'), 'decrypt-private-failed')
  }

  return {reveal: reveal, private: private}
}

exports.createAccept = function (msg, seed, id, caps) {
  if(!isObject(caps)) throw new Error('caps *must* be provided')

  seed = toBuffer(seed)
  exports.verifyInvitePrivate(msg, seed, caps)
  var keys = ssbKeys.generate(null, seed) //K
  if(keys.id != msg.content.invite)
    throw code(new Error('seed does not match invite'), 'seed-must-match-invite')
  var inviteId = toMsgId(msg)
  var content = {
    type: 'peer-invite/accept',
    receipt: inviteId,
    id: id
  }
  if(msg.content.reveal)
    content.key = hash2(seed).toString('base64')
  return ssbKeys.signObj(keys, caps.peerInvite, content)
}

exports.verifyAcceptOnly = function (accept, caps) {
  if(!isObject(caps)) throw new Error('caps *must* be provided')
  if(accept.content.type !== 'peer-invite/accept')
    throw code(new Error('accept must be type: "peer-invite/accept", was:'+JSON.stringify(accept.content.type)), 'accept-message-type')
  if(!isMsg(accept.content.receipt))
    throw code(new Error('accept must reference invite message id'), 'accept-reference-invite')
  //verify signed as ordinary message.
  if(!ssbKeys.verifyObj(accept.content.id, caps.sign, accept))
    throw code(new Error('acceptance must be signed by claimed key'), 'accept-signature-failed')
}

exports.verifyAccept = function (accept, invite_msg, caps) {
  if(!isObject(caps)) throw new Error('caps *must* be provided')
  if(!invite_msg) throw new Error('invite must be provided')

  exports.verifyAcceptOnly(accept, caps)

  if(invite_msg.content.type !== 'peer-invite')
    throw code(new Error('accept must be type: invite, was:'+accept.content.type), 'peer-invites:invite-message-type')

  var invite_id = toMsgId(invite_msg)
  var reveal

  if(invite_id !== accept.content.receipt)
    throw code(new Error('acceptance not matched to given invite, got:'+invite_id+' expected:'+accept.content.receipt), 'accept-wrong-invite')

  if(accept.author === invite_msg.content.id)
    throw code(new Error('guest must use a new key, not the same seed'), 'guest-key-reuse')
  if(invite_msg.content.reveal) {
    if(!accept.content.key)
      throw code(new Error('accept missing reveal key, when invite has it'), 'accept-must-reveal-key')
    reveal = u.unbox(invite_msg.content.reveal, toBuffer(accept.content.key))
    if(!reveal) throw code(new Error('accept did not correctly reveal invite'), 'decrypt-accept-reveal-failed')
  }

  if(!ssbKeys.verifyObj(invite_msg.content.invite, caps.peerInvite, accept.content))
    throw code(new Error('did not verify invite-acceptance contents'), 'accept-invite-signature-failed')
  //an ordinary message, so does not use hmac_key
  return reveal || true
}

exports.createConfirm =  function (accept) {
  return {
    type: 'peer-invite/confirm',
    embed: accept,
    //second pointer back to receipt, so that links can find it
    //(since it unfortunately does not handle links nested deeper
    //inside objects. when we look up the message,
    //confirm that content.embed.content.receipt is the same)
    receipt: accept.content.receipt
  }
}

