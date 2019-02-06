var ssbKeys = require('ssb-keys')
var tape = require('tape')

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

tape("alice will replicate bob's guests", function (t) {
  alice.publish({
    type: 'contact', contact: bob.id,
    following: true
  }, function (err, data) {
    if(err) throw err
    t.ok(data)
    console.log(data)
    bob.connect(alice.getAddress(), function (err, _alice) {
      if(err) throw err
      _alice.peerInvites.willReplicate(function (err, wr) {
        if(err) throw err
        t.ok(wr) //alice should replicate for bob's guests
        _alice.close()
        t.end()
      })
    })
  })
})

tape("bob won't replicate alice's guests", function (t) {
  alice.connect(bob.getAddress(), function (err, _bob) {
    if(err) throw err
    _bob.peerInvites.willReplicate(function (err, wr) {
      if(err) throw err
      t.notOk(wr) //alice should replicate for bob's guests
      _bob.close()
      t.end()
    })
  })
})

tape('clean up', function (t) {
  alice.close()
  bob.close()
  t.end()
})
