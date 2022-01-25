import { Data, Signer, Utils } from '@ethersphere/bee-js'
import { curve, ec } from 'elliptic'

export const TOPIC_BYTES_LENGTH = 32
export const TOPIC_HEX_LENGTH = 64
export const UNCOMPRESSED_RECOVERY_ID = 27

type PlainChunkReference = Bytes<32>
type EncryptedChunkReference = Bytes<64>

export type Bytes<Length extends number = number> = Utils.Bytes.Bytes<Length>
export type HexString<Length extends number = number> = Utils.Hex.HexString<Length>
export type EllipticPublicKey = curve.base.BasePoint
export type EthAddress = Utils.Eth.EthAddress
export type Signature = Bytes<65>
export type ChunkReference = PlainChunkReference | EncryptedChunkReference

export function writeUint64BigEndian(value: number, bytes: Bytes<8> = Utils.Bytes.makeBytes(8)): Bytes<8> {
  const dataView = new DataView(bytes.buffer)
  const valueLower32 = value & 0xffffffff

  dataView.setUint32(0, 0)
  dataView.setUint32(4, valueLower32)

  return bytes
}

function publicKeyToAddress(pubKey: EllipticPublicKey): EthAddress {
  const pubBytes = pubKey.encode('array', false)

  return Utils.keccak256Hash(pubBytes.slice(1)).slice(12) as EthAddress
}

function hashWithEthereumPrefix(data: Uint8Array): Bytes<32> {
  const ethereumSignedMessagePrefix = `\x19Ethereum Signed Message:\n${data.length}`
  const prefixBytes = new TextEncoder().encode(ethereumSignedMessagePrefix)

  return Utils.keccak256Hash(prefixBytes, data)
}

/**
 * The default signer function that can be used for integrating with
 * other applications (e.g. wallets).
 *
 * @param data      The data to be signed
 * @param privateKey  The private key used for signing the data
 */
 export function defaultSign(data: Uint8Array, privateKey: Bytes<32>): Signature {
  const curve = new ec('secp256k1')
  const keyPair = curve.keyFromPrivate(privateKey)

  const hashedDigest = hashWithEthereumPrefix(data)
  const sigRaw = curve.sign(hashedDigest, keyPair, { canonical: true, pers: undefined })

  if (sigRaw.recoveryParam === null) {
    throw new Error('signDigest recovery param was null')
  }
  const signature = new Uint8Array([
    ...sigRaw.r.toArray('be', 32),
    ...sigRaw.s.toArray('be', 32),
    sigRaw.recoveryParam + UNCOMPRESSED_RECOVERY_ID,
  ])

  return signature as Signature
}

/**
 * Creates a singer object that can be used when the private key is known.
 *
 * @param privateKey The private key
 */
 export function makePrivateKeySigner(privateKey: Bytes<32>): Signer {
  const curve = new ec('secp256k1')
  const keyPair = curve.keyFromPrivate(privateKey)
  const address = publicKeyToAddress(keyPair.getPublic())

  return {
    sign: (digest: Data) => defaultSign(digest, privateKey),
    address,
  }
}

export function readUint64BigEndian(bytes: Bytes<8>): number {
  const dataView = new DataView(bytes.buffer)

  return dataView.getUint32(4)
}

/**
 * Converts a hex string to Uint8Array
 * 
 * wrapper
 *
 * @param hex string input without 0x prefix!
 */
 export function hexToBytes<Length extends number, LengthHex extends number = number>(
  hex: Utils.Hex.HexString<LengthHex>,
): Utils.Bytes.Bytes<Length> {
  return Utils.Hex.hexToBytes<Length>(hex)
}

/**
 * Converts array of number or Uint8Array to HexString without prefix.
 *
 * wrapper
 * 
 * @param bytes   The input array
 * @param len     The length of the non prefixed HexString
 */
 export function bytesToHex<Length extends number = number>(bytes: Uint8Array, len?: Length): Utils.Hex.HexString<Length> {
  return Utils.Hex.bytesToHex<Length>(bytes, len)
}

/**
 * Verifies if a byte array has a certain length
 *
 * wrapper
 * 
 * @param b       The byte array
 * @param length  The specified length
 */
 export function assertBytes<Length extends number>(b: unknown, length: Length): asserts b is Bytes<Length> {
  return Utils.Bytes.assertBytes<Length>(b, length)
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
