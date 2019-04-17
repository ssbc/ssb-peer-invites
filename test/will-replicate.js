var ssbKeys = require('ssb-keys')
var tape = require('tape')

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

var createGobot = require('./gobot')

var caps = require('./randcaps')()

function createSbotWith(opts) {
  return function (cb) {
    try {
      let bot = createSbot(opts)
      cb(null, bot)
    } catch (error) {
      cb(error)
    }
  }
}

let keyAlice = ssbKeys.generate()
let keyBob = ssbKeys.generate()

let i = 0
function optAlice() {
  i+=10
  return {
    temp: true,
    timeout: 1000,
    port: 12342+i,
    keys: keyAlice,
    caps: caps
  }
}

let j = 0
function optBob() {
  j+=10
  return {
    temp: true,
    timeout: 1000,
    port: 12343+j,
    keys: keyBob,
    caps: caps
  }
}

let bots = []
// bots.push({mkAlice: createSbotWith(optAlice()), mkBob: createSbotWith(optBob())})
// bots.push({mkAlice: createSbotWith(optAlice()), mkBob:createGobot(optBob())})
// bots.push({mkAlice: createGobot(optAlice()), mkBob: createGobot(optBob())})
bots.push({mkAlice: createGobot(optAlice()), mkBob: createSbotWith(optBob())})

// somehow the ssb-client connection doesn't respect the manifest
// gobots whoami rpc is still treated async it seems
function checkWhoami(t, expId, bot) {
  let botId = bot.whoami()
  t.ok(botId)
  if (botId) {
    botId = botId.id ? botId.id : botId
    t.equal(botId, expId)
  }
}

bots.forEach( ( mkBots, i ) => {
  let {mkAlice, mkBob} = mkBots
  console.dir(mkBots)
  console.log('run ', i)
  mkAlice((err, alice) => {
    if(err) throw err
    mkBob((err, bob) => {
      if(err) throw err
    
  
  // tape("check identities", function(t) {
  //   checkWhoami(t, keyAlice.id, alice)
  //   checkWhoami(t, keyBob.id, bob)
  //   t.end()
  // })

  
  
  tape("alice will replicate bob's guests", function (t) {
    alice.publish({
      type: 'contact', contact: bob.id,
      following: true
    }, function (err, data) {
      if(err) throw err
      t.ok(data)
      console.log(data)
      // let aliceAddr = alice.getAddress() // TODO
      let aliceAddr = `net:localhost:12352~shs:${keyAlice.public}`
      bob.connect(aliceAddr, function (err, _alice) {
        if(err) throw err
        // console.log(_alice) // TODO: can't wrap back rpc from go endpoints...
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
    // let bobAddr = bob.getAddress() TODO
    let bobAddr = `net:localhost:12353~shs:${keyBob.public}`
    t.comment(`connecting to: ${bobAddr}`)
    alice.connect(bobAddr, function (err, _bob) {
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

    }) // bob
  }) // alice 
}) // wrap tape