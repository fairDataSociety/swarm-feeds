import { BatchId, Bee, Reference, Signer, Topic, Utils } from '@ethersphere/bee-js'
import type { SingleOwnerChunk } from '@ethersphere/bee-js/dist/src/chunk/soc'
import { FeedType } from './feed'
import {
  assembleSocPayload,
  makeTopic,
  mapSocToFeed,
  StreamingFeedChunk,
  SwarmStreamingFeed,
  SwarmStreamingFeedR,
  SwarmStreamingFeedRW,
} from './streaming'
import { ChunkReference, makeSigner, writeUint64BigEndian } from './utils'

const { Hex } = Utils
const { hexToBytes } = Hex

export class StreamingFeed implements SwarmStreamingFeed<number> {
  public readonly type: FeedType

  public constructor(public readonly bee: Bee) {
    this.type = 'fault-tolerant-stream'
  }

  public makeFeedR(
    topic: Topic | Uint8Array | string,
    owner: Utils.Eth.EthAddress | Uint8Array | string,
  ): SwarmStreamingFeedR<number> {
    const socReader = this.bee.makeSOCReader(owner)
    const topicHex = makeTopic(topic)
    const topicBytes = hexToBytes<32>(topicHex)
    const ownerHex = Utils.Eth.makeHexEthAddress(owner)
    const feedR = this.makeFeedR(topic, owner)

    const getIndexForArbitraryTime = async (lookupTime: number): Promise<number> => {
      const currentTime = new Date().getTime() // Tp
      const lastUpdateChunk = await feedR.findLastUpdate()
      const lastUpdateTime = lastUpdateChunk.timestamp // Tn
      const initialChunk = await feedR.getUpdate(0)
      const initialTime = initialChunk.timestamp //  T0
      const updatePeriod = initialChunk.updatePeriod

      //  the nearest last index to an arbitrary time (Tx) where T0 <= Tx <= Tn <= Tp
      if (currentTime >= lastUpdateTime && initialTime <= lookupTime && lookupTime <= lastUpdateTime) {
        return Math.floor((lookupTime - initialTime) / updatePeriod)
      }

      return -1
    }

    // TODO: Download Feed Chunk at Specific Time
    const getUpdate = async (index: number): Promise<StreamingFeedChunk> => {
      const socChunk = await socReader.download(this.getIdentifier(topicBytes, index))

      return mapSocToFeed(socChunk, index)
    }

    //  TODO: Download Feed Stream

    const getUpdates = async (indices: number[]): Promise<StreamingFeedChunk[]> => {
      const promises: Promise<SingleOwnerChunk>[] = []
      for (const index of indices) {
        promises.push(socReader.download(this.getIdentifier(topic as Utils.Bytes.Bytes<32>, index)))
      }
      const socs = await Promise.all(promises)
      const feeds: StreamingFeedChunk[] = socs.map((soc, orderIndex) => {
        return mapSocToFeed(soc, indices[orderIndex])
      })

      return feeds
    }

    return {
      ...feedR,
      type: 'fault-tolerant-stream',
      owner: ownerHex,
      topic: topicHex,
      getIndexForArbitraryTime,
    }
  }

  public makeFeedRW(
    topic: string | Topic | Uint8Array,
    signer: string | Uint8Array | Signer,
  ): SwarmStreamingFeedRW<number> {
    const canonicalSigner = makeSigner(signer)
    const topicHex = makeTopic(topic)
    const topicBytes = hexToBytes<32>(topicHex)
    const feedR = this.makeFeedR(topic, canonicalSigner.address)
    const socWriter = this.bee.makeSOCWriter(canonicalSigner)

    const setUpdate = async (
      index: number,
      postageBatchId: string | BatchId,
      reference: Reference,
      initialTime: number,
      updatePeriod: number,
    ): Promise<Reference> => {
      const identifier = this.getIdentifier(topicBytes, index)

      return socWriter.upload(
        postageBatchId,
        identifier,
        assembleSocPayload(hexToBytes(reference) as ChunkReference, {
          at: initialTime,
          updatePeriod,
          index,
        }),
      )
    }

    const setLastUpdate = async (
      postageBatchId: string | BatchId,
      reference: Reference,
      initialTime: number,
      updatePeriod: number,
    ): Promise<Reference> => {
      let index: number
      try {
        const lastIndex = await feedR.getIndexForArbitraryTime(initialTime)
        index = lastIndex + 1
      } catch (e) {
        index = 0
      }

      return setUpdate(index, postageBatchId, reference, initialTime, updatePeriod)
    }

    const create = async (
      postageBatchId: string | BatchId,
      reference: Reference,
      initialTime: number,
      updatePeriod: number,
    ): Promise<Reference> => {
      const index = 0

      return setUpdate(index, postageBatchId, reference, initialTime, updatePeriod)
    }

    return {
      ...feedR,
      create,
      setUpdate,
      setLastUpdate,
    }
  }

  /** Get Single Owner Chunk identifier */
  public getIdentifier(topic: Utils.Bytes.Bytes<32>, index: number): Utils.Bytes.Bytes<32> {
    const indexBytes = writeUint64BigEndian(index)

    return Utils.keccak256Hash(topic, indexBytes)
  }
}
