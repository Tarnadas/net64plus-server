declare module 'jest-mock-axios' {
  import * as jestMockAxios from 'jest-mock-axios'
  import axios from 'axios'

  const mockAxios: {
    reset: () => void
    mockResponse: (response?: any) => void
    mockError: (error?: any) => void
    get: typeof axios.get
    post: typeof axios.post
  }

  export default mockAxios
}
