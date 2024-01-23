# ASR Sample Service

This implements a mock ASR service for use as part of a takehome interview problem.

## Setting up the service

### Node

This service uses node >= 18.0. We recommend using [nvm](https://github.com/nvm-sh/nvm) to install and manage node versions if you don't already have node setup. Once installed you can run `nvm use` within this directory to use the correct node version.

### Dependencies

The primary dependency of this project is Fastify, a node.js webserver framework.

`npm install` will install all dependencies.

### Running the server

`npm start` will spin up the server on `localhost:3000`

### Querying the server

```sh
curl -X POST http://localhost:3000/transcribe \
     -H "Content-Type: application/json" \
     -d '{"userId": "rohan", "audioChunkPaths": ["audio-file-7.wav", "audio-file-2.wav"]}'

curl 'http://localhost:3000/transcript/1' | json_pp

curl 'http://localhost:3000/transcript/search?jobStatus=done&userId=rohan' | json_pp
```

```sh
curl 'http://localhost:3000/get-asr-output?path=audio-file-7.wav'
```
