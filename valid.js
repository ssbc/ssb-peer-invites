var ssbKeys = require('ssb-keys')
var isMsg = require('ssb-ref').isMsg
var u = require('./util')

var invite_key = require('./cap')

function code(err, c) {
  err.code = 'user-invites:'+c
  return err
}

function isObject (o) {
  return o && 'object' === typeof o
}

exports.createInvite = function (seed, host, reveal, private, caps) {
  if(!isObject(caps)) throw new Error('caps *must* be provided')

  var keys = ssbKeys.generate(null, seed) //K
  if(keys.id === host)
    throw code(new Error('do not create invite with own public key'), 'user-invites:no-own-goal')
  return ssbKeys.signObj(keys, caps.userInvite, {
    type: 'user-invite',
    invite: keys.id,
    host: host, //sign our own key, to prove we created K
    reveal: reveal ? u.box(reveal, u.hash(u.hash(seed))) : undefined,
    private: private ? u.box(private, u.hash(seed)) : undefined
  })
}

exports.verifyInvitePublic = function (msg, caps) {
  if(!isObject(caps)) throw new Error('caps *must* be provided')

  if(msg.content.host != msg.author)
    throw code(new Error('host did not match author'), 'host-must-match-author')

  if(!ssbKeys.verifyObj(msg.content.invite, caps.userInvite, msg.content))
    throw code(new Error('invalid invite signature'), 'invite-signature-failed')

  //an ordinary message so doesn't use special hmac_key, unless configed to.
  if(!ssbKeys.verifyObj(msg.author, caps.sign, msg))
    throw code(new Error('invalid host signature'), 'host-signature-failed')
  return true
}

exports.verifyInvitePrivate = function (msg, seed, caps) {
  if(!isObject(caps)) throw new Error('caps *must* be provided')

  exports.verifyInvitePublic(msg, caps)
  if(msg.content.reveal) {
    var reveal = u.unbox(msg.content.reveal, u.hash(u.hash(seed)))
    if(!reveal) throw code(new Error('could not decrypt reveal field'), 'decrypt-reveal-failed')
  }
  if(msg.content.private) {
    var private = u.unbox(msg.content.private, u.hash(seed))
    if(!private) throw code(new Error('could not decrypt private field'), 'decrypt-private-failed')
  }

  return {reveal: reveal, private: private}
}

exports.createAccept = function (msg, seed, id, caps) {
  if(!isObject(caps)) throw new Error('caps *must* be provided')

  exports.verifyInvitePrivate(msg, seed, caps)
  var keys = ssbKeys.generate(null, seed) //K
  if(keys.id != msg.content.invite)
    throw code(new Error('seed does not match invite'), 'seed-must-match-invite')
  var inviteId = '%'+ssbKeys.hash(JSON.stringify(msg, null, 2))
  var content = {
    type: 'user-invite/accept',
    receipt: inviteId,
    id: id
  }
  if(msg.content.reveal)
    content.key = u.hash(u.hash(seed)).toString('base64')
  return ssbKeys.signObj(keys, caps.userInvite, content)
}

exports.verifyAcceptOnly = function (accept, caps) {
  if(!isObject(caps)) throw new Error('caps *must* be provided')
  if(accept.content.type !== 'user-invite/accept')
    throw code(new Error('accept must be type: "user-invite/accept", was:'+JSON.stringify(accept.content.type)), 'accept-message-type')
  if(!isMsg(accept.content.receipt))
    throw code(new Error('accept must reference invite message id'), 'accept-reference-invite')
  //verify signed as ordinary message.
  if(!ssbKeys.verifyObj(accept.content.id, caps.sign, accept))
    throw code(new Error('acceptance must be signed by claimed key'), 'accept-signature-failed')
}

exports.verifyAccept = function (accept, invite, caps) {
  if(!isObject(caps)) throw new Error('caps *must* be provided')
  if(!invite) throw new Error('invite must be provided')

  exports.verifyAcceptOnly(accept, caps)

  if(invite.content.type !== 'user-invite')
    throw code(new Error('accept must be type: invite, was:'+accept.content.type), 'user-invites:invite-message-type')

  var invite_id = '%'+ssbKeys.hash(JSON.stringify(invite, null, 2))
  var reveal

  if(invite_id !== accept.content.receipt)
    throw code(new Error('acceptance not matched to given invite, got:'+invite_id+' expected:'+accept.content.receipt), 'accept-wrong-invite')

  if(accept.author === invite.content.id)
    throw code(new Error('guest must use a new key, not the same seed'), 'guest-key-reuse')
  if(invite.content.reveal) {
    if(!accept.content.key)
      throw code(new Error('accept missing reveal key, when invite has it'), 'accept-must-reveal-key')
    reveal = u.unbox(invite.content.reveal, new Buffer(accept.content.key, 'base64'))
    if(!reveal) throw code(new Error('accept did not correctly reveal invite'), 'decrypt-accept-reveal-failed')
  }

  if(!ssbKeys.verifyObj(invite.content.invite, caps.userInvite, accept.content))
    throw code(new Error('did not verify invite-acceptance contents'), 'accept-invite-signature-failed')
  //an ordinary message, so does not use hmac_key
  return reveal || true
}

exports.createConfirm =  function (accept) {
  return {
    type: 'user-invite/confirm',
    embed: accept,
    //second pointer back to receipt, so that links can find it
    //(since it unfortunately does not handle links nested deeper
    //inside objects. when we look up the message,
    //confirm that content.embed.content.receipt is the same)
    receipt: accept.content.receipt
  }
}



