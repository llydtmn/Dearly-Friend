import { Heart } from 'lucide-react';
import { useState } from 'react';

export default function EnvelopeScreen({ onOpen }) {
  const [isOpening, setIsOpening] = useState(false);

  const handleOpen = () => {
    setIsOpening(true);
    setTimeout(() => {
      onOpen();
    }, 800);
  };

  return (
    <div className={`absolute inset-0 bg-charcoal flex flex-col items-center justify-center z-20 transition-opacity duration-700 ${isOpening ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      
      <div className="relative w-full max-w-md aspect-[4/3] bg-[#3a3a3a] rounded-sm shadow-2xl flex flex-col items-center justify-center border-t-[100px] border-l-[200px] border-r-[200px] border-b-[150px] border-t-[#4a4a4a] border-l-transparent border-r-transparent border-b-transparent mb-8" style={{ clipPath: 'polygon(0 0, 50% 50%, 100% 0, 100% 100%, 0 100%)' }}>
        <div className="absolute top-0 left-0 w-full h-full bg-black/10"></div>
      </div>
      
      <div className="absolute top-1/4 flex flex-col items-center">
        <h2 className="font-handwriting text-3xl text-gray-300 mb-2">Message To You My</h2>
        <h1 className="font-sans text-5xl font-bold text-paper tracking-widest mb-12">FRIEND!</h1>
        
        <button 
          onClick={handleOpen}
          className="relative group animate-pulse-heart"
        >
          <Heart size={100} className="text-heart fill-heart drop-shadow-2xl" />
          <span className="absolute inset-0 flex items-center justify-center font-handwriting text-paper text-lg transform rotate-[-10deg] opacity-90 group-hover:opacity-100 transition-opacity">
            Tap<br/>Here!
          </span>
        </button>
      </div>
    </div>
  );
}
