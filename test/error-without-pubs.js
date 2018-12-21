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

function toId(msg) {
  return '%'+ssbKeys.hash(JSON.stringify(msg, null, 2))
}

tape('create an invite', function (t) {

  var seed = crypto.randomBytes(32)

  //without the pubs option, do not allow creating
  //an invite.
  alice.userInvites.create({}, function (err, invite) {
    t.ok(err)
    alice.close()
    t.end()
  })
})















