import { Utils } from '@ethersphere/bee-js'
import { Bytes } from './utils'

export type ChunkAddress = Bytes<32>

/**
 * General chunk interface for Swarm
 *
 * It stores the serialized data and provides functions to access
 * the fields of a chunk.
 *
 * It also provides an address function to calculate the address of
 * the chunk that is required for the Chunk API.
 */
export interface Chunk {
  readonly data: Uint8Array
  span(): Bytes<8>
  payload(): Utils.Bytes.FlexBytes<1, 4096>

  address(): ChunkAddress
}
