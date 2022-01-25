import { Bytes, isBytes, makeBytes } from "@ethersphere/bee-js/dist/src/utils/bytes"
import { assertHexString, HexString } from "@ethersphere/bee-js/dist/src/utils/hex"

export const TOPIC_BYTES_LENGTH = 32
export const TOPIC_HEX_LENGTH = 64

export function writeUint64BigEndian(value: number, bytes: Bytes<8> = makeBytes(8)): Bytes<8> {
  const dataView = new DataView(bytes.buffer)
  const valueLower32 = value & 0xffffffff

  dataView.setUint32(0, 0)
  dataView.setUint32(4, valueLower32)

  return bytes
}

export function readUint64BigEndian(bytes: Bytes<8>): number {
  const dataView = new DataView(bytes.buffer)

  return dataView.getUint32(4)
}

/**
 * Converts a hex string to Uint8Array
 *
 * @param hex string input without 0x prefix!
 */
 export function hexToBytes<Length extends number, LengthHex extends number = number>(
  hex: HexString<LengthHex>,
): Bytes<Length> {
  assertHexString(hex)

  const bytes = makeBytes(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    const hexByte = hex.substr(i * 2, 2)
    bytes[i] = parseInt(hexByte, 16)
  }

  return bytes as Bytes<Length>
}

/**
 * Converts array of number or Uint8Array to HexString without prefix.
 *
 * @param bytes   The input array
 * @param len     The length of the non prefixed HexString
 */
 export function bytesToHex<Length extends number = number>(bytes: Uint8Array, len?: Length): HexString<Length> {
  const hexByte = (n: number) => n.toString(16).padStart(2, '0')
  const hex = Array.from(bytes, hexByte).join('') as HexString<Length>

  // TODO: Make Length mandatory: https://github.com/ethersphere/bee-js/issues/208
  if (len && hex.length !== len) {
    throw new TypeError(`Resulting HexString does not have expected length ${len}: ${hex}`)
  }

  return hex
}

/**
 * Verifies if a byte array has a certain length
 *
 * @param b       The byte array
 * @param length  The specified length
 */
 export function assertBytes<Length extends number>(b: unknown, length: Length): asserts b is Bytes<Length> {
  if (!isBytes(b, length)) {
    throw new TypeError(`Parameter is not valid Bytes of length: ${length} !== ${(b as Uint8Array).length}`)
  }
}

/**
 * Helper function for serialize byte arrays
 *
 * @param arrays Any number of byte array arguments
 */
 export function serializeBytes(...arrays: Uint8Array[]): Uint8Array {
  const length = arrays.reduce((prev, curr) => prev + curr.length, 0)
  const buffer = new Uint8Array(length)
  let offset = 0
  arrays.forEach(arr => {
    buffer.set(arr, offset)
    offset += arr.length
  })

  return buffer
}
