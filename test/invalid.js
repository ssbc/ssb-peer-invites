var tape = require('tape')
var ssbKeys = require('ssb-keys')
var v = require('ssb-validate')
var i = require('../')
var u = require('../util')

var invite_key = require('../cap')

var hash = u.hash

var alice = ssbKeys.generate(null, hash('ALICE'))
var bob = ssbKeys.generate(null, hash('BOB'))


function throws(t, test, code) {
  if(!code) throw new Error('error code must be provided')
  try {
    test()
    t.fail('expected:'+test+' to throw code:'+code)
  } catch(err) {
    console.error(err.stack)
    t.ok(err.code, 'errors must have an error code')
    t.equal(err.code, code)
  }
}

//any bit in invite{invite,host,reveal} is flipped
tape('invalid - wrong invitee', function (t) {

  //construct a message where host does not match
  var seed = hash('seed2')
  var keys = ssbKeys.generate(null, seed)
  var invalid = ssbKeys.signObj(keys, invite_key, {
    type: 'invite',
    invite: ssbKeys.generate(null, hash('seed3')),
    host: alice.id
  })

  var msg = v.create(null, alice, null, invalid, new Date('2018-03-26T06:14:18.377Z'))

  throws(t, function () {
    i.verifyInvitePublic(msg)
  }, 'user-invites:invite-signature-failed')

  throws(t, function () {
    i.verifyInvitePrivate(msg)
  }, 'user-invites:invite-signature-failed')

  t.end()
})

//any bit in invite{invite,host,reveal} is flipped
tape('invalid - wrong invitee', function (t) {

  //construct a message where host does not match
  var seed = hash('seed2')
  var keys = ssbKeys.generate(null, seed)
  var invalid = ssbKeys.signObj(keys, invite_key, {
    type: 'invite',
    invite: keys.id, //correct key
    reveal: u.box('cannot be decrypted due to wrong key', u.hash('wrong key')),
    host: alice.id
  })
  var invite_msg = v.create(null, alice, null, invalid, new Date('2018-03-26T06:14:18.377Z'))

  t.ok(i.verifyInvitePublic(invite_msg))

  throws(t, function () {
    i.verifyInvitePrivate(invite_msg, seed)
  }, 'user-invites:decrypt-reveal-failed')

  //say if the invitee creates a accept message anyway.



  throws(t, function () {
    i.createAccept(invite_msg, seed, bob.id)
  }, 'user-invites:decrypt-reveal-failed')

  var accept = ssbKeys.signObj(ssbKeys.generate(null, seed), invite_key, {
    type: 'invite/accept',
    receipt: '%'+ssbKeys.hash(JSON.stringify(invite_msg, null, 2)),
    id: bob.id,
    key: u.hash(u.hash(seed)) //what the reveal key should be.
  })

  var accept_msg =
    v.create(null, bob, null, accept, new Date('2018-03-26T06:14:18.377Z'))

  throws(t, function () {
    i.verifyAccept(accept_msg, invite_msg)
  }, 'user-invites:decrypt-accept-reveal-failed')

  t.end()
})
