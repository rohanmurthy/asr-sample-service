import { STATUS_DONE, STATUS_PENDING, STATUS_FAILED } from "./constants.js";

/**
 * key: jobId
 * value: TranscriptResult
*/
let jobsDB = new Map();

/**
 * key: userId:jobStatus
 * value: set(jobId)
*/
let userDB = new Map();

/**
 * Fetches the transcript result that's in jobsDB and updates its chunkStatuses based on the provided params.
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
 * NOTE: There can be a cache that sits in front of the jobsDB to improve performance, which could be Redis/Memcached.
 * 
 * @param {string} jobId - The job ID.
 * @returns {TranscriptResult} - Object describing the transcribed text, statuses of the audio chunk transcriptions, job status, and completion time.
 */
export function getDBTranscriptResult(jobId) {
  return jobsDB.get(jobId);
}


/**
 * TODO
 * 
 * @param {string} userId - The user's ID.
 * @param {string} jobStatus - The status of the job.
 * @returns {Set} - TODO
 */
export function getUserJobIds({ userId, jobStatus }) {
  const key  = `${userId}:${jobStatus}`;
  return userDB.get(key);
}
