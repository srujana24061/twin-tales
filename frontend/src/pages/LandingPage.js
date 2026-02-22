import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  BookOpen, Sparkles, Shield, Palette, FileText, ArrowRight, Star, 
  MessageCircle, Brain, Heart, TrendingUp, Target, Smile, Activity,
  Users, CheckCircle, Play, Lock, BarChart2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, type: 'spring', stiffness: 200, damping: 25 } }),
};

const FloatingBlob = ({ className, style, delay = 0 }) => (
  <motion.div
    className={`absolute rounded-full opacity-30 blur-3xl ${className}`}
    style={style}
    animate={{ y: [0, -25, 0], scale: [1, 1.05, 1] }}
    transition={{ duration: 6 + delay, repeat: Infinity, ease: 'easeInOut' }}
  />
);

export const LandingPage = () => {
  const navigate = useNavigate();
  const token = localStorage.getItem('storycraft_token');

  return (
    <div className="min-h-screen theme-page-bg relative overflow-hidden">
      <FloatingBlob className="w-96 h-96 top-10 -left-48" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }} delay={0} />
      <FloatingBlob className="w-80 h-80 top-60 right-0" style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }} delay={2} />
      <FloatingBlob className="w-72 h-72 bottom-20 left-1/3" style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }} delay={4} />

      {/* Navbar */}
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 30 }}
        className="fixed top-0 left-0 right-0 z-50 glass-panel"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2" data-testid="landing-logo">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <Brain className="w-5 h-5 text-white" />
            </div>
            <span className="font-heading font-extrabold text-xl tracking-tight">
              TWINNEE
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeSwitcher />
            {token ? (
              <Button
                onClick={() => navigate('/dashboard')}
                data-testid="landing-dashboard-btn"
                className="rounded-full font-accent px-6 shadow-lg hover:scale-105 transition-all"
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/login')}
                  data-testid="landing-login-btn"
                  className="rounded-full font-medium"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Sign In
                </Button>
                <Button
                  onClick={() => navigate('/register')}
                  data-testid="landing-register-btn"
                  className="rounded-full font-accent px-6 shadow-lg hover:scale-105 transition-all"
                  style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}
                >
                  Get Started
                </Button>
              </>
            )}
          </div>
        </div>
      </motion.header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-44 md:pb-32 relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            <motion.div initial="hidden" animate="visible">
              <motion.div custom={0} variants={fadeUp} 
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium mb-6"
                style={{ background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)', color: '#667eea' }}>
                <Star className="w-4 h-4" />
                Meet TWINNEE — Your Child's Smart Companion
              </motion.div>
              
              <motion.h1 custom={1} variants={fadeUp} 
                className="font-heading font-extrabold text-4xl sm:text-5xl lg:text-7xl tracking-tight leading-[1.1] mb-6">
                TWINNEE
                <br />
                <span style={{ 
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  DIGITAL TWIN
                </span>
                <br />
                of your kids
              </motion.h1>
              
              <motion.p custom={2} variants={fadeUp} 
                className="text-lg md:text-xl leading-relaxed mb-8 max-w-3xl mx-auto"
                style={{ color: 'var(--text-secondary)' }}>
                A friendly AI-powered digital twin that learns, grows, and interacts with your child—helping them build better habits, think creatively, and stay emotionally balanced.
              </motion.p>

              <motion.div custom={3} variants={fadeUp} className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  <CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} />
                  Not just an app
                </div>
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  <CheckCircle className="w-5 h-5" style={{ color: '#F59E0B' }} />
                  A companion
                </div>
                <div className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  <CheckCircle className="w-5 h-5" style={{ color: '#667eea' }} />
                  A digital reflection
                </div>
              </motion.div>

              <motion.div custom={4} variants={fadeUp} className="flex flex-wrap gap-4 justify-center">
                <Button
                  size="lg"
                  onClick={() => navigate('/register')}
                  className="rounded-full font-accent px-8 py-6 text-lg shadow-2xl hover:scale-105 transition-all"
                  style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}
                  data-testid="hero-get-started-btn"
                >
                  Get Started Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate('/login')}
                  className="rounded-full font-accent px-8 py-6 text-lg hover:scale-105 transition-all"
                  style={{ borderColor: '#667eea', color: '#667eea' }}
                >
                  <Play className="w-5 h-5 mr-2" />
                  Watch Demo
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What is TWINNEE */}
      <section className="py-20 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl lg:text-5xl mb-4">
              💬 What is <span style={{ color: '#667eea' }}>TWINNEE</span>?
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              TWINNEE is an intelligent AI companion that talks like a friend, thinks like a guide, and grows with your child.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: MessageCircle, title: 'Talks like a friend', emoji: '🤝', color: '#667eea' },
              { icon: Brain, title: 'Thinks like a guide', emoji: '🧠', color: '#F59E0B' },
              { icon: BarChart2, title: 'Tracks like a smart assistant', emoji: '📊', color: '#10B981' },
              { icon: TrendingUp, title: 'Grows like your child', emoji: '🌱', color: '#EC4899' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-panel rounded-3xl p-6 hover:scale-105 transition-all cursor-pointer"
                style={{ border: `2px solid ${item.color}20` }}
              >
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
                  style={{ background: `${item.color}20` }}>
                  <item.icon className="w-6 h-6" style={{ color: item.color }} />
                </div>
                <div className="text-3xl mb-2">{item.emoji}</div>
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </h3>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12 text-base max-w-3xl mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            It works through interactive storytelling, conversations, and subtle guidance to help children develop better habits—<strong>without pressure</strong>.
          </motion.p>
        </div>
      </section>

      {/* A Friend, Not Just a Bot */}
      <section className="py-20 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <h2 className="font-heading font-extrabold text-3xl sm:text-4xl mb-6">
                🧒 A Friend, <span style={{ color: '#667eea' }}>Not Just a Bot</span>
              </h2>
              <p className="text-lg mb-6" style={{ color: 'var(--text-secondary)' }}>
                TWINNEE greets your child with a simple:
              </p>
              <div className="glass-panel rounded-3xl p-6 mb-6" style={{ background: 'linear-gradient(135deg, #667eea10 0%, #764ba210 100%)' }}>
                <p className="text-xl font-medium italic" style={{ color: '#667eea' }}>
                  "Hey! What was the best part of your day?"
                </p>
              </div>
              <p className="text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                It chats, listens, remembers, and adapts—becoming a <strong>trusted digital companion</strong> your child actually enjoys talking to.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="glass-panel rounded-3xl p-8"
            >
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 rounded-2xl rounded-tl-sm p-4"
                    style={{ background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      Hey there! 👋 I'm TWINNEE! Want to create a fun story together or chat about your day?
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 justify-end">
                  <div className="flex-1 max-w-[80%] rounded-2xl rounded-tr-sm p-4"
                    style={{ background: 'var(--bg-tertiary)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      I want to make a story about a dragon!
                    </p>
                  </div>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'var(--bg-tertiary)' }}>
                    <Smile className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                    <Brain className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 rounded-2xl rounded-tl-sm p-4"
                    style={{ background: 'linear-gradient(135deg, #667eea20 0%, #764ba220 100%)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                      That sounds awesome! 🐉 Should the dragon be friendly or brave and fierce?
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Powered by Stories */}
      <section className="py-20 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl mb-4">
              📖 Powered by <span style={{ color: '#667eea' }}>Stories</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Children learn best through stories—and TWINNEE makes them part of the story.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Palette, title: 'Interactive storytelling', emoji: '🎭', color: '#667eea' },
              { icon: Sparkles, title: 'Choice-based adventures', emoji: '🧩', color: '#EC4899' },
              { icon: Heart, title: 'Personalized characters', emoji: '🌈', color: '#F59E0B' },
              { icon: BookOpen, title: 'Embedded life lessons', emoji: '🧠', color: '#10B981' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-panel rounded-3xl p-6 text-center hover:scale-105 transition-all"
              >
                <div className="text-4xl mb-3">{item.emoji}</div>
                <item.icon className="w-8 h-8 mx-auto mb-3" style={{ color: item.color }} />
                <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </h3>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-12 text-base max-w-3xl mx-auto"
            style={{ color: 'var(--text-secondary)' }}
          >
            Every story adapts based on your child's <strong>behavior, mood, and interests</strong>.
          </motion.p>
        </div>
      </section>

      {/* Smart Behavior Insights */}
      <section className="py-20 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl mb-4">
              📊 Smart <span style={{ color: '#667eea' }}>Behavior Insights</span>
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              TWINNEE quietly observes and understands patterns:
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {[
              { icon: Brain, title: 'Screen time habits', emoji: '📱', color: '#6366F1' },
              { icon: BookOpen, title: 'Learning consistency', emoji: '📘', color: '#10B981' },
              { icon: Palette, title: 'Creativity levels', emoji: '🎨', color: '#EC4899' },
              { icon: Smile, title: 'Emotional patterns', emoji: '😊', color: '#F59E0B' },
              { icon: Activity, title: 'Physical activity', emoji: '🏃', color: '#EF4444' },
              { icon: Users, title: 'Social interactions', emoji: '👥', color: '#8B5CF6' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                className="glass-panel rounded-2xl p-5 flex items-center gap-4"
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: `${item.color}20` }}>
                  <item.icon className="w-6 h-6" style={{ color: item.color }} />
                </div>
                <div>
                  <div className="text-2xl mb-1">{item.emoji}</div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                    {item.title}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="glass-panel rounded-3xl p-6 text-center"
            style={{ background: 'linear-gradient(135deg, #10B98120 0%, #F59E0B20 100%)' }}
          >
            <p className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>
              It turns everyday interactions into meaningful insights—<strong>without making kids feel monitored</strong>.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Why Parents Love TWINNEE */}
      <section className="py-20 relative z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl mb-4">
              👨‍👩‍👧 Built for <span style={{ color: '#667eea' }}>Parents</span> Too
            </h2>
            <p className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              You stay in control with simple, meaningful updates
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: BarChart2, title: 'Simple behavior reports', color: '#667eea' },
              { icon: TrendingUp, title: 'Growth insights', color: '#10B981' },
              { icon: Heart, title: 'Smart alerts', color: '#EC4899' },
              { icon: Lock, title: 'Privacy-first design', color: '#F59E0B' },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="glass-panel rounded-3xl p-6 text-center"
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
                  style={{ background: `${item.color}20` }}>
                  <item.icon className="w-8 h-8" style={{ color: item.color }} />
                </div>
                <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </h3>
              </motion.div>
            ))}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-8 text-base italic" style={{ color: 'var(--text-secondary)' }}
          >
            No overwhelming dashboards—just meaningful updates.
          </motion.p>
        </div>
      </section>

      {/* Why Kids Love TWINNEE */}
      <section className="py-20 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="glass-panel rounded-3xl p-12 text-center"
            style={{ background: 'linear-gradient(135deg, #667eea10 0%, #764ba210 100%)' }}
          >
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl mb-8">
              🌈 Why Kids Love <span style={{ color: '#667eea' }}>TWINNEE</span>
            </h2>
            <div className="grid sm:grid-cols-2 gap-6">
              {[
                'Feels like a friend, not a teacher',
                'Fun, interactive storytelling',
                'No pressure or judgment',
                'Personalized just for them',
              ].map((text, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3"
                >
                  <CheckCircle className="w-6 h-6 shrink-0" style={{ color: '#10B981' }} />
                  <p className="text-base font-medium text-left" style={{ color: 'var(--text-primary)' }}>
                    {text}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Safe, Private, Responsible */}
      <section className="py-20 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
              <Shield className="w-10 h-10 text-white" />
            </div>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl mb-4">
              🔐 Safe. Private. <span style={{ color: '#667eea' }}>Responsible.</span>
            </h2>
            <div className="space-y-3 text-base max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              <p className="flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} />
                Designed for children's well-being
              </p>
              <p className="flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} />
                No harmful engagement loops
              </p>
              <p className="flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} />
                Transparent parent controls
              </p>
              <p className="flex items-center justify-center gap-2">
                <CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} />
                Privacy-first architecture
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-32 relative z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
          >
            <h2 className="font-heading font-extrabold text-4xl sm:text-5xl lg:text-6xl mb-6">
              🚀 Start Your Child's <br />
              <span style={{ 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                Journey Today
              </span>
            </h2>
            <p className="text-xl mb-10 max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Help your child grow with a companion that understands them.
            </p>
            <Button
              size="lg"
              onClick={() => navigate('/register')}
              className="rounded-full font-accent px-12 py-8 text-xl shadow-2xl hover:scale-110 transition-all"
              style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}
              data-testid="final-cta-btn"
            >
              Get Started Now
              <ArrowRight className="w-6 h-6 ml-3" />
            </Button>
            <p className="text-xs mt-6" style={{ color: 'var(--text-tertiary)' }}>
              Free to start • No credit card required
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t relative z-10" style={{ borderColor: 'var(--glass-border)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
                <Brain className="w-5 h-5 text-white" />
              </div>
              <span className="font-heading font-extrabold text-lg">TWINNEE</span>
            </div>
            <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>
              Growing with your child, one conversation at a time. 💜
            </p>
            <div className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              © 2025 TWINNEE. All rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
