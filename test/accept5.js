var crypto = require('crypto')
var I = require('../valid')
var createClient = require('ssb-client')
var u = require('../util')

var ssbKeys = require('ssb-keys')
var tape = require('tape')
//var explain = require('explain-error')
var pull = require('pull-stream')
//var u = require('../lib/util')
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
  userInvite: crypto.randomBytes(32),//.toString('base64'),
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

tape('create an invite', function (t) {

  alice.userInvites.create({allowWithoutPubs: true}, function (err, _invite) {
    if(err) throw err
    var invite = u.parse(_invite)
    var seed = invite.seed
    var invite_id = invite.invite

    //use device address, just for tests
    invite.pubs.push(alice.getAddress('device'))

    bob.userInvites.openInvite(invite, function (err, invite_msg, data) {
      if(err) throw err
      t.ok(invite)
      t.equal(toId(invite_msg), invite_id)
      t.deepEqual(data, {reveal: undefined, private: undefined})

      //bob publishes accept_content manually. simulates that he crashed
      //before causing confirm.
      var accept_content = I.createAccept(invite_msg, seed, bob.id, caps)
      bob.publish(accept_content, function (err, accept) {
        if(err) throw err

        //alice manually creates confrim, to simulate receiving it, but crashing
        //before bob receives it back, and so he calls again.

        alice.publish(I.createConfirm(accept.value), function (err, _confirm) {
          if(err) throw err
          bob.userInvites.acceptInvite(invite, function (err, confirm) {
            if(err) throw err
            //alice returns the same confirm message, does not create a new one
            t.equal(toId(confirm), toId(_confirm.value), 'id is equal')
            t.deepEqual(confirm, _confirm.value)

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
  })
})

