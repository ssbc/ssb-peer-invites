var ref = require('ssb-ref')
var ssbKeys = require('ssb-keys')
var createIsBase64 = require('is-canonical-base64')

function isObject (o) {
  return o && 'object' === typeof o
}

// signatures have a type (eg `.ed25519`) at the end,
// but not gonna check it right here.
var signature_rx = createIsBase64('', '\\.sig\\.\\w+')
var box_rx = createIsBase64()

function isSignature(b) {
  return signature_rx.test(b)
}

function isMaybeBase64(b) {
  return b === undefined || box_rx.test(b)
}

exports.isInvite = function (msg, caps) {
  if(!isObject(caps)) throw new Error('caps must be provided')
  //return true
  return isObject(msg) && isObject(msg.content) && (
    'user-invite' === msg.content.type &&
    ref.isFeed(msg.content.host) &&
    ref.isFeed(msg.content.invite) &&
    isMaybeBase64(msg.content.reveal) &&
    isMaybeBase64(msg.content.public) &&
    // signature must be valid !!!
    ssbKeys.verifyObj(msg.content.invite, caps.userInvite, msg.content)
  )
}

exports.isAccept = function (msg) {
  return isObject(msg) && isObject(msg.content) && (
    'user-invite/accept' === msg.content.type &&
    msg.content.id == msg.author &&
    ref.isMsg(msg.content.receipt) &&
    isMaybeBase64(msg.content.key) &&
    // can't verify this without having the invite message.
    // (that's intentional, forces implementers not to cut corners,
    // but to check that the receipt is correct)
    isSignature(msg.content.signature)
  )
}

exports.isConfirm = function (msg) {
  return isObject(msg) && isObject(msg.content) && (
    'user-invite/confirm' === msg.content.type &&
    exports.isAccept(msg.content.embed) &&
    //second pointer back to receipt, so that links can find it
    //(since it unfortunately does not handle links nested deeper
    //inside objects. when we look up the message,
    //confirm that content.embed.content.receipt is the same)
    msg.content.embed.content.receipt === msg.content.receipt
  )
}



