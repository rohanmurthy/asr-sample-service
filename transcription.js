import Axios from "axios";
import { updateTranscriptResultChunkStatus, updateTranscriptResult, getDBTranscriptResult } from "./db.js";
import { STATUS_DONE, STATUS_PENDING, STATUS_FAILED } from "./constants.js";

let globalJobId = 0;

function getASROutput(jobId, audioChunkPath, retries = 3, backoffDuration = 10) {
  updateTranscriptResultChunkStatus({ jobId, audioChunkPath, chunkStatus: STATUS_PENDING });

  return new Promise((resolve, reject) => {
    function invokeASR(n) {
      Axios.get(`http://localhost:3000/get-asr-output?path=${audioChunkPath}`)
        .then(resp => {
          updateTranscriptResultChunkStatus({ jobId, audioChunkPath, chunkStatus: STATUS_DONE });
          resolve(resp);
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

async function transcribeAndStitch(jobId){
  updateTranscriptResult({ jobId, jobStatus: STATUS_PENDING })

  const promisesGetASROutputs = audioChunkPaths.map(audioChunkPath => getASROutput(jobId, audioChunkPath));

  const results = await Promise.all(promisesGetASROutputs)
    .then(asrOutputs => {
      const finalTranscription = asrOutputs.join(" ");
      updateTranscriptResult({ jobId, jobStatus: STATUS_DONE, transcriptText: finalTranscription, completedTime: new Date().toISOString() })
      return transcriptResult;
    })
    .catch(err => {
      console.error("transcription failed: ", err);
      updateTranscriptResult({ jobId, jobStatus: STATUS_FAILED, completedTime: new Date().toISOString() })
      throw err
    });
  return results;
}

/**
 * NOTE?: the jobs could go in a queue?
 * @param {string[]} audioChunkPaths - The list of paths to the audio chunks.
 * @param {string} userId - The user's ID.
 */
export async function startTranscribeJob({ audioChunkPaths, userId }){
  // start job, in-parallel process all the audiochunks
  
  /**
   * TODO:
   * - write logic to start a job
   * - write job logic to essentially do what I have here and
   * write logic to store in key-value storage, may need to introduce larger function to encapsulate
   * the storage step
  */

  // NOTE: in production we would use a legitimate UUID
  const jobId = globalJobId;
  globalJobId += 1;

  transcribeAndStitch(jobId);

  return jobId;
}

/**
 * For a given job ID, return the transcript result for that job, which describes the transcribed text, statuses,
 * and completion time.
 * 
 * @param {string} jobId - The job ID.
 * @returns {TranscriptResult} - Object describing the transcribed text, statuses of the audio chunk transcriptions, job status, and completion time.
 */
export function getTranscriptResult(jobId) {
  return getDBTranscriptResult(jobId);
}

export function getUserTranscriptResults({ jobStatus, userId }) {
  return getUserJobIds({ userId, jobStatus })
}
