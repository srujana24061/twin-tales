import { motion } from "framer-motion";

const ShieldIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ChartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M21.21 15.89A10 10 0 1 1 8 2.83M22 12A10 10 0 0 0 12 2V12Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const benefits = [
  { icon: ChartIcon, title: "Simple behavior reports" },
  { icon: ChartIcon, title: "Growth insights" },
  { icon: ChartIcon, title: "Smart alerts" },
  { icon: ShieldIcon, title: "Privacy-first design" },
];

export function Parents() {
  return (
    <section className="py-24 relative" id="parents">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-panel rounded-[3rem] p-8 md:p-16 lg:p-24 overflow-hidden relative border border-purple-500/20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2" />
          
          <div className="grid lg:grid-cols-2 gap-16 items-center relative z-10">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 text-purple-600 mb-8">
                <ShieldIcon />
                <span className="text-sm font-semibold tracking-wide uppercase">Built for Parents Too</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight leading-tight">
                Early Awareness,<br />Safe Guidance.
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 font-serif mb-8 leading-relaxed">
                Twinnee detects patterns like excess screen time or emotional shifts and responds with supportive guidance, while keeping you informed. No overwhelming dashboards—just meaningful updates.
              </p>

              <div className="grid sm:grid-cols-2 gap-4">
                {benefits.map((benefit, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white dark:bg-black/50 flex items-center justify-center shadow-sm border border-gray-200 dark:border-gray-800">
                      <benefit.icon />
                    </div>
                    <span className="font-medium text-sm">{benefit.title}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="relative"
            >
              <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-2xl border border-gray-200 dark:border-gray-800 relative z-10 transform rotate-2 hover:rotate-0 transition-transform duration-300">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h4 className="font-bold text-lg tracking-tight">Weekly Insights</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400 font-serif">Alex's progress this week</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <span className="text-xl">🌟</span>
                  </div>
                </div>
                
                <div className="space-y-4 font-serif">
                  <div className="p-4 rounded-2xl bg-pink-500/10 flex items-center justify-between">
                    <span className="font-medium">Creativity</span>
                    <span className="text-pink-600 font-bold">+24%</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-green-500/10 flex items-center justify-between">
                    <span className="font-medium">Reading</span>
                    <span className="text-green-600 font-bold">Consistent</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
