import { BatchId, Bee, Reference, Signer, Topic, Utils } from '@ethersphere/bee-js'
import type { SingleOwnerChunk } from '@ethersphere/bee-js/dist/src/chunk/soc'
import type { ChunkReference } from '@ethersphere/bee-js/dist/src/feed'
import type { EthAddress } from '@ethersphere/bee-js/dist/src/utils/eth'
import { FeedType, SwarmFeedHandler } from './feed'
import {
  assertBytes,
  Bytes,
  bytesToHex,
  hexToBytes,
  readUint64BigEndian,
  serializeBytes,
  TOPIC_BYTES_LENGTH,
  TOPIC_HEX_LENGTH,
  writeUint64BigEndian,
} from './utils'

export type StreamingFeedData = {
  timestamp: number
  reference: ChunkReference
  updatePeriod: number
}

export interface StreamingFeedChunk<Index = number> extends SingleOwnerChunk {
  index: Index
  reference: Reference
  timestamp: number
  updatePeriod: number
}

/** Interface for feed type classes */
export interface SwarmStreamingFeed<Index> {
  /** Feed type identifier */
  readonly type: FeedType
  /** initialised BeeJS instance */
  readonly bee: Bee
  /** get Feed interface with read operations */
  makeFeedR(
    topic: Topic | Uint8Array | string,
    owner: EthAddress | Uint8Array | string,
    ...options: any[]
  ): SwarmStreamingFeedR<Index>
  /** get Feed interface with write and read operations */
  makeFeedRW(
    topic: Topic | Uint8Array | string,
    signer: Signer | Uint8Array | string,
    options?: any,
  ): SwarmStreamingFeedRW<Index>
  /** Get Single Owner Chunk identifier */
  getIdentifier(topic: Bytes<32>, index: Index): Bytes<32>
}

/** Swarm Feed Read operations */
export interface SwarmStreamingFeedR<Index = number> extends SwarmFeedHandler {
  getIndexForArbitraryTime(lookupTime: number): Promise<Index> | Index
  getLastIndex(): Promise<Index> | Index
  findLastUpdate(options?: any): Promise<StreamingFeedChunk<Index>>
  getUpdate(index: Index): Promise<StreamingFeedChunk<Index>>
  getUpdates(indices: Index[]): Promise<StreamingFeedChunk<Index>[]>
}

/** Swarm Feed Read and operations */
export interface SwarmStreamingFeedRW<Index = number> extends SwarmStreamingFeedR {
  setLastUpdate(
    postageBatchId: string | BatchId,
    reference: Reference,
    // TODO metadata
  ): Promise<Reference>
  setUpdate(
    index: Index,
    postageBatchId: string | BatchId,
    reference: Reference,
    initialTime?: number,
    updatePeriod?: number,
    // TODO metadata
  ): Promise<Reference>
}

export function extractDataFromSocPayload(payload: Uint8Array): StreamingFeedData {
  const updatePeriod = readUint64BigEndian(payload.slice(0, 8) as Bytes<8>)
  const timestamp = readUint64BigEndian(payload.slice(9, 8) as Bytes<8>)
  const p = payload.slice(8)

  if (p.length === 32 || p.length === 64) {
    return {
      timestamp,
      updatePeriod,
      reference: p as ChunkReference,
    }
  }

  // TODO handle JSON-like metadata
  throw new Error('NotImplemented: payload is longer than expected')
}

export function mapSocToFeed<Index = number>(socChunk: SingleOwnerChunk, index: Index): StreamingFeedChunk<Index> {
  const { reference, timestamp, updatePeriod } = extractDataFromSocPayload(socChunk.payload())

  return {
    ...socChunk,
    index,
    timestamp,
    updatePeriod,
    reference: bytesToHex(reference),
  }
}

export function assembleSocPayload(
  reference: ChunkReference,
  options?: { at?: number; updatePeriod?: number }, //TODO metadata
): Uint8Array {
  const at = options?.at ?? Date.now() / 1000.0
  const timestamp = writeUint64BigEndian(at)
  const updatePeriod = writeUint64BigEndian(options?.updatePeriod ?? 0)

  return serializeBytes(updatePeriod, timestamp, reference)
}

/** Converts feedIndex response to integer */
export function fetchIndexToInt(fetchIndex: string): number {
  const indexBytes = hexToBytes(fetchIndex)
  let index = 0
  for (let i = indexBytes.length - 1; i >= 0; i--) {
    const byte = indexBytes[i]

    if (byte === 0) break

    index += byte
  }

  return index
}

export function makeTopic(topic: Uint8Array | string): Topic {
  if (typeof topic === 'string') {
    return Utils.Hex.makeHexString(topic, TOPIC_HEX_LENGTH)
  } else if (topic instanceof Uint8Array) {
    assertBytes<32>(topic, TOPIC_BYTES_LENGTH)

    return bytesToHex(topic, TOPIC_HEX_LENGTH)
  }
  throw new TypeError('invalid topic')
}
