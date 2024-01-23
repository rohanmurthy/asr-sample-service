import { STATUS_DONE, STATUS_PENDING, STATUS_FAILED } from "./constants.js";

/**
 * key: jobId
 * value: TranscriptResult
*/
// const jobsDB = new Map();

/**
 * key: userId:jobStatus
 * value: set(jobId)
 * 
 * NOTE: in production this would have a primary and secondary index. Secondary index would help with query optimization.
 * Primary index would be on jobId (like jobsDB). The secondary index would be on userId (like userDB).
 * AWS DynamoDB supports this.
*/
// const userDB = new Map();

/**
 * Fetches the transcript result that's in jobsDB and updates its chunkStatuses based on the provided params.
 * 
 * NOTE: this could be an async process so we don't block to call jobsDB
 * 
 * @param {string} jobId - The job ID.
 * @param {string} audioChunkPath - The path of the audio file.
 * @param {string} chunkStatus - The status of the audio chunk's processing.
 */
export function updateTranscriptResultChunkStatus({ jobsDB, jobId, audioChunkPath, chunkStatus }) {
  if (!jobId || !audioChunkPath || !chunkStatus) {
    return
  }

  const transcriptResult = jobsDB.get(jobId) || {};
  const chunkStatuses = transcriptResult.chunkStatuses || {};
  chunkStatuses[audioChunkPath] = chunkStatus;
  transcriptResult.chunkStatuses = chunkStatuses;
  jobsDB.set(jobId, transcriptResult);
}

/**
 * Updates the transcript result that's in the jobsDB based on the provided parameters.
 * 
 * NOTE: this could be an async process so we don't block to call jobsDB
 * 
 * @param {string} jobId - The job ID.
 * @param {string} jobStatus - The status of the job.
 * @param {string} transcriptText - The final transcription text.
 * @param {string} completedTime - The time the job was completed.
 */
export function updateTranscriptResult({ jobsDB, jobId, jobStatus, transcriptText, completedTime }) {
  console.log(`here2: ${jobId}`);

  if (!jobId) {
    return
  }

  const transcriptResult = jobsDB.get(jobId) || {};
  if (jobStatus) {
    transcriptResult.jobStatus = jobStatus;
  }
  if (transcriptText) {
    transcriptResult.transcriptText = transcriptText;
  }
  if (completedTime) {
    transcriptResult.completedTime = completedTime;
  }
  jobsDB.set(jobId, transcriptResult);
  // console.log(`here3: ${JSON.stringify(Array.from(jobsDB.entries()))}`);
  console.log("updateTranscriptResult----------st");
  console.log(`keys: ${[...jobsDB.keys()]}`);
  jobsDB.forEach((value, key) => {
      console.log(`${key} -> ${JSON.stringify(value)}`);
  });
  console.log("updateTranscriptResult----------end");

  // console.log(`here4: ${JSON.stringify(transcriptResult)}`);
}

/**
 * For a given job ID, returns the transcript result for that job that's stored in the jobsDB.
 * 
 * NOTE: There can be a cache that sits in front of the jobsDB to improve performance, which could be Redis/Memcached.
 * 
 * @param {string} jobId - The job ID.
 * @returns {TranscriptResult} - Object describing the transcribed text, statuses of the audio chunk transcriptions, job status, and completion time.
 */
export function getDBTranscriptResult(jobId, jobsDB) {
  // console.log(`here3: ${JSON.stringify(Array.from(jobsDB.entries()))}`);
  // console.log(`here4: ${JSON.stringify(jobsDB.get(jobId))}`);
  console.log("getDBTranscriptResult----------st");
  console.log(`keys: ${[...jobsDB.keys()]}`);
  jobsDB.forEach((value, key) => {
    console.log(`${key} -> ${JSON.stringify(value)}`);
  });
  console.log(`jobId: ${jobId}`);
  console.log("getDBTranscriptResult----------end");
  return jobsDB.get(jobId);
}

/**
 * Gives the set of jobIds that apply to the given userId and jobStatus.
 * 
 * NOTE: There can be a cache that sits in front of the jobsDB to improve performance, which could be Redis/Memcached.
 * 
 * @param {string} userId - The user's ID.
 * @param {string} jobStatus - The status of the job.
 * @returns {Set} - Set of jobIds.
 */
export function getUserJobIds({ userDB, userId, jobStatus }) {
  const key  = `${userId}:${jobStatus}`;
  console.log(`getUserJobIds: ${key}`);
  console.log(`getUserJobIds: ${userDB.get(key)}`);
  console.log(`userDB: ${[...userDB.keys()]}`);
  console.log(`getUserJobIds: ${JSON.stringify([...userDB.get(key)])}`);
  return userDB.get(key);
}

/**
 * Updates the userDB based on the params. This adds the jobId to the `${userId}:${jobStatus}` key-value pair
 * and removes the jobId if it's in another key-value pair for the given userId.
 * 
 * NOTE: this could be an async process so we don't block to call jobsDB
 * 
 * @param {string} userId - The user's ID.
 * @param {string} jobId - The job ID.
 * @param {string} jobStatus - The status of the job.
 */
export function updateUserDB({ userDB, userId, jobId, jobStatus }){
  // add updated jobStatus
  const key  = `${userId}:${jobStatus}`;
  const currJobIds = userDB.get(key) || new Set();
  currJobIds.add(jobId);
  userDB.set(key, currJobIds)

  // ensure jobId is removed from the user's other mapping
  if ([STATUS_DONE, STATUS_FAILED].includes(jobStatus)) {
    const keyToUpdate = `${userId}:${STATUS_PENDING}`;
    const existingSet = userDB.get(keyToUpdate);
    if (!existingSet) {
      console.log("Error: there should already be mapping for this key");
    }
    existingSet.delete(jobId);
    userDB.set(keyToUpdate, existingSet)
  }
}
