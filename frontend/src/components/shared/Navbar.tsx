import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Bell, LogOut, User, Activity, Package, ClipboardList,
  UploadCloud, LayoutDashboard, ShieldCheck, ChevronDown
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { notificationAPI } from '../../services/api';
import { useSocket } from '../../context/SocketContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const socket = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      notificationAPI.getAll().then(r => setUnread(r.data.unreadCount)).catch(() => {});
    }
  }, [user, location.pathname]);

  useEffect(() => {
    if (!socket) return;
    const onNotif = () => setUnread(p => p + 1);
    socket.on('new_quotation', onNotif);
    socket.on('prescription_processed', onNotif);
    socket.on('quotation_accepted', onNotif);
    socket.on('order_status_updated', onNotif);
    return () => {
      socket.off('new_quotation', onNotif);
      socket.off('prescription_processed', onNotif);
      socket.off('quotation_accepted', onNotif);
      socket.off('order_status_updated', onNotif);
    };
  }, [socket]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => { logout(); navigate('/login'); };

  const navLinks = {
    patient: [
      { to: '/patient', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/patient/upload', label: 'Upload', icon: UploadCloud },
      { to: '/patient/prescriptions', label: 'Prescriptions', icon: ClipboardList },
    ],
    pharmacy: [
      { to: '/pharmacy', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/pharmacy/requests', label: 'Requests', icon: ClipboardList },
      { to: '/pharmacy/inventory', label: 'Inventory', icon: Package },
    ],
    admin: [
      { to: '/admin', label: 'Dashboard', icon: ShieldCheck },
    ],
  };

  const links = user ? navLinks[user.role as keyof typeof navLinks] || [] : [];

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path + '/'));

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center h-14 gap-6">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <div className="w-7 h-7 bg-primary-600 rounded-lg flex items-center justify-center">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg text-primary-700">MediLink</span>
          </Link>

          {/* Nav links */}
          <div className="hidden sm:flex items-center gap-1 flex-1">
            {links.map(link => (
              <Link key={link.to} to={link.to}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isActive(link.to) ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'}`}>
                <link.icon className="w-4 h-4" />{link.label}
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 ml-auto">
            <Link to="/notifications"
              className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
              onClick={() => setUnread(0)}>
              <Bell className="w-5 h-5 text-gray-600" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>

            <div className="relative" ref={menuRef}>
              <button onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 pl-2 pr-1 py-1 hover:bg-gray-100 rounded-lg transition-colors">
                <div className="w-7 h-7 bg-primary-100 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-primary-600" />
                </div>
                <span className="hidden sm:block text-sm font-medium text-gray-700 max-w-[100px] truncate">
                  {user?.name?.split(' ')[0]}
                </span>
                <ChevronDown className={`w-3 h-3 text-gray-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-1.5 w-52 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 z-50">
                  <div className="px-4 py-2.5 border-b border-gray-100">
                    <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
                  </div>
                  {links.map(link => (
                    <Link key={link.to} to={link.to} onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 sm:hidden">
                      <link.icon className="w-4 h-4 text-gray-400" />{link.label}
                    </Link>
                  ))}
                  <button onClick={handleLogout}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full transition-colors">
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
