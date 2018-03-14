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

## solution: user-invites

These are invites created directly by _users_ to directly
invite one new person.

* user creates invite, publishes stub, sends invite to guest
* guest publishes voucher, which uses accept
* guest calls pub passes accept message directly.
* peers can strongly link invite with stub
* stretch goal: invites can be encrypted.
  The main goal here is to hide the guest's name until they have accepted.

properties:

A invites B.
when B arrives, everyone else can see this is A's guest.
(even if A isn't at the party yet)

exactly 1 person my accept each invite.

if B refuses the invite, it is not revealed that A invited them.

---

simplest possible systems.

Alice creates temp key: K, publishes the public key "stub
("I invited K"),
then gives private key to bob.

bob uses K to sign their real key B. sign_[k](B_pub)
gives that signed object to pub P, who publishes it.

other peers can then observer that K signs B, theirfore A invited B.

---

problems?:
* anyone with K could claim that anyone is the invitee.
  so, accept should be `sign_B(sign_k(B_pub))`
* someone else could claim to have invited B, by publishing K_pub,

v2

alice creates temp key: K, publishes "stub"=sign_A(sign_K(K_pub+A_pub))

bob must acknowledge that this is the exact invite they are accepting

```
sign_B(sign_K(B_pub+stub))
```

(note: "stub" may be a hash of stub for same effect)

---

problems?:

* Alice has given lots of invites out, she needs to keep track of who actually accepts them.

invite stubs could have a name attached.
When bob accepts he gets to see the stub before he signs it,
so can choose not to accept the invite due to the name.

```
stub = sign_A(sign_K(K_pub+A_pub+"name"))
```

* problem: this may reveal information about who is being invited.
solution: encrypt the name.

```
key = hash(K_seed)
stub = sign_A(sign_K({K_pub,A_pub,box(key, "name")})))
```

(am using the hash of the private key, as the encryption key,
so that there is only one thing to give to Bob)

then Bob accepts, by revealing the key.

```
key = hash(K_seed)
sign_B(sign_K({B_pub,stub,key}))
```

peers then verify this, by verifying the signatures,
and that the key works with `unbox(key, stub.name)`

Question: as an option, maybe bob chooses not to decrypt the name?
Question: maybe alice wants to say, "public or nothing!"

situations: professional settings.

Being able to introduce the guest gives the inviter power.
(fair because they are taking a risk inviting them)

I have weird feelings about accepting the invite without
decrypting the name. If you don't accept the name,
you should discuss with the host (person who invited you).
If you don't accept their invite as is, there should be
some back-and-forth.

Problem: alice wants to also give some private information to bob,
for example, a welcome message, or to add bob to a private group (coming soon)

---

## interactions with pubs.

the guest connects to the pub, and requests the stub.
(the pub allows them to request that pub because they have
the invite code pubkey)

if the stub looks good, the guest signs the stub,
(`sign_B(sign_K(B_pub, stub, key))`) and passes
this back to the pub.

The pub then records that acceptance on their log.
(is this a message pointing to the stub and the stub signature?)

---

Notes on [sameAs](https://github.com/ssbc/ssb-same-as#assert-that-you-are-the-same-as-another-feed)

two peers create messages pointing to each other,
``` js
{
  type: 'contact',
  sameAs: other_feed
}
```

if `other_feed` has a sameAs pointing back to this one,
then the feeds are considered merged.

---

question: what is the pub policy?

the pub should follow anyone who they would have replicated,
because of their standing follow policy.

If a pub wouldn't accept your invite, then they wouldn't let you
connect and give you the thing. The invite should include
multiple pubs (say, 3?). 
---

Alice creates joins the network using Pub, which is run by Charles.

Alice creates an invite, and sends it to Bob, with the Pub address
on it.

Bob connects to the Pub, and convinces it that he was invited by alice.
Bob remembers the pub's address, for the future.

Dawn follows Charles and Alice. She sees the sameAs message that
links Pub to Charles. He replicates Pub, and sees it has a public
address. (type: 'address', ...). When she wants to sync Bob or Alice
she connects to Pub.

Dawn sees that Alice has created an invite, but she doesn't know who
it is yet. But then she sees that Pub has acknowledged a reciept
for that invite. Dawn retrives the reciept via ooo, and discovers
Bob. Since she replicates Alice, this is the second hop from here,
so she replicates Bob, and says "HI"

---

subsystems:

sameAs - link a pub with a uxer id.
address - a pub advertises it's public address.
invite/invite-receipt - uxer creates and invite, and a new uxer accepts it.

---

function createInvite (name, cb) {
  var keys = generate()

  publish(signObj({
      name: name, tempId: keys.public
    }, keys), function (err, msg) {
    cb(null, {key: keys.private, msg_id: msg.key})
  })
}

function acceptInvite (invite, keys, cb) {
  publish(signObj({
    invite: invite.msg_id,
    feed: 
  })
}

## License

MIT









