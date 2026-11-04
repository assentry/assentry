import { Footer } from "../../components/marketing/Footer";
import { HowItWorks } from "../../components/marketing/HowItWorks";
import { Nav } from "../../components/marketing/Nav";

export const metadata = { title: "How it works · Assentry" };

export default function HowItWorksPage() {
  return (
    <div className="relative min-h-screen bg-navy-950">
      <Nav />
      <HowItWorks />
      <Footer />
    </div>
  );
}
