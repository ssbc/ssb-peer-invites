//WARNING: this test currently only passes
//if the computer has a network.
var crypto = require('crypto')
var u = require('../util')

var ssbKeys = require('ssb-keys')
var tape = require('tape')
var pull = require('pull-stream')

var createSbot = require('ssb-server')
  .use(require('ssb-links'))
  .use({
    name: 'replicate', version: '1.0.0',
    manifest: { request: 'sync' },
    init: function () {
      return { request: function () {} }
    }
  })
  .use(require('ssb-query'))
  .use(require('ssb-device-address'))
  .use(require('ssb-identities'))
  .use(require('ssb-friends'))
  .use(require('../'))

var caps = require('./randcaps')()

var alice = createSbot({
  temp: true,
  timeout: 1000,
  port: 12342,
  keys:ssbKeys.generate(),
  caps: caps
})
var bob = createSbot({
  temp: true,
  timeout: 1000,
  port: 12343,
  keys:ssbKeys.generate(),
  caps: caps
})

function toId(msg) {
  return '%'+ssbKeys.hash(JSON.stringify(msg, null, 2))
}

tape('create an invite', function (t) {

  alice.peerInvites.create({allowWithoutPubs: true}, function (err, _invite) {
    if(err) throw err
    var invite = u.parse(_invite)
    var invite_id = invite.invite

    //use device address, just for tests
    invite.pubs.push(alice.getAddress('device'))

    bob.peerInvites.openInvite(invite, function (err, invite_msg, data) {
      if(err) throw err
      t.ok(invite)
      t.equal(toId(invite_msg), invite_id)
      t.deepEqual(data, {reveal: undefined, private: undefined})
      //check this invite is valid. would throw if it wasn't.
      bob.peerInvites.acceptInvite(invite, function (err, confirm) {
        if(err) throw err

        //check that alice and bob both understand the other to be following them.
        bob.friends.hops({reverse: true}, function (err, hops) {
          t.equal(hops[alice.id], 1)
          alice.friends.hops({reverse: true}, function (err, hops) {
            t.equal(hops[bob.id], 1)
            alice.close()
            bob.close()
            t.end()
          })
        })
      })
    })
  })
})

