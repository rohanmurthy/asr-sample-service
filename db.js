import { STATUS_DONE, STATUS_PENDING, STATUS_FAILED } from "./constants.js";

/**
 * key: jobId
 * value: TranscriptResult
 *
 * NOTE: in production this would be a legitimate DB, not in-memory
*/
const jobsDB = new Map();

/**
 * key: userId:jobStatus
 * value: set(jobId)
 *
 * NOTE: in production this would have a primary (jobs) and secondary (user) index. Secondary index would help with query optimization.
 * Primary index would be on jobId (like jobsDB). The secondary index would be on userId (like userDB).
 * AWS DynamoDB supports this.
*/
const userDB = new Map();

/**
 * Fetches the transcript result that's in jobsDB and updates its chunkStatuses based on the provided params.
 * 
 * NOTE: this could be an async process so we don't block to call jobsDB
 * 
 * @param {string} jobId - The job ID.
 * @param {string} audioChunkPath - The path of the audio file.
 * @param {string} chunkStatus - The status of the audio chunk's processing.
 */
export function updateTranscriptResultChunkStatus({ jobId, audioChunkPath, chunkStatus }) {
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
export function updateTranscriptResult({ jobId, jobStatus, transcriptText, completedTime }) {
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
}

/**
 * For a given job ID, returns the transcript result for that job that's stored in the jobsDB.
 * 
 * NOTE: There can be a cache that sits in front of the jobsDB to improve performance, which could be Redis/Memcached.
 * 
 * @param {string} jobId - The job ID.
 * @returns {TranscriptResult} - Object describing the transcribed text, statuses of the audio chunk transcriptions, job status, and completion time.
 */
export function getDBTranscriptResult(jobId) {
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
export function getUserJobIds({ userId, jobStatus }) {
  const key  = `${userId}:${jobStatus}`;
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
export function updateUserDB({ userId, jobId, jobStatus }){
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
