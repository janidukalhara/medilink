import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  FileText,
  MapPin,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Store,
  UploadCloud,
} from "lucide-react";
import Navbar from "../components/shared/Navbar";
import Brand from "../components/shared/Brand";
import {
  AnimatedHeading,
  ParallaxImage,
  Reveal,
} from "../components/ui/Motion";

import ShinyText from "../components/ui/reactbits/ShinyText";

const steps = [
  {
    icon: UploadCloud,
    title: "One photo. A clearer start.",
    text: "Upload your prescription. MediLink helps turn the details into a medicine list you can review.",
  },
  {
    icon: MapPin,
    title: "Your neighbourhood, connected.",
    text: "Choose nearby pharmacies and request quotations without making multiple trips.",
  },
  {
    icon: Check,
    title: "Compare. Choose. Breathe.",
    text: "Review prices and availability, chat with your pharmacy, and track your order in one place.",
  },
];
export default function HomePage() {
  return (
    <div className="home-page">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Navbar />
      <main id="main-content">
        <section className="hero-section section-wrap">
          <div className="hero-heading">
            <div>
              <div className="eyebrow">
                <span className="status-dot" /> CONNECTING YOUR NEXT STEP IN
                CARE
              </div>
              <h1>
                <AnimatedHeading text="Your prescription." />
                <br />
                <span className="serif-accent">
                  <AnimatedHeading text="A simpler journey." />
                </span>
              </h1>
            </div>
            <Reveal className="hero-intro" delay={0.3}>
              <p>
                From a prescription in your hand to a pharmacy you can count on.
                A little less effort. A lot more clarity.
              </p>
              <Link className="button-dark" to="/register">
                Start your care journey{" "}
                <span>
                  <ArrowUpRight size={20} />
                </span>
              </Link>
            </Reveal>
          </div>
          <div className="hero-visual">
            <ParallaxImage
              src="/images/medilink-care.webp"
              alt="A pharmacist helping a patient in a bright, welcoming pharmacy"
              className="hero-photo"
            />
            <div className="hero-photo-shade" />
            <div className="hero-photo-caption">
              <span className="small-tag light-tag">CARE, CLOSER TO YOU</span>
              <p>
                Good care begins
                <br />
                with a connection.
              </p>
            </div>
            <Reveal className="prescription-float" delay={0.7}>
              <div className="float-icon">
                <ScanLine size={22} />
              </div>
              <div>
                <span className="eyebrow">A SMALLER TO-DO LIST</span>
                <strong>
                  One prescription.
                  <br />
                  More possibilities.
                </strong>
              </div>
              <span className="float-check">
                <Check size={16} />
              </span>
            </Reveal>
          </div>
          <div className="hero-bottom">
            <span>
              <ShieldCheck size={16} /> AI-assisted. Always reviewed by you.
            </span>
            <a href="#how-it-works">
              Explore the journey <ArrowDown size={16} />
            </a>
          </div>
        </section>
        <section id="how-it-works" className="journey-section section-wrap">
          <Reveal className="section-heading">
            <div>
              <span className="eyebrow">01 / A LITTLE SIMPLER</span>
              <h2><ShinyText>
                Less back and forth.
                <br />
                <span className="serif-accent">More moving forward.</span>
              </ShinyText></h2>
            </div>
            <p>
              Three thoughtful steps that bring your prescription, your
              pharmacy, and your peace of mind together.
            </p>
          </Reveal>
          <div className="journey-grid">
            {steps.map((step, i) => (
              <Reveal key={step.title} className="journey-card" delay={i * 0.1}>
                <div className="journey-top">
                  <span className="journey-icon">
                    <step.icon size={25} strokeWidth={1.4} />
                  </span>
                  <span className="step-number">0{i + 1}</span>
                </div>
                <h3><ShinyText>{step.title}</ShinyText></h3>
                <p>{step.text}</p>
                <span className="journey-line" />
              </Reveal>
            ))}
          </div>
        </section>
        <section id="our-platform" className="platform-section">
          <div className="section-wrap platform-grid">
            <Reveal>
              <span className="eyebrow">02 / THOUGHTFULLY CONNECTED</span>
              <h2><ShinyText>
                Technology that helps.
                <br />
                <span className="serif-accent">Care that feels human.</span>
              </ShinyText></h2>
              <p className="section-copy">
                Keep the important details together, so you can focus on what
                matters. MediLink supports the journey from reading your
                prescription to finding your pharmacy.
              </p>
              <Link className="text-link" to="/register">
                Meet your new care companion <ArrowUpRight size={19} />
              </Link>
            </Reveal>
            <div className="feature-stack">
              {[
                {
                  icon: ScanLine,
                  title: "A clearer prescription",
                  text: "AI-assisted reading turns your upload into editable medicine details. Review them before requesting quotes.",
                },
                {
                  icon: Store,
                  title: "The right pharmacy for you",
                  text: "Explore nearby pharmacies and compare the quotations they send, all from one place.",
                },
                {
                  icon: FileText,
                  title: "Everything, in one place",
                  text: "Your prescriptions, conversations, quotations, and order updates stay connected.",
                },
              ].map((feature, i) => (
                <Reveal
                  className="feature-row"
                  key={feature.title}
                  delay={i * 0.08}
                >
                  <span className="feature-icon">
                    <feature.icon strokeWidth={1.4} />
                  </span>
                  <div>
                    <h3><ShinyText>{feature.title}</ShinyText></h3>
                    <p>{feature.text}</p>
                  </div>
                  <ArrowUpRight size={18} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>
        <section id="for-pharmacies" className="section-wrap pharmacy-section">
          <ParallaxImage
            src="/images/medilink-pharmacy.webp"
            alt="A calm modern pharmacy with warm natural light and teal cabinetry"
            className="pharmacy-photo"
          />
          <Reveal className="pharmacy-content">
            <span className="eyebrow">
              03 / FOR THE PEOPLE BEHIND THE COUNTER
            </span>
            <h2><ShinyText>
              Your expertise.
              <br />
              <span className="serif-accent">A little more reach.</span>
            </ShinyText></h2>
            <p>
              Bring your pharmacy closer to your community. Receive prescription
              requests, prepare quotations, and keep your inventory organised in
              one workspace.
            </p>
            <Link to="/register?role=pharmacy" className="button-dark">
              Join as a pharmacy{" "}
              <span>
                <ArrowUpRight size={20} />
              </span>
            </Link>
            <span className="pharmacy-note">
              <ShieldCheck size={15} /> Pharmacy registration is subject to
              approval.
            </span>
          </Reveal>
        </section>
        <section className="section-wrap faq-section">
          <Reveal className="section-heading">
            <div>
              <span className="eyebrow">A FEW THINGS YOU MIGHT WONDER</span>
              <h2><ShinyText>
                A little more <span className="serif-accent">clarity.</span>
              </ShinyText></h2>
            </div>
          </Reveal>
          <div className="faq-grid">
            {[
              {
                q: "How do I get started?",
                a: "Create a patient account, upload a clear prescription image or PDF, and review the extracted medicine details before sending requests to pharmacies.",
              },
              {
                q: "Does AI replace a pharmacist?",
                a: "No. AI helps read the prescription. You should check the extracted details and confirm any uncertainty with a qualified pharmacist or your prescriber.",
              },
              {
                q: "Can I compare pharmacy quotations?",
                a: "Yes. After you send a request, participating pharmacies can respond with prices and availability for you to compare.",
              },
              {
                q: "Can my pharmacy join MediLink?",
                a: "Choose Pharmacy when registering, complete your business and location details, and submit your account for administrator approval.",
              },
            ].map((item) => (
              <details key={item.q}>
                <summary>
                  {item.q}
                  <span>+</span>
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="care-cta section-wrap">
          <Reveal>
            <span className="eyebrow">YOUR NEXT STEP STARTS HERE</span>
            <h2><ShinyText shineColor="#ffffff">
              A simpler way
              <br />
              <span className="serif-accent">to take care.</span>
            </ShinyText></h2>
            <Link to="/register" className="button-mint">
              Get started with MediLink <ArrowUpRight size={20} />
            </Link>
          </Reveal>
          <Sparkles
            className="cta-spark"
            strokeWidth={0.7}
            aria-hidden="true"
          />
        </section>
      </main>
      <footer className="site-footer section-wrap">
        <Brand />
        <p>Connecting prescriptions. Bringing care closer.</p>
        <a href="#main-content" className="text-link">
          Back to top <ArrowUpRight size={16} />
        </a>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} MediLink</span>
          <span>Built around people. Made for Sri Lanka.</span>
        </div>
      </footer>
    </div>
  );
}
