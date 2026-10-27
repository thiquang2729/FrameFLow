import React, { useEffect, useState } from 'react'
import { Sidebar } from './components/layout/Sidebar'
import { TopBar } from './components/layout/TopBar'
import { CreateProjectModal } from './components/project/CreateProjectModal'
import { Dashboard } from './pages/Dashboard'
import { SourceLibrary } from './pages/SourceLibrary'
import { VersionList } from './pages/VersionList'
import { ReviewWorkspace } from './pages/ReviewWorkspace'
import { ExportPackage } from './pages/ExportPackage'
import { useProjectStore } from './stores/project.store'

export default function App(): React.JSX.Element {
  const { activeTab, fetchProjects } = useProjectStore()
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [])

  return (
    <div className="flex h-screen w-screen bg-[#f8fafc] text-slate-900 overflow-hidden font-sans">
      {/* 1. Left Sidebar Navigation */}
      <Sidebar onOpenCreateProject={() => setIsCreateModalOpen(true)} />

      {/* 2. Main Workspace Layout */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <TopBar />

        <main className="flex-1 flex overflow-hidden">
          {activeTab === 'overview' && <Dashboard />}
          {activeTab === 'src' && <SourceLibrary />}
          {activeTab === 'versions' && <VersionList />}
          {activeTab === 'review' && <ReviewWorkspace />}
          {activeTab === 'export' && <ExportPackage />}
        </main>
      </div>

      {/* Modal Create Project */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  )
}
