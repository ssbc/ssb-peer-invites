var tape = require('tape')
var ssbKeys = require('ssb-keys')
var v = require('ssb-validate')
var i = require('../valid')
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
    type: 'user-invite',
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
  var wrong_seed = hash('wrong_seed')
  var invalid = ssbKeys.signObj(keys, invite_key, {
    type: 'user-invite',
    invite: keys.id, //correct key
    reveal: u.box({hidden: true}, u.hash(u.hash(wrong_seed))),
    host: alice.id
  })
  var invite_msg = v.create(null, alice, null, invalid, new Date('2018-03-26T06:14:18.377Z'))

  t.ok(i.verifyInvitePublic(invite_msg))

  throws(t, function () {
    i.verifyInvitePrivate(invite_msg, seed)
  }, 'user-invites:decrypt-reveal-failed')

  //say if the invitee creates a accept message anyway.

  throws(t, function () {
    i.createAccept(invite_msg, wrong_seed, bob.id)
  }, 'user-invites:seed-must-match-invite')


  throws(t, function () {
    i.createAccept(invite_msg, seed, bob.id)
  }, 'user-invites:decrypt-reveal-failed')

  var accept = ssbKeys.signObj(ssbKeys.generate(null, seed), invite_key, {
    type: 'user-invite/accept',
    receipt: '%'+ssbKeys.hash(JSON.stringify(invite_msg, null, 2)),
    id: bob.id,
    key: u.hash(u.hash(seed)) //what the reveal key should be.
  })

  var accept_msg =
    v.create(null, bob, null, accept, new Date('2018-03-26T06:14:18.377Z'))

  throws(t, function () {
    i.verifyAccept(accept_msg, invite_msg)
  }, 'user-invites:decrypt-accept-reveal-failed')

  var accept2 = ssbKeys.signObj(ssbKeys.generate(null, seed), invite_key, {
    type: 'user-invite/accept',
    receipt: '%'+ssbKeys.hash(JSON.stringify(invite_msg, null, 2)),
    id: bob.id,
    key: u.hash('not the key') //what the reveal key should be.
  })

  throws(t, function () {
    i.verifyAccept(accept_msg, invite_msg)
  }, 'user-invites:decrypt-accept-reveal-failed')

  t.end()
})

tape('wrong invite',  function (t) {
  var seed = hash('seed1')

  var invite1 = v.create(null, alice, null, i.createInvite(seed, alice.id, {name: 'bob'}, {text: 'welcome to ssb!'}), new Date('2018-03-14T06:14:18.377Z'))

  t.deepEqual({
    reveal: {name: 'bob'},
    private: {text: 'welcome to ssb!'}
  }, i.verifyInvitePrivate(invite1, seed))


  var accept_content = i.createAccept(invite1, seed, bob.id)
  var accept = v.create(null, bob, null, accept_content, new Date('2018-03-14T06:32:18.377Z'))

  var seed2 = hash('seed2')
  var invite2 = v.create(null, alice, null, i.createInvite(seed2, alice.id, {name: 'bob'}, {text: 'welcome to ssb!'}), new Date('2018-03-14T06:14:18.377Z'))

  //just test we do not verify the incorrect invite
  throws(t, function () {
    i.verifyAccept(accept, invite2)
  }, 'user-invites:accept-wrong-invite')

  t.end()

})

tape('wrong invite',  function (t) {
  var seed = hash('seed1')

  var invite = v.create(null, alice, null, i.createInvite(seed, alice.id), new Date('2018-03-14T06:14:18.377Z'))
  var seed2 = hash('seed2')
  var accept_content = ssbKeys.signObj(ssbKeys.generate(null, seed2), invite_key, {
    type: 'user-invite/accept',
    receipt: '%'+ssbKeys.hash(JSON.stringify(invite, null, 2)),
    id: bob.id,
  })
  var accept2 = v.create(null, bob, null, accept_content, new Date('2018-03-14T06:32:18.377Z'))


  //just test we do not verify the incorrect invite
  throws(t, function () {
    i.verifyAccept(accept2, invite)
  }, 'user-invites:accept-invite-signature-failed')

  t.end()
})


tape('wrong invite',  function (t) {
  var seed = hash('seed1')

  var invite = v.create(null, alice, null, i.createInvite(seed, alice.id, 'REVEAL'), new Date('2018-03-14T06:14:18.377Z'))
  var accept_content = ssbKeys.signObj(ssbKeys.generate(null, seed), invite_key, {
    type: 'user-invite/accept',
    receipt: '%'+ssbKeys.hash(JSON.stringify(invite, null, 2)),
    id: bob.id,
    //key is missing!
  })
  var accept2 = v.create(null, bob, null, accept_content, new Date('2018-03-14T06:32:18.377Z'))


  //just test we do not verify the incorrect invite
  throws(t, function () {
    i.verifyAccept(accept2, invite)
  }, 'user-invites:accept-must-reveal-key')

  t.end()
})


