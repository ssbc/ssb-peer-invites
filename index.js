var I = require('./valid')

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

}

// KNOWN BUG: it's possible to accept an invite more than once,
// but peers will ignore subsequent acceptances. it's possible
// that this could create confusion in certain situations.
// (but you'd get a feed that some peers thought was invited by Alice
// other peers would think a different feed accepted that invite)
// I guess the answer is to let alice reject the second invite?)
// that would be easier to do if this was a levelreduce? (keys: reduce, instead of a single reduce?)
exports.init = function (sbot, config) {

  var index = sbot._flumeUse('invites', Reduce(1, function (acc, data) {
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
      try {
        I.validateAccept(accept, invite)
        //delete matched invites, but _only_ if they are valid.
        delete acc.accepts[accept.receipt]
        //but remember that this invite has been processed.
        acc.invites[accept.receipt] = true
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
    index.get(function (err, v) {
      if(err) return cb(err)
      for(var k in v.invites)
        if(v.invites[k].invite === id)
          return cb(null, {
            allow: ['invite.getInvite', 'invites.accept'],
            deny: null
          })
    })
  })

  //first
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
        cb(code(
          new Error('invite already used:'+invite_id),
          'invite-already-used'
        ))
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
        return cb(code(
          new Error('invite already used:'+invite_id),
          'invite-already-used'
        ))
      try {
        I.validateAccept(accept, invite)
      } catch (err) {
        return cb(err)
      }
      //there is a little race condition here
      accepted[invite_id] = true
      sbot.publish({type: 'invite/confirm', embed: accept}, function (err, msg) {
        delete accepted[invite_id]
        cb(err, msg)
      })
    })
  }

  return invites

}

