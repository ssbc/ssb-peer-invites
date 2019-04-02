
module.exports = {
  description: 'invite peers to your ssb network',
  commands: {
    create: {
      type: 'async',
      description: 'create an invitation',
      args: {
        id: {
          type: 'FeedId',
          description: 'feed identity to create invite from, defaults to your main identity',
          optional: true
        },
        private: {
          type: "Any",
          description: 'message to be encrypted to guest',
          optional: true,
        },
        reveal: {
          type: "Any",
          description: 'message to be encrypted to guest, and also publically revealed on invite acceptance',
          optional: true
        }

      }
    },
    getNearbyPubs: {
      type: 'async',
      descryption: 'get a list of nearby pubs that are willing to receive peer invites for you. if this does not return anything, no one will be able to accept your messages. Used internally by `ssb-peer-invites`',
      args: {
        hops: {
          type: 'number',
          description: 'number of hops away pubs are still considered "nearby", default is 2',
          optional: true
        }
      }
    },
    openInvite: {
      type: 'async',
      description: 'retrive an invitation, and decrypt any private messages inside it',
      args: {
        invite: {
          type: "PeerInvite",
          descryption: 'a peer invite as returned by peerInvites.create',
          optional: false
        }
      }
    },
    acceptInvite: {
      type: 'async',
      description: 'accept an invitation, including revealing publically any information in the reveal portion of the invitation. (see peerInvites.openInvite)',
      args: {
        invite: {
          type: "PeerInvite",
          descryption: 'a peer invite as returned by peerInvites.create',
          optional: false
        }
      }
    }
  }
}









