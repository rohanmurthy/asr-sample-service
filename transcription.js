import Axios from "axios";
import { updateTranscriptResultChunkStatus, updateTranscriptResult, updateUserDB, getDBTranscriptResult, getUserJobIds } from "./db.js";
import { STATUS_DONE, STATUS_PENDING, STATUS_FAILED } from "./constants.js";

let globalJobId = "1";

function getASROutput(jobsDB, jobId, audioChunkPath, retries = 3, backoffDuration = 10) {
  updateTranscriptResultChunkStatus({ jobsDB, jobId, audioChunkPath, chunkStatus: STATUS_PENDING });

  return new Promise((resolve, reject) => {
    function invokeASR(n) {
      Axios.get(`http://localhost:3000/get-asr-output?path=${audioChunkPath}`)
        .then(resp => {
          updateTranscriptResultChunkStatus({ jobsDB, jobId, audioChunkPath, chunkStatus: STATUS_DONE });
          resolve(resp.data.transcript);
        })
        .catch(err => {
          if (n === retries) {
            updateTranscriptResultChunkStatus({ jobsDB, jobId, audioChunkPath, chunkStatus: STATUS_FAILED });
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

async function transcribeAndStitch({ jobsDB, userDB, userId, jobId, audioChunkPaths}){
  updateTranscriptResult({ jobsDB, jobId, jobStatus: STATUS_PENDING })
  updateUserDB({ userDB, userId, jobId, jobStatus: STATUS_PENDING });

  const promisesGetASROutputs = audioChunkPaths.map(audioChunkPath => getASROutput(jobsDB, jobId, audioChunkPath));

  const results = await Promise.all(promisesGetASROutputs)
    .then(asrOutputs => {
      console.log(`asrOutputs: ${asrOutputs}`);
      const finalTranscription = asrOutputs.join(" ");
      updateTranscriptResult({ jobsDB, jobId, jobStatus: STATUS_DONE, transcriptText: finalTranscription, completedTime: new Date().toISOString() })
      updateUserDB({ userDB, userId, jobId, jobStatus: STATUS_DONE });
      return finalTranscription;
    })
    .catch(err => {
      console.error("transcription failed: ", err);
      updateTranscriptResult({ jobsDB, jobId, jobStatus: STATUS_FAILED, completedTime: new Date().toISOString() })
      updateUserDB({ userDB, userId, jobId, jobStatus: STATUS_FAILED });
      throw err
    });
  return results;
}

/**
 * NOTE?: the jobs could go in a queue?
 * @param {string[]} audioChunkPaths - The list of paths to the audio chunks.
 * @param {string} userId - The user's ID.
 */
export async function startTranscribeJob({ audioChunkPaths, userId }, jobsDB, userDB){
  // NOTE: in production we would use a legitimate UUID
  const jobId = globalJobId;
  globalJobId = (Number(globalJobId) + 1).toString();

  // start job, in-parallel process all the audiochunks
  transcribeAndStitch({ jobsDB, userDB, userId, jobId, audioChunkPaths });

  return jobId;
}

/**
 * For a given job ID, returns the transcript result for that job, which describes the transcribed text, statuses,
 * and completion time.
 * 
 * @param {string} jobId - The job ID.
 * @returns {TranscriptResult} - Object describing the transcribed text, statuses of the audio chunk transcriptions, job status, and completion time.
 */
export function getTranscriptResult(jobId, jobsDB) {
  return getDBTranscriptResult(jobId, jobsDB);
}

/**
 * For a given userId and jobStatus, returns the transcript results that apply to that user and job status.
 * 
 * @param {string} jobStatus - The job status.
 * @param {string} userId - The user's ID.
 * @returns {TranscriptResult[]} - List of objects describing the transcribed text, statuses of the audio chunk transcriptions, job status, and completion time.
 */
export function getUserTranscriptResults({ jobStatus, userId }, jobsDB, userDB) {
  const jobIds = getUserJobIds({ userDB, userId, jobStatus });
  if (!jobIds) {
    return undefined
  }
  return [...jobIds].map(jobId => getTranscriptResult(jobId, jobsDB));
}
