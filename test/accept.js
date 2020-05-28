var crypto = require('crypto')
var createClient = require('ssb-client')
var ssbKeys = require('ssb-keys')
var tape = require('tape')

var I = require('../valid')

var createSbot = require('ssb-server')
  .use({
    name: 'replicate', version: '1.0.0',
    manifest: { request: 'sync' },
    init: function () {
      return { request: function () {} }
    }
  })
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

tape('create an invite (accept)', function (t) {

  var seed = crypto.randomBytes(32)

  var content = I.createInvite(seed, alice.id, {name: 'bob'}, {text: 'welcome to ssb!'}, caps)
  alice.publish(content, function (err, msg) {
    I.verifyInvitePublic(msg.value, caps)

    createClient(
      ssbKeys.generate(null, seed),
      {
        remote: alice.getAddress('device') || alice.getAddress('device'),
        caps: caps,
        manifest: {
          peerInvites: {
            getInvite: 'async',
            confirm: 'async'
          }
        }
      },
      function (err, _bob) {
        if(err) throw err
        _bob.peerInvites.getInvite(msg.key, function (err, invite) {
          if(err) throw err
          t.ok(invite)
          t.deepEqual(invite, msg.value)
          //check this invite is valid. would throw if it wasn't.
          I.verifyInvitePrivate(invite, seed, caps)

          //bob chooses to accept this invite.
          var accept_content = I.createAccept(invite, seed, bob.id, caps)

          bob.publish(accept_content, function (err, accept) {
            if(err) throw err
            _bob.peerInvites.confirm(accept.value, function (err, msg) {
              if(err) throw err
              t.ok(msg)
          var confirm_id = '%'+ssbKeys.hash(JSON.stringify(msg, null, 2))
              alice.get(confirm_id, function (err, _msg) {
                if(err) throw err
                t.deepEqual(msg, _msg)


                //calling accept again should return the previous accept message.
                _bob.peerInvites.confirm(accept.value, function (err, msg2) {
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

