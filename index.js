exports.name = 'user-invites'

exports.version = '1.0.0'
exports.manifest = {
}

exports.permissions = {
}

exports.init = function (sbot, config) {
  throw new Error('DEPRECATION: ssb-user-invites has been deprecated. Please use ssb-peer-invites')
}
