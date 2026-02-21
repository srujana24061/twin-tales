import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Users, PlusCircle, Clock, LayoutDashboard, LogOut, Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const user = JSON.parse(localStorage.getItem('storycraft_user') || '{}');

  const handleLogout = () => {
    localStorage.removeItem('storycraft_token');
    localStorage.removeItem('storycraft_user');
    navigate('/');
  };

  const links = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/characters', label: 'Characters', icon: Users },
    { path: '/stories/new', label: 'New Story', icon: PlusCircle },
    { path: '/tasks', label: 'Tasks', icon: Clock },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 30 }}
      className="fixed top-0 left-0 right-0 z-50 glass-panel"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link to="/dashboard" className="flex items-center gap-2" data-testid="nav-logo">
            <BookOpen className="w-7 h-7 text-[#6366F1]" />
            <span className="font-heading font-extrabold text-xl tracking-tight text-[#1E293B]">
              Story<span className="text-[#6366F1]">Craft</span>
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {links.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200 ${
                  isActive(path)
                    ? 'bg-[#6366F1] text-white shadow-lg shadow-[#6366F1]/25'
                    : 'text-[#64748B] hover:text-[#1E293B] hover:bg-slate-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            <span className="text-sm text-[#64748B] font-medium">{user.name || 'User'}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-testid="nav-logout-btn"
              className="text-[#64748B] hover:text-red-500 rounded-full"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>

          <button
            className="md:hidden p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            data-testid="nav-mobile-toggle"
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden glass-panel border-t border-white/30"
        >
          <div className="px-4 py-3 space-y-2">
            {links.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                  isActive(path) ? 'bg-[#6366F1] text-white' : 'text-[#64748B]'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-red-500 w-full"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </motion.div>
      )}
    </motion.nav>
  );
};
