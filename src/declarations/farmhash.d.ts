declare module 'farmhash' {
  import * as hash from 'farmhash'

  const farmhash: {
    hash32: (input: string | Buffer | Uint8Array) => number
  }
  export default farmhash
}
