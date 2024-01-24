# ASR Sample Service

This implements a mock ASR service for use as part of a takehome interview problem.

`asr-server.js` : server and API defintion logic
`transcription.js` : core logic for the audio transcription service
`db.js` : logic for interacting with DB
`constants.js` : constant definitions
`requirements.md` : file going through thought process around function and non-functional requirements. Contains architectural diagram.

I have many comments in the code that start with `NOTE:` (you can do a find for this in this repo) where I explain logic in more detail. For example, I use these comments to note points about what we would do to make some of these things production-ready.

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
     -d '{"userId": "rohan", "audioChunkPaths": ["audio-file-1.wav", "audio-file-2.wav"]}'

curl -X POST http://localhost:3000/transcribe \
     -H "Content-Type: application/json" \
     -d '{"userId": "rohan", "audioChunkPaths": ["audio-file-1.wav", "audio-file-2.wav", "audio-file-3.wav", "audio-file-4.wav", "audio-file-5.wav", "audio-file-6.wav", "audio-file-7.wav", "audio-file-9.wav", "audio-file-10.wav"]}'

curl -X POST http://localhost:3000/transcribe \
     -H "Content-Type: application/json" \
     -d '{"userId": "rohan", "audioChunkPaths": ["audio-file-1.wav", "audio-file-2.wav", "audio-file-3.wav", "audio-file-4.wav", "audio-file-5.wav", "audio-file-6.wav", "audio-file-7.wav", "audio-file-8.wav", "audio-file-9.wav", "audio-file-10.wav"]}'

curl 'http://localhost:3000/transcript/1' | json_pp

curl 'http://localhost:3000/transcript/search?jobStatus=done&userId=rohan' | json_pp

curl 'http://localhost:3000/transcript/search?jobStatus=pending&userId=rohan' | json_pp

curl 'http://localhost:3000/transcript/search?jobStatus=failed&userId=rohan' | json_pp
```

```sh
curl 'http://localhost:3000/get-asr-output?path=audio-file-7.wav'
```
