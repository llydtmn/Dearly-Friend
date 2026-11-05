import { PenLine, BellRing, MailOpen, Heart, Lock, Keyboard, Users, Search, Trash2 } from 'lucide-react';

const steps = [
  {
    icon: PenLine,
    title: 'Write a letter',
    text: 'Pick a friend, or type any email address, and write something real. No character limits, no likes, no noise.',
  },
  {
    icon: BellRing,
    title: 'They get an email',
    text: 'Your friend receives a little notification in their Gmail with a button to open your letter. No account needed to receive one.',
  },
  {
    icon: MailOpen,
    title: 'They open the envelope',
    text: 'They sign in (or sign up with that same email), tap the envelope, and your words appear slowly, as if written just for them.',
  },
];

const features = [
  { icon: Heart, title: 'Made for the heart', text: 'A quiet place for long-distance friends, family and loved ones to say what chat apps rush past.' },
  { icon: Keyboard, title: 'Slow, typed reveal', text: 'Letters are revealed letter by letter, so every message is read the way it was meant to be.' },
  { icon: Users, title: 'Write to anyone', text: 'Send a letter to any email address. If they have not joined yet, the letter waits for them.' },
  { icon: Lock, title: 'Private by design', text: 'Only the sender and the recipient can read a letter. Nobody else can see it.' },
  { icon: Search, title: 'Easy to find', text: 'Browse All, Unread and Sent, and search by name or email to find an old letter fast.' },
  { icon: Trash2, title: 'Stay tidy', text: 'Swipe a letter to the left to delete it whenever you want.' },
];

export default function Landing({ onSignIn, onSignUp }) {
  return (
    <div className="min-h-screen text-paper font-sans">
      {/* Nav */}
      <header className="sticky top-0 z-30 bg-charcoal/80 backdrop-blur-md border-b border-gray-700/50">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-handwriting text-3xl">Dearly</span>
          <nav className="flex items-center gap-2 sm:gap-4 text-sm">
            <a href="#how" className="hidden sm:inline text-gray-300 hover:text-paper transition-colors">How it works</a>
            <a href="#features" className="hidden sm:inline text-gray-300 hover:text-paper transition-colors">Features</a>
            <button onClick={onSignIn} className="px-3 py-1.5 text-gray-200 hover:text-paper transition-colors">
              Sign in
            </button>
            <button
              onClick={onSignUp}
              className="px-4 py-1.5 bg-heart text-paper rounded-sm hover:bg-red-900 transition-colors"
            >
              Get started
            </button>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-5xl mx-auto px-4 pt-16 pb-20 md:pt-24 text-center">
        <div className="animate-fade-in">
          <div className="mx-auto mb-8 w-24 h-24 rounded-full bg-paper flex items-center justify-center shadow-2xl animate-pulse-heart">
            <Heart size={44} className="text-heart" fill="currentColor" />
          </div>
          <h1 className="font-handwriting text-6xl md:text-8xl drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">Dearly</h1>
          <p className="mt-4 font-handwriting text-3xl md:text-4xl text-gray-200 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
            Letters worth waiting for.
          </p>
          <p className="mt-6 max-w-xl mx-auto text-base md:text-lg text-gray-200 leading-relaxed drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
            Dearly is a small, private space for sending heartfelt letters to the people you miss. Write slowly, send
            with love, and let them open it like a real envelope.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={onSignUp}
              className="px-8 py-3 bg-heart text-paper rounded-sm text-sm tracking-wide hover:bg-red-900 transition-colors shadow-xl"
            >
              Create your account
            </button>
            <button
              onClick={onSignIn}
              className="px-8 py-3 bg-paper/10 border border-paper/40 text-paper rounded-sm text-sm tracking-wide hover:bg-paper/20 transition-colors backdrop-blur-sm"
            >
              I already have an account
            </button>
          </div>
        </div>
      </section>

      {/* Purpose */}
      <section className="max-w-3xl mx-auto px-4 pb-20">
        <div className="bg-paper text-ink rounded-sm shadow-2xl p-8 md:p-12 text-center">
          <h2 className="font-handwriting text-4xl md:text-5xl mb-4">Why Dearly?</h2>
          <p className="text-base md:text-lg leading-relaxed text-ink/80">
            Messages move fast and get lost. A quick chat is easy to send and easy to forget. Dearly slows things
            down: one letter, one person, one moment. It is built for long-distance friends, families and anyone who
            wants to say something that deserves to be read slowly, and kept.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="max-w-5xl mx-auto px-4 pb-20 scroll-mt-20">
        <h2 className="font-handwriting text-4xl md:text-5xl text-center mb-10 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
          How it works
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <div key={title} className="bg-charcoal/85 backdrop-blur-md border border-gray-700/60 rounded-sm p-6">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-10 h-10 rounded-full bg-heart flex items-center justify-center">
                  <Icon size={20} className="text-paper" />
                </span>
                <span className="text-sm text-gray-400">Step {i + 1}</span>
              </div>
              <h3 className="font-handwriting text-3xl mb-2">{title}</h3>
              <p className="text-sm text-gray-300 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="max-w-5xl mx-auto px-4 pb-20 scroll-mt-20">
        <h2 className="font-handwriting text-4xl md:text-5xl text-center mb-10 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
          Everything you need, nothing you do not
        </h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="bg-paper text-ink rounded-sm p-6 shadow-xl">
              <Icon size={24} className="text-heart mb-3" />
              <h3 className="font-semibold mb-1">{title}</h3>
              <p className="text-sm text-ink/75 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 pb-20">
        <h2 className="font-handwriting text-4xl md:text-5xl text-center mb-8 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
          Good to know
        </h2>
        <div className="space-y-4">
          <div className="bg-charcoal/85 backdrop-blur-md border border-gray-700/60 rounded-sm p-5">
            <h3 className="font-medium mb-1">Does my friend need an account to receive a letter?</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              No. They get an email with a link. When they click it, they sign up with that same email address and your
              letter opens right away.
            </p>
          </div>
          <div className="bg-charcoal/85 backdrop-blur-md border border-gray-700/60 rounded-sm p-5">
            <h3 className="font-medium mb-1">Who can read my letters?</h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              Only you and the person you wrote to. Your letters are not public and are not shown to other users.
            </p>
          </div>
          <div className="bg-charcoal/85 backdrop-blur-md border border-gray-700/60 rounded-sm p-5">
            <h3 className="font-medium mb-1">Is it free?</h3>
            <p className="text-sm text-gray-300 leading-relaxed">Yes. Create an account and start writing.</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-4 pb-24 text-center">
        <h2 className="font-handwriting text-4xl md:text-5xl mb-3 drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
          Someone is waiting to hear from you.
        </h2>
        <p className="text-gray-200 mb-8 drop-shadow-[0_1px_4px_rgba(0,0,0,0.95)]">
          Write your first letter today.
        </p>
        <button
          onClick={onSignUp}
          className="px-10 py-3 bg-heart text-paper rounded-sm text-sm tracking-wide hover:bg-red-900 transition-colors shadow-xl"
        >
          Get started
        </button>
      </section>

      <footer className="border-t border-gray-700/50 bg-charcoal/80 backdrop-blur-md py-6 text-center text-sm text-gray-400">
        <span className="font-handwriting text-xl text-gray-200">Dearly</span>
        <span className="mx-2">·</span>
        Written with care, for the people you miss.
      </footer>
    </div>
  );
}