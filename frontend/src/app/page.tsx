import React from 'react';
import Link from 'next/link';
import {
  MessageSquare,
  Users,
  Send,
  BarChart3,
  FileText,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Star,
  Sparkles,
  Zap,
  Check,
  Clock,
  Play,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/theme-toggle';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-primary/20">
      {/* 1. Header / Navbar */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground shadow-sm transition-transform group-hover:scale-105">
              <MessageSquare className="w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Wavedesk
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#testimonials" className="hover:text-foreground transition-colors">
              Testimonials
            </a>
            <a href="#demo" className="hover:text-foreground transition-colors">
              Platform Demo
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link href="/auth/login" className="hidden sm:inline-flex">
              <Button variant="ghost" size="sm">Login</Button>
            </Link>
            <Link href="/auth/signup">
              <Button size="sm" className="shadow-sm font-medium">
                Get Started
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* 2. Hero Section */}
        <section className="relative pt-20 pb-24 md:pt-28 md:pb-32 overflow-hidden border-b">
          {/* Subtle background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-primary/10 blur-[130px] rounded-full pointer-events-none -z-10" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {/* Tagline Badge */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border bg-muted/60 text-xs sm:text-sm font-medium text-foreground mb-6 shadow-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>WhatsApp Business API Platform</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight max-w-4xl mx-auto leading-[1.1]">
              Scale Your WhatsApp{' '}
              <span className="bg-gradient-to-r from-primary via-emerald-500 to-teal-400 bg-clip-text text-transparent">
                Communication
              </span>
            </h1>

            {/* Subheadline */}
            <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Wavedesk helps businesses connect with customers through WhatsApp Business API. Send bulk messages, manage
              customers, and track analytics all in one place.
            </p>

            {/* CTAs */}
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/auth/signup" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto h-12 px-8 text-base shadow-md">
                  Start Free Trial
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
              <Link href="/auth/login" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-12 px-8 text-base">
                  <Play className="w-4 h-4 mr-2 text-primary" />
                  Watch Demo
                </Button>
              </Link>
            </div>

            {/* Social proof highlights */}
            <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-muted-foreground font-medium">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                Official Meta Cloud API
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                24-Hour Window Guard
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                No Credit Card Required
              </div>
            </div>

            {/* Hero Visual Mockup */}
            <div id="demo" className="mt-16 max-w-5xl mx-auto rounded-2xl border bg-card/60 backdrop-blur-xl shadow-2xl overflow-hidden p-2 sm:p-4 text-left">
              <div className="rounded-xl border bg-background overflow-hidden">
                {/* Mock Browser Header */}
                <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500/80" />
                    <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                    <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                    <span className="ml-2 text-xs font-mono text-muted-foreground">wavedesk.io/dashboard/inbox</span>
                  </div>
                  <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse mr-1.5" />
                    Socket.io Live
                  </Badge>
                </div>

                {/* Mock Inbox UI Grid */}
                <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x min-h-[380px]">
                  {/* Left Column: Conversations List */}
                  <div className="p-3 bg-muted/10 space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-2 py-1">
                      Recent Chats
                    </div>
                    <div className="p-3 rounded-xl bg-accent text-accent-foreground border shadow-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">Sarah Jenkins</span>
                        <span className="text-[10px] text-muted-foreground">Just now</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        Hi, I would love to place a bulk order!
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600">
                          VIP Client
                        </Badge>
                        <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600">
                          Window Active
                        </Badge>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl hover:bg-muted/50 transition-colors cursor-pointer border border-transparent">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">Alex Rivera</span>
                        <span className="text-[10px] text-muted-foreground">12m ago</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        Thank you for the quick appointment confirmation.
                      </p>
                      <div className="flex items-center gap-1.5 mt-2">
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary">
                          Lead
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Middle & Right: Chat Thread & Telemetry */}
                  <div className="md:col-span-2 p-5 flex flex-col justify-between bg-card">
                    <div className="space-y-4">
                      {/* Customer Info Header */}
                      <div className="flex items-center justify-between pb-3 border-b">
                        <div>
                          <h4 className="font-bold text-sm">Sarah Jenkins (+1 555-987-6543)</h4>
                          <p className="text-xs text-muted-foreground">Active 24-hour messaging window (23h 48m left)</p>
                        </div>
                        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 text-xs">
                          Free-text Allowed
                        </Badge>
                      </div>

                      {/* Chat Bubbles */}
                      <div className="space-y-3 pt-2">
                        <div className="flex items-end gap-2">
                          <div className="bg-muted p-3.5 rounded-2xl rounded-bl-none text-xs sm:text-sm max-w-sm">
                            Hello! I am inquiring about your software enterprise pricing and bulk WhatsApp messaging.
                          </div>
                        </div>

                        <div className="flex items-end justify-end gap-2">
                          <div className="bg-primary text-primary-foreground p-3.5 rounded-2xl rounded-br-none text-xs sm:text-sm max-w-sm">
                            Hi Sarah! Thanks for reaching out. We would be delighted to assist you with our high-volume broadcast tools.
                            <div className="flex items-center justify-end gap-1 mt-1 text-[10px] text-primary-foreground/80 font-mono">
                              <span>12:45 PM</span>
                              <Check className="w-3 h-3 text-emerald-300" />
                              <Check className="w-3 h-3 text-emerald-300 -ml-2" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Stats Strip */}
                    <div className="mt-6 pt-4 border-t grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="p-2 rounded-lg bg-muted/40">
                        <div className="font-bold text-sm text-foreground">99.4%</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-medium">Delivery Rate</div>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/40">
                        <div className="font-bold text-sm text-foreground">20 msg/s</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-medium">Throttle Limit</div>
                      </div>
                      <div className="p-2 rounded-lg bg-muted/40">
                        <div className="font-bold text-sm text-foreground">AES-256</div>
                        <div className="text-[10px] text-muted-foreground uppercase font-medium">Encrypted</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Features Section ("Everything you need to succeed") */}
        <section id="features" className="py-24 md:py-32 bg-muted/20 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <Badge variant="outline" className="mb-4 text-xs font-semibold uppercase tracking-wider text-primary">
                Features
              </Badge>
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">Everything you need to succeed</h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Powerful features designed to help you connect with your customers effectively.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="p-8 rounded-2xl border bg-card hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold">WhatsApp Business API</h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Seamlessly connect your WhatsApp Business API and send messages at scale.
                  </p>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="p-8 rounded-2xl border bg-card hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                    <Users className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold">Customer Management</h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Organize customers with tags, notes, and detailed profiles.
                  </p>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="p-8 rounded-2xl border bg-card hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                    <Send className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold">Bulk Messaging</h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Send personalized messages to thousands of customers instantly.
                  </p>
                </div>
              </div>

              {/* Feature 4 */}
              <div className="p-8 rounded-2xl border bg-card hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold">Analytics Dashboard</h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Track message delivery, engagement, and campaign performance.
                  </p>
                </div>
              </div>

              {/* Feature 5 */}
              <div className="p-8 rounded-2xl border bg-card hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold">Template Management</h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Create and manage WhatsApp message templates with variables.
                  </p>
                </div>
              </div>

              {/* Feature 6 */}
              <div className="p-8 rounded-2xl border bg-card hover:border-primary/50 transition-all duration-300 shadow-sm hover:shadow-md flex flex-col justify-between">
                <div>
                  <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                    <ShieldCheck className="w-6 h-6" />
                  </div>
                  <h3 className="text-xl font-bold">Secure &amp; Compliant</h3>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    Enterprise-grade security with encrypted data storage.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4. Testimonials Section ("Trusted by thousands of businesses") */}
        <section id="testimonials" className="py-24 md:py-32 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto">
              <Badge variant="outline" className="mb-4 text-xs font-semibold uppercase tracking-wider text-primary">
                Testimonials
              </Badge>
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                Trusted by thousands of businesses
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                See what our customers have to say about Wavedesk.
              </p>
            </div>

            <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Testimonial 1 */}
              <div className="p-8 rounded-2xl border bg-card shadow-sm flex flex-col justify-between relative">
                <div>
                  <div className="flex items-center gap-1 text-amber-400 mb-6">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <blockquote className="text-base font-medium leading-relaxed italic text-foreground">
                    &ldquo;Wavedesk has revolutionized our customer communication. We&apos;ve increased our engagement by 300%.&rdquo;
                  </blockquote>
                </div>
                <div className="mt-8 pt-6 border-t">
                  <div className="font-bold text-sm text-foreground">Sarah Johnson</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Marketing Director at TechCorp</div>
                </div>
              </div>

              {/* Testimonial 2 */}
              <div className="p-8 rounded-2xl border bg-card shadow-sm flex flex-col justify-between relative">
                <div>
                  <div className="flex items-center gap-1 text-amber-400 mb-6">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <blockquote className="text-base font-medium leading-relaxed italic text-foreground">
                    &ldquo;The bulk messaging feature is incredible. We can now reach all our customers with personalized offers.&rdquo;
                  </blockquote>
                </div>
                <div className="mt-8 pt-6 border-t">
                  <div className="font-bold text-sm text-foreground">Michael Chen</div>
                  <div className="text-xs text-muted-foreground mt-0.5">E-commerce Owner at Fashion Store</div>
                </div>
              </div>

              {/* Testimonial 3 */}
              <div className="p-8 rounded-2xl border bg-card shadow-sm flex flex-col justify-between relative">
                <div>
                  <div className="flex items-center gap-1 text-amber-400 mb-6">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-4 h-4 fill-current" />
                    ))}
                  </div>
                  <blockquote className="text-base font-medium leading-relaxed italic text-foreground">
                    &ldquo;Our response time has improved dramatically. The shared inbox makes managing conversations easy.&rdquo;
                  </blockquote>
                </div>
                <div className="mt-8 pt-6 border-t">
                  <div className="font-bold text-sm text-foreground">Emily Rodriguez</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Customer Success at ServicePro</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Bottom CTA Banner */}
        <section className="py-20 md:py-28 relative overflow-hidden bg-primary/5 border-b">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-2xl mx-auto">
              Ready to scale your WhatsApp communication?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
              Join thousands of businesses already using Wavedesk to connect with their customers.
            </p>
            <div className="mt-8 flex justify-center">
              <Link href="/auth/signup">
                <Button size="lg" className="h-12 px-8 text-base shadow-lg font-semibold">
                  Get Started Now
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* 6. Footer */}
      <footer className="bg-card text-card-foreground border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
            {/* Brand column */}
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shadow-sm">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <span className="font-bold text-lg tracking-tight">Wavedesk</span>
              </Link>
              <p className="mt-4 text-sm text-muted-foreground max-w-sm leading-relaxed">
                The leading WhatsApp Business API platform for modern businesses.
              </p>
            </div>

            {/* Product Column */}
            <div>
              <h4 className="font-semibold text-sm mb-4">Product</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <a href="#features" className="hover:text-foreground transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <Link href="/auth/login" className="hover:text-foreground transition-colors">
                    Documentation
                  </Link>
                </li>
                <li>
                  <Link href="/auth/login" className="hover:text-foreground transition-colors">
                    API Reference
                  </Link>
                </li>
              </ul>
            </div>

            {/* Company Column */}
            <div>
              <h4 className="font-semibold text-sm mb-4">Company</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Contact
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Careers
                  </a>
                </li>
              </ul>
            </div>

            {/* Legal Column */}
            <div>
              <h4 className="font-semibold text-sm mb-4">Legal</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Terms
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Security
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Wavedesk. All rights reserved.</p>
            <div className="flex items-center gap-6">
              <a href="#" className="hover:text-foreground transition-colors">
                Status
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                Twitter
              </a>
              <a href="#" className="hover:text-foreground transition-colors">
                GitHub
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
