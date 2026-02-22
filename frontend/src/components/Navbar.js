import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Users, PlusCircle, Clock, LayoutDashboard, LogOut, Menu, X, Bell, Rss } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { SessionTimer } from '@/components/wellbeing/SessionTimer';

export const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const user = JSON.parse(localStorage.getItem('Twinnee_user') || '{}');

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const token = localStorage.getItem('storycraft_token');
        if (!token) return;
        
        const response = await fetch(process.env.REACT_APP_BACKEND_URL + '/api/notifications', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setNotifications(data || []);
        }
      } catch (err) {
        // Ignore errors
      }
    };
    
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('storycraft_token');
    localStorage.removeItem('storycraft_user');
    navigate('/');
  };

  const links = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/friends', label: 'Friends', icon: Users },
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
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <Brain className="w-6 h-6 text-white" />
            </div>
            <span className="font-heading font-extrabold text-xl tracking-tight" 
              style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
              TWINNEE
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {links.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                data-testid={`nav-${label.toLowerCase().replace(' ', '-')}`}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200"
                style={{
                  background: isActive(path) ? 'hsl(var(--primary))' : 'transparent',
                  color: isActive(path) ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                  boxShadow: isActive(path) ? '0 4px 16px rgba(var(--shadow-color), 0.28)' : 'none',
                }}
                onMouseEnter={e => {
                  if (!isActive(path)) {
                    e.currentTarget.style.color = 'hsl(var(--foreground))';
                    e.currentTarget.style.background = 'hsl(var(--muted))';
                  }
                }}
                onMouseLeave={e => {
                  if (!isActive(path)) {
                    e.currentTarget.style.color = 'hsl(var(--muted-foreground))';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {/* Session Timer */}
            <SessionTimer />
            
            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                data-testid="notification-bell"
                className="relative p-2 rounded-lg transition-colors"
                style={{ 
                  background: showNotifications ? 'var(--primary-light)' : 'transparent',
                  color: 'var(--text-primary)' 
                }}
              >
                <Bell className="w-5 h-5" />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold"
                    style={{ background: '#ef4444', color: 'white' }}>
                    {notifications.length}
                  </span>
                )}
              </button>

              {/* Notification Dropdown */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute right-0 mt-2 w-80 glass-panel rounded-xl shadow-lg overflow-hidden z-50"
                    style={{ border: '1px solid var(--glass-border)' }}
                  >
                    <div className="p-3 border-b" style={{ borderColor: 'var(--glass-border)' }}>
                      <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                          No new notifications
                        </div>
                      ) : (
                        notifications.map(notif => (
                          <div key={notif.id} className="p-3 border-b hover:bg-opacity-50"
                            style={{ borderColor: 'var(--glass-border)' }}>
                            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {notif.title}
                            </p>
                            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                              {notif.message}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Theme Switcher */}
            <ThemeSwitcher />

            <span className="text-sm font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
              {user.name || 'User'}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              data-testid="nav-logout-btn"
              className="rounded-full hover:text-red-500 transition-colors"
              style={{ color: 'hsl(var(--muted-foreground))' }}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <ThemeSwitcher />
            <button
              className="p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
              data-testid="nav-mobile-toggle"
              style={{ color: 'hsl(var(--foreground))' }}
            >
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="md:hidden glass-panel border-t"
          style={{ borderColor: 'var(--glass-border)' }}
        >
          <div className="px-4 py-3 space-y-1">
            {links.map(({ path, label, icon: Icon }) => (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: isActive(path) ? 'hsl(var(--primary))' : 'transparent',
                  color: isActive(path) ? 'hsl(var(--primary-foreground))' : 'hsl(var(--muted-foreground))',
                }}
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
