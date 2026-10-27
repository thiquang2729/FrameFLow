import { FrameFlowAPI } from './index'

declare global {
  interface Window {
    api: FrameFlowAPI
  }
}
