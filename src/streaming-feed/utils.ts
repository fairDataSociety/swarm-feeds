import { BatchId, Reference } from '@ethersphere/bee-js'
import { getCurrentTime } from '../utils'
import { FeedChunk, SwarmFeedR } from '../feed'

/**
 * Calculates nearest index
 * @param initialTime initial time of streaming feed
 * @param updatePeriod streaming feed frequency in milliseconds
 * @param lookupTime lookup time
 * @returns Returns -1 if not found, otherwise the index
 */
export const getIndexForArbitraryTime = (lookupTime: number, initialTime: number, updatePeriod: number): number => {
  const currentTime = getCurrentTime() // Tp

  //  the nearest last index to an arbitrary time (Tx) where T0 <= Tx <= Tn <= Tp
  if (currentTime >= initialTime && lookupTime >= initialTime) {
    return Math.floor((lookupTime - initialTime) / updatePeriod)
  }

  return -1
}

export type FaultTolerantStreamType = 'fault-tolerant-stream'

/** Swarm Feed Read operations */
export interface SwarmStreamingFeedR extends SwarmFeedR {
  getIndexForArbitraryTime(lookupTime: number): number
  getLastIndex(): number
  getUpdate(timeStamp?: number): Promise<FeedChunk>
}

/** Swarm Feed Read and Write operations */
export interface SwarmStreamingFeedRW extends SwarmStreamingFeedR {
  setLastUpdate(postageBatchId: string | BatchId, reference: Reference): Promise<Reference>
  setUpdate(lookupTime: number, postageBatchId: string | BatchId, reference: Reference): Promise<Reference>
}
