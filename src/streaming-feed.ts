import { BatchId, Bee, Reference, Signer, Topic, Utils } from '@ethersphere/bee-js'
import { makeTopic } from './feed'
import { getCurrentTime, getIndexForArbitraryTime } from './getIndexForArbitraryTime'
import {
  assembleSocPayload,
  mapSocToFeed,
  StreamingFeedChunk,
  IStreamingFeed,
  SwarmStreamingFeedR,
  SwarmStreamingFeedRW,
  FaultTolerantStreamType,
} from './streaming'
import { ChunkReference, makeSigner, writeUint64BigEndian } from './utils'

const { Hex } = Utils
const { hexToBytes } = Hex

export class StreamingFeed implements IStreamingFeed<number> {
  public constructor(public readonly bee: Bee, public type: FaultTolerantStreamType = 'fault-tolerant-stream') {}

  /**
   * Creates a streaming feed reader
   * @param topic a swarm topic
   * @param owner owner
   * @returns a streaming feed reader
   */
  public makeFeedR(
    topic: Topic | Uint8Array | string,
    owner: Utils.Eth.EthAddress | Uint8Array | string,
  ): SwarmStreamingFeedR {
    const socReader = this.bee.makeSOCReader(owner)
    const topicHex = makeTopic(topic)
    const topicBytes = hexToBytes<32>(topicHex)
    const ownerHex = Utils.Eth.makeHexEthAddress(owner)

    /**
     * Gets the last index in the feed
     * @returns An index number
     */
    const getLastIndex = async (initialTime: number, updatePeriod: number): Promise<number> => {
      const lookupTime = getCurrentTime()

      return getIndexForArbitraryTime(lookupTime, initialTime, updatePeriod)
    }

    /**
     * Gets the last appended chunk in the feed
     * @returns A feed chunk
     */
    const findLastUpdate = async (initialTime: number, updatePeriod: number): Promise<StreamingFeedChunk> => {
      return getUpdate(initialTime, updatePeriod)
    }

    /**
     * Download Feed Chunk at Specific Time
     * @param initialTime initial time of streaming feed
     * @param updatePeriod streaming feed frequency in milliseconds
     * @param lookupTime lookup time
     * @returns a StreamingFeedChunk object
     */
    const getUpdate = async (
      initialTime: number,
      updatePeriod: number,
      lookupTime?: number,
    ): Promise<StreamingFeedChunk> => {
      lookupTime = lookupTime ?? getCurrentTime()
      const index = getIndexForArbitraryTime(lookupTime, initialTime, updatePeriod)
      const socChunk = await socReader.download(this.getIdentifier(topicBytes, index))

      return mapSocToFeed(socChunk)
    }

    /**
     * Download all feed chunks
     * @param initialTime initial time of streaming feed
     * @param updatePeriod streaming feed frequency in milliseconds
     * @returns a StreamingFeedChunk array object
     */
    const getUpdates = async (initialTime: number, updatePeriod: number): Promise<StreamingFeedChunk[]> => {
      const feeds: StreamingFeedChunk[] = []

      try {
        let index = getIndexForArbitraryTime(getCurrentTime(), initialTime, updatePeriod)

        index--

        let lookupTime = getCurrentTime()
        let feed
        while (index > -1) {
          // throws
          const socChunk = await socReader.download(this.getIdentifier(topicBytes, index))
          feed = mapSocToFeed(socChunk)
          lookupTime -= feed.updatePeriod

          feeds.push(feed)
          index = getIndexForArbitraryTime(lookupTime, initialTime, updatePeriod)
          index--
        }

        return feeds
      } catch (e) {
        return feeds
      }
    }

    return {
      type: 'fault-tolerant-stream',
      owner: ownerHex,
      topic: topicHex,
      getIndexForArbitraryTime,
      getUpdate,
      getUpdates,
      findLastUpdate,
      getLastIndex,
    }
  }

  /**
   * Creates a streaming feed reader / writer
   * @param topic a swarm topic
   * @param signer signer
   * @returns a streaming feed reader / writer
   */
  public makeFeedRW(topic: string | Topic | Uint8Array, signer: string | Uint8Array | Signer): SwarmStreamingFeedRW {
    const canonicalSigner = makeSigner(signer)
    const topicHex = makeTopic(topic)
    const topicBytes = hexToBytes<32>(topicHex)
    const feedR = this.makeFeedR(topic, canonicalSigner.address)
    const socWriter = this.bee.makeSOCWriter(canonicalSigner)

    /**
     * Sets the upload chunk to update
     * @param index the chunk index to update
     * @param postageBatchId swarm postage batch id
     * @param reference chunk reference
     * @param initialTime initial time of streaming feed
     * @param updatePeriod streaming feed frequency in milliseconds
     * @param lookupTime lookup time
     * @returns a chunk reference
     */
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

    /**
     * Sets the next upload chunk
     * @param postageBatchId swarm postage batch id
     * @param reference chunk reference
     * @param initialTime initial time of streaming feed
     * @param updatePeriod streaming feed frequency in milliseconds
     * @param lookupTime lookup time
     * @returns a chunk reference
     */
    const setLastUpdate = async (
      postageBatchId: string | BatchId,
      reference: Reference,
      initialTime: number,
      updatePeriod: number,
      lookupTime: number,
    ): Promise<Reference> => {
      lookupTime = lookupTime ?? getCurrentTime()
      const lastIndex = feedR.getIndexForArbitraryTime(lookupTime, initialTime, updatePeriod)

      return setUpdate(lastIndex, postageBatchId, reference, initialTime, updatePeriod)
    }

    return {
      ...feedR,
      setLastUpdate,
      setUpdate,
    }
  }

  /**
   * Get Single Owner Chunk identifier
   * @param topic a swarm topic, bytes 32 length
   * @param index the chunk index
   * @returns a bytes 32
   */
  public getIdentifier(topic: Utils.Bytes.Bytes<32>, index: number): Utils.Bytes.Bytes<32> {
    const indexBytes = writeUint64BigEndian(index)

    return Utils.keccak256Hash(topic, indexBytes)
  }
}
