//WARNING: this test currently only passes
//if the computer has a network.
var crypto = require('crypto')
var I = require('../valid')
var createClient = require('ssb-client')


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

function toId(msg) {
  return '%'+ssbKeys.hash(JSON.stringify(msg, null, 2))
}

tape('create an invite', function (t) {

  var seed = crypto.randomBytes(32)

//  var content = I.createInvite(seed, alice.id, {name: 'bob'}, {text: 'welcome to ssb!'})
//  alice.publish(content, function (err, msg) {
  //  I.verifyInvitePublic(msg.value)

  alice.userInvites.create({}, function (err, invite) {
    if(err) throw err
    var seed = invite.seed
    var invite_id = invite.invite

    //use device address, just for tests
    invite.pubs.push(alice.getAddress('device'))

    bob.userInvites.openInvite(invite, function (err, invite_msg, data) {
      if(err) throw err
      t.ok(invite)
      t.equal(toId(invite_msg), invite_id)
      t.deepEqual(data, {reveal: undefined, private: undefined})
      //check this invite is valid. would throw if it wasn't.
      bob.userInvites.acceptInvite(invite, function (err, confirm) {
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



