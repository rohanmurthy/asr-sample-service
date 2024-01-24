# Requirements for audio transcription service

## Functional
- intended use: clients submit jobs with chunks of audio. they should get back a single transcript
- `/transcribe` API
  - input
    - audioChunkPaths
      - path to the audio files
      - 0-5 minutes (0-5MB)
      - can be 0-700 words
      - typically 6, max 24 audio files
    - userId
  - output
    - jobId
  - logic:
    - start job to transcribe
    - take given audio files, transcribe all of them individually, and append them together. Send this to caller
- `/transcript/{jobId}`
  - input
    - jobId
  - output
    - TranscriptResult
      - status of the job
        - failed
        - in progress
        - completed
      - the status of each audio chunk
      - completed time
      - transcription
  - logic:
    - given the jobId, return the TranscriptResult of the job
    - get job data from jobs DB with jobId
- `/transcript/search`
  - input
    - jobStatus
    - userId
  - output
    - transcript results
  - logic:
    - given a user and a jobStatus, find all the transcript results for that user that fits the specified jobStatus
    - fetch from the secondary index (user DB)

### Takeaways
- store jobs in DB
  - NoSQL, like AWS DynamoDB
  - key: jobId
  - value: job data (userId, audioChunkPaths, jobStatus, completedTime)
  - secondary index based on userId
  - for implementation I will use memory but to productionize this we would need to persist this data to a legitimate NoSQL DB
    - in production we should cache results from this DB, using Redis or Memcached
    - write-through will ensure data consistency between cached and DB
- store user-level data in DB
  - NoSQL, like AWS DynamoDB
  - key: userId:jobStatus
  - value: jobIds for that user ID and job status combination
  - for implementation I will use memory but to productionize this we would need to persist this data to a legitimate NoSQL DB
    - in production we should cache results from this DB, using Redis or Memcached
    - write-through will ensure data consistency between cached and DB

## Non-functional
- scalable to 1000 DAU
  - 96 audio files per user per day = (8 hours / 1 user) * 60 minutes / (5 minutes / 1 audio file)
    - 24,960 audio files per user per year = 96 * 5 days/week * 52 weeks
  - 96k audio files processed per day
  - around 1000 files at the same time, in the worst case
  - **takeaway**: should have sufficient compute on the servers to handle processing this many files at the same time. We should prefer this to serverless architecture because we want to optimize for performance. Serverless architecture has cold starts.
- gracefully handles failed calls to ASR model. Our web server architecture should have the typical reverse proxy, load balancer, and sufficient number of servers (~10).
  - **takeaway**: since some requests will always fail, do not infinitely retry. Have retries to ASR model: 3 should be sufficient. Exponential backoff should be implemented to ensure ASR model isn't impacted (we don't want to DoS ASR model).
- return response to client within 15 seconds
  - **takeaway**: since calls to ASR model are 5-10s, this response should be cached so we don't need to constantly make calls to ASR on-the-fly
- robust to restarts, resumes in-flight jobs which were killed
  - **takeaway**: to satisfy persistence, we will have a processing Queue where jobs are sent, which are then picked up by a job processor/handler. Upon restart, the web server will send jobs to the queue that were pending.

## Non-requirements
- implementing transcription method
- implementing stitching method

![](/diagram.png)
