import { motion } from "framer-motion";

const InstagramIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
  </svg>
);

const TwitterIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"></path>
  </svg>
);

export function Footer() {
  return (
    <footer className="py-20 border-t border-gray-200 dark:border-gray-800 bg-white/30 dark:bg-black/10 backdrop-blur-xl">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-1">
            <h3 className="text-2xl font-black mb-6 tracking-tighter">
              Twin<span className="text-purple-600">nee</span>
            </h3>
            <p className="text-gray-600 dark:text-gray-400 font-serif text-sm leading-relaxed mb-8">
              The smart, friendly digital twin companion for children. Built for safety, designed for growth.
            </p>
            <div className="flex gap-4">
              <a href="#" className="w-10 h-10 rounded-full glass-panel flex items-center justify-center hover:bg-purple-500/10 hover:text-purple-600 transition-all duration-300">
                <InstagramIcon />
              </a>
              <a href="#" className="w-10 h-10 rounded-full glass-panel flex items-center justify-center hover:bg-purple-500/10 hover:text-purple-600 transition-all duration-300">
                <TwitterIcon />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-6 text-sm uppercase tracking-widest">Platform</h4>
            <ul className="space-y-4 text-sm text-gray-600 dark:text-gray-400 font-serif">
              <li><a href="#features" className="hover:text-purple-600 transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-purple-600 transition-colors">Habit Tracking</a></li>
              <li><a href="#" className="hover:text-purple-600 transition-colors">Safety Features</a></li>
              <li><a href="#" className="hover:text-purple-600 transition-colors">App Download</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-sm uppercase tracking-widest">Resources</h4>
            <ul className="space-y-4 text-sm text-gray-600 dark:text-gray-400 font-serif">
              <li><a href="#" className="hover:text-purple-600 transition-colors">Parent Guide</a></li>
              <li><a href="#" className="hover:text-purple-600 transition-colors">Help Center</a></li>
              <li><a href="#" className="hover:text-purple-600 transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-purple-600 transition-colors">Terms of Service</a></li>
            </ul>
          </div>

          <div className="glass-panel p-6 rounded-3xl bg-purple-500/5 border-purple-500/10">
            <h4 className="font-bold mb-4 text-sm uppercase tracking-widest">Stay Updated</h4>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-serif mb-4 leading-relaxed">
              Get weekly tips on digital wellness and child growth.
            </p>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Email" 
                className="bg-white dark:bg-black/20 border border-gray-200 dark:border-gray-800 rounded-xl px-4 text-xs flex-1 focus:ring-1 focus:ring-purple-500 outline-none"
              />
              <button className="bg-purple-600 text-white p-2 rounded-xl hover:scale-105 transition-transform duration-300">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between pt-8 border-t border-gray-200 dark:border-gray-800 text-[10px] text-gray-600 dark:text-gray-400 font-medium uppercase tracking-[0.2em]">
          <p>© 2026 Twinnee AI. All rights reserved.</p>
          <div className="flex gap-8 mt-4 md:mt-0">
            <a href="#" className="hover:text-purple-600 transition-colors">Privacy</a>
            <a href="#" className="hover:text-purple-600 transition-colors">Terms</a>
            <a href="#" className="hover:text-purple-600 transition-colors">Safety</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
