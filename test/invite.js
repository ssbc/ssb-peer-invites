
var tape = require('tape')
var ssbKeys = require('ssb-keys')
var v = require('ssb-validate')
var i = require('../')

var crypto = require('crypto')

function hash (s) {
  return crypto.createHash('sha256').update(s).digest()
}

var alice = ssbKeys.generate(null, hash('ALICE'))
var bob = ssbKeys.generate(null, hash('BOB'))

tape('happy', function (t) {

  var seed = hash('seed')

  var invite_content = i.createInvite(seed, bob.id, {name: 'bob'}, {text: 'welcome to ssb!'})

  console.log(invite_content)

  var msg = v.create(null, alice, null, invite_content, new Date('2018-03-14T06:14:18.377Z'))

  var message = i.verifyInvitePrivate(msg, seed)

  t.deepEqual({
    reveal: {name: 'bob'},
    private: {text: 'welcome to ssb!'}
  }, message)

  var accept_content = i.createAccept(msg, seed, bob.id)

  console.log('accept:', accept_content)

  var msg2 = v.create(null, bob, null, accept_content, new Date('2018-03-14T06:32:18.377Z'))

  var revealed = i.verifyAccept(msg2, msg)

  t.deepEqual(revealed, {name: 'bob'})

  t.end()
})

