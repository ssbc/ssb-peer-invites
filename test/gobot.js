let { mkdtempSync, copyFileSync, lstatSync, mkdirSync, writeFileSync } = require('fs')
let createClient = require('ssb-client')
let { spawn, execFileSync } = require('child_process')
let { join } = require('path')


execFileSync("go", ["install", "-v", "go.cryptoscope.co/ssb/cmd/..."], {stdio: "inherit"})

module.exports = function(opts) {
    // console.dir(opts)
    let args = []
    
    let port = opts.port || 8008
    let host = `localhost:${port}`
    
    args.push('-l')
    args.push(host)
    
    let tmp = opts.temp || false
    let repoPath = ""
    
    if (tmp) {
        try {
            lstatSync('testrun');
        } catch(err) {
            mkdirSync('testrun')
        }
        repoPath = mkdtempSync(join('testrun', 'gosbot'))
        
        args.push('-repo')
        args.push(repoPath)
    }

    /* TODO:
        - add caps.sign
        - add caps.peerInvite
        - intercept close() ?!
    */

    if (opts.caps.shs) {
        let ak = opts.caps.shs.toString('base64')
        args.push('-appKey')
        args.push(ak)
    }
  
    writeFileSync(join(repoPath,'secret'), JSON.stringify(opts.keys))

    console.log('running with args', args.join(' '))

    let gobot = spawn("/home/cryptix/go/bin/go-sbot", args, {stdio: ['inherit', 'inherit', 'pipe']})
    gobot.on('close', (code) => {
        console.error(`go sbot exited with code ${code}`);
        process.exit(code)
    });

   

    // just for ssb-client
    copyFileSync("/home/cryptix/fake_manifest.json", join(repoPath, "manifest.json"))
    


    return function (cb) {


        
        gobot.stderr.on('data', (data) => {
            console.log(`gobot: ${data}`)
            if (data.indexOf('event=serving') > -1) {
                createClient(opts.keys, {
                    remote: `net:${host}~shs:${opts.keys.public}`,
                    path: repoPath,
                    caps: opts.caps || {},
                }, cb)
            }
        });

       
    }
}