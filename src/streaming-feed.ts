import { BatchId, Bee, Reference, Signer, Topic, Utils } from '@ethersphere/bee-js'
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
const getCurrentTimeInSeconds = () => new Date().getTime() / 1000
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

    const getIndexForArbitraryTime = async (
      lookupTime: number,
      initialTime?: number,
      updatePeriod?: number,
    ): Promise<number> => {
      const currentTime = getCurrentTimeInSeconds() // Tp
      const socChunk = await socReader.download(this.getIdentifier(topicBytes, 0))
      const initialChunk = mapSocToFeed(socChunk)
      initialTime = initialTime ?? initialChunk.timestamp
      updatePeriod = updatePeriod ?? initialChunk.updatePeriod
      const i = Math.floor((lookupTime - initialTime) / updatePeriod)

      //  the nearest last index to an arbitrary time (Tx) where T0 <= Tx <= Tn <= Tp
      if (currentTime >= i && initialTime <= lookupTime && lookupTime <= i) {
        return i
      }

      return -1
    }

    // Download Feed Chunk at Specific Time
    const getUpdate = async (lookupTime?: number): Promise<StreamingFeedChunk | null> => {
      lookupTime = lookupTime ?? getCurrentTimeInSeconds()
      const index = await getIndexForArbitraryTime(lookupTime)

      if (index === -1) return null

      const socChunk = await socReader.download(this.getIdentifier(topicBytes, index))

      return mapSocToFeed(socChunk)
    }

    //  Download Feed Stream
    const getUpdates = async (): Promise<StreamingFeedChunk[]> => {
      const feeds: StreamingFeedChunk[] = []
      // while from last to first, use lookupTime = chunk.timestamp + 1
      let socChunk = await getUpdate()
      while (socChunk) {
        feeds.push(socChunk)
        socChunk = await getUpdate(socChunk.timestamp)
      }

      return feeds
    }

    return {
      type: 'fault-tolerant-stream',
      owner: ownerHex,
      topic: topicHex,
      getIndexForArbitraryTime,
      getUpdate,
      getUpdates,
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

    const _setUpdate = async (
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

    const setLastUpdate = async (postageBatchId: string | BatchId, reference: Reference): Promise<Reference> => {
      const initialTime = getCurrentTimeInSeconds()
      const lastIndex = await feedR.getIndexForArbitraryTime(initialTime)
      const initialChunk = await feedR.getUpdate()

      if (!initialChunk) throw new Error('Feed has not been initialized, use `create`')

      const updatePeriod = initialChunk?.updatePeriod

      return _setUpdate(lastIndex, postageBatchId, reference, initialTime, updatePeriod)
    }

    const create = async (
      postageBatchId: string | BatchId,
      reference: Reference,
      initialTime: number,
      updatePeriod: number,
    ): Promise<Reference> => {
      const index = 0

      return _setUpdate(index, postageBatchId, reference, initialTime, updatePeriod)
    }

    return {
      ...feedR,
      create,
      setLastUpdate,
    }
  }

  /** Get Single Owner Chunk identifier */
  public getIdentifier(topic: Utils.Bytes.Bytes<32>, index: number): Utils.Bytes.Bytes<32> {
    const indexBytes = writeUint64BigEndian(index)

    return Utils.keccak256Hash(topic, indexBytes)
  }
}
