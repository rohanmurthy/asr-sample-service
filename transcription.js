import Axios from "axios";
import { updateTranscriptResultChunkStatus, updateTranscriptResult, updateUserDB, getDBTranscriptResult, getUserJobIds } from "./db.js";
import { STATUS_DONE, STATUS_PENDING, STATUS_FAILED } from "./constants.js";

let globalJobId = "1";

function getASROutput(jobId, audioChunkPath, retries = 3, backoffDuration = 10) {
  updateTranscriptResultChunkStatus({ jobId, audioChunkPath, chunkStatus: STATUS_PENDING });

  return new Promise((resolve, reject) => {
    // NOTE: in production we should cache responses to the ASR model to optimize getting this data
    function invokeASR(n) {
      Axios.get(`http://localhost:3000/get-asr-output?path=${audioChunkPath}`)
        .then(resp => {
          updateTranscriptResultChunkStatus({ jobId, audioChunkPath, chunkStatus: STATUS_DONE });
          resolve(resp.data.transcript);
        })
        .catch(err => {
          if (n === retries) {
            updateTranscriptResultChunkStatus({ jobId, audioChunkPath, chunkStatus: STATUS_FAILED });
            reject(err);
          } else {
            setTimeout(() => {
              invokeASR(n + 1);
            }, backoffDuration * Math.pow(2, n));
          }
        });
    }
    invokeASR(0)
  });
}

async function transcribeAndStitch({ userId, jobId, audioChunkPaths}){
  updateTranscriptResult({ jobId, jobStatus: STATUS_PENDING })
  updateUserDB({ userId, jobId, jobStatus: STATUS_PENDING });

  const promisesGetASROutputs = audioChunkPaths.map(audioChunkPath => getASROutput(jobId, audioChunkPath));

  const results = await Promise.all(promisesGetASROutputs)
    .then(asrOutputs => {
      const finalTranscription = asrOutputs.join(" ");
      updateTranscriptResult({ jobId, jobStatus: STATUS_DONE, transcriptText: finalTranscription, completedTime: new Date().toISOString() })
      updateUserDB({ userId, jobId, jobStatus: STATUS_DONE });
      return finalTranscription;
    })
    .catch(err => {
      updateTranscriptResult({ jobId, jobStatus: STATUS_FAILED, completedTime: new Date().toISOString() })
      updateUserDB({ userId, jobId, jobStatus: STATUS_FAILED });
      throw err
    });
  return results;
}

/**
 * Starts a transcription job with the audio chunks for the provided user.
 * 
 * @param {string[]} audioChunkPaths - The list of paths to the audio chunks.
 * @param {string} userId - The user's ID.
 * @returns {string} - The job ID that was started.
 */
export async function startTranscribeJob({ audioChunkPaths, userId }){
  // NOTE: in production we would use a legitimate UUID
  const jobId = globalJobId;
  globalJobId = (Number(globalJobId) + 1).toString();

  // start job, in-parallel process all the audiochunks
  // NOTE: I don't use await here to illustrate the idea that this API call is not blocked by the finishing of the job
  // (the API call starts the job process)
  transcribeAndStitch({ userId, jobId, audioChunkPaths });

  return jobId;
}

/**
 * For a given job ID, returns the transcript result for that job, which describes the transcribed text, statuses,
 * and completion time.
 * 
 * @param {string} jobId - The job ID.
 * @returns {TranscriptResult} - Object describing the transcribed text, statuses of the audio chunk transcriptions, job status, and completion time.
 */
export function getTranscriptResult(jobId) {
  return getDBTranscriptResult(jobId);
}

/**
 * For a given userId and jobStatus, returns the transcript results that apply to that user and job status.
 * 
 * @param {string} jobStatus - The job status.
 * @param {string} userId - The user's ID.
 * @returns {TranscriptResult[]} - List of objects describing the transcribed text, statuses of the audio chunk transcriptions, job status, and completion time.
 */
export function getUserTranscriptResults({ jobStatus, userId }) {
  const jobIds = getUserJobIds({ userId, jobStatus });
  if (!jobIds) {
    return undefined
  }
  return [...jobIds].map(jobId => getTranscriptResult(jobId));
}
