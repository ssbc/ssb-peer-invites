
var tape = require('tape')
var ssbKeys = require('ssb-keys')
var v = require('ssb-validate')
var i = require('../valid')
var u = require('../util')

var invite_key = require('../cap')

var hash = u.hash

var alice = ssbKeys.generate(null, hash('ALICE'))
var bob = ssbKeys.generate(null, hash('BOB'))

tape('happy', function (t) {

  var seed = hash('seed1')

  var tmp = ssbKeys.generate(null, seed)

  var invite_content = i.createInvite(seed, alice.id, {name: 'bob'}, {text: 'welcome to ssb!'})

  var msg = v.create(null, alice, null, invite_content, new Date('2018-03-14T06:14:18.377Z'))

  var message = i.verifyInvitePrivate(msg, seed)

  t.deepEqual({
    reveal: {name: 'bob'},
    private: {text: 'welcome to ssb!'}
  }, message)

  var accept_content = i.createAccept(msg, seed, bob.id)

  var msg2 = v.create(null, bob, null, accept_content, new Date('2018-03-14T06:32:18.377Z'))

  var revealed = i.verifyAccept(msg2, msg)

  t.deepEqual(revealed, {name: 'bob'})

  t.end()
})

tape('happy 2, without private', function (t) {

  var seed = hash('seed2')

  var tmp = ssbKeys.generate(null, seed)

  var invite_content = i.createInvite(seed, alice.id, {name: 'bob'}, null)

  var msg = v.create(null, alice, null, invite_content, new Date('2018-03-14T06:14:18.377Z'))

  var message = i.verifyInvitePrivate(msg, seed)

  t.deepEqual({
    reveal: {name: 'bob'},
    private: undefined
  }, message)

  var accept_content = i.createAccept(msg, seed, bob.id)

  var msg2 = v.create(null, bob, null, accept_content, new Date('2018-03-14T06:32:18.377Z'))

  var revealed = i.verifyAccept(msg2, msg)

  t.deepEqual(revealed, {name: 'bob'})

  t.end()
})



tape('happy 3, without reveal', function (t) {

  var seed = hash('seed3')

  var tmp = ssbKeys.generate(null, seed)

  var invite_content = i.createInvite(seed, alice.id, null, {name: 'bob'})

  var msg = v.create(null, alice, null, invite_content, new Date('2018-03-14T06:14:18.377Z'))

  var message = i.verifyInvitePrivate(msg, seed)

  t.deepEqual({
    reveal: undefined,
    private: {name: 'bob'}
  }, message)

  var accept_content = i.createAccept(msg, seed, bob.id)

  var msg2 = v.create(null, bob, null, accept_content, new Date('2018-03-14T06:32:18.377Z'))

  var revealed = i.verifyAccept(msg2, msg)

  t.equal(revealed, true)

  t.end()
})


tape('happy 4, neither private or reveal', function (t) {

  var seed = hash('seed4')

  var tmp = ssbKeys.generate(null, seed)

  var invite_content = i.createInvite(seed, alice.id)

  var msg = v.create(null, alice, null, invite_content, new Date('2018-03-14T06:14:18.377Z'))

  var message = i.verifyInvitePrivate(msg, seed)

  t.deepEqual({
    reveal: undefined,
    private: undefined
  }, message)

  var accept_content = i.createAccept(msg, seed, bob.id)

  var msg2 = v.create(null, bob, null, accept_content, new Date('2018-03-14T06:32:18.377Z'))

  var revealed = i.verifyAccept(msg2, msg)

  t.equal(revealed, true)

  t.end()
})

tape('safety', function (t) {
  t.throws(function () {
    //do now give away your own private key!
    i.createInvite(hash("ALICE"), alice.id, {name: 'bob'}, {text: 'welcome to ssb!'})
  })
  t.end()
})







