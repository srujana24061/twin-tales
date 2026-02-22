import { motion } from "framer-motion";

const ChatIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M24 16C24 20.4183 20.4183 24 16 24C14.2001 24 12.5414 23.4079 11.2001 22.4L7 24L8.6 19.8C7.5921 18.4586 7 16.7999 7 15C7 10.5817 10.5817 7 15 7C19.4183 7 23 10.5817 23 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const BrainIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 26C21.5228 26 26 21.5228 26 16C26 10.4772 21.5228 6 16 6C10.4772 6 6 10.4772 6 16C6 21.5228 10.4772 26 16 26Z" stroke="currentColor" strokeWidth="2"/>
    <path d="M16 12V20M12 16H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const GraphIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M8 22L12 14L18 18L24 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M6 26H26" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
);

const GrowIcon = () => (
  <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 25V13M16 13L12 17M16 13L20 17M8 25H24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const features = [
  {
    icon: <ChatIcon />,
    title: "Talks like a friend",
    description: "Twinnee greets your child, chats, listens, remembers, and adapts—becoming a trusted companion.",
    color: "from-purple-500/10 to-purple-500/5"
  },
  {
    icon: <BrainIcon />,
    title: "Thinks like a guide",
    description: "Uses gentle nudges and embedded life lessons to help children develop better habits without pressure.",
    color: "from-pink-500/10 to-pink-500/5"
  },
  {
    icon: <GraphIcon />,
    title: "Tracks like an assistant",
    description: "Quietly observes patterns in screen time, learning consistency, and creativity levels.",
    color: "from-blue-500/10 to-blue-500/5"
  },
  {
    icon: <GrowIcon />,
    title: "Grows like your child",
    description: "Evolves with them, learning preferences and predicting engagement times.",
    color: "from-green-500/10 to-green-500/5"
  }
];

export function Features() {
  return (
    <section className="py-24 relative overflow-hidden bg-white/50 dark:bg-black/20 backdrop-blur-3xl" id="features">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-bold mb-6 tracking-tight"
          >
            What is <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Twinnee?</span>
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-xl text-gray-600 dark:text-gray-400 font-serif leading-relaxed"
          >
            Twinnee is an intelligent AI companion that works through interactive storytelling, conversations, and subtle guidance.
          </motion.p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="glass-panel p-8 rounded-[2rem] hover:-translate-y-2 transition-all duration-300 group"
            >
              <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-6 bg-gradient-to-br ${feature.color} group-hover:scale-110 transition-transform duration-300`}>
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-4 tracking-tight">{feature.title}</h3>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed font-serif text-sm">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
