import { Link } from 'react-router-dom'
import { Pill, Brain, MessageSquare, ShieldCheck, Clock, ChevronRight, Activity, Zap } from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
              <Pill className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg">MediLink</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-slate-300 hover:text-white transition-colors px-4 py-2">
              Login
            </Link>
            <Link to="/register" className="text-sm bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg transition-colors">
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary-900/50 border border-primary-700 text-primary-300 text-sm px-4 py-1.5 rounded-full mb-6">
            <Zap className="w-3.5 h-3.5" />
            AI-Powered Prescription Management
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Smart Prescriptions,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-accent-400">
              Faster Care
            </span>
          </h1>
          <p className="text-xl text-slate-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            Upload your prescription and let AI extract medicine details automatically.
            Get instant quotes from pharmacies across Sri Lanka.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register?role=patient"
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white font-semibold px-8 py-4 rounded-xl transition-all hover:scale-105 shadow-lg shadow-primary-900/50">
              I'm a Patient <ChevronRight className="w-4 h-4" />
            </Link>
            <Link to="/register?role=pharmacy"
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-semibold px-8 py-4 rounded-xl transition-all">
              I'm a Pharmacy <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 px-6 border-y border-slate-800">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          {[
            { value: '≥90%', label: 'OCR Accuracy' },
            { value: '70%', label: 'Time Saved' },
            { value: '<2s', label: 'Notification Speed' },
          ].map(({ value, label }) => (
            <div key={label}>
              <div className="text-3xl font-bold text-primary-400 mb-1">{value}</div>
              <div className="text-sm text-slate-500">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-3">Everything you need</h2>
          <p className="text-slate-400 text-center mb-12">Built for Sri Lanka's healthcare ecosystem</p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: Brain, title: 'AI OCR + NLP', desc: 'Tesseract OCR with spaCy NLP extracts medicines, dosages, and frequencies from handwritten prescriptions.', color: 'text-primary-400' },
              { icon: Clock, title: 'Instant Quotes', desc: 'Pharmacies receive requests instantly and auto-generate quotations based on extracted medicine data.', color: 'text-accent-400' },
              { icon: MessageSquare, title: 'Real-time Chat', desc: 'Socket.IO powered live messaging between patients and pharmacies for seamless communication.', color: 'text-emerald-400' },
              { icon: ShieldCheck, title: 'Secure & Private', desc: 'JWT authentication, bcrypt hashing, and AES-256 encryption protect all your medical data.', color: 'text-amber-400' },
              { icon: Activity, title: 'Analytics Dashboard', desc: 'Track prescriptions processed, quotation times, AI accuracy rates and operational metrics.', color: 'text-rose-400' },
              { icon: Pill, title: 'Multi-pharmacy', desc: 'Requests are sent to up to 10 nearby pharmacies simultaneously — compare prices and pick the best.', color: 'text-cyan-400' },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-6 hover:border-slate-600 transition-colors">
                <Icon className={`w-7 h-7 ${color} mb-4`} />
                <h3 className="font-semibold mb-2">{title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-6 text-center border-t border-slate-800">
        <h2 className="text-3xl font-bold mb-4">Ready to get started?</h2>
        <p className="text-slate-400 mb-8">Join patients and pharmacies already using MediLink in Sri Lanka.</p>
        <Link to="/register"
          className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white font-semibold px-10 py-4 rounded-xl transition-all hover:scale-105">
          Create Free Account <ChevronRight className="w-4 h-4" />
        </Link>
      </section>

      <footer className="py-6 text-center text-sm text-slate-600 border-t border-slate-800">
        © 2025 MediLink — AI-Powered Prescription Management
      </footer>
    </div>
  )
}
