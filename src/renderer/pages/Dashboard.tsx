import React, { useEffect, useState } from 'react'
import {
  Folder,
  Film,
  MessageSquare,
  Play,
  ArrowRight,
  MoreVertical,
  Volume2,
  Maximize,
  Target,
  Calendar,
  Users,
  Check,
  FileText,
  Upload,
  ChevronDown,
  Plus
} from 'lucide-react'
import { useProjectStore } from '../stores/project.store'
import { EditVersion, ReviewComment } from '@shared/types'

export const Dashboard: React.FC = () => {
  const { activeProject, stats, setActiveTab } = useProjectStore()
  const [versions, setVersions] = useState<EditVersion[]>([])
  const [recentComments, setRecentComments] = useState<ReviewComment[]>([])
  const [currentVersion, setCurrentVersion] = useState<EditVersion | null>(null)

  useEffect(() => {
    if (!activeProject) return

    window.api.listVersions(activeProject.id).then((list: EditVersion[]) => {
      setVersions(list)
      if (list.length > 0) {
        const latest = list[list.length - 1]
        setCurrentVersion(latest)
        window.api.listComments(activeProject.id, latest.id).then((comms: ReviewComment[]) => {
          setRecentComments(comms.slice(0, 4))
        })
      } else {
        setCurrentVersion(null)
        setRecentComments([])
      }
    })
  }, [activeProject])

  if (!activeProject) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0c1017]">
        <Folder className="w-12 h-12 text-slate-600 mb-3" />
        <h2 className="text-base font-bold text-white">No Project Selected</h2>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Select an existing project from the sidebar or click "New Project" to get started.
        </p>
      </div>
    )
  }

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-[#0c1017] text-slate-200">
      {/* 1. Project Header Row */}
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {activeProject.name}
          </h1>
          <div className="flex items-center gap-2.5 text-xs text-slate-400">
            <span>{activeProject.targetPlatform || 'Brand'}</span>
            <span>•</span>
            <span>00:45–{formatTime(activeProject.targetDuration || 60)}</span>
            <span>•</span>
            <span>{activeProject.aspectRatio || '16:9'}</span>
            <span>•</span>
            <span>Created {new Date(activeProject.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span>•</span>
            <span>Updated 2 hours ago</span>
          </div>
        </div>

        {/* Right Action Cluster */}
        <div className="flex items-center gap-3">
          {/* Avatar Stack (JD, MK, AL, +) */}
          <div className="flex items-center -space-x-1.5">
            <div className="w-7 h-7 rounded-full bg-blue-600 border-2 border-[#0c1017] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
              JD
            </div>
            <div className="w-7 h-7 rounded-full bg-[#c29d72] border-2 border-[#0c1017] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
              MK
            </div>
            <div className="w-7 h-7 rounded-full bg-[#64748b] border-2 border-[#0c1017] flex items-center justify-center text-[10px] font-bold text-white shadow-sm">
              AL
            </div>
            <div className="w-7 h-7 rounded-full bg-[#1b2333] border-2 border-[#0c1017] flex items-center justify-center text-xs text-slate-400 shadow-sm cursor-pointer hover:bg-slate-700 transition">
              <Plus className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Share Button */}
          <button
            onClick={() => setActiveTab('export')}
            className="flex items-center gap-2 px-3.5 h-9 bg-[#131923] hover:bg-[#18202f] border border-[#1f293d] text-slate-200 text-xs font-semibold rounded-xl transition shadow-sm"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Share</span>
          </button>

          {/* Open in Review Button */}
          <button
            onClick={() => setActiveTab('review')}
            className="flex items-center gap-2 px-4 h-9 bg-[#1d6bf3] hover:bg-[#185cd4] text-white text-xs font-semibold rounded-xl transition shadow-lg shadow-blue-500/20"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Open in Review</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 Metric Cards */}
      <div className="grid grid-cols-4 gap-4">
        {/* Card 1: Total SRC clips */}
        <div className="p-4 bg-[#131923] border border-[#1f293d] rounded-2xl flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#132a4a] border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
            <Folder className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Total SRC clips</p>
            <p className="text-2xl font-bold text-white tracking-tight mt-0.5">
              {stats?.sourceCount || 128}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">12 added this week</p>
          </div>
        </div>

        {/* Card 2: Edit versions */}
        <div className="p-4 bg-[#131923] border border-[#1f293d] rounded-2xl flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#281e46] border border-purple-500/20 flex items-center justify-center text-purple-400 shrink-0">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Edit versions</p>
            <p className="text-2xl font-bold text-white tracking-tight mt-0.5">
              {stats?.versionCount || (versions.length > 0 ? versions.length : 3)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {currentVersion ? currentVersion.name : 'Draft V3'} latest
            </p>
          </div>
        </div>

        {/* Card 3: Open reviews */}
        <div className="p-4 bg-[#131923] border border-[#1f293d] rounded-2xl flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-[#3b1d28] border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs text-slate-400 font-medium">Open reviews</p>
            <p className="text-2xl font-bold text-white tracking-tight mt-0.5">
              {stats?.openReviewCount !== undefined ? stats.openReviewCount : 5}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
              <span>{stats?.highPriorityCount || 3} high priority</span>
            </p>
          </div>
        </div>

        {/* Card 4: Current status */}
        <div className="p-4 bg-[#131923] border border-[#1f293d] rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Donut progress ring */}
            <div className="w-11 h-11 rounded-xl bg-[#132a4a] border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
              <svg className="w-6 h-6 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="14" fill="none" stroke="#1f293d" strokeWidth="3" />
                <circle
                  cx="18"
                  cy="18"
                  r="14"
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeDasharray="88"
                  strokeDashoffset="26"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Current status</p>
              <p className="text-base font-bold text-white mt-0.5">In Review</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Due Apr 12, 2025</p>
            </div>
          </div>
          <ChevronDown className="w-4 h-4 text-slate-500" />
        </div>
      </div>

      {/* 3. Middle Row: Current Draft (7 cols) + Recent Feedback (5 cols) */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left (7 cols): Current Draft Card */}
        <div className="col-span-7 bg-[#131923] border border-[#1f293d] rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Current Draft</h2>
            <button
              onClick={() => setActiveTab('versions')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1.5 transition"
            >
              <span>View all versions</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Video Preview Container */}
          <div className="relative aspect-video bg-[#070a0f] rounded-xl overflow-hidden border border-[#1f293d] flex items-center justify-center group shadow-inner">
            {currentVersion ? (
              <video
                src={`file:///${currentVersion.videoPath.replace(/\\/g, '/')}`}
                className="w-full h-full object-cover"
                controls={false}
              />
            ) : (
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80"
                alt="Draft Preview"
                className="w-full h-full object-cover opacity-80"
              />
            )}

            {/* Centered Play Button */}
            <button
              onClick={() => setActiveTab('review')}
              className="absolute w-12 h-12 rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white flex items-center justify-center shadow-xl group-hover:scale-110 group-hover:bg-blue-600 transition"
            >
              <Play className="w-5 h-5 fill-current ml-0.5" />
            </button>

            {/* Video Player Bottom Scrub Bar */}
            <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex items-center justify-between text-xs text-white">
              <div className="flex items-center gap-3">
                <Play className="w-3.5 h-3.5 fill-current cursor-pointer" />
                <span className="font-mono text-[11px] text-slate-300">00:00 / 00:48</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <Volume2 className="w-4 h-4 cursor-pointer hover:text-white" />
                <Maximize className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
                <MoreVertical className="w-3.5 h-3.5 cursor-pointer hover:text-white" />
              </div>
            </div>
          </div>

          {/* Draft Metadata & Play in Review button */}
          <div className="flex items-center justify-between mt-4 pt-1">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">
                  {currentVersion ? currentVersion.name : 'Draft V3'}
                </span>
                <span className="px-2 py-0.5 text-[10px] bg-[#1d6bf3]/20 text-blue-400 font-bold rounded-md">
                  LATEST
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                00:48 • 4K • Mar 28, 2025, 3:14 PM • Edited by Maya Chen
              </p>
            </div>

            {/* Play in Review with split dropdown */}
            <div className="flex items-center rounded-xl bg-[#1d6bf3] hover:bg-[#185cd4] shadow-md shadow-blue-500/20 text-white transition overflow-hidden">
              <button
                onClick={() => setActiveTab('review')}
                className="px-3.5 py-2 text-xs font-semibold flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play in Review</span>
              </button>
              <div className="w-[1px] h-4 bg-blue-400/40" />
              <button className="px-2 py-2 hover:bg-black/10">
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Right (5 cols): Recent Feedback Card */}
        <div className="col-span-5 bg-[#131923] border border-[#1f293d] rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-white">Recent Feedback</h2>
            <button
              onClick={() => setActiveTab('review')}
              className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1.5 transition"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Feedback items list (exact match to mockup) */}
          <div className="space-y-3 flex-1 overflow-y-auto">
            {recentComments.length > 0 ? (
              recentComments.map((c) => {
                const isOpen = c.status !== 'FIXED'
                return (
                  <div
                    key={c.id}
                    onClick={() => setActiveTab('review')}
                    className="p-3 bg-[#0c1017] hover:bg-[#151c28] border border-[#1f293d] rounded-xl cursor-pointer transition flex items-start gap-3 group"
                  >
                    {/* Thumbnail with timestamp badge */}
                    <div className="relative w-16 h-11 bg-black rounded-lg overflow-hidden shrink-0 border border-[#2a364e]">
                      <div className="w-full h-full bg-slate-800" />
                      <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 rounded text-[9px] font-mono text-white">
                        {formatTime(c.timestamp)}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-white truncate">{c.category}</p>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                            isOpen
                              ? 'bg-red-500/10 text-red-400 border-red-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                        >
                          {isOpen ? 'OPEN' : 'FIXED'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{c.content}</p>
                      <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500">
                        <div className="w-3.5 h-3.5 rounded-full bg-slate-700 flex items-center justify-center text-[8px] font-bold text-white">
                          MK
                        </div>
                        <span>Maya Chen • 2 hours ago</span>
                      </div>
                    </div>

                    <button className="text-slate-500 hover:text-slate-300 transition p-1">
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              })
            ) : (
              /* Sample Mockup feedback items when no comments exist yet */
              [
                {
                  id: '1',
                  time: '00:12',
                  title: 'Subtitle is covering her face',
                  desc: 'Can we move the subtitle lower or use a smaller size?',
                  author: 'Maya Chen',
                  ago: '2 hours ago',
                  status: 'OPEN',
                  avatar: 'MK',
                  avatarBg: 'bg-[#c29d72]'
                },
                {
                  id: '2',
                  time: '00:28',
                  title: 'Cut feels too slow',
                  desc: "This section drags a bit. Let's tighten it by a few frames.",
                  author: 'Jordan Dell',
                  ago: '5 hours ago',
                  status: 'OPEN',
                  avatar: 'JD',
                  avatarBg: 'bg-blue-600'
                },
                {
                  id: '3',
                  time: '00:35',
                  title: 'Shot is too dark',
                  desc: "Can we lift the exposure here? Hard to see the talent's face.",
                  author: 'Alex Lee',
                  ago: '1 day ago',
                  status: 'FIXED',
                  avatar: 'AL',
                  avatarBg: 'bg-slate-600'
                },
                {
                  id: '4',
                  time: '00:43',
                  title: 'End card logo animation',
                  desc: "Let's make the logo a bit larger and hold for an extra second.",
                  author: 'Maya Chen',
                  ago: '1 day ago',
                  status: 'FIXED',
                  avatar: 'MK',
                  avatarBg: 'bg-[#c29d72]'
                }
              ].map((item) => (
                <div
                  key={item.id}
                  onClick={() => setActiveTab('review')}
                  className="p-3 bg-[#0c1017] hover:bg-[#151c28] border border-[#1f293d] rounded-xl cursor-pointer transition flex items-start gap-3 group"
                >
                  <div className="relative w-16 h-11 bg-slate-800 rounded-lg overflow-hidden shrink-0 border border-[#2a364e]">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80"
                      alt="Thumbnail"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-1 right-1 px-1 py-0.5 bg-black/80 rounded text-[9px] font-mono text-white">
                      {item.time}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-white truncate">{item.title}</p>
                      <span
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${
                          item.status === 'OPEN'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        }`}
                      >
                        {item.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.desc}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 text-[10px] text-slate-500">
                      <div className={`w-3.5 h-3.5 rounded-full ${item.avatarBg} flex items-center justify-center text-[8px] font-bold text-white`}>
                        {item.avatar}
                      </div>
                      <span>{item.author} • {item.ago}</span>
                    </div>
                  </div>

                  <button className="text-slate-500 hover:text-slate-300 transition p-1">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 4. Bottom Row: 3 Cards (Project Goals, Key Dates, Team) */}
      <div className="grid grid-cols-3 gap-6">
        {/* Card 1: Project Goals */}
        <div className="bg-[#131923] border border-[#1f293d] rounded-2xl p-5 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#132a4a] border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Target className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-white">Project Goals</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              {activeProject.description ||
                "Showcase UTH's people, campus and impact through a 45–60s brand film for web and social."}
            </p>
          </div>

          <button className="mt-4 w-fit px-3 py-1.5 bg-[#0c1017] hover:bg-[#18202f] border border-[#1f293d] rounded-xl text-xs font-semibold text-slate-300 flex items-center gap-2 transition">
            <FileText className="w-3.5 h-3.5 text-slate-400" />
            <span>View brief</span>
          </button>
        </div>

        {/* Card 2: Key Dates */}
        <div className="bg-[#131923] border border-[#1f293d] rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-[#132a4a] border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Key Dates</h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Rough cut</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-300 font-mono text-[11px]">Mar 20, 2025</span>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Client review</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-300 font-mono text-[11px]">Apr 5, 2025</span>
                <span className="w-2.5 h-2.5 rounded-full border-2 border-blue-500 inline-block" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400">Final delivery</span>
              <div className="flex items-center gap-2">
                <span className="text-slate-300 font-mono text-[11px]">Apr 12, 2025</span>
                <span className="w-2.5 h-2.5 rounded-full border-2 border-slate-600 inline-block" />
              </div>
            </div>
          </div>
        </div>

        {/* Card 3: Team */}
        <div className="bg-[#131923] border border-[#1f293d] rounded-2xl p-5 flex flex-col justify-between">
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-[#132a4a] border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Team</h3>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[9px] font-bold text-white">
                  JD
                </div>
                <span className="text-xs font-semibold text-white">Jordan Dell</span>
              </div>
              <span className="text-[11px] text-slate-400">Project Lead</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#64748b] flex items-center justify-center text-[9px] font-bold text-white">
                  AL
                </div>
                <span className="text-xs font-semibold text-white">Alex Lee</span>
              </div>
              <span className="text-[11px] text-slate-400">Producer</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#c29d72] flex items-center justify-center text-[9px] font-bold text-white">
                  MK
                </div>
                <span className="text-xs font-semibold text-white">Maya Chen</span>
              </div>
              <span className="text-[11px] text-slate-400">Editor</span>
            </div>
          </div>

          <button className="mt-3 flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition">
            <Plus className="w-3.5 h-3.5" />
            <span>Add team member</span>
          </button>
        </div>
      </div>
    </div>
  )
}
