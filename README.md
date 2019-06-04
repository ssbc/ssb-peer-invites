# peer-invites

when ssb was younger, we created the current invite system,
henceforth in this document referred to as the "followbot" system.
special peers called "pubs" can create tokens called "invite codes".
The invite code allows a new person to connect to the pub, and
request a follow.

This generally worked fairly well, but had some problems:

* not clear who invited who.
* people were confused about what a "pub" was
* sometimes pubs failed to follow back.
* some pubs more inviting than others "too open"
* hard to tell if growth was word of mouth or not

## usage

With peer invites, you can create invites without having a pub.
However, your local sbot needs to support peer invites.
that requires installing the following, if you havn't already:

```
sbot plugins.install ssb-device-address
sbot plugins.install ssb-identities
sbot plugins.install ssb-peer-invites
```

with peer invites, you do not need to have your own pub server,
as long as you have a friend has one (that supports peer-invites).
To enable peer-invites on your pub, install the same modules
and restart, and also announce a public address using
[ssb-device-address](https://github.com/ssbc/ssb-device-address)

then restart your sbot local server, there will be a bit of
index building, then you can create invites!

```
>sbot peerInvites.create
invite_code...
```
send `invite_code` to your friend and they can use

```
>sbot peerInvites.openInvite {invite_code}
{ private:..., reveal:...}
```
This shows what you have been invited to. This can contain a welcome
message, or access to private groups (TODO).
The `private` section is only readable by the guest,
but the `reveal` section is made public once the guest accepts the invite.

then, to actually accept the invite, they do:

```
>sbot peerInvites.acceptInvite {invite_code}
accept_message...
```

## peer invites - how it works

host (peer creating the invite) generates a _seed_, and publishes an invitation
message (`type:'peer-invite'`) for their guest (new peer, receiving the invite)
The message may contain both a private and a reveal section.
(private section is only readably be the guest, but reveal is published
if they guest accepts the invite).

The host then checks for peers that have a public address and follow them.
The host provides the guest with the `seed` the invite message id, and
a short list of [pub addresse](http://github.com/ssbc/ssb-device-address) that may process the invite.

The guest accepting the invite is a two step process. First they use the
seed and the pub addresses to connect to a pub and request the invite message.
Here they may read a private message from their host, as well as see what will
be revealed once they accept. If they accept, they publish a accept message
on their own feed (`type: 'peer-invite/accept'`), and then pass that to the pub,
who then publishes a confirm message (`type: peer-invite/confirm'`).
Now peers who replicate the pub's feed can see the guest has arrived.

## api

### peerInvites.create({id?, public?, reveal?, hops?}, cb(err, invite))

does everything needed to create an invite. generates a seed, finds pubs to act
as introducers, and publishes an invite message.

`id` is the host id to invite from. (optional, will use your default id if not provided).
private and reveal are information that is encrypted into the invite, except
that `private` is read only by the guest, but the key to `reveal` is published
as the guest accepts the invite. (so it's eventually read by everyone, but only
if the guest accepts the invite)

peer-invites have a lot more accountability than the previous _followbot_ system.
You can see who invited who. (so if someone invites an asshole, the community can see
who did that, but the host will already know that, so they'll think twice, or caution
their friend to not be a jerk) `reveal` can be used to enhance this. It could for
example - be used to assign someone a name before they are invited.

private can be used for the benefit of the guest. it may contain a welcome message
or links to threads or channels, or peers to follow.

on success, cb is called with `{invite: msgId, seed: seed, pubs: [addr,...]}`
this information can be sent to the guest as the invite!

### peerInvites.openInvite(invite, cb(err, invite_msg, content)

"open" an invite. retrives the invite message created by the host (using `peerInvites.create`)
and decrypt any encrypted values. since the invite may contain a welcome message, etc,
peer interfaces implementing peer interfaces should process peer-invites in two steps.
firstly opening the invite, then accepting (on peer confirmation)

calling openInvite will not publish a message, but may make a network connection
(if you do not already possess the `invite_msg` which you won't the first time)

### peerInvites.acceptInvite(invite, cb)

accept the invite. this publishes a `peer-invite/accept` message locally,
and then contacts a pub and asks them publish a `peer-invite/confirm` message.

## example

Alice wishes to invite Bob to her corner of the ssb
network. But she is does not have a pub server.
She creates a _peer invite_, indicating that she
is creating an invite. This is just a message on her feed.

``` js
var seed = random(32) //32 bytes of randomness
var invite_key = ssbKeys.generate(null, seed)
var invite_cap = require('ssb-config').caps.invite

alice_sbot.publish(ssbKeys.signObj({
    type: 'peer-invite',
    invite: invite_key.id,
    host: alice.id,

    //optional fields
    reveal: box(message_to_be_revealed, hash(hash(seed))),
    private: box(message_for_bob, hash(seed))
  }, invite_cap, invite_key),
  function (err, invite_msg) {
    ...
  })
```
`reveal` and `private` are optional, and will
be discussed later.

also note, the the invite is self-signed, to proove
that alice created the invite code, and so that no one
else can claim they invited alice's friend.
The signature has an `invite_cap` so that it cannot be confused with another type of signature.

Alice encodes the seed, the invite message id,
and the addresses of some pubs that are likely
to replicate bob. this is called the "invite code"

she then gives the invite code to bob via a channel
she already trusts, say, a 1:1 chat app.

bob then connects to one of the pubs in the invite
code, using the seed to derive a private key.
(which the pub will recognise as alice's guest id)

bob then requests the invite message id, and probably
alice's feed. if the invite has reveal and public
fields, bob decrypts them by hashing the seed.

If bob accepts the invite,
bob then creates an "peer-invite/accept" message,
which is a proof that he has the seed, and knows
who's invite he is accepting, and indicates the long term
key he will be using. At this point, he can forget the seed.

``` js
var invite_key = ssbKeys.generate(null, seed)
var invite_cap = require('ssb-config').caps.invite

sbot_bob.publish(ssbKeys.signObj({
    type: 'peer-invite/accept',
    receipt: getId(invite_msg), //the id of the invite message
    id: bob.id, //the id we are accepting this invite as.
    //if the invite has a reveal, key must be included.
    key: hash(hash(seed))
  }, invite_cap, invite_key),
  function (err, invite_accept_msg) {
    ...
  })
```

This is then passed to the pub, who verifies it,
and if is correct, posts a confirm message.

``` js
sbot_pub.publish({
    type: 'peer-invite/confirm',
    embed: invite_accept_msg //embed the whole message.
  }, function (err, invite_confirm_msg) {
    ...
  })
```
the pub just reposts the whole invite_accept message
that bob created. this makes the message available
for other peers to validate, since they do not follow
bob yet.

The pub now knows that bob and alice are friends,
and will start replicating bob. Other friends
of alice who replicate the pub will also see this,
and they will also start replicating bob. Thus
alice's friends can welcome bob, knowing it's a friend
of alice, even if alice is offline.

## reveal & private

There are two optional encrypted fields on an invite.
`reveal` and `private`. The private field contains
a private message from the host that the guest reads
when accepting the invite. The private field is
intended to hold a private welcome message from the host.
The reveal feed is more
interesting. To accept the invite, the guest must
provide the decryption key to the reveal field,
otherwise their accept message is ignored.
The reveal field is intended to hold a message from
the host to their other peers, it's _about_ their guest,
but it's _for_ their other friends.
"hey everyone, this is bob, he's really awesome at growing mushrooms!" 
Most importantly, this message can be used to assign
a name for bob. Also importantly, the reveal message
is secret until bob accepts the invite. This avoids
revealing anything about bob without his consent
(he may choose not to accept the invite if he disagrees
with what alice says about him)

## messages

because the trick here is two keys are associated,
some particular techniques are used.

#### double signatures

notice a pattern with two keys and two signatures,
the inner, short term key, signs the outer long term public key,
and then the outer, long term key, signs the signed message
of the short term key.

```
sign(sign({message, long_term.public}, short_term), long_term)
```

A key point here is that the inner signs the public key of the outer.
Otherwise another party could just replay the inner portion,
but by signing the long term key (and checking this when validating,
this is prevented).

#### signing capability

the inner signatures uses [`ssbKeys.signObj(key, hmac_key?, obj)`](https://github.com/ssbc/ssb-keys#signobjkeys-hmac_key-obj)
with an _`hmac_key`_ provided. The purpose of this is to ensure
that this signature can never be confused with a signature used for
other purposes (such as ordinary message signing).

### peer-invite

published by the host when creating the invite.

``` js
{
  previous: ...,
  author: host_longterm_id,
  ... //other required message fields
  content {
    type: 'peer-invite',
    host: author_id,  // author of this message.
    invite: guest_temp_id, // public key guest will use to authenticate
    reveal: boxed,    // encrypted message to be revealed (optional)
    private: boxed,   // encrypted message for guest only (optional)
    signature: inner_sig, //signed by `guest_temp_id`, to prove that `author` held that.
  },
  signature: sig //signed by author.
}
```

### peer-invite/accept

published by guest when accepting the above invite.

``` js
{
  previous: ...,
  author: guest_long_term_id,
  ... //other required fields,
  content: {
    type: 'peer-invite/accept',
    receipt: invite_id,     // the id of the invite message (which is being accepted).
    id: guest_long_term_id, // the real identity which the guest will use now.
    key: hash(seed),        // key used to encrypt the `reveal` field. required if reveal was present.
                            // if the guest does not wish to reveal that info, they should ask
                            // their host to create another invite.
    signature: inner_sig    // signed by guest_temp_id, to prove that guest_long_term_id held that.
  },
  signature: outer_sig
}
```

a double signature is used as with the `peer-invite` message.

### peer-invite/confirm

published by a pub, when observing an invite accept message.
it just embeds the accept_message.

``` js
{
  type: 'peer-invite/confirm',
  embed: accept_message
}
```

# License

MIT
























