//WARNING: this test currently only passes
//if the computer has a network.
var crypto = require('crypto')
var ssbKeys = require('ssb-keys')
var tape = require('tape')
var pull = require('pull-stream')

var createSbot = require('ssb-server')
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

tape('create an invite', function (t) {
  //without the pubs option, do not allow creating
  //an invite.
  alice.peerInvites.create({}, function (err, invite) {
    t.ok(err)
    alice.close()
    t.end()
  })
})















