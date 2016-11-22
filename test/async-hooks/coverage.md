## AsyncHooks Coverage Overview

Showing which kind of async resource is covered by which test:

| Resource Type        | Test                                   |
|----------------------|----------------------------------------|
| CONNECTION           | test-connection.ssl.js                 |
| FSEVENTWRAP          | test-fseventwrap.js                    |
| FSREQWRAP            | test-fsreqwrap-{access,readFile}.js    |
| GETADDRINFOREQWRAP   | test-getaddrinforeqwrap.js             |
| GETNAMEINFOREQWRAP   | test-getnameinforeqwrap.js             |
| HTTPPARSER           | test-httpparser.{request,response}.js  |
| Immediate            | test-immediate.js                      |
| JSSTREAM             | TODO (crashes when accessing directly) |
| PBKDF2REQUEST        | test-crypto-pbkdf2.js                  |
| PIPECONNECTWRAP      | test-pipeconnectwrap.js                |
| PIPEWRAP             | test-pipewrap.js                       |
| PROCESSWRAP          | test-pipewrap.js                       |
| QUERYWRAP            | test-querywrap.js                      |
| RANDOMBYTESREQUEST   | test-crypto-randomBytes.js             |
| SENDWRAP             | test-sendwrap.js                       |
| SHUTDOWNWRAP         | test-shutdownwrap.js                   |
| SIGNALWRAP           | test-signalwrap.js                     |
| STATWATCHER          | test-statwatcher.js                    |
| TCPWRAP              | test-tcpwrap.js                        |
| TCPCONNECTWRAP       | test-tcpwrap.js                        |
| TIMERWRAP            | test-timerwrap.set{Timeout,Interval}.js|
| TLSWRAP              | test-tlswrap.js                        |
| TTYWRAP              | test-ttywrap.{read,write}stream.js     |
| UDPWRAP              | test-udpwrap.js                        |
| WRITEWRAP            | test-writewrap.js                      |
| ZCTX                 | test-zctx.zlib-binding.deflate.js      |
