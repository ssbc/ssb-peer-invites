//WARNING: this test currently only passes
//if the computer has a network.
var crypto = require('crypto')
var I = require('../valid')
var createClient = require('ssb-client')
var u = require('../util')

var ssbKeys = require('ssb-keys')
var tape = require('tape')
var pull = require('pull-stream')
var ref = require('ssb-ref')

var createSbot = require('scuttlebot')
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

function toId(msg) {
  return '%'+ssbKeys.hash(JSON.stringify(msg, null, 2))
}

function all(stream, cb) {
  return pull(stream, pull.collect(cb))
}

var caps = {
  sign: crypto.randomBytes(32),//.toString('base64'),
  peerInvite: crypto.randomBytes(32),//.toString('base64'),
  shs: crypto.randomBytes(32),//.toString('base64'),
}

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
var carol = ssbKeys.generate()

tape('create an invite', function (t) {

  var seed = crypto.randomBytes(32)

  //in this test, we use a separate identity to create the invite,
  //to test multiple identity support, and also simulate confirmation by pub.
  alice.identities.create(function (err, carol_id) {
    if(err) throw err
    alice.peerInvites.create({id: carol_id, allowWithoutPubs: true}, function (err, _invite) {
      if(err) throw err
      var invite = u.parse(_invite)
      var seed = invite.seed
      var invite_id = invite.invite

      //use device address, just for tests
      invite.pubs.push(alice.getAddress('device'))

      bob.peerInvites.openInvite(invite, function (err, invite_msg, data) {
        if(err) throw err
        t.ok(invite)
        t.equal(invite_msg.author, carol_id)
        t.equal(toId(invite_msg), invite_id)
        t.deepEqual(data, {reveal: undefined, private: undefined})
        //check this invite is valid. would throw if it wasn't.
        bob.peerInvites.acceptInvite(invite, function (err, confirm) {
          if(err) throw err
          t.equal(confirm.author, alice.id)
          //check that alice and bob both understand the other to be following them.
          bob.friends.hops({reverse: true}, function (err, hops) {
            t.equal(hops[carol_id], 1)
            alice.friends.hops({reverse: true, start: carol_id}, function (err, hops) {
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
})

