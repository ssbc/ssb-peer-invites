//WARNING: this test currently only passes
//if the computer has a network.
var crypto = require('crypto')
var I = require('../valid')
var createClient = require('ssb-client')


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
  .use(require('ssb-friends'))
  .use(require('../'))

function all(stream, cb) {
  return pull(stream, pull.collect(cb))
}

var alice = createSbot({
  temp: true,
  timeout: 1000,
  port: 12342,
  keys:ssbKeys.generate(),
})
var bob = createSbot({
  temp: true,
  timeout: 1000,
  port: 12343,
  keys:ssbKeys.generate(),
})

tape('create an invite', function (t) {

  var seed = crypto.randomBytes(32)

  var content = I.createInvite(seed, alice.id, {name: 'bob'}, {text: 'welcome to ssb!'})
  alice.publish(content, function (err, msg) {
    I.verifyInvitePublic(msg.value)

    createClient(
      ssbKeys.generate(null, seed),
      {
        remote: alice.getAddress(),
        caps: require('ssb-config').caps,
        manifest: {
          userInvites: {
            getInvite: 'async',
            confirm: 'async'
          }
        }
      },
      function (err, _bob) {
        if(err) throw err
        _bob.userInvites.getInvite(msg.key, function (err, invite) {
          if(err) throw err
          t.ok(invite)
          t.deepEqual(invite, msg.value)
          //check this invite is valid. would throw if it wasn't.
          I.verifyInvitePrivate(invite, seed)

          //bob chooses to accept this invite.
          var accept_content = I.createAccept(invite, seed, bob.id)

          bob.publish(accept_content, function (err, accept) {
            if(err) throw err
            _bob.userInvites.confirm(accept.value, function (err, msg) {
              if(err) throw err
              t.ok(msg)
          var confirm_id = '%'+ssbKeys.hash(JSON.stringify(msg, null, 2))
              alice.get(confirm_id, function (err, _msg) {
                if(err) throw err
                t.deepEqual(msg, _msg)


                //calling accept again should return the previous accept message.
                _bob.userInvites.confirm(accept.value, function (err, msg2) {
                  if(err) throw err
                  t.deepEqual(msg2, msg)
                  alice.close()
                  bob.close()
                  t.end()
                })
              })
            })
          })
        })
      }
    )
  })
})

