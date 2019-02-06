var explain = require('explain-error')
var ssbKeys = require('ssb-keys')
var tape = require('tape')

var u = require('../util')

var createSbot = require('scuttlebot')
  .use(require('ssb-links'))
  .use(require('scuttlebot/plugins/replicate'))
  .use(require('scuttlebot/plugins/gossip'))
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

var carol = createSbot({
  temp: true,
  timeout: 1000,
  port: 12344,
  keys:ssbKeys.generate(),
  caps: caps
})

tape('setup', function (t) {

  //once alice has 3 messages (one from her, and two from carol)
  //can move to next test.
  var a = 3
  alice.post(function (data) {
    if(--a) return

    //HACK: wait for servers to start
    setTimeout(function () { t.end() }, 1000)
  })

  carol.deviceAddress.announce({
    address:carol.getAddress('device'),
    availability: 1
  }, function (err, msg) {
    if(err) throw err
    t.ok(msg)
    alice.publish({
      type: 'contact', contact: carol.id, following: true
    }, function (err, msg) {
      if(err) throw err
      t.ok(msg)
      carol.publish({
        type: 'contact', contact: alice.id, following: true
      }, function (err, msg) {
        if(err) throw err
        t.ok(msg)
        alice.connect(carol.getAddress(), function (err) {
          if(err) throw err
        })
      })
    })
  })
})

tape('getNearbyPubs', function (t) {
  alice.peerInvites.getNearbyPubs({}, function (err, pubs) {
    if(err) throw err
    t.ok(pubs.length)
    t.end()
  })
})

var invite
tape('create-invite, with automatic pubs', function (t) {
  var n = 1
  //wait until carol has received alice's invite
  carol.post(function (data) {
    if(data.value.content.type === 'peer-invite') {
      console.log('invit?', data)
      if(--n) return
      t.end()
    }
  })

  setTimeout(function () {
    alice.peerInvites.create({}, function (err, _invite) {
      if(err) throw err
      console.log('create invite')
      invite = u.parse(_invite)
      console.log(_invite)
      console.log(invite)
    })
  })

})

tape('accept invite', function (t) {
  alice.get(invite.invite, function (err, invite_msg) {
    if(err) throw err
    t.deepEqual(invite.pubs, [carol.getAddress('device')])
    
    bob.peerInvites.openInvite(invite, function (err, _invite_msg) {
      if(err) throw explain(err, 'error while opening invite')
      t.deepEqual(_invite_msg, invite_msg)
      bob.peerInvites.acceptInvite(invite, function (err) {
        if(err) throw err
        t.end()
      })
    })
  })
})

//there is another race here. seems flumedb
//doesn't like it if you close and immediately
//it receives a message. (should just drop that though)
//we don't need to fix that just to get peer-invites working, though.
tape('cleanup', function (t) {
  setTimeout(function () {
    alice.close()
    carol.close()
    bob.close()
    t.end()
  }, 1000)
})



