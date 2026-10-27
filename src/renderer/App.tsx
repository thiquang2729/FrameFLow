import React from 'react'

export default function App(): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background text-white">
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold tracking-tight text-blue-500">FrameFlow</h1>
        <p className="text-slate-400 text-sm">
          AI-assisted post-production video review workspace
        </p>
      </div>
    </div>
  )
}
