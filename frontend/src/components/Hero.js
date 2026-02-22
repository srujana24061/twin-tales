import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const SparkleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z" fill="currentColor"/>
  </svg>
);

const ArrowIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4.16663 10H15.8333M15.8333 10L10.8333 5M15.8333 10L10.8333 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export function Hero() {
  const navigate = useNavigate();
  
  return (
    <section className="relative min-h-screen flex items-center pt-20 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none -z-10">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], rotate: [0, 90, 0] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -right-[10%] w-[60%] h-[60%] bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-full blur-[120px]" 
        />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-8 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 1 }}
            className="relative z-10"
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass-panel mb-8 border-purple-500/20 bg-white/10 backdrop-blur-xl">
              <div className="text-purple-600 w-4 h-4"><SparkleIcon /></div>
              <span className="text-xs font-bold tracking-widest text-purple-600 uppercase">Digital Twin of your kids</span>
            </div>
            
            <h1 className="text-6xl lg:text-8xl font-black tracking-tight mb-8 leading-[0.9] text-balance">
              Meet <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Twinnee</span>
              <span className="block text-4xl lg:text-5xl mt-4 font-medium tracking-tight opacity-80">Your Child's Smart Companion</span>
            </h1>
            
            <p className="text-xl lg:text-2xl text-gray-600 dark:text-gray-400 mb-12 font-serif max-w-xl leading-relaxed">
              A friendly AI-powered companion that learns, grows, and interacts—helping them build habits and stay balanced.
            </p>
            
            <div className="flex flex-wrap gap-5">
              <Button 
                size="lg" 
                onClick={() => navigate('/register')}
                className="rounded-full text-lg px-10 h-16 bg-gradient-to-r from-purple-600 to-purple-700 text-white hover:scale-105 transition-all shadow-2xl border-0"
              >
                Get Started <div className="ml-2"><ArrowIcon /></div>
              </Button>
              <Button 
                size="lg" 
                variant="ghost" 
                onClick={() => navigate('/login')}
                className="rounded-full text-lg px-10 h-16 glass-panel border-white/20 hover:bg-white/10"
              >
                Watch Demo
              </Button>
            </div>
          </motion.div>
          
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1.2 }}
            className="relative lg:h-[600px] flex items-center justify-center"
          >
            {/* Simplified companion visual */}
            <div className="relative w-full h-full flex items-center justify-center">
              <motion.div
                animate={{ 
                  y: [0, -20, 0],
                  scale: [1, 1.05, 1]
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className="w-64 h-64 rounded-full bg-gradient-to-tr from-purple-400 via-pink-400 to-purple-500 opacity-30 blur-3xl"
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute w-80 h-80 rounded-full border-4 border-purple-300/30"
              />
              <div className="absolute text-8xl">🧠</div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
