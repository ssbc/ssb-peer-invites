# user-invites

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

## user invites - how it works

host (user creating the invite) generates a _seed_, and publishes an invitation
message (`type:'user-invite'`) for their guest (new user, receiving the invite)
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
on their own feed (`type: 'user-invite/accept'`), and then pass that to the pub,
who then publishes a confirm message (`type: user-invite/confirm'`).
Now peers who replicate the pub's feed can see the guest has arrived.

## api

### userInvites.create({id?, public?, reveal?, hops?}, cb(err, invite))

does everything needed to create an invite. generates a seed, finds pubs to act
as introducers, and publishes an invite message.

`id` is the host id to invite from. (optional, will use your default id if not provided).
private and reveal are information thatis encrypted into the invite, except
that `private` is read only by the guest, but the key to `reveal` is published
as the guest accepts the invite. (so it's eventually read by everyone, but only
if the guest accepts the invite)

user-invites have a lot more accountability than the previous _followbot_ system.
You can see who invited who. (so if someone invites an asshole, the community can see
who did that, but the host will already know that, so they'll think twice, or caution
their friend to not be a jerk) `reveal` can be used to enhance this. It could for
example - be used to assign someone a name before they are invited.

private can be used for the benefit of the guest. it may contain a welcome message
or links to threads or channels, or users to follow.

on success, cb is called with `{invite: msgId, seed: seed, pubs: [addr,...]}`
this information can be sent to the guest as the invite!



## example

Alice wishes to invite Bob to her corner of the ssb
network. But she is does not have a pub server.
She creates a user invite, indicating that she
is creating an invite. This is just a message on her feed.

``` js
var seed = random(32) //32 bytes of randomness
var invite_key = ssbKeys.generate(null, seed)
var invite_cap = require('ssb-config').caps.invite

alice_sbot.publish(ssbKeys.signObj({
    type: 'invite',
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

*** TODO *** alice encodes the seed, the message id,
and the addresses of some pubs that are likely
to replicate bob. this is called the "invite code"

she then gives the invite code to bob via a channel
she already trusts, say, a 1:1 chat app.

bob then connects to one of the pubs in the invite
code, using the guest id derived from the seed
(which the pub will recognise as alice's guest)

bob then requests the invite message, and probably
alice's feed. if the invite has reveal and public
fields, bob decrypts them.

if bob accepts the invite,
bob then creates an "invite/accept" message,
which is a proof that he has the seed, and knows
who's invite he is accepting.

``` js
var invite_key = ssbKeys.generate(null, seed)
var invite_cap = require('ssb-config').caps.invite

sbot_bob.publish(ssbKeys.signObj({
    type: 'invite/accept',
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
and if is correct, posts a new message containing it.

``` js
sbot_pub.publish({
    type: 'invite/confirm',
    embed: invite_accept_msg //embed the whole message.
  }, function (err, invite_confirm_msg) {
    ...
  })
```
the pub just reposts the whole invite_accept message
that bob created. this makes the message available
for other peers to validate, since they do not follow
bob yet.

the pub now knows that bob and alice are friends,
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

## License

MIT







