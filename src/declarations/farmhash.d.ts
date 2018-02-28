declare module 'farmhash' {
  import * as hash from 'farmhash'

  const farmhash: {
    hash32: (input: string | Buffer) => number
  }
  export default farmhash
}
