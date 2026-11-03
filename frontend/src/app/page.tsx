import { DeveloperSection } from "../components/marketing/DeveloperSection";
import { Footer } from "../components/marketing/Footer";
import { FutureVisionSection } from "../components/marketing/FutureVisionSection";
import { Hero } from "../components/marketing/Hero";
import { HowItWorksSection } from "../components/marketing/HowItWorksSection";
import { InteractiveDemoSection } from "../components/marketing/InteractiveDemoSection";
import { Nav } from "../components/marketing/Nav";
import { PermissionsSection } from "../components/marketing/PermissionsSection";
import { ProblemSection } from "../components/marketing/ProblemSection";
import { VerificationSection } from "../components/marketing/VerificationSection";

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-navy-950">
      <Nav />
      <Hero />
      <ProblemSection />
      <HowItWorksSection />
      <InteractiveDemoSection />
      <PermissionsSection />
      <VerificationSection />
      <DeveloperSection />
      <FutureVisionSection />
      <Footer />
    </div>
  );
}
