/* eslint-disable @typescript-eslint/no-explicit-any */
import { BatchId, Bee, Reference, Signer, Topic, Utils } from '@ethersphere/bee-js'
import type { SingleOwnerChunk } from '@ethersphere/bee-js/dist/src/chunk/soc'
import type { ChunkReference } from '@ethersphere/bee-js/dist/src/feed'
import type { EthAddress, HexEthAddress } from '@ethersphere/bee-js/dist/src/utils/eth'
import { deserialiseJson, MarshalVersion, marshalVersionHash01, serialiseJson, serialiseVersion } from './json'
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

export const FEED_TYPES = ['sequential', 'fault-tolarent-stream'] as const

export type FeedData<Metadata = any> = {
  timestamp: number
  reference: ChunkReference
  metadata?: Metadata
}

export type FeedType = typeof FEED_TYPES[number]

export type FeedIndex<T extends FeedType> = T extends 'sequential'
  ? number
  : T extends 'fault-tolarent-stream'
  ? number
  : never

export type useSwarmFeed<T extends FeedType> = (type: T) => SwarmFeed<T>

export interface FeedChunk<Index = number, Metadata = any> extends SingleOwnerChunk {
  index: Index
  reference: Reference
  timestamp: number
  metadata?: Metadata
}

export interface SwarmFeedHandler {
  readonly type: FeedType
  readonly owner: HexEthAddress
  readonly topic: Topic
}

/** Interface for feed type classes */
export interface SwarmFeed<Index> {
  /** Feed type identifier */
  readonly type: FeedType
  /** initialised BeeJS instance */
  readonly bee: Bee
  /** get Feed interface with read operations */
  makeFeedR(
    topic: Topic | Uint8Array | string,
    owner: EthAddress | Uint8Array | string,
    ...options: any[]
  ): SwarmFeedR<Index>
  /** get Feed interface with write and read operations */
  makeFeedRW(
    topic: Topic | Uint8Array | string,
    signer: Signer | Uint8Array | string,
    options?: any,
  ): SwarmFeedRW<Index>
  /** Get Single Owner Chunk identifier */
  getIdentifier(topic: Bytes<32>, index: Index): Bytes<32>
}

/** Swarm Feed Read operations */
export interface SwarmFeedR<Index = number> extends SwarmFeedHandler {
  getLastIndex(): Promise<Index> | Index
  findLastUpdate(options?: any): Promise<FeedChunk<Index>>
  getUpdate(index: Index): Promise<FeedChunk<Index>>
  getUpdates(indices: Index[]): Promise<FeedChunk<Index>[]>
}

/** Swarm Feed Read and operations */
export interface SwarmFeedRW<Index = number> extends SwarmFeedR {
  setLastUpdate<Metadata = any>(
    postageBatchId: string | BatchId,
    reference: Reference,
    options?: {
      metadata: Metadata
    },
  ): Promise<Reference>
  setUpdate<Metadata = any>(
    index: Index,
    postageBatchId: string | BatchId,
    reference: Reference,
    options?: {
      metadata: Metadata
    },
  ): Promise<Reference>
}

export function extractDataFromSocPayload<Metadata = any>(payload: Uint8Array): FeedData<Metadata> {
  const timestamp = readUint64BigEndian(payload.slice(0, 8) as Bytes<8>)
  const p = payload.slice(8)

  if (p.length === 32 || p.length === 64) {
    return {
      timestamp,
      reference: p as ChunkReference,
    }
  }

  // identify JSON hash after reference
  let jsonData: Uint8Array
  let marshalVersion: MarshalVersion

  // NOTE: later more types of JSON serialisation
  if (Utils.Bytes.bytesEqual(p.slice(32, 36), marshalVersionHash01)) {
    jsonData = p.slice(36)
    marshalVersion = '0.1'
  } else if (Utils.Bytes.bytesEqual(p.slice(64, 68), marshalVersionHash01)) {
    jsonData = p.slice(68)
    marshalVersion = '0.1'
  } else throw Error(`Wrong Feed deserialisation at metadata`)

  // deserialise jsonData
  const metadata = deserialiseJson<Metadata>(jsonData, marshalVersion)

  return {
    timestamp,
    reference: p as ChunkReference,
    metadata,
  }
}

export function mapSocToFeed<Index = number>(socChunk: SingleOwnerChunk, index: Index): FeedChunk<Index> {
  const { reference, timestamp, metadata } = extractDataFromSocPayload(socChunk.payload())

  return {
    ...socChunk,
    index,
    timestamp,
    reference: bytesToHex(reference),
    metadata,
  }
}

/**
 * Assemble Feed payload for Single Owner Chunk byte payload
 *
 * metadata serialisation always happens in the most recent version
 */
export function assembleSocPayload<Metadata = any>(
  reference: ChunkReference,
  options?: { at?: number; metadata: Metadata },
): Uint8Array {
  const at = options?.at ?? Date.now() / 1000.0
  const timestamp = writeUint64BigEndian(at)
  const metadata = serialiseJson(options?.metadata)
  const metadataVersion = metadata.length > 0 ? serialiseVersion('0.1') : new Uint8Array()

  return serializeBytes(timestamp, reference, metadataVersion, metadata)
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
