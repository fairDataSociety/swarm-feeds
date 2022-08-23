import { BatchId, Bee, Reference, Signer, Topic } from '@ethersphere/bee-js'
import type { SingleOwnerChunk } from '@ethersphere/bee-js/dist/src/chunk/soc'
import type { ChunkReference } from '@ethersphere/bee-js/dist/src/feed'
import type { EthAddress } from '@ethersphere/bee-js/dist/src/utils/eth'
import { SwarmFeedHandler } from './feed'
import { Bytes, readUint64BigEndian, serializeBytes, writeUint64BigEndian } from './utils'

export interface StreamingFeedChunk extends SingleOwnerChunk {
  index: number
  reference: ChunkReference
  timestamp: number
  updatePeriod: number
}

export type FaultTolerantStreamType = 'fault-tolerant-stream'

/** Interface for feed type classes */
export interface IStreamingFeed<Index> {
  /** Feed type identifier */
  readonly type: FaultTolerantStreamType
  /** initialised BeeJS instance */
  readonly bee: Bee
  /** get Feed interface with read operations */
  makeFeedR(
    topic: Topic | Uint8Array | string,
    owner: EthAddress | Uint8Array | string,
    ...options: any[]
  ): SwarmStreamingFeedR
  /** get Feed interface with write and read operations */
  makeFeedRW(
    topic: Topic | Uint8Array | string,
    signer: Signer | Uint8Array | string,
    options?: any,
  ): SwarmStreamingFeedRW
  /** Get Single Owner Chunk identifier */
  getIdentifier(topic: Bytes<32>, index: Index): Bytes<32>
}

/** Swarm Feed Read operations */
export interface SwarmStreamingFeedR extends SwarmFeedHandler {
  getIndexForArbitraryTime(lookupTime: number, initialTime?: number, updatePeriod?: number): number
  getUpdate(initialTime: number, updatePeriod: number, lookupTime?: number): Promise<StreamingFeedChunk>
  getUpdates(initialTime: number, updatePeriod: number): Promise<StreamingFeedChunk[]>
  findLastUpdate(initialTime: number, updatePeriod: number): Promise<StreamingFeedChunk>
  getLastIndex(initialTime: number, updatePeriod: number): Promise<number>
}

/** Swarm Feed Read and Write operations */
export interface SwarmStreamingFeedRW extends SwarmStreamingFeedR {
  setLastUpdate(
    postageBatchId: string | BatchId,
    reference: Reference,
    initialTime: number,
    updatePeriod: number,
    lookupTime?: number,
  ): Promise<Reference>
  setUpdate(
    index: number,
    postageBatchId: string | BatchId,
    reference: Reference,
    initialTime: number,
    updatePeriod: number,
    lookupTime?: number,
  ): Promise<Reference>
}

export function extractDataFromSocPayload(payload: Uint8Array): StreamingFeedChunk {
  const index = readUint64BigEndian(payload.slice(0, 8) as Bytes<8>)
  const updatePeriod = readUint64BigEndian(payload.slice(8, 16) as Bytes<8>)
  const timestamp = readUint64BigEndian(payload.slice(16, 24) as Bytes<8>)
  const p = payload.slice(24) // 32 bytes

  if (p.length === 32 || p.length === 64) {
    return {
      timestamp,
      updatePeriod,
      index,
      reference: p as ChunkReference,
    } as any
  }

  // TODO handle JSON-like metadata
  throw new Error('NotImplemented: payload is longer than expected')
}

export function mapSocToFeed<Index = number>(socChunk: SingleOwnerChunk): StreamingFeedChunk {
  const { reference, timestamp, updatePeriod, index } = extractDataFromSocPayload(socChunk.payload())

  return {
    ...socChunk,
    index,
    timestamp,
    updatePeriod,
    reference: reference,
  }
}

export function assembleSocPayload(
  reference: ChunkReference,
  options: { at: number; updatePeriod: number; index: number },
): Uint8Array {
  const at = options.at ?? Date.now() / 1000.0
  const timestamp = writeUint64BigEndian(at)
  const updatePeriod = writeUint64BigEndian(options.updatePeriod)
  const chunkIndex = writeUint64BigEndian(options.index)

  return serializeBytes(chunkIndex, updatePeriod, timestamp, reference)
}
