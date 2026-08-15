import { Link } from "react-router-dom";
import { ShieldCheck, Users, Sparkles, MessageCircle, CalendarClock, HeartHandshake } from "lucide-react";
import { Button, Card } from "../components/ui/primitives";
import { InstallPrompt } from "../components/layout/InstallPrompt";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// A hand-picked illustrative pattern for the hero visual — not live data.
const HIGHLIGHT: Record<string, number[]> = { Mon: [2, 3], Wed: [5, 6, 7], Fri: [8, 9, 10, 11], Sat: [1, 2, 3, 12] };

function ScheduleGlyph() {
  return (
    <div className="grid grid-cols-7 gap-1.5 w-full max-w-sm">
      {DAYS.map((day) => (
        <div key={day} className="flex flex-col gap-1.5">
          <span className="text-[10px] font-mono text-pulse-300 text-center">{day}</span>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((slot) => (
            <div key={slot} className={`h-2.5 rounded-sm ${HIGHLIGHT[day]?.includes(slot) ? "bg-ember-500" : "bg-pulse-100"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

const HOW_IT_WORKS = [
  { icon: Sparkles, title: "Tell us who you are", desc: "Interests, goals, personality, lifestyle — the stuff that actually matters." },
  { icon: HeartHandshake, title: "See real compatibility", desc: "Every profile shows a score and the specific reasons you'd click." },
  { icon: MessageCircle, title: "Connect and chat", desc: "Match, break the ice, and take it from there — safely, on your terms." },
];

const FEATURES = [
  { icon: Sparkles, title: "Smart compatibility", desc: "Personality, interests, goals, lifestyle, and schedule — combined into one honest score, with the reasons spelled out." },
  { icon: ShieldCheck, title: "Verified profiles", desc: "Email and student verification help keep the people you meet real." },
  { icon: CalendarClock, title: "Free-time matching", desc: "See who's actually free when you are — no more matching with someone whose schedule never lines up with yours." },
  { icon: Users, title: "Interest communities", desc: "Find your people beyond the swipe — join spaces built around what you're into." },
];

const FAQS = [
  { q: "Is Campus Pulse only for college students?", a: "Campus Pulse is built for students and young adults navigating campus life — school and major fields are optional if they don't apply to you." },
  { q: "How is the compatibility score calculated?", a: "It's a weighted estimate combining personality, shared interests, relationship goals, lifestyle, education, schedule overlap, and distance. It's a starting point for a conversation, not a guarantee." },
  { q: "Can I control who sees my profile?", a: "Yes — you decide your discoverability, who can message you, and exactly what's visible, all from Settings." },
  { q: "What if someone makes me uncomfortable?", a: "Block or report anyone in one tap from their profile or a conversation. Our Safety Center has more on how we handle reports." },
];

const TESTIMONIALS = [
  { name: "Priya, junior — demo testimonial", quote: "The schedule matching is what got me. I stopped matching with people I'd never actually be free to meet." },
  { name: "Marcus, sophomore — demo testimonial", quote: "The compatibility breakdown actually gives you something to talk about on a first message." },
];

export function LandingPage() {
  return (
    <div className="bg-paper dark:bg-midnight text-midnight dark:text-paper">
      <header className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <span className="font-display text-xl font-semibold text-pulse-600">Campus Pulse</span>
        <div className="flex items-center gap-3">
          <InstallPrompt />
          <Link to="/login" className="text-sm font-semibold text-pulse-700 dark:text-pulse-200">
            Sign in
          </Link>
          <Link to="/register">
            <Button className="!py-2 !px-4 text-sm">Get started</Button>
          </Link>
        </div>
      </header>

      <section className="max-w-6xl mx-auto px-6 pt-10 pb-20 grid md:grid-cols-2 gap-10 items-center">
        <div>
          <h1 className="font-display text-5xl md:text-6xl font-semibold leading-[1.05] text-balance mb-5">
            Don't just match <span className="italic text-ember-500">faces.</span>
            <br />
            Match <span className="italic text-pulse-500">lives.</span>
          </h1>
          <p className="text-lg text-pulse-700/80 dark:text-pulse-100/80 mb-8 max-w-md">
            Meet people who fit your interests, goals, personality, lifestyle, and schedule.
          </p>
          <div className="flex gap-3">
            <Link to="/register">
              <Button>Get Started</Button>
            </Link>
            <a href="#how-it-works">
              <Button variant="ghost">Explore</Button>
            </a>
          </div>
        </div>
        <Card className="p-6">
          <p className="text-xs font-mono uppercase text-pulse-300 mb-3">Your overlapping free time</p>
          <ScheduleGlyph />
          <p className="text-sm text-pulse-700 dark:text-pulse-200 mt-4">
            <strong>You and Jordan</strong> are both free Friday afternoons and Saturday mornings.
          </p>
        </Card>
      </section>

      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="font-display text-3xl font-semibold mb-10 text-center">How it works</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map((item) => (
            <Card key={item.title} className="p-6">
              <item.icon className="text-ember-500 mb-3" size={28} />
              <h3 className="font-semibold mb-1.5">{item.title}</h3>
              <p className="text-sm text-pulse-400">{item.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="font-display text-3xl font-semibold mb-10 text-center">Built for real compatibility</h2>
        <div className="grid sm:grid-cols-2 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="flex gap-4">
              <f.icon className="text-pulse-500 shrink-0 mt-1" size={24} />
              <div>
                <h3 className="font-semibold mb-1">{f.title}</h3>
                <p className="text-sm text-pulse-400">{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="font-display text-3xl font-semibold mb-10 text-center">What people are saying</h2>
        <div className="grid md:grid-cols-2 gap-6">
          {TESTIMONIALS.map((t) => (
            <Card key={t.name} className="p-6">
              <p className="text-pulse-700 dark:text-pulse-200 italic mb-4">"{t.quote}"</p>
              <p className="text-xs text-pulse-300">{t.name}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-6 py-16">
        <h2 className="font-display text-3xl font-semibold mb-8 text-center">Questions</h2>
        <div className="flex flex-col divide-y divide-pulse-100 dark:divide-pulse-800">
          {FAQS.map((f) => (
            <details key={f.q} className="py-4 group">
              <summary className="font-semibold cursor-pointer list-none flex justify-between items-center">
                {f.q}
                <span className="text-pulse-300 group-open:rotate-45 transition-transform">+</span>
              </summary>
              <p className="text-sm text-pulse-400 mt-2">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <footer className="border-t border-pulse-100 dark:border-pulse-800 px-6 py-10">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-x-8 gap-y-3 justify-between text-sm text-pulse-400">
          <span className="font-display text-pulse-600">Campus Pulse</span>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#" className="hover:text-pulse-700">About</a>
            <a href="#" className="hover:text-pulse-700">Contact</a>
            <a href="#" className="hover:text-pulse-700">Safety</a>
            <a href="#" className="hover:text-pulse-700">Privacy Policy</a>
            <a href="#" className="hover:text-pulse-700">Terms</a>
            <a href="#" className="hover:text-pulse-700">Community Guidelines</a>
            <a href="#" className="hover:text-pulse-700">Help Center</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
