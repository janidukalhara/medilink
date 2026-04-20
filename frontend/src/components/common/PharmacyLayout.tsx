import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import {
  Pill, LayoutDashboard, ClipboardList, FileSearch,
  MessageSquare, User, LogOut, Bell, Menu, X
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import api from '@/utils/api'
import toast from 'react-hot-toast'

const pharmacyNav = [
  { to: '/pharmacy/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pharmacy/requests', icon: ClipboardList, label: 'Requests' },
  { to: '/pharmacy/quotations', icon: FileSearch, label: 'My Quotations' },
  { to: '/pharmacy/chat', icon: MessageSquare, label: 'Chat' },
  { to: '/pharmacy/profile', icon: User, label: 'Profile' },
]

const adminNav = [
  { to: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/pharmacies', icon: ClipboardList, label: 'Pharmacies' },
  { to: '/admin/users', icon: User, label: 'Users' },
]

function AppLayout({ navItems, accentColor = 'bg-primary-600' }: { navItems: any[], accentColor?: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = async () => {
    logout()
    navigate('/login')
    toast.success('Logged out')
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-100 flex flex-col
        transform transition-transform duration-200 lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 ${accentColor} rounded-lg flex items-center justify-center`}>
              <Pill className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-800">MediLink</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-slate-600" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate">{user?.name}</p>
              <p className="text-xs text-slate-400 capitalize">
                {user?.role === 'pharmacy'
                  ? user?.pharmacyProfile?.pharmacyName || 'Pharmacy'
                  : user?.role}
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-100">
          <button onClick={handleLogout} className="sidebar-link w-full text-red-500 hover:bg-red-50 hover:text-red-600">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-100 flex items-center justify-between px-6 shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-slate-500">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3 ml-auto">
            <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
              <Bell className="w-5 h-5" />
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export function PharmacyLayout() {
  return <AppLayout navItems={pharmacyNav} accentColor="bg-emerald-600" />
}

export function AdminLayout() {
  return <AppLayout navItems={adminNav} accentColor="bg-rose-600" />
}

export default PharmacyLayout
