var I = require('./valid')
var Reduce = require('flumeview-reduce')

function code(err, c) {
  err.code = 'user-invites:'+c
  return err
}
var pull = require('pull-stream')
function all (stream, cb) {
  return pull(stream, pull.collect(cb))
}

/*
uxer (someone who observes an invite, but not directly involved):

if we see
  someone post an invite I
  someone else post a confirmation C that I has been accepted A
  // OOO that A
  emded that A inside a C(A)
  match valid I->A's and interpret them like follows.

  we only care about confirmations if it's of an invite we follow,
  and it hasn't been confirmed already.

{
  invited: {
    <alice>: { <bob>: true, ...}
  }

  invites: { <invites>, ...}
  accepts: { <accepts>, ...}

}

---

pub

  someone connects, using key from an open invite I
  they request that invite I (by it's id)
  they send a message accepting A the invite.
  the pub then posts confirmation (I,A)

*/

exports.name = 'invites'

exports.version = '1.0.0'
exports.manifest = {
  getInvite: 'async',
  accept: 'async',
//  create: 'async'
}

exports.permissions = {
//  master: {allow: ['create']}
}

// KNOWN BUG: it's possible to accept an invite more than once,
// but peers will ignore subsequent acceptances. it's possible
// that this could create confusion in certain situations.
// (but you'd get a feed that some peers thought was invited by Alice
// other peers would think a different feed accepted that invite)
// I guess the answer is to let alice reject the second invite?)
// that would be easier to do if this was a levelreduce? (keys: reduce, instead of a single reduce?)

exports.init = function (sbot, config) {

  var invites = sbot._flumeUse('invites', Reduce(1, function (acc, data) {
    if(!acc) acc = {invited: {}, invites:{}, accepts: {}}

    var msg = data.value
    var invite, accept
    if(msg.content.type === 'invite') {
      invite = msg
      accept = acc.accepts[data.key]
    }
    else if(msg.content.type === 'invite/accept') {
      accept = msg
      invite = acc.invites[accept.content.receipt]
    }
    else if(msg.content.type === 'invite/confirm') {
      accept = msg.content.embed
      invite = acc.invites[accept.content.receipt]
    }
    if(invite && accept) {
      if(invite === true)
        return acc
      var invite_id = accept.content.receipt
      try {
        I.verifyAccept(accept, invite)
        //delete matched invites, but _only_ if they are valid.
        delete acc.accepts[invite_id]
        //but remember that this invite has been processed.
        acc.invites[invite_id] = true
      } catch (err) {
        return acc //? or store something?
      }
    }
    else if(invite)
      acc.invites[data.key] = invite
    else if(accept)
      acc.accepts[accept.receipt] = accept

    return acc

  }))

  sbot.auth.hook(function (fn, args) {
    var id = args[0], cb = args[1]
    invites.get(function (err, v) {
      if(err) return cb(err)
      for(var k in v.invites) {
        if(v.invites[k].content.invite === id)
          return cb(null, {
            allow: ['invites.getInvite', 'invites.accept'],
            deny: null
          })
      }
    })
  })

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

  var accepted = {}

  invites.accept = function (accept, cb) {
    //check if the invite in question hasn't already been accepted.
    invites.get(function (err, v) {
      var invite_id = accept.content.receipt
      var invite = v.invites[invite_id]

      if(invite === true || accepted[invite_id])
        //TODO: this should return the confirmation, not an error.
        return all(
          sbot.links({dest: invite_id, values: true, keys: false, meta: false}),
          function (err, confirms) {
            if(err) cb(err)
            else cb(null,
              confirms.filter(function (e) {
                try {
                  return (
                    e.content.type === 'invite/confirm' &&
                    e.content.embed.content.receipt === invite_id
                  )
                } catch (err) {
                  return false
                }
              })[0]
            )
          }
        )

      try {
        I.verifyAccept(accept, invite)
      } catch (err) {
        return cb(err)
      }
      //there is a little race condition here
      accepted[invite_id] = true
      sbot.publish({
        type: 'invite/confirm',
        embed: accept,
        //second pointer back to receipt, so that links can find it
        //(since it unfortunately does not handle links nested deeper
        //inside objects. when we look up the message,
        //confirm that content.embed.content.receipt is the same)
        receipt: accept.content.receipt
      }, function (err, data) {
        delete accepted[invite_id]
        cb(err, data.value)
      })
    })
  }

  return invites

}

