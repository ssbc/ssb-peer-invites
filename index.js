var pull       = require('pull-stream')
var Reduce     = require('flumeview-reduce')
var I          = require('./valid')
var deepEquals = require('deep-equals')
var types      = require('./types')
var paramap    = require('pull-paramap')
var ssbClient  = require('ssb-client')
var crypto     = require('crypto')
var ssbKeys    = require('ssb-keys')
var u          = require('./util')
var cap        = require('./cap')
var explain    = require('explain-error')

function code(err, c) {
  err.code = 'peer-invites:'+c
  return err
}

function all (stream, cb) {
  return pull(stream, pull.collect(cb))
}

function isFunction (f) {
  return typeof f === 'function'
}

function isObject (o) {
  return o && typeof o == 'object'
}

function isString (s) {
  return typeof s == 'string'
}

function toBuffer(b) {
  return Buffer.isBuffer(b) ? b : Buffer.from(b, 'base64')
}

exports.name = 'peer-invites'

exports.version = '1.0.0'
exports.manifest = {
  getInvite: 'async',
  confirm: 'async',
  create: 'async',
  willReplicate: 'async',
  getNearbyPubs: 'async',
  openInvite: 'async',
  acceptInvite: 'async'
}

exports.permissions = {
  anonymous: {allow: ['willReplicate']},
}

// KNOWN BUG: it's possible to accept an invite more than once,
// but peers will ignore subsequent acceptances. it's possible
// that this could create confusion in certain situations.
// (but you'd get a feed that some peers thought was invited by Alice
// other peers would think a different feed accepted that invite)
// I guess the answer is to let alice reject the second invite?)
// that would be easier to do if this was a levelreduce? (keys: reduce, instead of a single reduce?)

exports.init = function (sbot, config) {
  var init = false
  var layer = sbot.friends.createLayer('peer-invites')

  var caps = config.caps || {}
  caps.peerInvite = caps.peerInvite || cap
  var initial = {invites: {}, accepts: {}, hosts: {}, guests: {}}

  function reduce (acc, data, _seq) {
    if(!acc) acc = initial
    var msg = data.value
    var invite, accept
    if(types.isInvite(msg, caps)) {
      //TODO: validate that this is a msg we understand!
      invite = msg
      accept = acc.accepts[data.key]

      //remember guest ids, so that you can process pub messages.
      //this is necessary to confirm invites here the guest failed before they received
      //the confirmation, and do not realize they are confirmed yet. they'll try again later.

      //id rather not have this here. it's gonna bloat. better a different kind of index.
      //can fix this later though.
      acc.guests[data.value.content.invite] = true
    }
    else if(types.isAccept(msg, caps)) {
      accept = msg
      invite = acc.invites[accept.content.receipt]
    }
    else if(types.isConfirm(msg, caps)) {
      //TODO: just for when we are the guest, but we need to make sure at least one confirm exists.
      accept = msg.content.embed
      invite = acc.invites[accept.content.receipt]
    }

    if(invite && accept) {
      if(invite === true)
        return acc
      var invite_id = accept.content.receipt
      try { I.verifyAccept(accept, invite, caps) }
      catch (err) { return acc }
      //fall through from not throwing

      //delete matched invites, but _only_ if they are VALID. (returned in the catch if invalid)
      delete acc.accepts[invite_id]
      //but remember that this invite has been processed.
      acc.invites[invite_id] = true
      acc.hosts[invite.author] = acc.hosts[invite.author] || {}
      acc.hosts[invite.author][accept.author] = 1
      if(init) {
        //interpret accepting an invite as a mutual follow.
        layer(invite.author, accept.author, 1)
        layer(accept.author, invite.author, 1)
      }
    }
    else if(invite)
      acc.invites[data.key] = invite
    else if(accept)
      acc.accepts[accept.receipt] = accept

    return acc
  }

  var state
  //a hack here, so that we can grab a handle on invites.value.set
  var invites = sbot._flumeUse('peer-invites', function (log, name) {
    var _invites = Reduce(3, reduce, null, null, initial)(log, name)
    state = _invites.value
    return _invites
  })

  invites.get(function (_, invites) {
    var g = {}
    if(!invites) layer({})
    else {
      //interpret accepted invites as two-way, but only store a minimal host->guest data structure
      for(var j in invites.hosts)
        for(var k in invites.hosts[j])
          g[j][k] = g[k][j] = 1
      init = true
      layer(g)
    }
  })

  sbot.auth.hook(function (fn, args) {
    var id = args[0], cb = args[1]
    //currently a problem here where message may be confirmed,
    //but guest didn't get the welcome yet. they need to be able to connect
    //and request it again.
    invites.get(function (err, v) {
      if(err) return cb(err)
      if(v.guests[id])
        return cb(null, {
          allow: ['peerInvites.getInvite', 'peerInvites.confirm'],
          deny: null
        })
      fn.apply(null, args)
    })
  })

  //retrive full invitation.
  invites.getInvite = function (invite_id, cb) {
    var self = this
    invites.get(function (err, v) {
      var invite = v.invites[invite_id]
      if(err) return cb(err)
      if(!invite)
        cb(code(
          new Error('unknown invite:'+invite_id),
          'unknown-invite'
        ))
      else if(invite === true)
        //TODO just retrive all confirmations we know about
        //via links.
        sbot.get(invite_id, cb)
      //only allow the guest to request their own invite.
      else if(self.id !== invite.content.invite)
        cb(code(
          new Error('invite did not match client id'),
          'invite-mismatch'
        ))
      else
        cb(null, v.invites[invite_id])
    })
  }

  function getResponse (invite_id, test, cb) {
    return all(
      sbot.links({dest: invite_id, values: true, keys: false, meta: false}),
      function (err, confirms) {
        if(err) cb(err)
        else cb(null,
          confirms.filter(function (e) {
            try {
              return test(e)
            } catch (err) {
              return false
            }
          })[0]
        )
      }
    )
  }

  var accepted = {}

  function getConfirm (invite_id, accept, cb) {
    getResponse(invite_id, function (msg) {
      return (
        msg.content.type === 'peer-invite/confirm' &&
        msg.content.embed.content.receipt === invite_id &&
        deepEquals(msg.content.embed, accept)
      )
    }, cb)
  }

  //used to request that a server confirms your acceptance.
  invites.confirm = function (accept, cb) {
    var invite_id = accept.content.receipt
    //check if the invite in question hasn't already been accepted.
    getConfirm(invite_id, accept, function (err, confirm) {
      if(err) return cb(err)
      if(confirm) return cb(null, confirm)

      sbot.get(invite_id, function (err, invite) {
        try {
          I.verifyAccept(accept, invite, caps)
        } catch (err) {
          return cb(err)
        }
        //there is a little race condition here, if accept is called again
        //before this write completes, it will write twice, so just return an error.
        if(accepted[invite_id]) return cb(new Error('race condition: try again soon'))

        accepted[invite_id] = true
        sbot.publish(I.createConfirm(accept), function (err, data) {
          delete accepted[invite_id]
          cb(err, data.value)
        })
      })
    })
  }


  //if the caller is someone we know, let them know wether
  //we are willing to confirm (and replicate) their guest.
  invites.willReplicate = function (opts, cb) {
    if(isFunction(opts)) cb = opts, opts = {}
    var id = this.id //id of caller
    var max = config.friends && config.friends.hops || config.replicate && config.replicate.hops || 3
    sbot.friends.hops({}, function (err, hops) {
      // compare hops of caller (host to be) with max - 1
      // because that means that the hops of the guest
      // will be in range.
      if(hops[id] <= (max - 1)) cb(null,  true)
      else cb(null, false)
    })
  }

  function getAccept (invite_id, cb) {
    getResponse(invite_id, function (msg) {
      return (
        msg.content.type === 'peer-invite/accept' &&
        msg.content.receipt === invite_id
      )
    }, cb)
  }

  //retrive pubs who might be willing to confirm your invite. (used when creating an invte)
  invites.getNearbyPubs = function (opts, cb) {
    if(isFunction (opts))
      cb = opts, opts = {}
    var maxHops = opts.hops || 2
    sbot.deviceAddress.getState(function (err, state) {
      if(err) return cb(explain(err, 'could not retrive any device addresses'))
      sbot.friends.hops({hops: opts.hops, reverse: true, start: opts.id}, function (err, hops) {
        if(err) return cb(explain(err, 'could not retrive nearby friends'))
        var near = []
        for(var k in state) {
          var da = state[k]
          if(hops[k] <= maxHops) {
            near.push({
              id: k,
              address: da.address,
              hops: hops[k],
              availability: da.availability
            })
          }
        }
        //sort by reverse hops, then by decending availability.
        //default availibility
        near.sort(function (a, b) {
          return (
            a.hops - b.hops ||
            b.availability - a.availability
          )
        })

        if(opts.offline) return cb(null, near)

        var count = 3, found = []

        function pushFound (pub, err, will) {
          found.push({
            id: pub.id, address: pub.address,
            availability: pub.availability,
            hops: pub.hops,
            error: err && err.message, willReplicate: !!will
          })
          if(will) count --
          //sort in order of wether they will replicate,
          //or availability
          found.sort(function (a, b) {
            (!!b.willReplicate) - (!!a.willReplicate) || b.availability - a.availability
          })
        }

        pull(
          pull.values(near),
          paramap(function (pub, cb) {
            //if opts.id != sbot.id connect using ssb client
            //so that you ask willReplicate from the correct id.
            sbot.connect(pub.address, function (err, rpc) {
              //skip pubs that were not contactable
              if(err) {
                pushFound(pub, err)
                return cb()
              }
              rpc.peerInvites.willReplicate({}, function (err, v) {
                //pass through input if true, else (err or false)
                //then drop.
                pushFound(pub, err, !!v)
                cb(null, v && pub)
              })
            })
          },3),
          function (read) {
            read(null, function next (err, pub) {
              if(err) return cb(null, found)
              else if(count) read(null, next)
              else read(true, function (_) { cb(null, found) })
            })
          }
        )
      })
    })
  }

  invites.create = function (opts, cb) {
    if(isFunction(opts))
      return opts(new Error ('peer-invites: expected: options *must* be provided.'))

    var host_id = opts.id || sbot.id
    invites.getNearbyPubs(opts, function (err, near) {
      if(near.length == 0 && !opts.allowWithoutPubs)
        return cb(new Error('failed to find any suitable pubs'))

      var seed = crypto.randomBytes(32).toString('base64')
      sbot.identities.publishAs({
        id: host_id,
        content: I.createInvite(seed, host_id, opts.reveal, opts.private, caps)
      }, function (err, data) {
        if(err) return cb(err)
        var invite = {
          seed: seed,
          invite: data.key,
          cap: opts.cap,
          pubs: near.map(function (e) { return e.address }),
        }
        cb(null, u.stringify(invite))
      })
    })
  }

  //try each of an array of addresses, and cb the first one that works.
  function connectFirst (invite, cb) {
    var n = 0, err
    var keys = ssbKeys.generate(null, toBuffer(invite.seed))
    invite.pubs.forEach(function (addr) {
      n++
      //don't use sbot.connect here, because we are connecting
      //with a different cap.
      ssbClient(keys, {
        remote: addr,
        caps: {shs: invite.cap || caps.shs},
        manifest: {
          peerInvites: {
            getInvite: 'async',
            confirm: 'async'
          }
        }
      }, function (_err, rpc) {
        if(n > 0 && rpc) {
          n = -1
          cb(null, rpc)
        } else {
          err = err || _err
        }
        if(--n == 0) cb(explain(err, 'while trying to connect to:'+remote))
      })
    })
  }

  //TODO: check if invite is already held locally
  //      if so, just get it. when got, update local db.
  invites.openInvite = function (invite, cb) {
    if(isString(invite)) invite = u.parse(invite)
    invites.getInvite(invite.invite, function (err, msg) {
      if(msg)
        next(msg)
      else
        connectFirst(invite, function (err, rpc) {
          if(err) return cb(err)
          rpc.peerInvites.getInvite(invite.invite, function (err, msg) {
            if(err) return cb(err)
            next(msg)
          })
        })

      function next (msg) {
        var invite_id = '%'+ssbKeys.hash(JSON.stringify(msg, null, 2))
        if(invite.invite !== invite_id)
          return cb(new Error(
            'incorrect invite was returned! expected:'+invite.invite+', but got:'+inviteId
          ))
        var opened
        try { opened = I.verifyInvitePrivate(msg, invite.seed, caps) }
        catch (err) { return cb(err) }
        //UPDATE REDUCE STATE.
        // this is a wee bit naughty, because if you rebuild the index it might not have this invite
        // (until you replicate it, but when you do the value won't change)
        state.set(reduce(state.value, {key: invite_id, value:msg}, invites.since.value))
        cb(null, msg, opened)
      }
    })
  }

  invites.acceptInvite = function (opts, cb) {
    if(isString(opts)) opts = u.parse(opts)
    var invite = isObject(opts.invite) ? opts.invite : opts
    var invite_id = invite.invite
    var id = opts.id || sbot.id

    //check wether this invite is already accepted.
    //or if the acceptance has been publish, but not yet confirmed.
    getAccept(invite_id, function (err, accept) {
      if(accept) next(accept)
      else {
        invites.openInvite(invite, function (err, invite_msg, opened) {
          sbot.identities.publishAs({
            id: id,
            content: I.createAccept(invite_msg, invite.seed, id, caps)
          }, function (err, accept) {
            if(err) cb(err)
            else {
              state.set(reduce(state.value, accept, invites.since.value))
              next(accept.value)
            }
          })
        })
      }
    })

    function next(accept) {
      getConfirm(invite_id, accept, function (err, confirm) {
        if(!confirm)
          connectFirst(invite, function (err, rpc) {
            if(err) return cb(err)
            rpc.peerInvites.confirm(accept, function (err, confirm) {
              //TODO: store confirms for us in the state.
              cb(err, confirm)
            })
          })
      })
    }
  }

  return invites
}

// I am not happy with how big this file is
// but I can't see a really good line along which to break it up.

